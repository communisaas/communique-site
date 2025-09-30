import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { handler } from '../index';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Mock GCP proxy client
jest.mock('../gcp-proxy-client', () => {
	return {
		GcpProxyClient: jest.fn().mockImplementation(() => ({
			submitToHouse: jest.fn(),
			healthCheck: jest.fn()
		}))
	};
});

// Mock circuit breaker
jest.mock('../circuit-breaker', () => {
	return {
		CircuitBreaker: jest.fn().mockImplementation(() => ({
			execute: jest.fn(),
			getState: jest.fn().mockReturnValue('CLOSED')
		}))
	};
});

// Mock global fetch
global.fetch = jest.fn();

const createMockSQSRecord = (body: unknown): SQSRecord => ({
	messageId: 'test-message-id',
	receiptHandle: 'test-receipt-handle',
	body: JSON.stringify(body),
	attributes: {
		ApproximateReceiveCount: '1',
		SentTimestamp: '1234567890000',
		SenderId: 'test-sender',
		ApproximateFirstReceiveTimestamp: '1234567890000'
	},
	messageAttributes: {},
	md5OfBody: 'test-md5',
	eventSource: 'aws:sqs',
	eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue.fifo',
	awsRegion: 'us-east-1'
});

const createMockContext = (): Context => ({
	callbackWaitsForEmptyEventLoop: false,
	functionName: 'house-cwc-worker',
	functionVersion: '1',
	invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:house-cwc-worker',
	memoryLimitInMB: '512',
	awsRequestId: 'test-request-id',
	logGroupName: '/aws/lambda/house-cwc-worker',
	logStreamName: '2024/01/01/[$LATEST]test-stream',
	getRemainingTimeInMillis: () => 30000,
	done: jest.fn(),
	fail: jest.fn(),
	succeed: jest.fn()
});

describe('House Worker Lambda Handler', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Setup environment variables
		process.env.RATE_LIMIT_TABLE = 'test-rate-limits';
		process.env.JOB_STATUS_API_URL = 'https://api.test.com/v1/cwc/jobs';
		process.env.GCP_PROXY_URL = 'https://test-proxy.com/submit';
		process.env.GCP_PROXY_AUTH_TOKEN = 'test-token';
		process.env.API_AUTH_TOKEN = 'test-api-token';
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	test('should process valid House CWC submission successfully', async () => {
		const validSubmission = {
			jobId: 'test-job-123',
			officeCode: 'CA01',
			recipientName: 'Rep. Test Person',
			recipientEmail: 'rep.test@house.gov',
			subject: 'Test Subject',
			message: 'Test message content',
			senderName: 'John Doe',
			senderEmail: 'john@example.com',
			senderAddress: '123 Main St, City, ST 12345',
			priority: 'normal' as const
		};

		const event: SQSEvent = {
			Records: [createMockSQSRecord(validSubmission)]
		};

		const context = createMockContext();

		// Mock successful responses
		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('{"success": true}')
		});

		const result = await handler(event, context, jest.fn());

		expect(result).toEqual({ batchItemFailures: [] });
		expect(fetch).toHaveBeenCalled();
	});

	test('should handle missing required fields', async () => {
		const invalidSubmission = {
			jobId: 'test-job-123',
			// Missing required fields
			subject: 'Test Subject'
		};

		const event: SQSEvent = {
			Records: [createMockSQSRecord(invalidSubmission)]
		};

		const context = createMockContext();

		const result = await handler(event, context, jest.fn());

		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: 'test-message-id' }]
		});
	});

	test('should handle multiple records with partial failures', async () => {
		const validSubmission = {
			jobId: 'test-job-123',
			officeCode: 'CA01',
			recipientName: 'Rep. Test Person',
			recipientEmail: 'rep.test@house.gov',
			subject: 'Test Subject',
			message: 'Test message content',
			senderName: 'John Doe',
			senderEmail: 'john@example.com',
			senderAddress: '123 Main St, City, ST 12345',
			priority: 'normal' as const
		};

		const invalidSubmission = {
			jobId: 'test-job-456'
			// Missing required fields
		};

		const event: SQSEvent = {
			Records: [
				createMockSQSRecord(validSubmission),
				{ ...createMockSQSRecord(invalidSubmission), messageId: 'test-message-id-2' }
			]
		};

		const context = createMockContext();

		// Mock successful response for first record
		(fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			text: () => Promise.resolve('{"success": true}')
		});

		const result = await handler(event, context, jest.fn());

		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: 'test-message-id-2' }]
		});
	});

	test('should handle GCP proxy failures', async () => {
		const validSubmission = {
			jobId: 'test-job-123',
			officeCode: 'CA01',
			recipientName: 'Rep. Test Person',
			recipientEmail: 'rep.test@house.gov',
			subject: 'Test Subject',
			message: 'Test message content',
			senderName: 'John Doe',
			senderEmail: 'john@example.com',
			senderAddress: '123 Main St, City, ST 12345',
			priority: 'normal' as const
		};

		const event: SQSEvent = {
			Records: [createMockSQSRecord(validSubmission)]
		};

		const context = createMockContext();

		// Mock failed response
		(fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

		const result = await handler(event, context, jest.fn());

		expect(result).toEqual({
			batchItemFailures: [{ itemIdentifier: 'test-message-id' }]
		});
	});

	test('should handle job status update failures gracefully', async () => {
		const validSubmission = {
			jobId: 'test-job-123',
			officeCode: 'CA01',
			recipientName: 'Rep. Test Person',
			recipientEmail: 'rep.test@house.gov',
			subject: 'Test Subject',
			message: 'Test message content',
			senderName: 'John Doe',
			senderEmail: 'john@example.com',
			senderAddress: '123 Main St, City, ST 12345',
			priority: 'normal' as const
		};

		const event: SQSEvent = {
			Records: [createMockSQSRecord(validSubmission)]
		};

		const context = createMockContext();

		// Mock job status API failure but GCP proxy success
		(fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				text: () => Promise.resolve('{"success": true}')
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});

		// Should not throw - job status updates are best effort
		const result = await handler(event, context, jest.fn());

		// The record should still fail because GCP proxy call will throw
		// when wrapped in circuit breaker execution
		expect(result.batchItemFailures).toHaveLength(1);
	});
});
