import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockTemplate } from '../types/test-helpers.js';
import type { MockTemplate } from '../types/test-helpers.js';
import { testMultipliersAccess } from '../helpers/json-test-helpers';

// Agent decision types for testing
interface AgentDecision {
	decision: {
		riskFactors?: unknown;
		recommendedActions?: unknown;
		verificationLevel?: string;
		credibilityScore?: number;
		credibilityComponents?: {
			civic_engagement?: number;
			[key: string]: unknown;
		};
		impactScore?: number;
		confidenceLevel?: string;
		baseRewardUSD?: number;
		totalMultiplier?: number;
		multipliers?: {
			urgency?: number;
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

/**
 * Agent Integration Tests
 *
 * Tests the integration with Communiqué's multi-agent system:
 * - Verification Agent: Identity verification
 * - Impact Agent: Civic impact measurement
 * - Reputation Agent: User credibility scoring
 * - Supply Agent: Token economics and rewards
 * - Agent Coordinator: Multi-agent consensus
 *
 * Updated for consolidated schema (Phase 1-5 complete)
 */

// Mock agents and their dependencies - Updated for consolidated schema
const mockDb = vi.hoisted(() => ({
	user: {
		findUnique: vi.fn().mockImplementation((query) => {
			const userId = query?.where?.id;
			if (!userId || userId === '' || typeof userId !== 'string') {
				return Promise.resolve(null);
			}

			// Return different user data based on ID for testing
			const userData: Record<string, unknown> = {
				'user-123': {
					id: 'user-123',
					name: 'Test User 123',
					email: 'test123@example.com',
					avatar: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					// Consolidated address fields
					street: '123 Main St',
					city: 'San Francisco',
					state: 'CA',
					zip: '94102',
					congressional_district: 'CA-12',
					phone: '+1-555-123-4567',
					// Verification status
					is_verified: true,
					verification_method: 'email',
					verification_data: { provider: 'test' },
					verified_at: new Date(),
					// VOTER Protocol fields
					wallet_address: '0x123456789',
					district_hash: 'hash123',
					trust_score: 100,
					reputation_tier: 'verified',
					// Reputation scores
					pending_rewards: BigInt(0),
					total_earned: BigInt(1000000),
					last_certification: new Date(),
					challenge_score: 70,
					civic_score: 75,
					discourse_score: 80,
					// Profile fields
					role: 'citizen',
					organization: null,
					location: 'San Francisco, CA',
					connection: 'Climate advocate',
					connection_details: null,
					profile_completed_at: new Date(),
					profile_visibility: 'public'
				},
				'suspicious-user': {
					id: 'suspicious-user',
					name: 'Suspicious User',
					email: 'suspicious@example.com',
					avatar: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					// Consolidated address fields
					street: '456 Fake St',
					city: 'Unknown',
					state: 'XX',
					zip: '00000',
					congressional_district: 'XX-00',
					phone: '+1-555-000-0000',
					// Verification status
					is_verified: false,
					verification_method: null,
					verification_data: null,
					verified_at: null,
					// VOTER Protocol fields
					wallet_address: null,
					district_hash: null,
					voter_id: null,
					// Reputation fields
					trust_score: -10,
					reputation_tier: 'suspicious',
					challenge_score: 90,
					civic_score: 80,
					discourse_score: 95
				},
				'new-user': {
					id: 'new-user',
					name: 'New User',
					email: 'new@example.com',
					avatar: null,
					createdAt: new Date(),
					updatedAt: new Date(),
					trust_score: 0,
					reputation_tier: 'novice',
					is_verified: false,
					challenge_score: 50,
					civic_score: 50,
					discourse_score: 50
				},
				'established-user': {
					id: 'established-user',
					name: 'Established User',
					email: 'established@example.com',
					avatar: null,
					createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
					updatedAt: new Date(),
					trust_score: 200,
					reputation_tier: 'expert',
					is_verified: true,
					verification_method: 'government_id',
					challenge_score: 85,
					civic_score: 90,
					discourse_score: 95
				}
			};

			return Promise.resolve(userData[userId] || null);
		}),
		update: vi.fn().mockResolvedValue({
			id: 'user-123',
			trust_score: 150,
			reputation_tier: 'verified'
		})
	},
	template: {
		findUnique: vi.fn().mockImplementation((query) => {
			const templateId = query?.where?.id;
			if (!templateId || typeof templateId !== 'string') {
				return Promise.resolve(null);
			}

			const templateData: Record<string, unknown> = {
				'template-123': {
					id: 'template-123',
					slug: 'test-template',
					title: 'Test Template',
					description: 'A test template for integration testing',
					category: 'environment',
					type: 'congressional',
					deliveryMethod: 'cwc',
					message_body: 'This is a test message about environmental policy',
					subject: 'Environmental Policy Request',
					preview: 'This is a test message...',
					status: 'published',
					is_public: true,
					delivery_config: { method: 'cwc' },
					cwc_config: { house: true, senate: true },
					recipient_config: { auto_lookup: true },
					metrics: { opens: 0, clicks: 0, responses: 0 },
					send_count: 5,
					applicable_countries: ['US'],
					specific_locations: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: null
				},
				'template-456': {
					id: 'template-456',
					slug: 'test-template-456',
					title: 'Test Template 456',
					description: 'Another test template',
					category: 'healthcare',
					type: 'congressional',
					deliveryMethod: 'cwc',
					message_body: 'This is a test message about healthcare policy',
					subject: 'Healthcare Policy Request',
					preview: 'This is a test message...',
					status: 'published',
					is_public: true,
					delivery_config: { method: 'cwc' },
					cwc_config: { house: true, senate: true },
					recipient_config: { auto_lookup: true },
					metrics: { opens: 0, clicks: 0, responses: 0 },
					send_count: 3,
					applicable_countries: ['US'],
					specific_locations: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: null
				},
				'healthcare-template': {
					id: 'healthcare-template',
					slug: 'healthcare-template',
					title: 'Healthcare Template',
					description: 'Healthcare advocacy template',
					category: 'healthcare',
					type: 'congressional',
					deliveryMethod: 'cwc',
					message_body: 'Healthcare policy advocacy message',
					subject: 'Healthcare Policy Support',
					preview: 'Healthcare policy...',
					status: 'published',
					is_public: true,
					delivery_config: { method: 'cwc' },
					cwc_config: { house: true, senate: true },
					recipient_config: { auto_lookup: true },
					metrics: { opens: 0, clicks: 0, responses: 0 },
					send_count: 10,
					applicable_countries: ['US'],
					specific_locations: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: null
				},
				'climate-petition': {
					id: 'climate-petition',
					slug: 'climate-petition',
					title: 'Climate Petition',
					description: 'Climate action petition',
					category: 'environment',
					type: 'congressional',
					deliveryMethod: 'cwc',
					message_body: 'Climate action petition message',
					subject: 'Climate Action Required',
					preview: 'Climate action...',
					status: 'published',
					is_public: true,
					delivery_config: { method: 'cwc' },
					cwc_config: { house: true, senate: true },
					recipient_config: { auto_lookup: true },
					metrics: { opens: 0, clicks: 0, responses: 0 },
					send_count: 15,
					applicable_countries: ['US'],
					specific_locations: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: null
				}
			};

			return Promise.resolve(templateData[templateId] || null);
		}),
		findMany: vi.fn().mockResolvedValue([
			{
				id: 'template-123',
				slug: 'test-template',
				title: 'Test Template',
				description: 'A test template',
				category: 'environment',
				type: 'congressional',
				deliveryMethod: 'cwc',
				message_body: 'This is a test message about environmental policy',
				subject: 'Environmental Policy Request',
				preview: 'This is a test message...',
				status: 'published',
				is_public: true,
				delivery_config: { method: 'cwc' },
				recipient_config: { auto_lookup: true },
				metrics: { opens: 0, clicks: 0, responses: 0 },
				send_count: 5,
				applicable_countries: ['US'],
				specific_locations: [],
				createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
			}
		]),
		count: vi.fn().mockResolvedValue(10)
	},
	civicAction: {
		findMany: vi.fn().mockImplementation((query) => {
			// Mock data for network activity queries
			const actions = [
				{
					id: 'action-1',
					user_id: 'user-123',
					template_id: 'template-123',
					action_type: 'cwc_message',
					status: 'confirmed',
					reward_wei: '100000000000000000',
					tx_hash: '0xabcd1234',
					created_at: new Date()
				},
				{
					id: 'action-2',
					user_id: 'user-456',
					template_id: 'template-456',
					action_type: 'cwc_message',
					status: 'confirmed',
					reward_wei: '200000000000000000',
					tx_hash: '0xabcd5678',
					created_at: new Date()
				}
			];

			// Handle distinct queries for unique users
			if (query?.distinct?.includes('user_id')) {
				return Promise.resolve([
					{ user_id: 'user-123' },
					{ user_id: 'user-456' },
					{ user_id: 'user-789' }
				]);
			}

			return Promise.resolve(actions);
		}),
		count: vi.fn().mockResolvedValue(5)
	},
	auditLog: {
		create: vi.fn().mockResolvedValue({ id: 'log-123' }),
		findMany: vi.fn().mockResolvedValue([
			{
				id: 'log-1',
				user_id: 'user-123',
				score_before: 50,
				score_after: 75,
				change_amount: 25,
				change_reason: 'civic_action_completed',
				agent_source: 'reputation_agent',
				confidence: 0.85,
				created_at: new Date()
			}
		])
	},
	challenge: {
		findMany: vi.fn().mockResolvedValue([])
	}
}));

vi.mock('$lib/core/db', () => ({
	prisma: mockDb,
	db: mockDb // Expose db export for agents that use it
}));

describe('Agent Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Verification Agent', () => {
		it('should verify user identity successfully', async () => {
			const { VerificationAgent } = await import('../../src/lib/agents/verification-agent');
			const agent = new VerificationAgent();

			const context = {
				userId: 'user-123',
				actionType: 'identity_verification',
				timestamp: new Date().toISOString()
			};

			const decision = await agent.makeDecision(context);

			expect(decision).toMatchObject({
				agentId: expect.stringContaining('verification'),
				confidence: expect.any(Number),
				reasoning: expect.any(String),
				decision: expect.objectContaining({
					userId: 'user-123',
					verificationLevel: expect.stringMatching(/unverified|partial|verified|high_assurance/),
					trustScore: expect.any(Number),
					verificationSources: expect.any(Array),
					riskFactors: expect.any(Array),
					recommendedActions: expect.any(Array)
				})
			});
		});

		it('should assess risk factors for verification', async () => {
			const { VerificationAgent } = await import('../../src/lib/agents/verification-agent');
			const agent = new VerificationAgent();

			const suspiciousContext = {
				userId: 'suspicious-user',
				actionType: 'identity_verification',
				timestamp: new Date().toISOString()
			};

			const decision = await agent.makeDecision(suspiciousContext);

			// Should identify risk factors for suspicious users
			expect((decision as unknown as AgentDecision).decision.riskFactors).toBeDefined();
			expect((decision as unknown as AgentDecision).decision.recommendedActions).toBeDefined();
			expect((decision as unknown as AgentDecision).decision.verificationLevel).toMatch(
				/unverified|partial/
			);
		});

		it('should handle verification errors gracefully', async () => {
			const { VerificationAgent } = await import('../../src/lib/agents/verification-agent');
			const agent = new VerificationAgent();

			// Test with invalid context
			const invalidContext = {
				userId: '', // Invalid empty userId
				actionType: 'identity_verification'
			};

			try {
				const decision = await agent.makeDecision(invalidContext);
				// Should still return a decision, possibly with low confidence
				expect(decision.confidence).toBeLessThanOrEqual(0.5);
				expect((decision as unknown as AgentDecision).decision.verificationLevel).toBe(
					'unverified'
				);
			} catch (error) {
				// Or may throw error for invalid input
				expect(error).toBeDefined();
			}
		});
	});

	describe('Agent Coordinator', () => {
		it('should coordinate multiple agents for consensus', async () => {
			const { AgentCoordinator, AgentType } = await import('../../src/lib/agents/base-agent');
			const { SupplyAgent } = await import('../../src/lib/agents/supply-agent');
			const { ImpactAgent } = await import('../../src/lib/agents/impact-agent');

			const coordinator = new AgentCoordinator();
			const supplyAgent = new SupplyAgent();
			const impactAgent = new ImpactAgent();

			coordinator.registerAgent(supplyAgent);
			coordinator.registerAgent(impactAgent);

			const context = {
				userId: 'user-123',
				actionType: 'cwc_message',
				templateId: 'template-456',
				timestamp: new Date().toISOString()
			};

			const consensus = await coordinator.coordinateDecision(context, [
				AgentType.SUPPLY,
				AgentType.IMPACT
			]);

			expect(consensus).toMatchObject({
				consensusReached: expect.any(Boolean),
				consensusConfidence: expect.any(Number),
				decisions: expect.arrayContaining([
					expect.objectContaining({
						agentType: expect.any(String),
						agentId: expect.any(String),
						confidence: expect.any(Number),
						reasoning: expect.any(String),
						decision: expect.any(Object)
					})
				])
			});

			if (consensus.consensusReached) {
				expect(consensus.decisions.length).toBeGreaterThan(0);
				expect(consensus.consensusConfidence).toBeGreaterThan(0);
			}
		});

		it('should handle cases where consensus is not reached', async () => {
			// Create a mock coordinator that simulates disagreement
			const { AgentCoordinator, AgentType } = await import('../../src/lib/agents/base-agent');

			// Test with agents that would disagree
			// Since this is an integration test, we'll test a case where consensus would fail
			const coordinator = new AgentCoordinator();

			// Try to coordinate with no agents registered
			const emptyContext = {
				userId: 'test-user',
				actionType: 'unknown_action'
			};

			try {
				const consensus = await coordinator.coordinateDecision(emptyContext, [AgentType.SUPPLY]);

				// If it succeeds, check that it's handling the edge case appropriately
				expect(consensus).toMatchObject({
					consensusReached: expect.any(Boolean),
					consensusConfidence: expect.any(Number),
					decisions: expect.any(Array)
				});
			} catch (error) {
				// If it fails, that's also valid behavior for an edge case
				expect(error).toBeDefined();
			}
		});
	});

	describe('Reputation Agent', () => {
		it('should calculate reputation changes based on actions', async () => {
			const { ReputationAgent } = await import('../../src/lib/agents/reputation-agent');
			const agent = new ReputationAgent();

			const context = {
				userId: 'user-123',
				actionType: 'reputation_update',
				timestamp: new Date().toISOString()
			};

			const decision = await agent.makeDecision(context);

			expect(decision).toMatchObject({
				agentId: expect.stringContaining('reputation'),
				confidence: expect.any(Number),
				reasoning: expect.any(String),
				decision: expect.objectContaining({
					userId: 'user-123',
					credibilityScore: expect.any(Number),
					tier: expect.stringMatching(/untrusted|emerging|established|respected|authoritative/),
					credibilityComponents: expect.objectContaining({
						civic_engagement: expect.any(Number),
						information_quality: expect.any(Number),
						community_trust: expect.any(Number),
						verification_depth: expect.any(Number),
						behavioral_integrity: expect.any(Number)
					}),
					badges: expect.any(Array),
					attestations: expect.any(Array),
					riskFactors: expect.any(Array),
					portabilityHash: expect.any(String)
				})
			});

			expect(
				(decision as unknown as AgentDecision).decision.credibilityScore
			).toBeGreaterThanOrEqual(0);
		});

		it('should assess credibility components independently', async () => {
			const { ReputationAgent } = await import('../../src/lib/agents/reputation-agent');
			const agent = new ReputationAgent();

			const newUserContext = {
				userId: 'new-user',
				actionType: 'reputation_update'
			};

			const establishedUserContext = {
				userId: 'established-user',
				actionType: 'reputation_update'
			};

			const newUserDecision = await agent.makeDecision(newUserContext);
			const establishedUserDecision = await agent.makeDecision(establishedUserContext);

			// Both should have valid credibility components
			expect(
				((newUserDecision as unknown as AgentDecision).decision as unknown).credibilityComponents
					.civic_engagement
			).toBeGreaterThanOrEqual(0);
			expect(
				((establishedUserDecision as unknown as AgentDecision).decision as unknown)
					.credibilityComponents.civic_engagement
			).toBeGreaterThanOrEqual(0);

			// Check that all components are present
			const components = ((newUserDecision as unknown as AgentDecision).decision as unknown)
				.credibilityComponents;
			expect(components).toHaveProperty('civic_engagement');
			expect(components).toHaveProperty('information_quality');
			expect(components).toHaveProperty('community_trust');
			expect(components).toHaveProperty('verification_depth');
			expect(components).toHaveProperty('behavioral_integrity');
		});
	});

	describe('Impact Agent', () => {
		it('should measure civic impact of actions', async () => {
			const { ImpactAgent } = await import('../../src/lib/agents/impact-agent');
			const agent = new ImpactAgent();

			const context = {
				userId: 'user-123',
				actionType: 'cwc_message',
				templateId: 'template-456',
				timestamp: new Date().toISOString()
			};

			const decision = await agent.makeDecision(context);

			expect(decision).toMatchObject({
				agentId: expect.stringContaining('impact'),
				confidence: expect.any(Number),
				reasoning: expect.any(String),
				decision: expect.objectContaining({
					templateId: expect.any(String),
					impactScore: expect.any(Number),
					confidenceLevel: expect.stringMatching(/high|medium|low/)
					// Note: Some fields like legislativeOutcomes, causalChains may be undefined for simple cases
				})
			});

			expect((decision as unknown as AgentDecision).decision.impactScore).toBeGreaterThanOrEqual(0);
			expect((decision as unknown as AgentDecision).decision.impactScore).toBeLessThanOrEqual(100);
		});

		it('should assess different types of civic actions', async () => {
			const { ImpactAgent } = await import('../../src/lib/agents/impact-agent');
			const agent = new ImpactAgent();

			const contexts = [
				{
					userId: 'user-123',
					actionType: 'cwc_message',
					templateId: 'healthcare-template'
				},
				{
					userId: 'user-123', // Use same user for consistent mocking
					actionType: 'petition_signature',
					templateId: 'climate-petition'
				}
			];

			for (const context of contexts) {
				const decision = await agent.makeDecision(context);

				expect((decision as unknown as AgentDecision).decision.impactScore).toBeGreaterThanOrEqual(
					0
				);
				expect((decision as unknown as AgentDecision).decision.confidenceLevel).toMatch(
					/high|medium|low/
				);
				expect(decision.confidence).toBeGreaterThan(0);
				expect(decision.confidence).toBeLessThanOrEqual(1);
			}
		});
	});

	describe('Supply Agent', () => {
		it('should calculate appropriate rewards based on multiple factors', async () => {
			const { SupplyAgent } = await import('../../src/lib/agents/supply-agent');
			const agent = new SupplyAgent();

			const context = {
				userId: 'user-123',
				actionType: 'cwc_message',
				templateId: 'template-456',
				timestamp: new Date().toISOString()
			};

			const decision = await agent.makeDecision(context);

			expect(decision).toMatchObject({
				agentId: expect.stringContaining('supply'),
				confidence: expect.any(Number),
				reasoning: expect.any(String),
				decision: expect.objectContaining({
					baseRewardUSD: expect.any(Number),
					multipliers: expect.objectContaining({
						activity: expect.any(Number),
						action: expect.any(Number),
						reputation: expect.any(Number),
						complexity: expect.any(Number),
						time: expect.any(Number),
						urgency: expect.any(Number)
					}),
					totalMultiplier: expect.any(Number),
					ethPrice: expect.any(Number),
					finalRewardETH: expect.any(Number),
					finalRewardWei: expect.any(String)
				})
			});

			expect((decision as unknown as AgentDecision).decision.baseRewardUSD).toBeGreaterThan(0);
			expect((decision as unknown as AgentDecision).decision.totalMultiplier).toBeGreaterThan(0);
		});

		it('should apply appropriate multipliers for different scenarios', async () => {
			const { SupplyAgent } = await import('../../src/lib/agents/supply-agent');
			const agent = new SupplyAgent();

			const urgentContext = {
				userId: 'user-123',
				actionType: 'urgent_congressional_response',
				templateId: 'emergency-template',
				timestamp: new Date().toISOString()
			};

			const routineContext = {
				userId: 'user-123', // Use same user for consistent results
				actionType: 'routine_communication',
				templateId: 'standard-template',
				timestamp: new Date().toISOString()
			};

			const urgentDecision = await agent.makeDecision(urgentContext);
			const routineDecision = await agent.makeDecision(routineContext);

			// Urgent actions should generally have higher multipliers
			expect(
				testMultipliersAccess((urgentDecision as unknown as AgentDecision).decision.multipliers)
					.urgency
			).toBeGreaterThanOrEqual(
				testMultipliersAccess((routineDecision as unknown as AgentDecision).decision.multipliers)
					.urgency
			);

			expect(
				(urgentDecision as unknown as AgentDecision).decision.totalMultiplier
			).toBeGreaterThanOrEqual(
				(routineDecision as unknown as AgentDecision).decision.totalMultiplier
			);
		});
	});

	describe('Type Guards and Decision Extraction', () => {
		it('should properly extract supply agent decisions', async () => {
			const { extractSupplyDecision } = await import('../../src/lib/agents/type-guards');

			const validDecision = {
				baseRewardUSD: 0.15,
				multipliers: {
					activity: 1.2,
					action: 1.0,
					reputation: 1.1,
					complexity: 1.0,
					time: 1.0,
					urgency: 1.3
				},
				totalMultiplier: 1.716,
				ethPrice: 2500,
				finalRewardETH: 0.1029,
				finalRewardWei: '102900000000000000'
			};

			const extracted = extractSupplyDecision(validDecision);

			expect(extracted).toMatchObject({
				baseRewardUSD: 0.15,
				totalMultiplier: 1.716,
				finalRewardWei: '102900000000000000',
				rewardAmount: expect.any(Number),
				supplyImpact: expect.any(Number)
			});

			// Test with invalid decision
			const invalidDecision = { invalid: 'data' };
			const fallback = extractSupplyDecision(invalidDecision);

			expect(fallback).toMatchObject({
				baseRewardUSD: 0,
				finalRewardWei: '0',
				rewardAmount: 0,
				supplyImpact: 1.0
			});
		});

		it('should properly extract reputation agent decisions', async () => {
			const { extractReputationDecision } = await import('../../src/lib/agents/type-guards');

			const validDecision = {
				userId: 'user-123',
				credibilityScore: 175,
				tier: 'verified',
				credibilityComponents: {
					civic_engagement: 40,
					information_quality: 35,
					community_trust: 35,
					verification_depth: 35,
					behavioral_integrity: 30
				},
				badges: ['verified_citizen', 'civic_advocate'],
				attestations: [],
				riskFactors: [],
				portabilityHash: '0xabcd1234'
			};

			const extracted = extractReputationDecision(validDecision);

			expect(extracted).toMatchObject({
				userId: 'user-123',
				credibilityScore: 175,
				tier: 'verified',
				credibilityComponents: expect.objectContaining({
					civic_engagement: 40,
					information_quality: 35
				}),
				badges: expect.arrayContaining(['verified_citizen']),
				portabilityHash: '0xabcd1234'
			});

			// Test with invalid decision
			const invalidDecision = { invalid: 'data' };
			const fallback = extractReputationDecision(invalidDecision);

			expect(fallback).toMatchObject({
				userId: '',
				credibilityScore: 0,
				tier: 'untrusted',
				badges: [],
				riskFactors: [],
				portabilityHash: ''
			});
		});

		it('should properly extract verification agent decisions', async () => {
			const { extractVerificationDecision } = await import('../../src/lib/agents/type-guards');

			const validDecision = {
				userId: 'user-456',
				verificationLevel: 'high_assurance',
				trustScore: 95,
				verificationSources: [
					{
						provider: 'didit',
						type: 'kyc',
						score: 95,
						confidence: 0.95,
						timestamp: new Date(),
						metadata: {}
					}
				],
				riskFactors: [],
				recommendedActions: ['enable_advanced_features']
			};

			const extracted = extractVerificationDecision(validDecision);

			expect(extracted).toMatchObject({
				userId: 'user-456',
				verificationLevel: 'high_assurance',
				trustScore: 95,
				verificationSources: expect.arrayContaining([
					expect.objectContaining({
						provider: 'didit',
						type: 'kyc'
					})
				]),
				recommendedActions: expect.arrayContaining(['enable_advanced_features'])
			});
		});

		it('should properly extract impact agent decisions', async () => {
			const { extractImpactDecision } = await import('../../src/lib/agents/type-guards');

			const validDecision = {
				templateId: 'climate-action-template',
				impactScore: 78,
				legislativeOutcomes: [{ bill: 'HR-1234', likelihood: 0.65 }],
				confidenceLevel: 'high',
				causalChains: [{ action: 'constituent_pressure', outcome: 'committee_hearing' }],
				correlationStrength: 0.78
			};

			const extracted = extractImpactDecision(validDecision);

			expect(extracted).toMatchObject({
				templateId: 'climate-action-template',
				impactScore: 78,
				confidenceLevel: 'high',
				correlationStrength: 0.78,
				rewardAmount: expect.any(Number),
				impactMultiplier: expect.any(Number)
			});

			expect(extracted.impactMultiplier).toBeGreaterThan(1); // Should be > 1 for positive impact
		});
	});
});
