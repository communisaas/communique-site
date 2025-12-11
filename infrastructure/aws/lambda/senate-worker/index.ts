/**
 * AWS Lambda Function: Senate CWC Worker
 *
 * Processes SQS FIFO messages for Senate CWC submissions
 * Integrates with existing Communique CWC client and infrastructure
 */

import type {
	SQSEvent,
	SQSRecord,
	SQSBatchResponse,
	SQSBatchItemFailure,
	Context
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Types from Communique codebase
interface Template {
	id: string;
	slug: string;
	title: string;
	description: string;
	category: string;
	type: string;
	deliveryMethod: 'email' | 'certified' | 'direct' | 'cwc';
	subject?: string | null;
	message_body: string;
	delivery_config: unknown;
	cwc_config?: unknown | null;
	recipient_config: unknown;
	metrics: Record<string, unknown>;
	campaign_id?: string | null;
	status: string;
	is_public: boolean;
	send_count: number;
	last_sent_at?: Date | string | null;
	applicable_countries: string[];
	jurisdiction_level?: string | null;
	specific_locations: string[];
}

interface CongressionalOffice {
	bioguideId: string;
	name: string;
	chamber: 'house' | 'senate';
	officeCode: string;
	state: string;
	district: string;
	party: string;
}

interface User {
	id: string;
	name: string;
	email: string;
	phone?: string;
	street?: string;
	city?: string;
	state?: string;
	zip?: string;
}

interface CWCSubmissionResult {
	success: boolean;
	messageId?: string;
	confirmationNumber?: string;
	status: 'submitted' | 'queued' | 'failed' | 'rejected';
	office: string;
	timestamp: string;
	error?: string;
	cwcResponse?: Record<string, unknown>;
}

interface SQSMessageBody {
	jobId: string;
	templateId: string;
	userId: string;
	template: Template;
	user: User;
	senator: CongressionalOffice;
	personalizedMessage: string;
	messageId: string; // Unique ID for this specific submission
	retryCount?: number;
}

interface RateLimitEntry {
	userId: string;
	action: string;
	timestamp: number;
	ttl: number;
}

interface JobStatusUpdate {
	jobId: string;
	messageId: string;
	status: 'processing' | 'submitted' | 'failed' | 'rate_limited';
	cwcResponse?: Record<string, unknown> | undefined;
	error?: string | undefined;
	timestamp: string;
}

// Environment configuration
const config = {
	cwcApiKey: process.env.CWC_API_KEY || '',
	cwcApiBaseUrl: process.env.CWC_API_BASE_URL || 'https://soapbox.senate.gov/api',
	dynamoTableName: process.env.DYNAMO_TABLE_NAME || 'communique-rate-limits',
	jobStatusApiUrl: process.env.JOB_STATUS_API_URL || '',
	lambdaWebhookSecret: process.env.LAMBDA_WEBHOOK_SECRET || '',
	maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
	rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '3600'), // 1 hour
	rateLimitCount: parseInt(process.env.RATE_LIMIT_COUNT || '10'), // 10 per hour
	visibilityTimeoutSeconds: parseInt(process.env.VISIBILITY_TIMEOUT_SECONDS || '300') // 5 minutes
};

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Lambda handler for processing SQS FIFO messages
 */
export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
	console.log('Lambda invocation started', {
		requestId: context.awsRequestId,
		messageCount: event.Records.length,
		timestamp: new Date().toISOString()
	});

	const batchItemFailures: SQSBatchItemFailure[] = [];

	// Process each SQS record
	for (const record of event.Records) {
		try {
			await processRecord(record, context.awsRequestId);
		} catch (error) {
			console.error('Failed to process record', {
				messageId: record.messageId,
				error: error instanceof Error ? error.message : 'Unknown error',
				requestId: context.awsRequestId
			});

			// Add to batch failures for partial retry
			batchItemFailures.push({
				itemIdentifier: record.messageId
			});
		}
	}

	console.log('Lambda invocation completed', {
		requestId: context.awsRequestId,
		totalMessages: event.Records.length,
		failedMessages: batchItemFailures.length,
		successfulMessages: event.Records.length - batchItemFailures.length
	});

	return {
		batchItemFailures
	};
};

