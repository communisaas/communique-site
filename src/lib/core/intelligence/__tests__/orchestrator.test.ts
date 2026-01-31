/**
 * Intelligence Orchestrator Tests
 *
 * Tests for the intelligence gathering system.
 * These tests use mock providers to verify orchestration behavior
 * without requiring external API calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntelligenceOrchestrator } from '../orchestrator';
import { BaseIntelligenceProvider } from '../providers/base';
import type { IntelligenceQuery, IntelligenceItem } from '../types';

// ============================================================================
// Mock Providers
// ============================================================================

/**
 * Fast mock provider that yields items immediately
 */
class FastMockProvider extends BaseIntelligenceProvider {
	readonly name = 'fast-mock';
	readonly categories = ['news' as const];

	constructor(private itemCount: number = 3) {
		super();
	}

	async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
		for (let i = 0; i < this.itemCount; i++) {
			yield {
				id: `fast-${i}`,
				category: 'news',
				title: `Fast Item ${i}`,
				summary: `Summary for fast item ${i}`,
				sourceUrl: `https://fast.com/item-${i}`,
				sourceName: 'Fast Source',
				publishedAt: new Date(),
				relevanceScore: 0.8,
				topics: query.topics,
				entities: []
			};
		}
	}
}

/**
 * Slow mock provider that simulates network delay
 */
class SlowMockProvider extends BaseIntelligenceProvider {
	readonly name = 'slow-mock';
	readonly categories = ['legislative' as const];

	constructor(
		private itemCount: number = 2,
		private delayMs: number = 100
	) {
		super();
	}

	async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
		for (let i = 0; i < this.itemCount; i++) {
			await new Promise((resolve) => setTimeout(resolve, this.delayMs));

			yield {
				id: `slow-${i}`,
				category: 'legislative',
				title: `Slow Item ${i}`,
				summary: `Summary for slow item ${i}`,
				sourceUrl: `https://slow.com/item-${i}`,
				sourceName: 'Slow Source',
				publishedAt: new Date(),
				relevanceScore: 0.7,
				topics: query.topics,
				entities: []
			};
		}
	}
}

/**
 * Provider that fails after yielding some items
 */
class FailingMockProvider extends BaseIntelligenceProvider {
	readonly name = 'failing-mock';
	readonly categories = ['corporate' as const];

	constructor(private itemsBeforeFailure: number = 1) {
		super();
	}

	async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
		for (let i = 0; i < this.itemsBeforeFailure; i++) {
			yield {
				id: `failing-${i}`,
				category: 'corporate',
				title: `Item ${i} Before Failure`,
				summary: 'This item succeeded',
				sourceUrl: `https://failing.com/item-${i}`,
				sourceName: 'Failing Source',
				publishedAt: new Date(),
				relevanceScore: 0.6,
				topics: query.topics,
				entities: []
			};
		}

		throw new Error('Provider failed intentionally');
	}
}

// ============================================================================
// Tests
// ============================================================================

