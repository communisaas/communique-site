/**
 * Provider Architecture Tests
 *
 * Verify that the provider system works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionMakerRouter } from '../router';
import { GeminiDecisionMakerProvider } from '../gemini-provider';
import type { DecisionMakerProvider, ResolveContext, DecisionMakerResult } from '../types';

// Mock provider for testing
class MockProvider implements DecisionMakerProvider {
	readonly name = 'mock-provider';
	readonly supportedTargetTypes = ['corporate', 'nonprofit'] as const;

	canResolve(context: ResolveContext): boolean {
		return this.supportedTargetTypes.includes(context.targetType);
	}

	async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
		return {
			decisionMakers: [
				{
					name: 'Test Decision Maker',
					title: 'CEO',
					organization: 'Test Corp',
					email: 'ceo@test.com',
					reasoning: 'Mock reasoning',
					source: 'https://test.com',
					provenance: 'Mock provenance',
					isAiResolved: true,
					powerLevel: 'primary'
				}
			],
			provider: this.name,
			cacheHit: false,
			latencyMs: 10,
			researchSummary: 'Mock research'
		};
	}
}

describe('Provider Architecture', () => {
	let router: DecisionMakerRouter;
	let geminiProvider: GeminiDecisionMakerProvider;
	let mockProvider: MockProvider;

	beforeEach(() => {
		router = new DecisionMakerRouter();
		geminiProvider = new GeminiDecisionMakerProvider();
		mockProvider = new MockProvider();
	});

	describe('GeminiDecisionMakerProvider', () => {
		it('has correct name', () => {
			expect(geminiProvider.name).toBe('gemini-search');
		});

		it('supports government target types', () => {
			expect(geminiProvider.supportedTargetTypes).toContain('congress');
			expect(geminiProvider.supportedTargetTypes).toContain('state_legislature');
			expect(geminiProvider.supportedTargetTypes).toContain('local_government');
		});

		it('can resolve government targets', () => {
			const context: ResolveContext = {
				targetType: 'congress',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};
			expect(geminiProvider.canResolve(context)).toBe(true);
		});

		it('cannot resolve corporate targets', () => {
			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};
			expect(geminiProvider.canResolve(context)).toBe(false);
		});
	});

	describe('DecisionMakerRouter', () => {
		it('registers providers', () => {
			router.register(geminiProvider, 10);
			expect(router.getProvider('gemini-search')).toBe(geminiProvider);
		});

		it('retrieves all registered providers', () => {
			router.register(geminiProvider, 10);
			router.register(mockProvider, 20);

			const providers = router.getProviders();
			expect(providers).toHaveLength(2);
			expect(providers).toContain(geminiProvider);
			expect(providers).toContain(mockProvider);
		});

		it('selects provider based on target type', async () => {
			router.register(geminiProvider, 10);
			router.register(mockProvider, 20);

			const context: ResolveContext = {
				targetType: 'corporate',
				targetEntity: 'Test Corp',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};

			const result = await router.resolve(context);
			expect(result.provider).toBe('mock-provider');
		});

		it('respects provider priority', async () => {
			// Register two mock providers with different priorities
			const lowPriorityProvider = new MockProvider();
			const highPriorityProvider = new MockProvider();
			Object.defineProperty(highPriorityProvider, 'name', {
				value: 'high-priority-provider'
			});

			router.register(lowPriorityProvider, 10);
			router.register(highPriorityProvider, 20);

			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};

			const result = await router.resolve(context);
			expect(result.provider).toBe('high-priority-provider');
		});

		it('throws error for unsupported target type', async () => {
			router.register(geminiProvider, 10);

			const context: ResolveContext = {
				targetType: 'corporate', // Not supported by Gemini
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};

			await expect(router.resolve(context)).rejects.toThrow(
				/No provider available for target type: corporate/
			);
		});

		it('uses preferred provider if available', async () => {
			router.register(geminiProvider, 10);
			router.register(mockProvider, 20);

			// Both support corporate in this test scenario
			const lowPriorityMock = new MockProvider();
			Object.defineProperty(lowPriorityMock, 'supportedTargetTypes', {
				value: ['congress', 'corporate']
			});
			Object.defineProperty(lowPriorityMock, 'name', {
				value: 'low-priority'
			});

			router.register(lowPriorityMock, 5);

			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};

			const result = await router.resolve(context, {
				preferredProvider: 'low-priority'
			});

			expect(result.provider).toBe('low-priority');
		});

		it('attempts fallback on provider failure', async () => {
			// Create a failing provider
			const failingProvider: DecisionMakerProvider = {
				name: 'failing-provider',
				supportedTargetTypes: ['corporate', 'nonprofit'],
				canResolve: () => true,
				resolve: async () => {
					throw new Error('Provider failed');
				}
			};

			router.register(failingProvider, 30); // Higher priority
			router.register(mockProvider, 10); // Lower priority fallback

			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};

			const result = await router.resolve(context, {
				allowFallback: true
			});

			expect(result.provider).toBe('mock-provider'); // Fell back to working provider
		});

		it('fails when all providers fail and fallback enabled', async () => {
			const failingProvider1: DecisionMakerProvider = {
				name: 'failing-1',
				supportedTargetTypes: ['corporate'],
				canResolve: () => true,
				resolve: async () => {
					throw new Error('Provider 1 failed');
				}
			};

			const failingProvider2: DecisionMakerProvider = {
				name: 'failing-2',
				supportedTargetTypes: ['corporate'],
				canResolve: () => true,
				resolve: async () => {
					throw new Error('Provider 2 failed');
				}
			};

			router.register(failingProvider1, 20);
			router.register(failingProvider2, 10);

			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};

			await expect(
				router.resolve(context, { allowFallback: true })
			).rejects.toThrow(/All providers failed/);
		});
	});

	describe('Provider Interface', () => {
		it('requires all interface methods', () => {
			expect(mockProvider).toHaveProperty('name');
			expect(mockProvider).toHaveProperty('supportedTargetTypes');
			expect(mockProvider).toHaveProperty('canResolve');
			expect(mockProvider).toHaveProperty('resolve');
		});

		it('canResolve returns boolean', () => {
			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};
			expect(typeof mockProvider.canResolve(context)).toBe('boolean');
		});

		it('resolve returns DecisionMakerResult', async () => {
			const context: ResolveContext = {
				targetType: 'corporate',
				subjectLine: 'Test',
				coreMessage: 'Test',
				topics: []
			};

			const result = await mockProvider.resolve(context);

			expect(result).toHaveProperty('decisionMakers');
			expect(result).toHaveProperty('provider');
			expect(result).toHaveProperty('cacheHit');
			expect(result).toHaveProperty('latencyMs');
			expect(Array.isArray(result.decisionMakers)).toBe(true);
		});
	});
});
