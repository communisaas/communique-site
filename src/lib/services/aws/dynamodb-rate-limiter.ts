/**
 * DynamoDB Rate Limiting Service for CWC Integration
 *
 * Implements distributed rate limiting using DynamoDB conditional writes
 * with token bucket algorithm for different Congressional chambers and offices.
 *
 * Rate Limits:
 * - Global: 60 requests/minute total across all chambers
 * - Senate: 30 requests/minute for all Senate offices combined
 * - House Global: 20 requests/minute for all House offices combined
 * - House Per-Office: 2 requests/minute per individual House office
 * - Idempotency: Track submissions for 24 hours to prevent duplicates
 *
 * NOTE: Requires @aws-sdk/client-dynamodb dependency to be added to package.json
 */

import {
	DynamoDBClient,
	PutItemCommand,
	GetItemCommand,
	TransactWriteItemsCommand,
	ConditionalCheckFailedException
} from '@aws-sdk/client-dynamodb';
import { createApiError } from '$lib/types/errors';

// Chamber types for rate limiting
export type Chamber = 'senate' | 'house';

// Rate limit configuration
export interface RateLimitConfig {
	readonly global: {
		readonly maxTokens: number;
		readonly refillRate: number; // tokens per minute
		readonly windowSizeMs: number;
	};
	readonly senate: {
		readonly maxTokens: number;
		readonly refillRate: number;
		readonly windowSizeMs: number;
	};
	readonly houseGlobal: {
		readonly maxTokens: number;
		readonly refillRate: number;
		readonly windowSizeMs: number;
	};
	readonly housePerOffice: {
		readonly maxTokens: number;
		readonly refillRate: number;
		readonly windowSizeMs: number;
	};
}

// Default rate limit configuration
export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
	global: {
		maxTokens: 60,
		refillRate: 60, // 60 tokens per minute
		windowSizeMs: 60 * 1000 // 1 minute
	},
	senate: {
		maxTokens: 30,
		refillRate: 30, // 30 tokens per minute
		windowSizeMs: 60 * 1000 // 1 minute
	},
	houseGlobal: {
		maxTokens: 20,
		refillRate: 20, // 20 tokens per minute
		windowSizeMs: 60 * 1000 // 1 minute
	},
	housePerOffice: {
		maxTokens: 2,
		refillRate: 2, // 2 tokens per minute
		windowSizeMs: 60 * 1000 // 1 minute
	}
} as const;

// Environment configuration
export interface DynamoDBRateLimiterConfig {
	readonly rateLimitTableName: string;
	readonly idempotencyTableName: string;
	readonly region: string;
	readonly endpoint?: string; // For local development
}

// Rate limit bucket state
export interface RateLimitBucket {
	readonly tokens: number;
	readonly lastRefill: number;
	readonly maxTokens: number;
	readonly refillRate: number;
}

// Rate limit check result
export interface RateLimitResult {
	readonly allowed: boolean;
	readonly tokensRemaining: number;
	readonly resetAt: number;
	readonly retryAfterMs?: number;
}

// Idempotency check result
export interface IdempotencyResult {
	readonly isDuplicate: boolean;
	readonly originalMessageId?: string;
	readonly originalSubmissionTime?: number;
}

// Idempotency key components
export interface IdempotencyKey {
	readonly templateId: string;
	readonly recipientOfficeId: string;
	readonly userId: string;
	readonly date: string; // YYYY-MM-DD format
}

// Rate limit error details
export interface RateLimitErrorDetails {
	readonly chamber: Chamber;
	readonly officeId?: string;
	readonly tokensRemaining: number;
	readonly resetAt: number;
	readonly retryAfterMs: number;
}

/**
 * DynamoDB-based distributed rate limiter with token bucket algorithm
 */
export class DynamoDBRateLimiter {
	private readonly client: DynamoDBClient;
	private readonly config: DynamoDBRateLimiterConfig;
	private readonly rateLimits: RateLimitConfig;

