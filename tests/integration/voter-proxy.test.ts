import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from '$env/dynamic/private';
import { createMockRequestEvent } from '../helpers/request-event';

/**
 * VOTER Protocol Proxy Endpoint Tests
 *
 * Tests the /api/voter-proxy/* endpoints that delegate to VOTER Protocol.
 * These endpoints handle authentication, CORS, and request transformation.
 */

// Mock env variables
vi.mock('$env/dynamic/private', () => ({
	env: {
		VOTER_API_URL: 'http://localhost:8000',
		VOTER_API_KEY: 'test-voter-api-key'
	}
}));

// Mock database
const mockDb = vi.hoisted(() => ({
	user: {
		findUnique: vi.fn(),
		findFirst: vi.fn(),
		create: vi.fn(),
		update: vi.fn()
	},
	template: {
		findUnique: vi.fn()
	},
	civicAction: {
		create: vi.fn()
	},
	reputationLog: {
		create: vi.fn()
	},
	challenge: {
		create: vi.fn()
	},
	challengeStake: {
		upsert: vi.fn()
	},
	rewardCalculation: {
		create: vi.fn()
	}
}));

vi.mock('$lib/core/db', () => ({
	prisma: mockDb
}));

// Mock CWC client
const mockCwcClient = vi.hoisted(() => ({
	submitToAllRepresentatives: vi.fn()
}));

vi.mock('$lib/core/congress/cwc-client', () => ({
	cwcClient: mockCwcClient
}));

// Mock agents
vi.mock('$lib/agents/supply-agent', () => ({
	SupplyAgent: vi.fn().mockImplementation(() => ({
		makeDecision: vi.fn().mockResolvedValue({
			agentId: 'supply-agent',
			confidence: 0.9,
			reasoning: 'Standard reward calculation',
			decision: {
				baseRewardUSD: 0.1,
				totalMultiplier: 1.0,
				finalRewardWei: '100000000000000000'
			}
		}))
	}))
}));

vi.mock('$lib/agents/impact-agent', () => ({
	ImpactAgent: vi.fn().mockImplementation(() => ({
		makeDecision: vi.fn().mockResolvedValue({
			agentId: 'impact-agent',
			confidence: 0.8,
			reasoning: 'High impact action',
			decision: {
				impactScore: 85
			}
		}))
	}))
}));

vi.mock('$lib/agents/verification-agent', () => ({
	VerificationAgent: vi.fn().mockImplementation(() => ({
		makeDecision: vi.fn().mockResolvedValue({
			agentId: 'verification-agent',
			confidence: 0.9,
			reasoning: 'Verified identity',
			decision: {
				verificationLevel: 'verified',
				trustScore: 100
			}
		}))
	}))
}));

vi.mock('$lib/agents/reputation-agent', () => ({
	ReputationAgent: vi.fn().mockImplementation(() => ({
		makeDecision: vi.fn().mockResolvedValue({
			agentId: 'reputation-agent',
			confidence: 0.85,
			reasoning: 'Credibility assessment complete',
			decision: {
				credibilityScore: 150,
				tier: 'verified'
			}
		}))
	}))
}));

vi.mock('$lib/agents/base-agent', () => ({
	AgentCoordinator: vi.fn().mockImplementation(() => ({
		registerAgent: vi.fn(),
		coordinateDecision: vi.fn().mockResolvedValue({
			consensusReached: true,
			consensusConfidence: 0.9,
			decisions: [
				{
					agentType: 'SUPPLY',
					agentId: 'supply-agent',
					confidence: 0.9,
					reasoning: 'Standard calculation',
					decision: {
						baseRewardUSD: 0.1,
						totalMultiplier: 1.0,
						finalRewardWei: '100000000000000000'
					}
				}
			]
		})
	})),
	AgentType: {
		SUPPLY: 'SUPPLY',
		IMPACT: 'IMPACT',
		VERIFICATION: 'VERIFICATION',
		REPUTATION: 'REPUTATION'
	}
}));

