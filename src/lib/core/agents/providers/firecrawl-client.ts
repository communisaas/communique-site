/**
 * Firecrawl API Client (v2)
 *
 * Wrapper around Firecrawl's Agent API v2 for autonomous website navigation
 * and data extraction. Used for discovering organization leadership and
 * decision-makers from corporate websites.
 *
 * Firecrawl Agent API v2:
 * - Autonomous navigation (no URLs needed, just objectives)
 * - Structured data extraction via schemas
 * - Async job-based architecture with polling
 * - Uses spark-1-mini or spark-1-pro models
 * - Avoids LinkedIn/Twitter (blocked by those sites)
 */

import type { LeaderDocument, PolicyPositionDocument, OrganizationContactsDocument } from '$lib/server/mongodb/schema';
import { validateOrganizationProfile, type ValidationResult, type FirecrawlOrganizationProfileValidated } from './firecrawl-schemas';
import { TIMEOUTS } from '$lib/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Organization profile extracted by Firecrawl Agent
 */
export interface FirecrawlOrganizationProfile {
	name: string;
	website?: string;
	about?: string;
	industry?: string;
	headquarters?: {
		city?: string;
		state?: string;
		country?: string;
	};
	employeeCount?: string;
	leadership: FirecrawlLeader[];
	policyPositions: FirecrawlPolicyPosition[];
	contacts: {
		general?: string;
		press?: string;
		stakeholder?: string;
		phone?: string;
	};
}

export interface FirecrawlLeader {
	name: string;
	title: string;
	email?: string;
	emailVerified: boolean; // true if found directly, false if inferred
	linkedin?: string;
	department?: string;
	sourceUrl?: string;
	responsibilities?: string;
}

export interface FirecrawlPolicyPosition {
	topic: string;
	stance: string;
	summary: string;
	sourceUrl?: string;
}

/**
 * Firecrawl Agent API v2 job start response
 * Returns { id, status } on success, not { success, jobId }
 */
interface AgentStartResponse {
	id: string;
	status: string;
	error?: string;
}

/**
 * Firecrawl Agent API v2 job status response
 * Returns { success, status, data, expiresAt, creditsUsed }
 */
interface AgentStatusResponse {
	success: boolean;
	status: 'processing' | 'completed' | 'failed';
	data?: unknown;
	expiresAt?: string;
	creditsUsed?: number;
	error?: string;
}

/**
 * Firecrawl Agent API response structure (resolved)
 */
interface FirecrawlAgentResponse<T> {
	success: boolean;
	data: T;
	jobId?: string;
	creditsUsed?: number;
	error?: string;
	/** Validation warnings (data usable but some fields failed validation) */
	warnings?: string[];
}

/**
 * Agent API request configuration (v2)
 */
interface AgentRequest {
	objective: string;
	schema?: unknown;
	startUrl?: string;
	/** Model to use: 'spark-1-mini' (faster) or 'spark-1-pro' (more capable) */
	model?: 'spark-1-mini' | 'spark-1-pro';
	/** Maximum credits to spend on this job */
	maxCredits?: number;
}

/**
 * Progress callback for job polling
 */
export type AgentProgressCallback = (status: string, elapsedMs: number) => void;

/**
 * Batch progress callback for tracking multiple organization discoveries
 */
export type BatchProgressCallback = (progress: {
	completed: number;
	total: number;
	currentOrg?: string;
	status: 'processing' | 'completed' | 'failed';
	results: Array<{
		organization: string;
		status: 'pending' | 'processing' | 'completed' | 'failed';
		error?: string;
	}>;
}) => void;

/**
 * Result of a batch discovery operation
 */
export interface BatchDiscoveryResult {
	/** Successfully discovered organizations */
	successful: Array<{
		organization: string;
		profile: FirecrawlOrganizationProfile;
		creditsUsed?: number;
	}>;
	/** Failed discovery attempts */
	failed: Array<{
		organization: string;
		error: string;
	}>;
	/** Total credits consumed across all jobs */
	totalCreditsUsed: number;
	/** Total time taken for batch operation */
	totalTimeMs: number;
}

