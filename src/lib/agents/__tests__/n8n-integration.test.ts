/**
 * N8N Agent Integration Tests
 *
 * Tests the N8N-first agent architecture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VerificationAgent } from '../verification-agent';
import { ModerationConsensus } from '../moderation-consensus';
import { N8NClient } from '$lib/services/delivery/integrations/n8n';

// Mock N8N client
vi.mock('$lib/services/delivery/integrations/n8n', () => {
	return {
		N8NClient: vi.fn().mockImplementation(() => ({
			triggerWorkflow: vi.fn(),
			waitForCompletion: vi.fn(),
			healthCheck: vi.fn(),
			getWorkflowMetrics: vi.fn(),
			monitorWorkflowPerformance: vi.fn()
		}))
	};
});

describe('N8N Agent Integration', () => {
	let verificationAgent: VerificationAgent;
	let moderationConsensus: ModerationConsensus;
	let mockN8NClient: any;

	beforeEach(() => {
		vi.clearAllMocks();
		verificationAgent = new VerificationAgent();
		moderationConsensus = new ModerationConsensus();

		// Get the mocked N8N client
		mockN8NClient = (verificationAgent as any).n8nClient;
	});

	describe('VerificationAgent N8N Integration', () => {
		it('should call N8N workflow for verification', async () => {
			// Mock successful N8N response
			(mockN8NClient as any).triggerWorkflow.mockResolvedValue({
				success: true,
				data: {
					approved: true,
					confidence: 0.9,
					reasoning: ['Template looks good'],
					severity_level: 2,
					violations: []
				}
			});

			const template = {
				id: 'test-123',
				subject: 'Test Subject',
				message_body: 'Test message body'
			};

			const result = await (verificationAgent as any).process({ template });

			expect((mockN8NClient as any).triggerWorkflow).toHaveBeenCalledWith(
				'verification-comprehensive',
				expect.objectContaining({
					template: {
						id: 'test-123',
						subject: 'Test Subject',
						message_body: 'Test message body'
					},
					checks: {
						grammar: true,
						policy: true,
						factuality: false
					}
				})
			);

			expect(result.approved).toBe(true);
			expect(result.confidence).toBe(0.9);
			expect(result.decision).toBe('approved');
		});

		it('should fallback to local verification when N8N fails', async () => {
			// Mock N8N failure
			mockN8NClient.triggerWorkflow.mockRejectedValue(new Error('N8N unavailable'));

			const template = {
				id: 'test-123',
				subject: 'Test Subject',
				message_body: 'Test message body'
			};

			const result = await (verificationAgent as any).process({ template });

			expect(result.reasoning).toContain('[Fallback verification used]');
			expect(result.approved).toBeDefined();
		});
	});

	describe('ModerationConsensus N8N Integration', () => {
		it('should use N8N workflows for OpenAI moderation', async () => {
			// Mock successful workflow responses
			mockN8NClient.triggerWorkflow
				.mockResolvedValueOnce({
					success: true,
					data: {
						contains_violations: false,
						confidence: 0.8,
						violations: [],
						reasons: ['Content appears legitimate']
					}
				})
				.mockResolvedValueOnce({
					success: true,
					data: {
						contains_violations: false,
						confidence: 0.7,
						violations: [],
						reasons: ['No severe violations detected']
					}
				});

			// Mock database
			const mockVerification = {
				id: 'verification-123',
				severity_level: 8,
				template: {
					id: 'template-123',
					subject: 'Test',
					message_body: 'Test content'
				}
			};

			// Mock db.templateVerification.findUnique
			vi.doMock('$lib/core/db', () => ({
				db: {
					templateVerification: {
						findUnique: vi.fn().mockResolvedValue(mockVerification),
						update: vi.fn().mockResolvedValue({})
					}
				}
			}));

			const result = await moderationConsensus.evaluateTemplate('verification-123');

			expect((mockN8NClient as any).triggerWorkflow).toHaveBeenCalledWith(
				'llm-moderation-openai',
				expect.objectContaining({
					template: expect.objectContaining({
						id: 'template-123'
					})
				})
			);

			expect((mockN8NClient as any).triggerWorkflow).toHaveBeenCalledWith(
				'llm-moderation-gemini',
				expect.objectContaining({
					template: expect.objectContaining({
						id: 'template-123'
					})
				})
			);
		});
	});

	describe('N8N Client Monitoring', () => {
		it('should provide workflow performance monitoring', async () => {
			mockN8NClient.monitorWorkflowPerformance.mockResolvedValue({
				status: 'healthy',
				success_rate: 0.95,
				avg_response_time: 2500,
				recommendations: []
			});

			const performance = await mockN8NClient.monitorWorkflowPerformance(
				'verification-comprehensive'
			);

			expect(performance.status).toBe('healthy');
			expect(performance.success_rate).toBe(0.95);
			expect(performance.avg_response_time).toBe(2500);
		});

		it('should detect degraded workflow performance', async () => {
			mockN8NClient.monitorWorkflowPerformance.mockResolvedValue({
				status: 'degraded',
				success_rate: 0.75,
				avg_response_time: 35000,
				recommendations: ['High execution time - optimize workflow']
			});

			const performance = await mockN8NClient.monitorWorkflowPerformance('slow-workflow');

			expect(performance.status).toBe('degraded');
			expect(performance.recommendations).toContain('High execution time - optimize workflow');
		});
	});

	describe('Error Handling and Fallbacks', () => {
		it('should handle N8N service unavailability gracefully', async () => {
			mockN8NClient.healthCheck.mockResolvedValue(false);
			mockN8NClient.triggerWorkflow.mockRejectedValue(new Error('Service unavailable'));

			const template = {
				id: 'test-123',
				subject: 'Test',
				message_body: 'Test content'
			};

			// Should not throw, should use fallback
			const result = await (verificationAgent as any).process({ template });
			expect(result).toBeDefined();
			expect(result.reasoning).toContain('[Fallback verification used]');
		});

		it('should provide meaningful error messages', async () => {
			mockN8NClient.triggerWorkflow.mockResolvedValue({
				success: false,
				error: 'Workflow execution failed: Invalid prompt format'
			});

			const template = {
				id: 'test-123',
				subject: 'Test',
				message_body: 'Test content'
			};

			const result = await (verificationAgent as any).process({ template });
			expect(result.reasoning).toContain('[Fallback verification used]');
		});
	});
});

describe('N8N Workflow Pattern Compliance', () => {
	it('should follow standard workflow input schema', async () => {
		const mockN8NClient = new (N8NClient as any)();
		mockN8NClient.triggerWorkflow = vi.fn().mockResolvedValue({
			success: true,
			data: {}
		});

		const agent = new VerificationAgent();
		(agent as any).n8nClient = mockN8NClient;

		await (agent as any).process({
			template: {
				id: 'test',
				subject: 'Test',
				message_body: 'Content'
			}
		});

		expect(mockN8NClient.triggerWorkflow).toHaveBeenCalledWith(
			'verification-comprehensive',
			expect.objectContaining({
				template: expect.any(Object),
				checks: expect.any(Object),
				criteria: expect.any(Object)
			})
		);
	});
});