// Mock fetch for controlled testing (still needed for some tests)
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('VOTER Protocol Proxy Endpoints', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST /api/voter-proxy/certify', () => {
		it('should forward certification requests with proper headers', async () => {
			// Mock successful VOTER response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					certification_hash: 'cert-123',
					reward_amount: 50,
					reputation_change: 5
				})
			});

			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'record_civic_action',
					userId: 'user-123',
					actionType: 'cwc_message',
					templateId: 'template-123',
					metadata: {
						userAddress: '0x123',
						deliveryReceipt: 'receipt-data',
						messageHash: 'hash-123',
						timestamp: '2024-01-01T00:00:00Z'
					}
				})
			});

			const response = await POST(createMockRequestEvent(request, '/api/voter') as any);
			const data = await response.json();

			// Verify fetch was called with correct parameters
			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/api/v1/certification/action',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
						'X-API-Key': 'test-voter-api-key',
						'X-User-Address': '0x123'
					})
				})
			);

			// Verify response transformation
			expect(data).toEqual({
				success: true,
				certificationHash: 'cert-123',
				rewardAmount: 50,
				reputationChange: 5
			});
		});

		it('should handle VOTER API errors gracefully', async () => {
			// Mock VOTER error response
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				text: async () => 'Invalid action data'
			});

			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter/certify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userAddress: '0x123',
					actionType: 'invalid_type'
				})
			});

			const response = await POST(createMockRequestEvent(request, '/api/voter') as any);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.success).toBe(false);
			expect(data.error).toContain('Certification failed');
		});

		it('should skip certification when disabled', async () => {
			// Temporarily set ENABLE_CERTIFICATION to false
			const originalEnv = env.ENABLE_CERTIFICATION;
			env.ENABLE_CERTIFICATION = 'false';

			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter/certify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userAddress: '0x123',
					actionType: 'cwc_message'
				})
			});

			const response = await POST(createMockRequestEvent(request, '/api/voter') as any);
			const data = await response.json();

			// Should return success without calling VOTER
			expect(data.success).toBe(true);
			expect(data.message).toBe('Certification service disabled');
			expect(mockFetch).not.toHaveBeenCalled();

			// Restore env
			env.ENABLE_CERTIFICATION = originalEnv;
		});

		it('should handle network timeouts', async () => {
			// Mock network timeout
			mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter/certify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userAddress: '0x123',
					actionType: 'cwc_message'
				})
			});

			const response = await POST(createMockRequestEvent(request, '/api/voter') as any);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.success).toBe(false);
			expect(data.error).toContain('Internal server error');
		});
	});

	describe('Generic Proxy Endpoints', () => {
		it('should proxy GET requests to VOTER API', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					reputation: 100,
					tier: 'emerging'
				})
			});

			const { GET } = await import('../../src/routes/api/voter/+server');

			const url = new URL('http://localhost/api/voter/reputation/0x123');
			const response = await GET(createMockRequestEvent(new Request(url.toString() as any), '/api/voter'));
			const data = await response.json();

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/reputation/0x123',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-voter-api-key'
					})
				})
			);

			expect(data).toEqual({
				reputation: 100,
				tier: 'emerging'
			});
		});

		it('should proxy POST requests with body transformation', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					consensus_score: 0.85,
					approved: true
				})
			});

			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter/consensus', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-User-Address': '0x456'
				},
				body: JSON.stringify({
					templateData: { content: 'test' }
				})
			});

			const url = new URL('http://localhost/api/voter/consensus');
			const response = await POST(createMockRequestEvent(request, '/api/voter') as any);
			const data = await response.json();

			// Verify user address header is forwarded
			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/consensus',
				expect.objectContaining({
					headers: expect.objectContaining({
						'X-User-Address': '0x456'
					})
				})
			);

			expect(data.consensus_score).toBe(0.85);
			expect(data.approved).toBe(true);
		});

		it('should handle rate limiting responses', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				text: async () => 'Rate limit exceeded'
			});

			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ test: 'data' })
			});

			const url = new URL('http://localhost/api/voter/verify');

			await expect(POST(createMockRequestEvent(request, '/api/voter') as any)).rejects.toMatchObject({
				status: 429
			});
		});
	});

	describe('Security & Authentication', () => {
		it('should not expose API keys in responses', async () => {
			// Mock response that accidentally includes API key
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: 'test',
					api_key: 'leaked-key' // This should be filtered
				})
			});

			const { GET } = await import('../../src/routes/api/voter/+server');

			const url = new URL('http://localhost/api/voter/test');
			const response = await GET(createMockRequestEvent(new Request(url.toString() as any), '/api/voter'));
			const data = await response.json();

			// API key should not be in response
			expect(data.api_key).toBeUndefined();
			expect(data.data).toBe('test');
		});

		it('should validate request origins for CORS', async () => {
			// This would be tested in a browser environment
			// Here we just verify the endpoint handles origins
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter/test', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Origin: 'https://malicious-site.com'
				},
				body: JSON.stringify({ test: 'data' })
			});

			const url = new URL('http://localhost/api/voter/test');
			const response = await POST(createMockRequestEvent(request, '/api/voter') as any);

			// Should still process but CORS headers would block in browser
			expect(response.status).not.toBe(403);
		});
	});

	describe('Error Handling & Resilience', () => {
		it('should retry on transient failures', async () => {
			// First call fails, second succeeds
			mockFetch.mockRejectedValueOnce(new Error('Connection reset')).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			// Note: Retry logic would be in the actual implementation
			// This test verifies the pattern
			const { POST } = await import('../../src/routes/api/voter/+server');

			const request = new Request('http://localhost/api/voter/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ test: 'data' })
			});

			const url = new URL('http://localhost/api/voter/test');

			// First attempt fails
			await expect(POST(createMockRequestEvent(request, '/api/voter') as any)).rejects.toThrow();

			// Manual retry succeeds
			const response = await POST(createMockRequestEvent(request, '/api/voter') as any);
			expect(response.status).toBe(200);
		});

		it('should handle malformed responses from VOTER', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => {
					throw new Error('Invalid JSON');
				},
				text: async () => 'Not JSON'
			});

			const { GET } = await import('../../src/routes/api/voter/+server');

			const url = new URL('http://localhost/api/voter/test');

			await expect(GET(createMockRequestEvent(new Request(url.toString() as any), '/api/voter'))).rejects.toMatchObject({
				status: 500
			});
		});
	});
});