describe('IntelligenceOrchestrator', () => {
	let orchestrator: IntelligenceOrchestrator;

	beforeEach(() => {
		orchestrator = new IntelligenceOrchestrator();
		// Clear default providers for isolated testing
		orchestrator.unregisterProvider('news');
		orchestrator.unregisterProvider('legislative');
		orchestrator.unregisterProvider('corporate');
	});

	describe('provider registration', () => {
		it('registers and unregisters providers', () => {
			const provider = new FastMockProvider();

			orchestrator.registerProvider(provider);
			expect(orchestrator.unregisterProvider('fast-mock')).toBe(true);
			expect(orchestrator.unregisterProvider('fast-mock')).toBe(false);
		});
	});

	describe('basic streaming', () => {
		it('streams items from a single provider', async () => {
			orchestrator.registerProvider(new FastMockProvider(5));

			const items: IntelligenceItem[] = [];
			for await (const item of orchestrator.stream({ topics: ['test'] })) {
				items.push(item);
			}

			expect(items).toHaveLength(5);
			expect(items[0].category).toBe('news');
			expect(items[0].title).toContain('Fast Item');
		});

		it('merges streams from multiple providers in parallel', async () => {
			orchestrator.registerProvider(new FastMockProvider(3));
			orchestrator.registerProvider(new SlowMockProvider(2, 50));

			const items: IntelligenceItem[] = [];
			const startTime = Date.now();

			for await (const item of orchestrator.stream({ topics: ['test'] })) {
				items.push(item);
			}

			const elapsed = Date.now() - startTime;

			// Should have items from both providers
			expect(items).toHaveLength(5);
			expect(items.some((i) => i.category === 'news')).toBe(true);
			expect(items.some((i) => i.category === 'legislative')).toBe(true);

			// Should complete in parallel time, not sequential
			// (2 slow items * 50ms = 100ms, not 150ms sequential)
			expect(elapsed).toBeLessThan(200);
		});
	});

	describe('deduplication', () => {
		it('deduplicates items by URL across providers', async () => {
			// Create providers that yield duplicate URLs
			class DuplicateProvider1 extends BaseIntelligenceProvider {
				readonly name = 'dup1';
				readonly categories = ['news' as const];

				async *fetch(): AsyncGenerator<IntelligenceItem> {
					yield {
						id: 'dup-1',
						category: 'news',
						title: 'Duplicate from Provider 1',
						summary: 'Summary',
						sourceUrl: 'https://example.com/article',
						sourceName: 'Source 1',
						publishedAt: new Date(),
						relevanceScore: 0.9,
						topics: [],
						entities: []
					};
				}
			}

			class DuplicateProvider2 extends BaseIntelligenceProvider {
				readonly name = 'dup2';
				readonly categories = ['legislative' as const];

				async *fetch(): AsyncGenerator<IntelligenceItem> {
					yield {
						id: 'dup-2',
						category: 'legislative',
						title: 'Duplicate from Provider 2',
						summary: 'Summary',
						sourceUrl: 'https://example.com/article', // Same URL
						sourceName: 'Source 2',
						publishedAt: new Date(),
						relevanceScore: 0.8,
						topics: [],
						entities: []
					};
				}
			}

			orchestrator.registerProvider(new DuplicateProvider1());
			orchestrator.registerProvider(new DuplicateProvider2());

			const items: IntelligenceItem[] = [];
			for await (const item of orchestrator.stream({ topics: ['test'] })) {
				items.push(item);
			}

			// Only one item should be yielded (first one wins)
			expect(items).toHaveLength(1);
			expect(items[0].sourceUrl).toBe('https://example.com/article');
		});
	});

	describe('filtering', () => {
		it('filters by minimum relevance score', async () => {
			class VariableRelevanceProvider extends BaseIntelligenceProvider {
				readonly name = 'variable';
				readonly categories = ['news' as const];

				async *fetch(): AsyncGenerator<IntelligenceItem> {
					for (let i = 0; i < 5; i++) {
						yield {
							id: `var-${i}`,
							category: 'news',
							title: `Item ${i}`,
							summary: 'Summary',
							sourceUrl: `https://example.com/${i}`,
							sourceName: 'Source',
							publishedAt: new Date(),
							relevanceScore: i * 0.2, // 0, 0.2, 0.4, 0.6, 0.8
							topics: [],
							entities: []
						};
					}
				}
			}

			orchestrator.registerProvider(new VariableRelevanceProvider());

			const items: IntelligenceItem[] = [];
			for await (const item of orchestrator.stream(
				{ topics: ['test'] },
				{ minRelevanceScore: 0.5 }
			)) {
				items.push(item);
			}

			// Only items with score >= 0.5 (0.6 and 0.8)
			expect(items).toHaveLength(2);
			expect(items.every((i) => i.relevanceScore >= 0.5)).toBe(true);
		});

		it('limits items per provider', async () => {
			orchestrator.registerProvider(new FastMockProvider(10));

			const items: IntelligenceItem[] = [];
			for await (const item of orchestrator.stream(
				{ topics: ['test'] },
				{ maxItemsPerProvider: 3 }
			)) {
				items.push(item);
			}

			expect(items).toHaveLength(3);
		});

		it('filters by category', async () => {
			orchestrator.registerProvider(new FastMockProvider(3));
			orchestrator.registerProvider(new SlowMockProvider(2));

			const items: IntelligenceItem[] = [];
			for await (const item of orchestrator.stream(
				{ topics: ['test'] },
				{ categories: ['news'] } // Only news category
			)) {
				items.push(item);
			}

			expect(items).toHaveLength(3);
			expect(items.every((i) => i.category === 'news')).toBe(true);
		});
	});

	describe('error handling', () => {
		it('continues when a provider fails', async () => {
			orchestrator.registerProvider(new FastMockProvider(3));
			orchestrator.registerProvider(new FailingMockProvider(1));

			const items: IntelligenceItem[] = [];
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			for await (const item of orchestrator.stream({ topics: ['test'] })) {
				items.push(item);
			}

			// Should get items from fast provider + 1 from failing provider before it fails
			expect(items.length).toBeGreaterThanOrEqual(3);
			expect(items.some((i) => i.category === 'news')).toBe(true);

			// Error should be logged
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('respects provider timeout', async () => {
			class SlowProvider extends BaseIntelligenceProvider {
				readonly name = 'too-slow';
				readonly categories = ['news' as const];

				async *fetch(): AsyncGenerator<IntelligenceItem> {
					// Delay longer than timeout
					await new Promise((resolve) => setTimeout(resolve, 5000));

					yield {
						id: 'too-slow',
						category: 'news',
						title: 'This should timeout',
						summary: 'Summary',
						sourceUrl: 'https://slow.com',
						sourceName: 'Slow',
						publishedAt: new Date(),
						relevanceScore: 0.8,
						topics: [],
						entities: []
					};
				}
			}

			orchestrator.registerProvider(new SlowProvider());

			const items: IntelligenceItem[] = [];
			const startTime = Date.now();

			for await (const item of orchestrator.stream(
				{ topics: ['test'] },
				{ providerTimeoutMs: 100 } // 100ms timeout
			)) {
				items.push(item);
			}

			const elapsed = Date.now() - startTime;

			// Should timeout quickly, not wait 5 seconds
			expect(elapsed).toBeLessThan(1000);
			expect(items).toHaveLength(0); // No items before timeout
		});
	});

	describe('event streaming', () => {
		it('emits item events', async () => {
			orchestrator.registerProvider(new FastMockProvider(2));

			const events = [];
			for await (const event of orchestrator.streamWithEvents({ topics: ['test'] })) {
				events.push(event);
			}

			const itemEvents = events.filter((e) => e.type === 'item');
			expect(itemEvents).toHaveLength(2);
		});

		it('emits complete events', async () => {
			orchestrator.registerProvider(new FastMockProvider(2));

			const events = [];
			for await (const event of orchestrator.streamWithEvents({ topics: ['test'] })) {
				events.push(event);
			}

			const completeEvents = events.filter((e) => e.type === 'complete');
			expect(completeEvents.length).toBeGreaterThan(0);

			const completeEvent = completeEvents[0];
			expect(completeEvent.type).toBe('complete');
			if (completeEvent.type === 'complete') {
				expect(completeEvent.totalItems).toBe(2);
				expect(completeEvent.durationMs).toBeGreaterThanOrEqual(0);
			}
		});

		it('emits error events on failure', async () => {
			orchestrator.registerProvider(new FailingMockProvider(0));

			const events = [];
			for await (const event of orchestrator.streamWithEvents({ topics: ['test'] })) {
				events.push(event);
			}

			const errorEvents = events.filter((e) => e.type === 'error');
			expect(errorEvents.length).toBeGreaterThan(0);

			const errorEvent = errorEvents[0];
			if (errorEvent.type === 'error') {
				expect(errorEvent.error).toContain('failed');
			}
		});
	});

	describe('gather (non-streaming)', () => {
		it('gathers all items at once', async () => {
			orchestrator.registerProvider(new FastMockProvider(3));
			orchestrator.registerProvider(new SlowMockProvider(2));

			const items = await orchestrator.gather({ topics: ['test'] });

			expect(items).toHaveLength(5);
			expect(Array.isArray(items)).toBe(true);
		});
	});

	describe('provider relevance', () => {
		it('excludes legislative provider for corporate targets', async () => {
			orchestrator.registerProvider(new FastMockProvider(2)); // News - always relevant
			orchestrator.registerProvider(new SlowMockProvider(2)); // Legislative

			const items: IntelligenceItem[] = [];
			for await (const item of orchestrator.stream({
				topics: ['test'],
				targetType: 'corporate',
				targetEntity: 'TestCorp'
			})) {
				items.push(item);
			}

			// Should only get news items (legislative excluded for corporate target)
			expect(items.every((i) => i.category === 'news')).toBe(true);
		});

		it('includes legislative provider for congress targets', async () => {
			orchestrator.registerProvider(new FastMockProvider(2)); // News
			orchestrator.registerProvider(new SlowMockProvider(2)); // Legislative

			const items: IntelligenceItem[] = [];
			for await (const item of orchestrator.stream({
				topics: ['test'],
				targetType: 'congress'
			})) {
				items.push(item);
			}

			// Should get both news and legislative
			expect(items.some((i) => i.category === 'news')).toBe(true);
			expect(items.some((i) => i.category === 'legislative')).toBe(true);
		});
	});
});