	constructor(
		config: DynamoDBRateLimiterConfig,
		rateLimits: RateLimitConfig = DEFAULT_RATE_LIMITS
	) {
		this.config = config;
		this.rateLimits = rateLimits;

		this.client = new DynamoDBClient({
			region: config.region,
			...(config.endpoint && { endpoint: config.endpoint })
		});
	}

	/**
	 * Check rate limits for a CWC message submission
	 */
	async checkRateLimit(
		chamber: Chamber,
		officeId: string,
		userId: string
	): Promise<RateLimitResult> {
		const now = Date.now();

		try {
			// Check all applicable rate limits
			const checks = await Promise.all([
				this.checkBucketRateLimit('global', 'global', now),
				this.checkBucketRateLimit(chamber, chamber, now),
				...(chamber === 'house' ? [this.checkBucketRateLimit('house-office', officeId, now)] : [])
			]);

			// Find the most restrictive limit
			const restrictiveCheck = checks.find((check) => !check.allowed);

			if (restrictiveCheck) {
				return restrictiveCheck;
			}

			// All checks passed - consume tokens
			await this.consumeTokens(chamber, officeId, now);

			return {
				allowed: true,
				tokensRemaining: Math.min(...checks.map((c) => c.tokensRemaining)),
				resetAt: Math.max(...checks.map((c) => c.resetAt))
			};
		} catch (error) {
			console.error('Rate limit check failed:', error);

			// In case of DynamoDB errors, allow the request but log the issue
			// This prevents DynamoDB issues from blocking all CWC submissions
			return {
				allowed: true,
				tokensRemaining: 1,
				resetAt: now + 60000 // 1 minute from now
			};
		}
	}

	/**
	 * Check for duplicate submissions using idempotency key
	 */
	async checkIdempotency(key: IdempotencyKey): Promise<IdempotencyResult> {
		const idempotencyKey = this.buildIdempotencyKey(key);

		try {
			const command = new GetItemCommand({
				TableName: this.config.idempotencyTableName,
				Key: {
					PK: { S: idempotencyKey }
				}
			});

			const result = await this.client.send(command);

			if (result.Item) {
				return {
					isDuplicate: true,
					originalMessageId: result.Item.messageId?.S,
					originalSubmissionTime: result.Item.submittedAt?.N
						? parseInt(result.Item.submittedAt.N)
						: undefined
				};
			}

			return { isDuplicate: false };
		} catch (error) {
			console.error('Idempotency check failed:', error);

			// In case of errors, assume not duplicate to avoid blocking submissions
			return { isDuplicate: false };
		}
	}

	/**
	 * Record a successful message submission for idempotency tracking
	 */
	async recordSubmission(key: IdempotencyKey, messageId: string): Promise<void> {
		const idempotencyKey = this.buildIdempotencyKey(key);
		const now = Date.now();
		const ttl = Math.floor((now + 24 * 60 * 60 * 1000) / 1000); // 24 hours from now

		try {
			const command = new PutItemCommand({
				TableName: this.config.idempotencyTableName,
				Item: {
					PK: { S: idempotencyKey },
					messageId: { S: messageId },
					submittedAt: { N: now.toString() },
					TTL: { N: ttl.toString() }
				},
				// Only create if doesn't exist (prevents race conditions)
				ConditionExpression: 'attribute_not_exists(PK)'
			});

			await this.client.send(command);
		} catch (error) {
			if (!(error instanceof ConditionalCheckFailedException)) {
				console.error('Failed to record submission:', error);
			}
			// ConditionalCheckFailedException means duplicate, which is expected
		}
	}