/**
 * Process individual SQS record
 */
async function processRecord(record: SQSRecord, requestId: string): Promise<void> {
	let messageBody: SQSMessageBody;

	try {
		messageBody = JSON.parse(record.body);
	} catch (error) {
		console.error('Invalid JSON in SQS message', {
			messageId: record.messageId,
			body: record.body,
			requestId
		});
		throw new Error('Invalid JSON in message body');
	}

	console.log('Processing Senate submission', {
		jobId: messageBody.jobId,
		messageId: messageBody.messageId,
		senatorName: messageBody.senator.name,
		senatorState: messageBody.senator.state,
		userId: messageBody.userId,
		requestId
	});

	// Check rate limiting
	const rateLimitCheck = await checkRateLimit(messageBody.userId, 'senate_submission');
	if (!rateLimitCheck.allowed) {
		console.warn('Rate limit exceeded, extending visibility timeout', {
			userId: messageBody.userId,
			messageId: messageBody.messageId,
			requestId
		});

		// Update job status to rate_limited
		await updateJobStatus({
			jobId: messageBody.jobId,
			messageId: messageBody.messageId,
			status: 'rate_limited',
			error: 'Rate limit exceeded, message will be retried later',
			timestamp: new Date().toISOString()
		});

		// Throw error to return message to queue with visibility timeout
		throw new Error('Rate limit exceeded');
	}

	// Update job status to processing
	await updateJobStatus({
		jobId: messageBody.jobId,
		messageId: messageBody.messageId,
		status: 'processing',
		timestamp: new Date().toISOString()
	});

	try {
		// Perform CWC submission
		const result = await submitToSenate(messageBody);

		// Record rate limit usage on successful submission
		await recordRateLimitUsage(messageBody.userId, 'senate_submission');

		// Update job status with results
		await updateJobStatus({
			jobId: messageBody.jobId,
			messageId: messageBody.messageId,
			status: result.success ? 'submitted' : 'failed',
			cwcResponse: result.cwcResponse || undefined,
			error: result.error,
			timestamp: new Date().toISOString()
		});

		console.log('Senate submission completed', {
			jobId: messageBody.jobId,
			messageId: messageBody.messageId,
			success: result.success,
			status: result.status,
			cwcMessageId: result.messageId,
			requestId
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		console.error('Senate submission failed', {
			jobId: messageBody.jobId,
			messageId: messageBody.messageId,
			error: errorMessage,
			requestId
		});

		// Update job status to failed
		await updateJobStatus({
			jobId: messageBody.jobId,
			messageId: messageBody.messageId,
			status: 'failed',
			error: errorMessage,
			timestamp: new Date().toISOString()
		});

		// Determine if we should retry or send to DLQ
		const retryCount = messageBody.retryCount || 0;
		if (retryCount < config.maxRetries && isRetryableError(error)) {
			console.log('Retrying message', {
				messageId: messageBody.messageId,
				retryCount,
				maxRetries: config.maxRetries
			});
			throw error; // Will be retried by SQS
		} else {
			console.error('Message exceeded retry limit or non-retryable error', {
				messageId: messageBody.messageId,
				retryCount,
				maxRetries: config.maxRetries,
				error: errorMessage
			});
			throw error; // Will go to DLQ
		}
	}
}

/**
 * Submit message to Senate using existing CWC client logic
 */
async function submitToSenate(messageBody: SQSMessageBody): Promise<CWCSubmissionResult> {
	const { template, user, senator, personalizedMessage } = messageBody;

	if (senator.chamber !== 'senate') {
		throw new Error('This worker is only for Senate offices');
	}

	if (!config.cwcApiKey) {
		throw new Error('CWC_API_KEY not configured');
	}

	// Generate CWC XML using the same logic as the main application
	const cwcXml = await generateCWCXML(template, user, senator, personalizedMessage);

	// Validate XML before submission
	const validation = validateXML(cwcXml);
	if (!validation.valid) {
		return {
			success: false,
			status: 'failed',
			office: senator.name,
			timestamp: new Date().toISOString(),
			error: `XML validation failed: ${validation.errors.join(', ')}`
		};
	}

	// Submit to Senate CWC endpoint
	const endpoint = `${config.cwcApiBaseUrl}/testing-messages/?apikey=${config.cwcApiKey}`;

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/xml',
				'User-Agent': 'Communique-Lambda-Worker/1.0'
			},
			body: cwcXml
		});

		return await parseResponse(response, senator);
	} catch (error) {
		console.error('CWC API request failed', {
			endpoint,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		throw error;
	}
}

/**
 * Generate CWC XML (simplified version of CWCGenerator)
 */
async function generateCWCXML(
	template: Template,
	user: User,
	senator: CongressionalOffice,
	personalizedMessage: string
): Promise<string> {
	// This is a simplified version of the CWC XML generation
	// In production, you would import the actual CWCGenerator
	const timestamp = new Date().toISOString();

	return `<?xml version="1.0" encoding="UTF-8"?>
<CWC xmlns="http://www.house.gov/htbin/formproc_xml.cgi">
	<DeliveryAgent>
		<DeliveryAgentAcknowledgmentMessage>
			<Timestamp>${timestamp}</Timestamp>
			<CampaignId>${template.id}</CampaignId>
			<SenderName>${user.name}</SenderName>
			<SenderEmail>${user.email}</SenderEmail>
			<Subject>${template.subject || template.title}</Subject>
			<Message>${personalizedMessage}</Message>
			<Recipient>
				<MemberOffice>${senator.officeCode}</MemberOffice>
				<IsResponseRequested>Y</IsResponseRequested>
			</Recipient>
		</DeliveryAgentAcknowledgmentMessage>
	</DeliveryAgent>
</CWC>`;
}

/**
 * Simple XML validation
 */
function validateXML(xml: string): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Basic XML structure validation
	if (!xml.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
		errors.push('Missing XML declaration');
	}

	if (!xml.includes('<CWC xmlns=')) {
		errors.push('Missing CWC root element');
	}

	if (!xml.includes('<DeliveryAgent>')) {
		errors.push('Missing DeliveryAgent element');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Parse CWC API response
 */
async function parseResponse(
	response: Response,
	office: CongressionalOffice
): Promise<CWCSubmissionResult> {
	const timestamp = new Date().toISOString();
	const baseResult = {
		office: office.name,
		timestamp
	};

	try {
		if (!response.ok) {
			const errorText = await response.text();
			console.error(`CWC API error (${response.status}):`, errorText);

			return {
				...baseResult,
				success: false,
				status: 'failed' as const,
				error: `HTTP ${response.status}: ${errorText}`
			};
		}

		// Try to parse JSON response
		const contentType = response.headers.get('content-type');
		let cwcResponse: Record<string, unknown>;

		if (contentType?.includes('application/json')) {
			cwcResponse = (await response.json()) as Record<string, unknown>;
		} else {
			cwcResponse = { raw: await response.text() };
		}

		// Determine success based on response
		const success = response.status === 200 || response.status === 202;
		const messageId = (cwcResponse?.messageId || cwcResponse?.id || `CWC-${Date.now()}`) as string;
		const status = (cwcResponse?.status || (success ? 'submitted' : 'failed')) as string;

		return {
			...baseResult,
			success,
			status: status as CWCSubmissionResult['status'],
			messageId,
			cwcResponse
		};
	} catch (error) {
		console.error('Failed to parse CWC response', {
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		return {
			...baseResult,
			success: false,
			status: 'failed',
			error: 'Failed to parse CWC response'
		};
	}
}

/**
 * Check if user has exceeded rate limits
 */
async function checkRateLimit(
	userId: string,
	action: string
): Promise<{ allowed: boolean; remainingCount: number }> {
	// const key = `${userId}:${action}`;
	const currentTime = Math.floor(Date.now() / 1000);
	const windowStart = currentTime - config.rateLimitWindow;

	try {
		const response = await docClient.send(
			new GetCommand({
				TableName: config.dynamoTableName,
				Key: { userId, action }
			})
		);

		if (!response.Item) {
			// No existing rate limit entry
			return { allowed: true, remainingCount: config.rateLimitCount - 1 };
		}

		const item = response.Item as RateLimitEntry;

		// Check if the entry is within the current window
		if (item.timestamp < windowStart) {
			// Old entry, reset count
			return { allowed: true, remainingCount: config.rateLimitCount - 1 };
		}

		// Check current count
		const count = item.timestamp || 0;
		if (count >= config.rateLimitCount) {
			return { allowed: false, remainingCount: 0 };
		}

		return { allowed: true, remainingCount: config.rateLimitCount - count - 1 };
	} catch (error) {
		console.error('Rate limit check failed', {
			userId,
			action,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		// Allow on error to avoid blocking submissions
		return { allowed: true, remainingCount: config.rateLimitCount };
	}
}

/**
 * Record rate limit usage
 */
async function recordRateLimitUsage(userId: string, action: string): Promise<void> {
	const currentTime = Math.floor(Date.now() / 1000);
	const ttl = currentTime + config.rateLimitWindow;

	try {
		await docClient.send(
			new UpdateCommand({
				TableName: config.dynamoTableName,
				Key: { userId, action },
				UpdateExpression: 'ADD #count :inc SET #timestamp = :timestamp, #ttl = :ttl',
				ExpressionAttributeNames: {
					'#count': 'count',
					'#timestamp': 'timestamp',
					'#ttl': 'ttl'
				},
				ExpressionAttributeValues: {
					':inc': 1,
					':timestamp': currentTime,
					':ttl': ttl
				}
			})
		);
	} catch (error) {
		console.error('Failed to record rate limit usage', {
			userId,
			action,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		// Don't throw error, rate limiting is not critical for submission
	}
}

/**
 * Update job status via API
 */
async function updateJobStatus(update: JobStatusUpdate): Promise<void> {
	if (!config.jobStatusApiUrl || !config.lambdaWebhookSecret) {
		console.warn('Job status API not configured, skipping update');
		return;
	}

	try {
		const response = await fetch(`${config.jobStatusApiUrl}/api/cwc/jobs/${update.jobId}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-webhook-secret': config.lambdaWebhookSecret
			},
			body: JSON.stringify({
				status: update.status === 'submitted' ? 'completed' : update.status,
				submissionResults: [
					{
						messageId: update.messageId,
						status: update.status,
						cwcConfirmation: update.cwcResponse?.messageId || update.cwcResponse?.id,
						error: update.error
					}
				],
				completedAt:
					update.status === 'submitted' || update.status === 'failed' ? update.timestamp : undefined
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Job status update failed', {
				jobId: update.jobId,
				status: response.status,
				error: errorText
			});
		}
	} catch (error) {
		console.error('Job status update request failed', {
			jobId: update.jobId,
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;

	const errorMessage = error instanceof Error ? error.message : '';

	// Network errors
	if (
		errorMessage.includes('ECONNRESET') ||
		errorMessage.includes('ENOTFOUND') ||
		errorMessage.includes('ETIMEDOUT')
	) {
		return true;
	}

	// HTTP 5xx errors
	if (errorMessage.includes('HTTP 5')) {
		return true;
	}

	// Rate limiting (should be handled separately but can retry)
	if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
		return true;
	}

	// XML validation errors are not retryable
	if (errorMessage.includes('XML validation')) {
		return false;
	}

	// Invalid message format is not retryable
	if (errorMessage.includes('Invalid JSON')) {
		return false;
	}

	// Default to not retryable for safety
	return false;
}
