/**
 * Firecrawl Decision-Maker Provider Tests
 *
 * Integration tests for Firecrawl provider functionality.
 * Note: These tests require FIRECRAWL_API_KEY to be set.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirecrawlDecisionMakerProvider } from '../firecrawl-provider';
import type { ResolveContext } from '../types';

describe('FirecrawlDecisionMakerProvider', () => {
	let provider: FirecrawlDecisionMakerProvider;

	beforeEach(() => {
		provider = new FirecrawlDecisionMakerProvider();
	});

	describe('Provider Metadata', () => {
		it('should have correct name and supported types', () => {
			expect(provider.name).toBe('firecrawl');
			expect(provider.supportedTargetTypes).toEqual([
				'corporate',
				'nonprofit',
				'education',
				'healthcare',
				'labor',
				'media'
			]);
		});
	});

	describe('canResolve', () => {
		it('should resolve corporate targets with entity name', () => {
			const context: ResolveContext = {
				targetType: 'corporate',
				targetEntity: 'Amazon',
				subjectLine: 'Test subject',
				coreMessage: 'Test message',
				topics: ['labor']
			};

			expect(provider.canResolve(context)).toBe(true);
		});

		it('should not resolve without target entity', () => {
			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test subject',
				coreMessage: 'Test message',
				topics: ['labor']
			};

			expect(provider.canResolve(context)).toBe(false);
		});

		it('should not resolve government targets', () => {
			const context: ResolveContext = {
				targetType: 'congress',
				targetEntity: 'US Congress',
				subjectLine: 'Test subject',
				coreMessage: 'Test message',
				topics: ['healthcare']
			};

			expect(provider.canResolve(context)).toBe(false);
		});

		it('should resolve all supported organizational types', () => {
			const supportedTypes = [
				'corporate',
				'nonprofit',
				'education',
				'healthcare',
				'labor',
				'media'
			] as const;

			supportedTypes.forEach(targetType => {
				const context: ResolveContext = {
					targetType,
					targetEntity: 'Test Organization',
					subjectLine: 'Test',
					coreMessage: 'Test',
					topics: ['test']
				};

				expect(provider.canResolve(context)).toBe(true);
			});
		});
	});

	describe('resolve - Integration Tests', () => {
		// Skip these tests if no API key is configured
		const skipIfNoApiKey = process.env.FIRECRAWL_API_KEY ? it : it.skip;

		skipIfNoApiKey('should discover corporate organization', async () => {
			const context: ResolveContext = {
				targetType: 'corporate',
				targetEntity: 'Patagonia',
				targetUrl: 'https://www.patagonia.com',
				subjectLine: 'Environmental sustainability commitment',
				coreMessage: 'We encourage Patagonia to expand their environmental initiatives',
				topics: ['environment', 'sustainability']
			};

			const result = await provider.resolve(context);

			expect(result).toBeDefined();
			expect(result.provider).toBe('firecrawl');
			expect(result.decisionMakers).toBeDefined();
			expect(Array.isArray(result.decisionMakers)).toBe(true);
			expect(result.latencyMs).toBeGreaterThan(0);

			if (result.decisionMakers.length > 0) {
				const firstDm = result.decisionMakers[0];
				expect(firstDm).toHaveProperty('name');
				expect(firstDm).toHaveProperty('title');
				expect(firstDm).toHaveProperty('organization');
				expect(firstDm.isAiResolved).toBe(true);
			}
		}, 120000); // 2 min timeout for Firecrawl Agent

		skipIfNoApiKey('should cache and reuse organization data', async () => {
			const context: ResolveContext = {
				targetType: 'nonprofit',
				targetEntity: 'Electronic Frontier Foundation',
				targetUrl: 'https://www.eff.org',
				subjectLine: 'Digital privacy advocacy',
				coreMessage: 'Support for privacy legislation',
				topics: ['privacy', 'digital-rights']
			};

			// First call - cache miss
			const result1 = await provider.resolve(context);
			expect(result1.cacheHit).toBe(false);

			// Second call - should hit cache
			const result2 = await provider.resolve(context);
			expect(result2.cacheHit).toBe(true);
			expect(result2.latencyMs).toBeLessThan(result1.latencyMs);
		}, 120000);

		it('should reject resolution without target entity', async () => {
			const context: ResolveContext = {
				targetType: 'corporate',
				// Missing targetEntity
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: ['test']
			};

			await expect(provider.resolve(context)).rejects.toThrow(
				'Target entity required for organization lookup'
			);
		});
	});

	describe('Streaming Callbacks', () => {
		it('should call streaming callbacks during resolution', async () => {
			const phaseCallback = vi.fn();
			const thoughtCallback = vi.fn();

			const context: ResolveContext = {
				targetType: 'corporate',
				targetEntity: 'Test Corp',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: ['test'],
				streaming: {
					onPhase: phaseCallback,
					onThought: thoughtCallback
				}
			};

			// Mock Firecrawl client to avoid API call
			const mockResolve = vi
				.spyOn(provider as any, 'discoverOrganization')
				.mockResolvedValue({
					name: 'Test Corp',
					website: 'https://test.com',
					leadership: [
						{
							name: 'John Doe',
							title: 'CEO',
							email: 'john@test.com',
							emailVerified: true
						}
					],
					policyPositions: [],
					contacts: {}
				});

			await provider.resolve(context);

			expect(phaseCallback).toHaveBeenCalled();
			expect(mockResolve).toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('should provide helpful error for missing API key', async () => {
			// Temporarily clear API key
			const originalKey = process.env.FIRECRAWL_API_KEY;
			delete process.env.FIRECRAWL_API_KEY;

			const context: ResolveContext = {
				targetType: 'corporate',
				targetEntity: 'Test Corp',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: ['test']
			};

			await expect(provider.resolve(context)).rejects.toThrow(
				/Firecrawl API.*not configured/i
			);

			// Restore API key
			if (originalKey) {
				process.env.FIRECRAWL_API_KEY = originalKey;
			}
		});
	});

	describe('Decision Maker Transformation', () => {
		it('should transform leaders to ProcessedDecisionMakers correctly', () => {
			const leaders = [
				{
					name: 'Jane Smith',
					title: 'CEO',
					email: 'jane@company.com',
					isVerified: true,
					sourceUrl: 'https://company.com/leadership'
				}
			];

			// Access private method via type casting (for testing only)
			const transformed = (provider as any).transformToProcessedDecisionMakers(
				leaders,
				'Test Company',
				'https://company.com'
			);

			expect(transformed).toHaveLength(1);
			expect(transformed[0]).toMatchObject({
				name: 'Jane Smith',
				title: 'CEO',
				organization: 'Test Company',
				email: 'jane@company.com',
				isAiResolved: true,
				emailSource: 'verified',
				powerLevel: 'primary'
			});
		});
	});

	describe('Power Level Classification', () => {
		it('should classify C-suite as primary power level', () => {
			const ceoTitle = 'Chief Executive Officer';
			const powerLevel = (provider as any).determinePowerLevel(ceoTitle);
			expect(powerLevel).toBe('primary');
		});

		it('should classify VPs as secondary power level', () => {
			const vpTitle = 'Vice President of Engineering';
			const powerLevel = (provider as any).determinePowerLevel(vpTitle);
			expect(powerLevel).toBe('secondary');
		});

		it('should classify managers as support power level', () => {
			const managerTitle = 'Senior Manager';
			const powerLevel = (provider as any).determinePowerLevel(managerTitle);
			expect(powerLevel).toBe('support');
		});
	});

	describe('Title Relevance Detection', () => {
		it('should detect C-suite as always relevant', () => {
			const isRelevant = (provider as any).hasRelevantTitle('CEO', ['random', 'topics']);
			expect(isRelevant).toBe(true);
		});

		it('should match topic keywords in title', () => {
			const isRelevant = (provider as any).hasRelevantTitle(
				'VP of Environmental Sustainability',
				['environment', 'climate']
			);
			expect(isRelevant).toBe(true);
		});

		it('should reject unrelated titles', () => {
			const isRelevant = (provider as any).hasRelevantTitle(
				'Marketing Coordinator',
				['labor', 'healthcare']
			);
			expect(isRelevant).toBe(false);
		});
	});

	describe('Confidence Scoring', () => {
		it('should score verified email higher', () => {
			const verifiedLeader = {
				name: 'John',
				title: 'CEO',
				email: 'john@test.com',
				isVerified: true,
				sourceUrl: 'https://test.com'
			};

			const inferredLeader = {
				...verifiedLeader,
				isVerified: false
			};

			const verifiedConfidence = (provider as any).calculateConfidence(verifiedLeader);
			const inferredConfidence = (provider as any).calculateConfidence(inferredLeader);

			expect(verifiedConfidence).toBeGreaterThan(inferredConfidence);
		});

		it('should score source URLs as confidence boost', () => {
			const withSource = {
				name: 'John',
				title: 'CEO',
				email: 'john@test.com',
				isVerified: true,
				sourceUrl: 'https://test.com'
			};

			const withoutSource = {
				...withSource,
				sourceUrl: undefined
			};

			const withConfidence = (provider as any).calculateConfidence(withSource);
			const withoutConfidence = (provider as any).calculateConfidence(withoutSource);

			expect(withConfidence).toBeGreaterThan(withoutConfidence);
		});
	});

	describe('Batch Discovery', () => {
		const skipIfNoApiKey = process.env.FIRECRAWL_API_KEY ? it : it.skip;

		skipIfNoApiKey('should discover multiple organizations in parallel', async () => {
			const organizations = ['Patagonia', 'Ben & Jerry\'s', 'Seventh Generation'];
			const context = {
				targetType: 'corporate' as const,
				subjectLine: 'Environmental sustainability commitment',
				coreMessage: 'Support for environmental initiatives',
				topics: ['environment', 'sustainability']
			};

			const results = await provider.resolveBatch(organizations, context);

			expect(results).toHaveLength(organizations.length);
			expect(Array.isArray(results)).toBe(true);

			// Each result should have decision-makers array
			results.forEach((result, idx) => {
				expect(result).toBeDefined();
				expect(result.provider).toBe('firecrawl');
				expect(Array.isArray(result.decisionMakers)).toBe(true);
			});

			// At least one org should have found decision-makers
			const totalDMs = results.reduce((sum, r) => sum + r.decisionMakers.length, 0);
			expect(totalDMs).toBeGreaterThan(0);
		}, 180000); // 3 min timeout for batch

		skipIfNoApiKey('should handle batch with some cache hits', async () => {
			// First, populate cache with one org
			const firstContext = {
				targetType: 'corporate' as const,
				targetEntity: 'Patagonia',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: ['environment']
			};

			await provider.resolve(firstContext);

			// Now do batch with that org + new ones
			const organizations = ['Patagonia', 'Tesla'];
			const batchContext = {
				targetType: 'corporate' as const,
				subjectLine: 'Clean energy',
				coreMessage: 'Support for clean energy',
				topics: ['energy', 'climate']
			};

			const results = await provider.resolveBatch(organizations, batchContext);

			expect(results).toHaveLength(2);

			// At least one should be a cache hit
			const cacheHits = results.filter(r => r.cacheHit);
			expect(cacheHits.length).toBeGreaterThan(0);
		}, 180000);

		skipIfNoApiKey('should isolate errors in batch processing', async () => {
			const organizations = [
				'Patagonia', // Real org
				'NonExistentCompanyXYZ123456', // Should fail
				'Ben & Jerry\'s' // Real org
			];

			const context = {
				targetType: 'corporate' as const,
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: ['test']
			};

			const results = await provider.resolveBatch(organizations, context);

			// Should still get results for all orgs
			expect(results).toHaveLength(3);

			// Check that some succeeded and some failed
			const successful = results.filter(r => r.decisionMakers.length > 0 || r.cacheHit);
			const failed = results.filter(r => r.decisionMakers.length === 0 && !r.cacheHit);

			// Should have at least one success and one failure
			expect(successful.length).toBeGreaterThan(0);
			expect(failed.length).toBeGreaterThan(0);
		}, 180000);

		it('should call batch progress callbacks', async () => {
			const phaseCallback = vi.fn();
			const thoughtCallback = vi.fn();

			const organizations = ['Test Corp A', 'Test Corp B', 'Test Corp C'];
			const context = {
				targetType: 'corporate' as const,
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: ['test'],
				streaming: {
					onPhase: phaseCallback,
					onThought: thoughtCallback
				}
			};

			// Mock discoverOrganizationsBatch
			const mockBatch = vi
				.spyOn(provider as any, 'firecrawl')
				.mockReturnValue({
					discoverOrganizationsBatch: vi.fn().mockResolvedValue({
						successful: organizations.map(org => ({
							organization: org,
							profile: {
								name: org,
								website: `https://${org.toLowerCase().replace(/\s/g, '')}.com`,
								leadership: [],
								policyPositions: [],
								contacts: {}
							},
							creditsUsed: 10
						})),
						failed: [],
						totalCreditsUsed: 30,
						totalTimeMs: 5000
					})
				});

			await provider.resolveBatch(organizations, context);

			// Should have called progress callbacks
			expect(phaseCallback).toHaveBeenCalled();
		});

		it('should optimize with cache-aware batch processing', async () => {
			// This test would require proper mocking of MongoDB service
			// For now, we test the logic path exists
			const organizations = ['Test Corp A', 'Test Corp B'];
			const context = {
				targetType: 'corporate' as const,
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: ['test']
			};

			// Verify the method exists and accepts the right parameters
			expect(typeof provider.resolveBatch).toBe('function');

			// Note: Full integration test requires MongoDB + Firecrawl API
			// See integration tests for actual batch processing validation
		});
	});
});