// ============================================================================
// Firecrawl Client
// ============================================================================

export class FirecrawlClient {
	private apiKey: string;
	private baseUrl = 'https://api.firecrawl.dev/v2';

	/** Default polling configuration */
	private readonly DEFAULT_POLL_INTERVAL_MS = TIMEOUTS.FIRECRAWL_POLL;
	private readonly DEFAULT_MAX_WAIT_MS = TIMEOUTS.FIRECRAWL_MAX_WAIT;

	/** Batch processing configuration */
	private readonly DEFAULT_BATCH_CONCURRENCY = TIMEOUTS.FIRECRAWL_BATCH_CONCURRENCY;
	private readonly BATCH_RATE_LIMIT_DELAY_MS = TIMEOUTS.FIRECRAWL_BATCH;

	constructor(apiKey?: string) {
		this.apiKey = apiKey || process.env.FIRECRAWL_API_KEY || '';

		if (!this.apiKey) {
			console.warn('[firecrawl-client] No API key provided. Set FIRECRAWL_API_KEY environment variable.');
		}
	}

	/**
	 * Discover organization leadership and profile using Agent API v2
	 *
	 * @param organizationName - Name of the organization to research
	 * @param topics - Topics to focus leadership discovery on
	 * @param startUrl - Optional starting URL (otherwise agent searches)
	 * @param onProgress - Optional callback for progress updates during polling
	 */
	async discoverOrganization(
		organizationName: string,
		topics: string[],
		startUrl?: string,
		onProgress?: AgentProgressCallback
	): Promise<FirecrawlOrganizationProfile> {
		console.log('[firecrawl-client] Discovering organization:', {
			name: organizationName,
			topics,
			startUrl
		});

		const objective = this.buildDiscoveryObjective(organizationName, topics);

		try {
			// Use Agent API v2 for autonomous discovery (async job-based)
			const response = await this.agent<FirecrawlOrganizationProfile>({
				objective,
				startUrl,
				model: 'spark-1-mini', // Use faster model for discovery
				maxCredits: 50
			}, onProgress);

			if (!response.success || !response.data) {
				throw new Error(`Firecrawl discovery failed: ${response.error || 'Unknown error'}`);
			}

			console.log('[firecrawl-client] Discovery successful:', {
				name: response.data.name,
				leadershipFound: response.data.leadership.length,
				creditsUsed: response.creditsUsed
			});

			return response.data;
		} catch (error) {
			console.error('[firecrawl-client] Discovery error:', error);
			throw new Error(
				`Failed to discover organization: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Discover multiple organizations in parallel with controlled concurrency
	 *
	 * This method provides ~4x faster organization discovery by:
	 * 1. Running multiple Agent API jobs in parallel (default: 4 concurrent)
	 * 2. Using Promise.allSettled for error isolation (one failure doesn't break all)
	 * 3. Implementing rate limiting to avoid API throttling
	 * 4. Providing progress callbacks for UI feedback
	 *
	 * @param organizations - Array of organization names to research
	 * @param topics - Topics to focus leadership discovery on (shared across all orgs)
	 * @param options - Batch processing configuration
	 * @returns Results object with successful/failed discoveries and metrics
	 *
	 * @example
	 * ```typescript
	 * const result = await client.discoverOrganizationsBatch(
	 *   ['Microsoft', 'Google', 'Apple'],
	 *   ['sustainability', 'climate'],
	 *   {
	 *     concurrency: 4,
	 *     onProgress: (progress) => console.log(progress)
	 *   }
	 * );
	 * console.log(`Found ${result.successful.length} orgs, ${result.failed.length} failed`);
	 * ```
	 */
	async discoverOrganizationsBatch(
		organizations: string[],
		topics: string[],
		options?: {
			/** Number of parallel jobs to run (default: 4) */
			concurrency?: number;
			/** Optional starting URLs (indexed by org name) */
			startUrls?: Map<string, string>;
			/** Progress callback for UI updates */
			onProgress?: BatchProgressCallback;
			/** Rate limit delay between job starts in ms (default: 500ms) */
			rateLimitDelayMs?: number;
		}
	): Promise<BatchDiscoveryResult> {
		const startTime = Date.now();
		const concurrency = options?.concurrency || this.DEFAULT_BATCH_CONCURRENCY;
		const rateLimitDelay = options?.rateLimitDelayMs || this.BATCH_RATE_LIMIT_DELAY_MS;

		console.log('[firecrawl-client] Starting batch discovery:', {
			organizations: organizations.length,
			concurrency,
			topics
		});

		// Track progress state
		const progressState: BatchProgressCallback extends (progress: infer P) => void ? P : never = {
			completed: 0,
			total: organizations.length,
			status: 'processing',
			results: organizations.map(org => ({
				organization: org,
				status: 'pending'
			}))
		};

		// Helper to update progress
		const updateProgress = (
			org: string,
			status: 'pending' | 'processing' | 'completed' | 'failed',
			error?: string
		) => {
			const result = progressState.results.find(r => r.organization === org);
			if (result) {
				result.status = status;
				if (error) result.error = error;
			}

			if (status === 'completed' || status === 'failed') {
				progressState.completed++;
			}

			progressState.currentOrg = org;
			options?.onProgress?.(progressState);
		};

		// Process organizations in batches with controlled concurrency
		const results = await this.processBatchWithConcurrency(
			organizations,
			concurrency,
			rateLimitDelay,
			async (org) => {
				updateProgress(org, 'processing');

				try {
					const startUrl = options?.startUrls?.get(org);
					const profile = await this.discoverOrganization(org, topics, startUrl);

					updateProgress(org, 'completed');

					return {
						organization: org,
						profile,
						creditsUsed: 0, // We don't get this from discoverOrganization currently
						success: true as const
					};
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					updateProgress(org, 'failed', errorMsg);

					return {
						organization: org,
						error: errorMsg,
						success: false as const
					};
				}
			}
		);

		// Separate successful and failed results
		const successful = results
			.filter((r): r is Extract<typeof r, { success: true }> => r.success)
			.map(r => ({
				organization: r.organization,
				profile: r.profile,
				creditsUsed: r.creditsUsed
			}));

		const failed = results
			.filter((r): r is Extract<typeof r, { success: false }> => !r.success)
			.map(r => ({
				organization: r.organization,
				error: r.error
			}));

		const totalCreditsUsed = successful.reduce((sum, r) => sum + (r.creditsUsed || 0), 0);
		const totalTimeMs = Date.now() - startTime;

		// Final progress update
		progressState.status = 'completed';
		options?.onProgress?.(progressState);

		console.log('[firecrawl-client] Batch discovery complete:', {
			successful: successful.length,
			failed: failed.length,
			totalCreditsUsed,
			totalTimeMs,
			avgTimePerOrg: Math.round(totalTimeMs / organizations.length)
		});

		return {
			successful,
			failed,
			totalCreditsUsed,
			totalTimeMs
		};
	}

	/**
	 * Process items in batches with controlled concurrency and rate limiting
	 *
	 * This implements a semaphore-like pattern to limit concurrent operations
	 * while also introducing delays between job starts to avoid rate limits.
	 */
	private async processBatchWithConcurrency<T, R>(
		items: T[],
		concurrency: number,
		rateLimitDelayMs: number,
		processor: (item: T) => Promise<R>
	): Promise<R[]> {
		const results: R[] = [];
		const executing: Promise<void>[] = [];

		for (const item of items) {
			// Create a promise for this item's processing
			const promise = processor(item).then(result => {
				results.push(result);
			});

			// Add to executing pool
			executing.push(promise);

			// If we've reached concurrency limit, wait for one to finish
			if (executing.length >= concurrency) {
				await Promise.race(executing);
				// Remove completed promises
				executing.splice(0, executing.findIndex(p => p === promise) + 1);
			}

			// Rate limiting: delay between starting new jobs
			if (rateLimitDelayMs > 0 && items.indexOf(item) < items.length - 1) {
				await new Promise(resolve => setTimeout(resolve, rateLimitDelayMs));
			}
		}

		// Wait for all remaining promises
		await Promise.all(executing);

		return results;
	}

	/**
	 * Build discovery objective prompt for Firecrawl Agent
	 */
	private buildDiscoveryObjective(organizationName: string, topics: string[]): string {
		const topicsText = topics.length > 0
			? `with focus on: ${topics.join(', ')}`
			: '';

		return `
Research ${organizationName} ${topicsText} and extract the following information:

## Organization Overview
- Official name and common aliases
- Mission statement or company description
- Industry/sector classification
- Headquarters location (city, state, country)
- Approximate employee count

## Leadership Team
Find executives, board members, and department heads who would have decision-making authority over ${topics.join(', ') || 'major organizational decisions'}.

For EACH leader, extract:
- Full name (as it appears officially)
- Official title
- Email address (CRITICAL - search thoroughly in contact pages, team pages, press sections, investor relations)
- LinkedIn profile URL (if available)
- Department or area of responsibility
- Brief description of their role

### Email Discovery Strategy
Search these locations for email addresses:
1. Contact/About pages and website footer
2. Leadership/Team/Executive pages
3. Press/Media contact sections
4. Investor relations pages
5. Staff directory if available
6. Individual biography pages

If you find ANY email at the organization, note the pattern:
- john.doe@company.com → pattern: firstname.lastname@domain
- jdoe@company.com → pattern: firstinitiallastname@domain

Mark emails as "verified" (found directly on site) or "inferred" (pattern-based guess).

## Policy Positions
Any public statements, commitments, or positions related to: ${topics.join(', ') || 'key issues'}

For each position:
- Topic area
- Organization's stance (support/oppose/neutral)
- Brief summary of their position
- Source URL for verification

## Contact Information
- General inquiries email
- Press/media contact email
- Stakeholder relations contact
- Main phone number

## Output Quality Requirements
- Only include information you can verify from the website
- Include source URLs for all leadership entries
- If leadership is not found, return empty array (don't guess)
- Prioritize accuracy over completeness
`.trim();
	}

	/**
	 * Call Firecrawl Agent API v2 (async job-based)
	 *
	 * 1. Starts an agent job via POST /v2/agent
	 * 2. Polls job status via GET /v2/agent/{jobId}
	 * 3. Returns results when job completes
	 */
	private async agent<T>(
		request: AgentRequest,
		onProgress?: AgentProgressCallback
	): Promise<FirecrawlAgentResponse<T>> {
		if (!this.apiKey) {
			throw new Error('Firecrawl API key not configured');
		}

		// Step 1: Start the agent job
		const jobId = await this.startAgentJob(request);

		console.log('[firecrawl-client] Agent job started:', { jobId });

		// Step 2: Poll for completion
		const result = await this.pollAgentJob<T>(jobId, onProgress);

		return result;
	}

	/**
	 * Start an agent job via POST /v2/agent
	 */
	private async startAgentJob(request: AgentRequest): Promise<string> {
		const url = `${this.baseUrl}/agent`;

		// Build v2 API request body
		const body: Record<string, unknown> = {
			prompt: request.objective.slice(0, 10000), // Max 10,000 chars
			model: request.model || 'spark-1-mini'
		};

		// urls is optional and must be an array
		if (request.startUrl) {
			body.urls = [request.startUrl];
		}

		// Schema for structured output
		if (request.schema) {
			body.schema = request.schema;
		}

		// Optional spending limit
		if (request.maxCredits) {
			body.maxCredits = request.maxCredits;
		}

		console.log('[firecrawl-client] Starting Agent job...', {
			url,
			model: body.model,
			hasUrls: !!body.urls,
			hasSchema: !!body.schema,
			maxCredits: body.maxCredits
		});

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.apiKey}`
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unable to read error response');
			throw new Error(`Firecrawl API error (${response.status}): ${errorText}`);
		}

		const data: AgentStartResponse = await response.json();

		if (!data.id) {
			throw new Error(`Failed to start agent job: ${data.error || 'No job ID returned'}`);
		}

		return data.id;
	}

	/**
	 * Poll agent job status until completion or timeout
	 */
	private async pollAgentJob<T>(
		jobId: string,
		onProgress?: AgentProgressCallback,
		maxWaitMs: number = this.DEFAULT_MAX_WAIT_MS
	): Promise<FirecrawlAgentResponse<T>> {
		const startTime = Date.now();
		const pollInterval = this.DEFAULT_POLL_INTERVAL_MS;
		let pollCount = 0;

		while (Date.now() - startTime < maxWaitMs) {
			pollCount++;
			const elapsedMs = Date.now() - startTime;

			// Fetch job status
			const statusUrl = `${this.baseUrl}/agent/${jobId}`;
			const response = await fetch(statusUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`
				}
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unable to read error response');
				throw new Error(`Firecrawl status check failed (${response.status}): ${errorText}`);
			}

			const status: AgentStatusResponse = await response.json();

			console.log('[firecrawl-client] Job status:', {
				jobId,
				status: status.status,
				pollCount,
				elapsedMs
			});

			// Emit progress callback
			if (onProgress) {
				onProgress(status.status, elapsedMs);
			}

			// Check for terminal states
			if (status.status === 'completed') {
				// Validate organization profile responses with graceful degradation
				// This catches malformed API responses before they cause runtime errors
				const validation = validateOrganizationProfile(status.data);

				if (!validation.success) {
					console.error('[firecrawl-client] Validation failed:', validation.errors);

					// Check if we have partial recoverable data
					if (validation.partialData?.leadership?.length) {
						console.warn(
							'[firecrawl-client] Using partial recovery with',
							validation.partialData.leadership.length,
							'leaders'
						);
						return {
							success: true,
							data: validation.partialData as T,
							jobId,
							creditsUsed: status.creditsUsed,
							warnings: validation.warnings
						};
					}

					throw new Error(
						`Invalid organization profile from Firecrawl: ${validation.errors.join(', ')}`
					);
				}

				return {
					success: true,
					data: validation.data as T,
					jobId,
					creditsUsed: status.creditsUsed,
					warnings: validation.warnings.length > 0 ? validation.warnings : undefined
				};
			}

			if (status.status === 'failed') {
				throw new Error(`Agent job failed: ${status.error || 'Unknown error'}`);
			}

			// Still processing - wait before next poll
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		}

		// Timeout reached
		throw new Error(`Agent job timed out after ${maxWaitMs}ms (job ID: ${jobId})`);
	}

	/**
	 * Test API connectivity and authentication
	 */
	async testConnection(): Promise<boolean> {
		try {
			if (!this.apiKey) {
				return false;
			}

			// Simple health check - try to get account info
			// Note: Account endpoint may be on v1, but we test v2 agent availability
			const response = await fetch('https://api.firecrawl.dev/v1/account', {
				headers: {
					'Authorization': `Bearer ${this.apiKey}`
				}
			});

			return response.ok;
		} catch (error) {
			console.error('[firecrawl-client] Connection test failed:', error);
			return false;
		}
	}

	/**
	 * Get the current API version
	 */
	getApiVersion(): string {
		return 'v2';
	}
}

/**
 * Singleton Firecrawl client instance
 */
let firecrawlClient: FirecrawlClient | null = null;

export function getFirecrawlClient(): FirecrawlClient {
	if (!firecrawlClient) {
		firecrawlClient = new FirecrawlClient();
	}
	return firecrawlClient;
}
