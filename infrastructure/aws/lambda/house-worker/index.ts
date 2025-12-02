import { SQSHandler, SQSRecord } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { GcpProxyClient } from './gcp-proxy-client';
import { CircuitBreaker } from './circuit-breaker';

// Environment variables
const {
	RATE_LIMIT_TABLE = 'cwc-rate-limits',
	JOB_STATUS_API_URL = 'https://api.communique.com/v1/cwc/jobs',
	GCP_PROXY_URL = 'https://your-gcp-proxy.com/submit',
	GCP_PROXY_AUTH_TOKEN = '',
	API_AUTH_TOKEN = '',
	AWS_REGION = 'us-east-1'
} = process.env;

// Configuration
const HOUSE_RATE_LIMIT_REQUESTS = 2;
const HOUSE_RATE_LIMIT_WINDOW_MINUTES = 1;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000; // 30 seconds

// AWS clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

// GCP proxy client with circuit breaker
const gcpProxyClient = new GcpProxyClient({
	baseUrl: GCP_PROXY_URL,
	authToken: GCP_PROXY_AUTH_TOKEN,
	timeout: 90000 // 90 seconds
});

const circuitBreaker = new CircuitBreaker({
	failureThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
	resetTimeout: CIRCUIT_BREAKER_RESET_TIMEOUT,
	onStateChange: (state: string) => {
		console.log(`Circuit breaker state changed to: ${state}`);
	}
});

interface HouseCwcSubmission {
	jobId: string;
	officeCode: string;
	recipientName: string;
	recipientEmail: string;
	subject: string;
	message: string;
	senderName: string;
	senderEmail: string;
	senderAddress: string;
	senderPhone?: string;
	priority: 'normal' | 'high';
	metadata?: Record<string, unknown>;
}

interface JobStatusUpdate {
	jobId: string;
	status: 'processing' | 'completed' | 'failed' | 'rate_limited';
	message?: string;
	timestamp: string;
	processingTimeMs?: number;
	retryCount?: number;
}

interface RateLimitRecord {
	pk: string; // office-{officeCode}
	requests: number;
	windowStart: number;
	ttl: number;
}

/**
 * Check if office has exceeded rate limit (2 requests/minute)
 */
