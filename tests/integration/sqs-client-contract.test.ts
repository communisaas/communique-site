/**
 * SQS Client Contract Tests
 * 
 * Contract testing for AWS SQS integration ensuring:
 * - FIFO queue message ordering and deduplication
 * - Congressional submission payload validation
 * - Error handling and retry logic
 * - Message attributes and metadata
 * - Configuration validation
 * - AWS SDK v3 integration correctness
 * 
 * These tests verify the SQS client behaves correctly without requiring actual AWS infrastructure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SendMessageCommandInput } from '@aws-sdk/client-sqs';

// Mock AWS SDK
const mockSQSClient = vi.hoisted(() => ({
	send: vi.fn()
}));

const mockSendMessageCommand = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-sqs', () => ({
	SQSClient: vi.fn(() => mockSQSClient),
	SendMessageCommand: mockSendMessageCommand
}));

// Import after mocking
import { CWCSQSClient } from '../../src/lib/services/aws/sqs-client';
import type { Template } from '../../src/lib/types/template';
import type { CongressionalOffice } from '../../src/lib/core/congress/cwc-client';
import type { SQSUser } from '../../src/lib/services/aws/sqs-client';

describe('SQS Client Contract Tests', () => {
	let sqsClient: CWCSQSClient;
	let mockTemplate: Template;
	let mockUser: SQSUser;
	let mockSenator: CongressionalOffice;
	let mockRepresentative: CongressionalOffice;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock environment variables
		vi.stubEnv('AWS_REGION', 'us-east-1');
		vi.stubEnv('CWC_SENATE_QUEUE_URL', 'https://sqs.us-east-1.amazonaws.com/123456789/senate-submissions.fifo');
		vi.stubEnv('CWC_HOUSE_QUEUE_URL', 'https://sqs.us-east-1.amazonaws.com/123456789/house-submissions.fifo');
		vi.stubEnv('AWS_ACCESS_KEY_ID', 'AKIA123456789');
		vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secretkey123');

		sqsClient = new CWCSQSClient();

		// Mock successful SQS response
		mockSQSClient.send.mockResolvedValue({
			MessageId: 'msg-12345-abcde',
			MD5OfMessageBody: 'a1b2c3d4e5f6',
			SequenceNumber: '1000000000001'
		});

		// Test data fixtures
		mockTemplate = {
			id: 'template_123',
			slug: 'climate-action-letter',
			title: 'Climate Action Letter',
			message_body: 'Dear Representative, I urge you to support climate action legislation...',
			category: 'environmental',
			subject: 'Support for Climate Action Legislation'
		} as Template;

		mockUser = {
			id: 'user_456',
			name: 'Jane Citizen',
			email: 'jane@example.com',
			phone: '+1234567890',
			address: {
				zip4: '1234'
			}
		};

		mockSenator = {
			bioguideId: 'F000062',
			name: 'Dianne Feinstein',
			chamber: 'senate',
			officeCode: 'CA_SEN',
			district: '00',
			party: 'Democratic'
		};

		mockRepresentative = {
			bioguideId: 'P000197',
			name: 'Nancy Pelosi',
			chamber: 'house',
			officeCode: 'CA12',
			district: '12',
			party: 'Democratic'
		};
	});

	describe('Configuration Management', () => {
		it('should load configuration from environment variables', () => {
			const config = sqsClient.getConfiguration();

			expect(config.region).toBe('us-east-1');
			expect(config.senateQueueUrl).toBe('***CONFIGURED***');
			expect(config.houseQueueUrl).toBe('***CONFIGURED***');
			expect(config.credentialsConfigured).toBe(true);
		});

		it('should validate FIFO queue URLs', () => {
			vi.stubEnv('CWC_SENATE_QUEUE_URL', 'https://sqs.us-east-1.amazonaws.com/123456789/invalid-queue');
			vi.stubEnv('CWC_HOUSE_QUEUE_URL', 'https://sqs.us-east-1.amazonaws.com/123456789/another-invalid');

			const invalidClient = new CWCSQSClient();

			await expect(async () => {
				await invalidClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);
			}).rejects.toThrow('must reference a FIFO queue');
		});

		it('should handle missing environment variables gracefully', () => {
			vi.stubEnv('CWC_SENATE_QUEUE_URL', '');
			vi.stubEnv('CWC_HOUSE_QUEUE_URL', '');

			const unconfiguredClient = new CWCSQSClient();

			await expect(async () => {
				await unconfiguredClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);
			}).rejects.toThrow('CWC_SENATE_QUEUE_URL environment variable is required');
		});

		it('should use default AWS region when not specified', () => {
			vi.stubEnv('AWS_REGION', '');
			vi.stubEnv('AWS_DEFAULT_REGION', '');

			const defaultClient = new CWCSQSClient();
			const config = defaultClient.getConfiguration();

			expect(config.region).toBe('us-east-1');
		});
	});

	describe('Senate Queue Operations', () => {
		it('should send message to Senate FIFO queue with correct structure', async () => {
			const result = await sqsClient.sendToSenateQueue(
				mockTemplate,
				mockUser,
				mockSenator,
				'Personal note: This issue affects my community directly.',
				'high'
			);

			expect(result.success).toBe(true);
			expect(result.messageId).toBe('msg-12345-abcde');
			expect(result.sequenceNumber).toBe('1000000000001');

			// Verify SQS command was called with correct parameters
			expect(mockSendMessageCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/senate-submissions.fifo',
					MessageGroupId: 'senator-F000062',
					MessageDeduplicationId: expect.stringMatching(/^template_123-user_456-F000062-\d{8}$/),
					MessageAttributes: expect.objectContaining({
						messageType: { DataType: 'String', StringValue: 'cwc_submission' },
						chamber: { DataType: 'String', StringValue: 'senate' },
						priority: { DataType: 'String', StringValue: 'high' },
						templateId: { DataType: 'String', StringValue: 'template_123' },
						userId: { DataType: 'String', StringValue: 'user_456' },
						district: { DataType: 'String', StringValue: '00' }
					})
				})
			);

			expect(mockSQSClient.send).toHaveBeenCalledTimes(1);
		});

		it('should validate message payload structure for Senate queue', async () => {
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			const commandCall = mockSendMessageCommand.mock.calls[0][0] as SendMessageCommandInput;
			const messageBody = JSON.parse(commandCall.MessageBody!);

			// Verify complete message structure
			expect(messageBody).toMatchObject({
				messageType: 'cwc_submission',
				timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
				submissionId: expect.stringMatching(/^template_123-user_456-F000062-\d{8}$/),
				template: {
					id: 'template_123',
					slug: 'climate-action-letter',
					title: 'Climate Action Letter',
					messageBody: 'Dear Representative, I urge you to support climate action legislation...',
					category: 'environmental',
					subject: 'Support for Climate Action Legislation'
				},
				user: {
					id: 'user_456',
					name: 'Jane Citizen',
					email: 'jane@example.com',
					phone: '+1234567890',
					address: {
						zip4: '1234'
					}
				},
				office: {
					bioguideId: 'F000062',
					name: 'Dianne Feinstein',
					chamber: 'senate',
					officeCode: 'CA_SEN',
					district: '00',
					party: 'Democratic'
				},
				priority: 'normal',
				retryCount: 0
			});
		});

		it('should reject House representative for Senate queue', async () => {
			await expect(
				sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockRepresentative)
			).rejects.toThrow('Senator office required for Senate queue submission');

			expect(mockSQSClient.send).not.toHaveBeenCalled();
		});

		it('should handle Senate queue submission failures', async () => {
			mockSQSClient.send.mockRejectedValue(new Error('Queue temporarily unavailable'));

			const result = await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Queue temporarily unavailable');
			expect(result.timestamp).toBeDefined();
		});
	});

	describe('House Queue Operations', () => {
		it('should send message to House FIFO queue with correct structure', async () => {
			const result = await sqsClient.sendToHouseQueue(
				mockTemplate,
				mockUser,
				mockRepresentative,
				'Personal note: My district is particularly affected.',
				'normal'
			);

			expect(result.success).toBe(true);
			expect(result.messageId).toBe('msg-12345-abcde');

			// Verify House-specific queue and grouping
			expect(mockSendMessageCommand).toHaveBeenCalledWith(
				expect.objectContaining({
					QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/house-submissions.fifo',
					MessageGroupId: 'office-CA12',
					MessageDeduplicationId: expect.stringMatching(/^template_123-user_456-P000197-\d{8}$/),
					MessageAttributes: expect.objectContaining({
						chamber: { DataType: 'String', StringValue: 'house' }
					})
				})
			);
		});

		it('should validate message payload structure for House queue', async () => {
			await sqsClient.sendToHouseQueue(mockTemplate, mockUser, mockRepresentative);

			const commandCall = mockSendMessageCommand.mock.calls[0][0] as SendMessageCommandInput;
			const messageBody = JSON.parse(commandCall.MessageBody!);

			expect(messageBody.office).toMatchObject({
				bioguideId: 'P000197',
				name: 'Nancy Pelosi',
				chamber: 'house',
				officeCode: 'CA12',
				district: '12',
				party: 'Democratic'
			});
		});

		it('should reject Senator for House queue', async () => {
			await expect(
				sqsClient.sendToHouseQueue(mockTemplate, mockUser, mockSenator)
			).rejects.toThrow('Representative office required for House queue submission');

			expect(mockSQSClient.send).not.toHaveBeenCalled();
		});

		it('should handle House queue submission failures', async () => {
			mockSQSClient.send.mockRejectedValue(new Error('Access denied'));

			const result = await sqsClient.sendToHouseQueue(mockTemplate, mockUser, mockRepresentative);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Access denied');
		});
	});

	describe('Multi-Representative Operations', () => {
		it('should send to all representatives concurrently', async () => {
			const representatives = [mockSenator, mockRepresentative];

			const results = await sqsClient.sendToAllRepresentatives(
				mockTemplate,
				mockUser,
				representatives,
				'Personalized message for all',
				'high'
			);

			expect(results).toHaveLength(2);
			expect(results.every(r => r.success)).toBe(true);
			expect(mockSQSClient.send).toHaveBeenCalledTimes(2);

			// Verify both queues were used
			const calls = mockSendMessageCommand.mock.calls;
			const senateCall = calls.find(call => 
				call[0].QueueUrl.includes('senate-submissions.fifo')
			);
			const houseCall = calls.find(call => 
				call[0].QueueUrl.includes('house-submissions.fifo')
			);

			expect(senateCall).toBeDefined();
			expect(houseCall).toBeDefined();
		});

		it('should handle mixed success and failure scenarios', async () => {
			// Mock partial failure - Senate succeeds, House fails
			mockSQSClient.send
				.mockResolvedValueOnce({
					MessageId: 'senate-msg-123',
					MD5OfMessageBody: 'abc123',
					SequenceNumber: '1001'
				})
				.mockRejectedValueOnce(new Error('House queue overloaded'));

			const representatives = [mockSenator, mockRepresentative];
			const results = await sqsClient.sendToAllRepresentatives(mockTemplate, mockUser, representatives);

			expect(results).toHaveLength(2);
			expect(results[0].success).toBe(true);
			expect(results[0].messageId).toBe('senate-msg-123');
			expect(results[1].success).toBe(false);
			expect(results[1].error).toBe('House queue overloaded');
		});

		it('should handle complete failure gracefully', async () => {
			mockSQSClient.send.mockRejectedValue(new Error('AWS service unavailable'));

			const representatives = [mockSenator, mockRepresentative];
			const results = await sqsClient.sendToAllRepresentatives(mockTemplate, mockUser, representatives);

			expect(results).toHaveLength(2);
			expect(results.every(r => !r.success)).toBe(true);
			expect(results.every(r => r.error === 'AWS service unavailable')).toBe(true);
		});

		it('should handle empty representatives array', async () => {
			const results = await sqsClient.sendToAllRepresentatives(mockTemplate, mockUser, []);

			expect(results).toHaveLength(0);
			expect(mockSQSClient.send).not.toHaveBeenCalled();
		});
	});

	describe('FIFO Queue Features', () => {
		it('should generate unique deduplication IDs', async () => {
			// Send same message twice on same day
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			expect(mockSendMessageCommand).toHaveBeenCalledTimes(2);

			const firstCall = mockSendMessageCommand.mock.calls[0][0];
			const secondCall = mockSendMessageCommand.mock.calls[1][0];

			// Should have same deduplication ID (same template, user, office, day)
			expect(firstCall.MessageDeduplicationId).toBe(secondCall.MessageDeduplicationId);
		});

		it('should use appropriate message grouping for FIFO ordering', async () => {
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);
			await sqsClient.sendToHouseQueue(mockTemplate, mockUser, mockRepresentative);

			const senateCall = mockSendMessageCommand.mock.calls[0][0];
			const houseCall = mockSendMessageCommand.mock.calls[1][0];

			expect(senateCall.MessageGroupId).toBe('senator-F000062');
			expect(houseCall.MessageGroupId).toBe('office-CA12');
		});

		it('should include comprehensive message attributes for filtering', async () => {
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator, undefined, 'high');

			const call = mockSendMessageCommand.mock.calls[0][0];
			const attributes = call.MessageAttributes;

			expect(attributes).toMatchObject({
				messageType: { DataType: 'String', StringValue: 'cwc_submission' },
				chamber: { DataType: 'String', StringValue: 'senate' },
				priority: { DataType: 'String', StringValue: 'high' },
				templateId: { DataType: 'String', StringValue: 'template_123' },
				userId: { DataType: 'String', StringValue: 'user_456' },
				district: { DataType: 'String', StringValue: '00' }
			});
		});

		it('should handle message attributes correctly for House submissions', async () => {
			await sqsClient.sendToHouseQueue(mockTemplate, mockUser, mockRepresentative);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const attributes = call.MessageAttributes;

			expect(attributes.chamber.StringValue).toBe('house');
			expect(attributes.district.StringValue).toBe('12');
		});
	});

	describe('Message Payload Validation', () => {
		it('should include optional personalized message when provided', async () => {
			const personalMessage = 'This is my personal story about why this matters.';
			
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator, personalMessage);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.personalizedMessage).toBe(personalMessage);
		});

		it('should omit personalized message when not provided', async () => {
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.personalizedMessage).toBeUndefined();
		});

		it('should handle template without optional fields', async () => {
			const minimalTemplate = {
				id: 'minimal_template',
				slug: 'minimal',
				title: 'Minimal Template',
				message_body: 'Minimal message content'
			} as Template;

			await sqsClient.sendToSenateQueue(minimalTemplate, mockUser, mockSenator);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.template.category).toBeUndefined();
			expect(messageBody.template.subject).toBeUndefined();
		});

		it('should handle user without optional address fields', async () => {
			const minimalUser: SQSUser = {
				id: 'minimal_user',
				name: 'Minimal User',
				email: 'minimal@example.com'
			};

			await sqsClient.sendToSenateQueue(mockTemplate, minimalUser, mockSenator);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.user.phone).toBeUndefined();
			expect(messageBody.user.address).toBeUndefined();
		});

		it('should initialize retry count to zero', async () => {
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.retryCount).toBe(0);
		});
	});

	describe('Error Handling and Resilience', () => {
		it('should handle AWS SDK errors gracefully', async () => {
			mockSQSClient.send.mockRejectedValue(new Error('InvalidParameterValue'));

			const result = await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			expect(result.success).toBe(false);
			expect(result.error).toBe('InvalidParameterValue');
			expect(result.messageId).toBeUndefined();
		});

		it('should handle non-Error rejections', async () => {
			mockSQSClient.send.mockRejectedValue('Unexpected string error');

			const result = await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Unknown SQS error occurred');
		});

		it('should provide structured error information', async () => {
			const awsError = new Error('The specified queue does not exist');
			awsError.name = 'QueueDoesNotExist';
			mockSQSClient.send.mockRejectedValue(awsError);

			const result = await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			expect(result.success).toBe(false);
			expect(result.error).toBe('The specified queue does not exist');
			expect(result.timestamp).toBeDefined();
		});

		it('should handle promise rejection in multi-representative submissions', async () => {
			const representatives = [mockSenator, mockRepresentative];

			// Mock first call to succeed, second to throw synchronously
			mockSQSClient.send
				.mockResolvedValueOnce({ MessageId: 'success-msg' })
				.mockImplementation(() => {
					throw new Error('Synchronous error');
				});

			const results = await sqsClient.sendToAllRepresentatives(mockTemplate, mockUser, representatives);

			expect(results).toHaveLength(2);
			expect(results[0].success).toBe(true);
			expect(results[1].success).toBe(false);
			expect(results[1].error).toContain('Synchronous error');
		});
	});

	describe('Connection Testing', () => {
		it('should test connection with valid configuration', async () => {
			const connectionTest = await sqsClient.testConnection();

			expect(connectionTest.connected).toBe(true);
			expect(connectionTest.senateQueue).toBe(true);
			expect(connectionTest.houseQueue).toBe(true);
			expect(connectionTest.error).toBeUndefined();
		});

		it('should detect missing queue configuration', async () => {
			vi.stubEnv('CWC_SENATE_QUEUE_URL', '');
			
			const unconfiguredClient = new CWCSQSClient();
			const connectionTest = await unconfiguredClient.testConnection();

			expect(connectionTest.connected).toBe(false);
			expect(connectionTest.senateQueue).toBe(false);
			expect(connectionTest.houseQueue).toBe(true);
		});

		it('should handle connection test errors', async () => {
			// Mock an error in connection testing logic
			const errorClient = new CWCSQSClient();
			
			// Force an error by temporarily modifying client state
			vi.spyOn(errorClient as any, 'config', 'get').mockImplementation(() => {
				throw new Error('Configuration access error');
			});

			const connectionTest = await errorClient.testConnection();

			expect(connectionTest.connected).toBe(false);
			expect(connectionTest.error).toBe('Configuration access error');
		});
	});

	describe('AWS SDK Integration', () => {
		it('should configure SQS client with correct parameters', () => {
			// Verify AWS SQS client was instantiated with correct configuration
			const { SQSClient } = require('@aws-sdk/client-sqs');
			
			expect(SQSClient).toHaveBeenCalledWith({
				region: 'us-east-1',
				credentials: {
					accessKeyId: 'AKIA123456789',
					secretAccessKey: 'secretkey123',
					sessionToken: undefined
				},
				maxAttempts: 3
			});
		});

		it('should handle AWS credentials correctly', () => {
			vi.stubEnv('AWS_ACCESS_KEY_ID', '');
			vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');

			const credentiallessClient = new CWCSQSClient();
			const config = credentiallessClient.getConfiguration();

			expect(config.credentialsConfigured).toBe(false);
		});

		it('should use session token when provided', () => {
			vi.stubEnv('AWS_SESSION_TOKEN', 'session-token-123');

			new CWCSQSClient();

			const { SQSClient } = require('@aws-sdk/client-sqs');
			const lastCall = SQSClient.mock.calls[SQSClient.mock.calls.length - 1][0];

			expect(lastCall.credentials.sessionToken).toBe('session-token-123');
		});
	});

	describe('Date and ID Generation', () => {
		it('should generate submission IDs with current date', async () => {
			const mockDate = new Date('2024-03-15T10:30:00Z');
			vi.setSystemTime(mockDate);

			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			const call = mockSendMessageCommand.mock.calls[0][0];
			expect(call.MessageDeduplicationId).toBe('template_123-user_456-F000062-20240315');

			vi.useRealTimers();
		});

		it('should include timestamp in message payload', async () => {
			const mockDate = new Date('2024-03-15T10:30:00Z');
			vi.setSystemTime(mockDate);

			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.timestamp).toBe('2024-03-15T10:30:00.000Z');

			vi.useRealTimers();
		});
	});

	describe('Priority Handling', () => {
		it('should default to normal priority', async () => {
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator);

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.priority).toBe('normal');
			expect(call.MessageAttributes.priority.StringValue).toBe('normal');
		});

		it('should accept high priority setting', async () => {
			await sqsClient.sendToSenateQueue(mockTemplate, mockUser, mockSenator, undefined, 'high');

			const call = mockSendMessageCommand.mock.calls[0][0];
			const messageBody = JSON.parse(call.MessageBody!);

			expect(messageBody.priority).toBe('high');
			expect(call.MessageAttributes.priority.StringValue).toBe('high');
		});
	});
});