	/**
	 * Check rate limit for a specific bucket
	 */
	private async checkBucketRateLimit(
		bucketType: string,
		bucketId: string,
		now: number
	): Promise<RateLimitResult> {
		const config = this.getBucketConfig(bucketType);
		const partitionKey = `rate#${bucketType}#${bucketId}`;
		const windowStart = Math.floor(now / config.windowSizeMs) * config.windowSizeMs;
		const sortKey = `window#${windowStart}`;

		try {
			const command = new GetItemCommand({
				TableName: this.config.rateLimitTableName,
				Key: {
					PK: { S: partitionKey },
					SK: { S: sortKey }
				}
			});

			const result = await this.client.send(command);
			let bucket: RateLimitBucket;

			if (result.Item) {
				bucket = {
					tokens: parseInt(result.Item.tokens?.N || '0'),
					lastRefill: parseInt(result.Item.lastRefill?.N || now.toString()),
					maxTokens: config.maxTokens,
					refillRate: config.refillRate
				};
			} else {
				// New bucket - start with full tokens
				bucket = {
					tokens: config.maxTokens,
					lastRefill: now,
					maxTokens: config.maxTokens,
					refillRate: config.refillRate
				};
			}

			// Refill tokens based on time elapsed
			const refillableBucket = this.refillTokens(bucket, now, config);

			const allowed = refillableBucket.tokens >= 1;
			const resetAt = windowStart + config.windowSizeMs;

			return {
				allowed,
				tokensRemaining: Math.max(0, refillableBucket.tokens - (allowed ? 1 : 0)),
				resetAt,
				...(allowed
					? {}
					: {
							retryAfterMs: Math.max(0, resetAt - now)
						})
			};
		} catch (error) {
			console.error(`Rate limit check failed for ${bucketType}:${bucketId}:`, error);
			throw error;
		}
	}

	/**
	 * Consume tokens from all applicable buckets atomically
	 */
	private async consumeTokens(chamber: Chamber, officeId: string, now: number): Promise<void> {
		const windowStart =
			Math.floor(now / this.rateLimits.global.windowSizeMs) * this.rateLimits.global.windowSizeMs;
		const ttl = Math.floor((windowStart + 2 * this.rateLimits.global.windowSizeMs) / 1000);

		const transactItems = [
			// Global bucket
			this.buildConsumeTokenItem('global', 'global', windowStart, ttl, this.rateLimits.global, now),
			// Chamber bucket
			this.buildConsumeTokenItem(
				chamber,
				chamber,
				windowStart,
				ttl,
				this.getChamberConfig(chamber),
				now
			)
		];

		// Add house per-office bucket if applicable
		if (chamber === 'house') {
			transactItems.push(
				this.buildConsumeTokenItem(
					'house-office',
					officeId,
					windowStart,
					ttl,
					this.rateLimits.housePerOffice,
					now
				)
			);
		}

		try {
			const command = new TransactWriteItemsCommand({
				TransactItems: transactItems
			});

			await this.client.send(command);
		} catch (error) {
			console.error('Failed to consume tokens:', error);
			throw error;
		}
	}

	/**
	 * Build a transaction item for consuming tokens
	 */
	private buildConsumeTokenItem(
		bucketType: string,
		bucketId: string,
		windowStart: number,
		ttl: number,
		config: { maxTokens: number; refillRate: number; windowSizeMs: number },
		now: number
	) {
		const partitionKey = `rate#${bucketType}#${bucketId}`;
		const sortKey = `window#${windowStart}`;

		return {
			Update: {
				TableName: this.config.rateLimitTableName,
				Key: {
					PK: { S: partitionKey },
					SK: { S: sortKey }
				},
				UpdateExpression:
					'SET tokens = if_not_exists(tokens, :maxTokens) - :consumeAmount, lastRefill = :now, resetAt = :resetAt, TTL = :ttl',
				ExpressionAttributeValues: {
					':consumeAmount': { N: '1' },
					':maxTokens': { N: config.maxTokens.toString() },
					':now': { N: now.toString() },
					':resetAt': { N: (windowStart + config.windowSizeMs).toString() },
					':ttl': { N: ttl.toString() }
				},
				ConditionExpression: 'if_not_exists(tokens, :maxTokens) >= :consumeAmount'
			}
		};
	}