async function checkRateLimit(
	officeCode: string
): Promise<{ allowed: boolean; remainingRequests: number }> {
	const now = Date.now();
	const windowStart =
		Math.floor(now / (HOUSE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000)) *
		(HOUSE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
	const pk = `office-${officeCode}`;

	try {
		const response = await dynamoClient.send(
			new GetCommand({
				TableName: RATE_LIMIT_TABLE,
				Key: { pk }
			})
		);

		const record = response.Item as RateLimitRecord | undefined;

		// If no record or different window, allow request
		if (!record || record.windowStart < windowStart) {
			// Create new rate limit record
			await dynamoClient.send(
				new PutCommand({
					TableName: RATE_LIMIT_TABLE,
					Item: {
						pk,
						requests: 1,
						windowStart,
						ttl:
							Math.floor((windowStart + HOUSE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000) / 1000) + 3600 // TTL 1 hour after window
					}
				})
			);

			return { allowed: true, remainingRequests: HOUSE_RATE_LIMIT_REQUESTS - 1 };
		}

		// Check if within rate limit
		if (record.requests >= HOUSE_RATE_LIMIT_REQUESTS) {
			return { allowed: false, remainingRequests: 0 };
		}

		// Increment request count
		await dynamoClient.send(
			new PutCommand({
				TableName: RATE_LIMIT_TABLE,
				Item: {
					...record,
					requests: record.requests + 1
				}
			})
		);

		return { allowed: true, remainingRequests: HOUSE_RATE_LIMIT_REQUESTS - record.requests - 1 };
	} catch (error) {
		console.error('Rate limit check failed:', error);
		// On error, allow request but log the issue
		return { allowed: true, remainingRequests: HOUSE_RATE_LIMIT_REQUESTS - 1 };
	}
}

/**
 * Update job status via API
 */
async function updateJobStatus(update: JobStatusUpdate): Promise<void> {
	try {
		const response = await fetch(`${JOB_STATUS_API_URL}/${update.jobId}/status`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${API_AUTH_TOKEN}`
			},
			body: JSON.stringify(update)
		});

		if (!response.ok) {
			throw new Error(`Job status update failed: ${response.status} ${response.statusText}`);
		}

		console.log(`Job status updated: ${update.jobId} -> ${update.status}`);
	} catch (error) {
		console.error('Failed to update job status:', error);
		// Don't throw - job status updates are best effort
	}
}

/**
 * Process a single House CWC submission
 */
async function processSubmission(submission: HouseCwcSubmission): Promise<void> {
	const startTime = Date.now();
	let retryCount = 0;

	console.log(
		`Processing House CWC submission for office ${submission.officeCode}, job ${submission.jobId}`
	);

	try {
		// Update job status to processing
		await updateJobStatus({
			jobId: submission.jobId,
			status: 'processing',
			timestamp: new Date().toISOString()
		});

		// Check rate limit for this office
		const rateLimitCheck = await checkRateLimit(submission.officeCode);

		if (!rateLimitCheck.allowed) {
			console.log(`Rate limit exceeded for office ${submission.officeCode}`);

			await updateJobStatus({
				jobId: submission.jobId,
				status: 'rate_limited',
				message: 'Office rate limit exceeded (2 requests/minute)',
				timestamp: new Date().toISOString(),
				processingTimeMs: Date.now() - startTime
			});

			// Throw error to trigger message retry after visibility timeout
			throw new Error('Rate limit exceeded');
		}

		console.log(
			`Rate limit check passed for office ${submission.officeCode}, remaining: ${rateLimitCheck.remainingRequests}`
		);

		// Submit through GCP proxy with circuit breaker protection
		const result = await circuitBreaker.execute(async () => {
			return await gcpProxyClient.submitToHouse(submission);
		});

		console.log(`Submission successful for job ${submission.jobId}:`, result);

		// Update job status to completed
		await updateJobStatus({
			jobId: submission.jobId,
			status: 'completed',
			message: result.message || 'Submission completed successfully',
			timestamp: new Date().toISOString(),
			processingTimeMs: Date.now() - startTime,
			retryCount
		});
	} catch (error) {
		const processingTimeMs = Date.now() - startTime;

		console.error(`Failed to process submission for job ${submission.jobId}:`, error);

		let status: JobStatusUpdate['status'] = 'failed';
		let message = 'Submission failed';

		if (error instanceof Error) {
			message = error.message;

			// Specific error handling
			if (message.includes('Rate limit exceeded')) {
				status = 'rate_limited';
			} else if (message.includes('Circuit breaker')) {
				message = 'GCP proxy temporarily unavailable';
			}
		}

		await updateJobStatus({
			jobId: submission.jobId,
			status,
			message,
			timestamp: new Date().toISOString(),
			processingTimeMs,
			retryCount
		});

		// Re-throw to trigger SQS retry mechanism
		throw error;
	}
}

/**
 * Parse SQS message body
 */
function parseMessageBody(record: SQSRecord): HouseCwcSubmission {
	try {
		const body = JSON.parse(record.body);

		// Validate required fields
		const required = [
			'jobId',
			'officeCode',
			'recipientName',
			'recipientEmail',
			'subject',
			'message',
			'senderName',
			'senderEmail',
			'senderAddress'
		];
		for (const field of required) {
			if (!body[field]) {
				throw new Error(`Missing required field: ${field}`);
			}
		}

		return body as HouseCwcSubmission;
	} catch (error) {
		console.error('Failed to parse message body:', record.body);
		throw new Error(
			`Invalid message format: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Main Lambda handler for processing House CWC submissions from SQS FIFO
 */
export const handler: SQSHandler = async (event) => {
	console.log(`Processing ${event.Records.length} House CWC submissions`);
	console.log('Circuit breaker state:', circuitBreaker.getState());

	const batchItemFailures: { itemIdentifier: string }[] = [];

	// Process records with proper error handling for partial batch failures
	for (const record of event.Records) {
		try {
			const submission = parseMessageBody(record);

			console.log(`Processing record ${record.messageId} for office ${submission.officeCode}`);

			await processSubmission(submission);

			console.log(`Successfully processed record ${record.messageId}`);
		} catch (error) {
			console.error(`Failed to process record ${record.messageId}:`, error);

			// Add to batch item failures for SQS retry
			batchItemFailures.push({
				itemIdentifier: record.messageId
			});

			// For rate limiting errors, we want to retry the message
			if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
				console.log(`Record ${record.messageId} will be retried due to rate limiting`);
			}
		}
	}

	// Log batch processing results
	const successCount = event.Records.length - batchItemFailures.length;
	const failureCount = batchItemFailures.length;

	console.log(`Batch processing completed: ${successCount} successful, ${failureCount} failed`);

	if (batchItemFailures.length > 0) {
		console.log(
			'Failed message IDs:',
			batchItemFailures.map((f) => f.itemIdentifier)
		);
	}

	// Return batch item failures for SQS partial batch failure handling
	return {
		batchItemFailures
	};
};