	/**
	 * Refill tokens in bucket based on elapsed time
	 */
	private refillTokens(
		bucket: RateLimitBucket,
		now: number,
		config: { maxTokens: number; refillRate: number; windowSizeMs: number }
	): RateLimitBucket {
		const timeSinceLastRefill = now - bucket.lastRefill;
		const tokensToAdd = Math.floor((timeSinceLastRefill / config.windowSizeMs) * config.refillRate);

		return {
			...bucket,
			tokens: Math.min(config.maxTokens, bucket.tokens + tokensToAdd),
			lastRefill: now
		};
	}

	/**
	 * Get bucket configuration by type
	 */
	private getBucketConfig(bucketType: string) {
		switch (bucketType) {
			case 'global':
				return this.rateLimits.global;
			case 'senate':
				return this.rateLimits.senate;
			case 'house':
				return this.rateLimits.houseGlobal;
			case 'house-office':
				return this.rateLimits.housePerOffice;
			default:
				throw new Error(`Unknown bucket type: ${bucketType}`);
		}
	}

	/**
	 * Get chamber-specific configuration
	 */
	private getChamberConfig(chamber: Chamber) {
		return chamber === 'senate' ? this.rateLimits.senate : this.rateLimits.houseGlobal;
	}

	/**
	 * Build idempotency key from components
	 */
	private buildIdempotencyKey(key: IdempotencyKey): string {
		return `idem#${key.templateId}#${key.recipientOfficeId}#${key.userId}#${key.date}`;
	}
}

/**
 * Utility function to extract chamber from office ID
 */
export function extractChamber(officeId: string): Chamber {
	// Convention: Senate offices typically start with 'S' or contain 'senate'
	// House offices typically start with 'H' or contain 'house'
	const lowerOfficeId = officeId.toLowerCase();

	if (lowerOfficeId.startsWith('s') || lowerOfficeId.includes('senate')) {
		return 'senate';
	}

	return 'house'; // Default to house
}

/**
 * Create rate limit error with detailed information
 */
export function createRateLimitError(
	chamber: Chamber,
	result: RateLimitResult,
	officeId?: string
): Error {
	const details: RateLimitErrorDetails = {
		chamber,
		officeId,
		tokensRemaining: result.tokensRemaining,
		resetAt: result.resetAt,
		retryAfterMs: result.retryAfterMs || 0
	};

	const apiError = createApiError(
		'server',
		'SERVER_RATE_LIMIT',
		`Rate limit exceeded for ${chamber}${officeId ? ` office ${officeId}` : ''}. Try again in ${Math.ceil(details.retryAfterMs / 1000)} seconds.`,
		undefined,
		details
	);

	return new Error(apiError.message);
}

/**
 * Configuration helper for different environments
 */
export function createRateLimiterConfig(
	environment: 'development' | 'staging' | 'production'
): DynamoDBRateLimiterConfig {
	const tablePrefix = environment === 'production' ? 'prod' : environment;

	return {
		rateLimitTableName: `${tablePrefix}-communique-rate-limits`,
		idempotencyTableName: `${tablePrefix}-communique-idempotency`,
		region: process.env.AWS_REGION || 'us-east-1',
		...(environment === 'development' && {
			endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
		})
	};
}

/**
 * Create rate limiter instance with environment-based configuration
 */
export function createRateLimiter(
	environment: 'development' | 'staging' | 'production' = 'development',
	customRateLimits?: Partial<RateLimitConfig>
): DynamoDBRateLimiter {
	const config = createRateLimiterConfig(environment);
	const rateLimits = customRateLimits
		? { ...DEFAULT_RATE_LIMITS, ...customRateLimits }
		: DEFAULT_RATE_LIMITS;

	return new DynamoDBRateLimiter(config, rateLimits);
}

/**
 * Type guard for rate limit result
 */
export function isRateLimitResult(value: unknown): value is RateLimitResult {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as RateLimitResult).allowed === 'boolean' &&
		typeof (value as RateLimitResult).tokensRemaining === 'number' &&
		typeof (value as RateLimitResult).resetAt === 'number'
	);
}

/**
 * Type guard for idempotency result
 */
export function isIdempotencyResult(value: unknown): value is IdempotencyResult {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as IdempotencyResult).isDuplicate === 'boolean'
	);
}
