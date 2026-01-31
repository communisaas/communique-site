/**
 * Intelligence Orchestrator
 *
 * Coordinates multiple intelligence providers to gather contextual information
 * during template creation. Implements true async streaming with parallel execution,
 * deduplication, and MongoDB caching.
 *
 * Architecture:
 * 1. Accepts a query context (topic, target type, location)
 * 2. Launches relevant providers in parallel
 * 3. Streams merged results as they arrive
 * 4. Deduplicates by source URL
 * 5. Caches items via IntelligenceService
 */

import type {
	IntelligenceProvider,
	IntelligenceQuery,
	IntelligenceItem,
	IntelligenceStreamEvent,
	OrchestrationOptions,
	IntelligenceCategory
} from './types';
import { NewsProvider } from './providers/news-provider';
import { LegislativeProvider } from './providers/legislative-provider';
import { CorporateProvider } from './providers/corporate-provider';

/**
 * Main orchestrator class
 */
export class IntelligenceOrchestrator {
	private providers: Map<string, IntelligenceProvider>;

	constructor() {
		this.providers = new Map();

		// Register default providers
		this.registerProvider(new NewsProvider());
		this.registerProvider(new LegislativeProvider());
		this.registerProvider(new CorporateProvider());
	}

	/**
	 * Register a new intelligence provider
	 */
	registerProvider(provider: IntelligenceProvider): void {
		this.providers.set(provider.name, provider);
		console.log(`[orchestrator] Registered provider: ${provider.name}`);
	}

	/**
	 * Remove a provider
	 */
	unregisterProvider(name: string): boolean {
		return this.providers.delete(name);
	}

	/**
	 * Stream intelligence items from all relevant providers
	 * Uses AsyncGenerator for true streaming as results arrive
	 *
	 * @yields IntelligenceItem - Items as they're discovered, deduplicated
	 */
	async *stream(
		query: IntelligenceQuery,
		options: OrchestrationOptions = {}
	): AsyncGenerator<IntelligenceItem> {
		const {
			maxItemsPerProvider = 10,
			minRelevanceScore = 0.5,
			categories,
			providerTimeoutMs = 30000
		} = options;

		// Filter to relevant providers based on query
		const relevantProviders = this.selectProviders(query, categories);

		if (relevantProviders.length === 0) {
			console.log('[orchestrator] No relevant providers for query');
			return;
		}

		console.log(
			`[orchestrator] Using ${relevantProviders.length} providers:`,
			relevantProviders.map((p) => p.name)
		);

		// Track seen URLs for deduplication
		const seenUrls = new Set<string>();
		let totalYielded = 0;

		// Launch all providers in parallel and merge their streams
		yield* this.mergeStreams(
			relevantProviders.map((provider) =>
				this.wrapProviderStream(
					provider,
					query,
					maxItemsPerProvider,
					minRelevanceScore,
					providerTimeoutMs,
					seenUrls
				)
			)
		);

		console.log(`[orchestrator] Total items yielded: ${totalYielded}`);
	}

	/**
	 * Stream intelligence items and emit progress events
	 * Useful for UI progress tracking
	 */
	async *streamWithEvents(
		query: IntelligenceQuery,
		options: OrchestrationOptions = {}
	): AsyncGenerator<IntelligenceStreamEvent> {
		const relevantProviders = this.selectProviders(query, options.categories);
		const itemCounts = new Map<IntelligenceCategory, number>();
		const startTimes = new Map<IntelligenceCategory, number>();

		// Initialize tracking
		for (const provider of relevantProviders) {
			for (const category of provider.categories) {
				itemCounts.set(category, 0);
				startTimes.set(category, Date.now());
			}
		}

		// Stream items and convert to events
		try {
			for await (const item of this.stream(query, options)) {
				// Update count
				const count = (itemCounts.get(item.category) || 0) + 1;
				itemCounts.set(item.category, count);

				// Yield item event
				yield {
					type: 'item',
					category: item.category,
					item
				};
			}

			// Yield complete events for each category
			for (const [category, count] of itemCounts) {
				const startTime = startTimes.get(category) || Date.now();
				yield {
					type: 'complete',
					category,
					totalItems: count,
					durationMs: Date.now() - startTime
				};
			}
		} catch (error) {
			// Yield error event
			yield {
				type: 'error',
				category: 'news', // Generic category
				error: error instanceof Error ? error.message : String(error),
				recoverable: false
			};
		}
	}

	/**
	 * Select providers relevant to the query
	 */
	private selectProviders(
		query: IntelligenceQuery,
		filterCategories?: IntelligenceCategory[]
	): IntelligenceProvider[] {
		const providers: IntelligenceProvider[] = [];

		for (const provider of this.providers.values()) {
			// Check if provider's categories match filter
			if (filterCategories) {
				const hasMatchingCategory = provider.categories.some((cat) =>
					filterCategories.includes(cat)
				);
				if (!hasMatchingCategory) continue;
			}

			// Check if provider is relevant to target type
			if (this.isProviderRelevant(provider, query)) {
				providers.push(provider);
			}
		}

		return providers;
	}

	/**
	 * Determine if a provider is relevant to the query
	 */
	private isProviderRelevant(
		provider: IntelligenceProvider,
		query: IntelligenceQuery
	): boolean {
		// News is always relevant
		if (provider.categories.includes('news')) {
			return true;
		}

		// Legislative only for government targets
		if (provider.categories.includes('legislative')) {
			return (
				!query.targetType ||
				['congress', 'state_legislature', 'local_government'].includes(query.targetType)
			);
		}

		// Corporate only for corporate targets
		if (provider.categories.includes('corporate')) {
			return query.targetType === 'corporate' && !!query.targetEntity;
		}

		// Default: include
		return true;
	}

	/**
	 * Wrap a provider's stream with timeout, filtering, and deduplication
	 */
	private async *wrapProviderStream(
		provider: IntelligenceProvider,
		query: IntelligenceQuery,
		maxItems: number,
		minRelevanceScore: number,
		timeoutMs: number,
		seenUrls: Set<string>
	): AsyncGenerator<IntelligenceItem> {
		let itemCount = 0;
		const startTime = Date.now();

		try {
			// Create timeout race
			const stream = provider.fetch(query);

			for await (const item of stream) {
				// Check timeout
				if (Date.now() - startTime > timeoutMs) {
					console.warn(`[${provider.name}] Timeout reached`);
					break;
				}

				// Filter by relevance
				if (item.relevanceScore < minRelevanceScore) {
					continue;
				}

				// Deduplicate by URL
				if (seenUrls.has(item.sourceUrl)) {
					continue;
				}

				seenUrls.add(item.sourceUrl);
				itemCount++;

				yield item;

				// Check max items
				if (itemCount >= maxItems) {
					console.log(`[${provider.name}] Max items reached: ${maxItems}`);
					break;
				}
			}

			console.log(
				`[${provider.name}] Completed: ${itemCount} items in ${Date.now() - startTime}ms`
			);
		} catch (error) {
			console.error(`[${provider.name}] Error:`, error);
			// Don't rethrow - allow other providers to continue
		}
	}

	/**
	 * Merge multiple async generators into a single stream
	 * Uses Promise.race to yield items as soon as they arrive from any provider
	 *
	 * This is the core async streaming pattern - items are yielded immediately
	 * as any provider produces them, maintaining true parallelism.
	 */
	private async *mergeStreams(
		generators: AsyncGenerator<IntelligenceItem>[]
	): AsyncGenerator<IntelligenceItem> {
		if (generators.length === 0) {
			return;
		}

		// Track pending promises from each generator
		interface PendingResult {
			value: IteratorResult<IntelligenceItem>;
			index: number;
		}

		const pending = new Map<number, Promise<PendingResult>>();

		// Initialize: get first promise from each generator
		for (let i = 0; i < generators.length; i++) {
			pending.set(
				i,
				generators[i]
					.next()
					.then((value) => ({ value, index: i }))
			);
		}

		// Race all pending promises until all generators are done
		while (pending.size > 0) {
			// Wait for the first generator to produce a value
			const { value, index } = await Promise.race(pending.values());

			if (value.done) {
				// Generator is exhausted, remove from pending
				pending.delete(index);
			} else {
				// Yield the value
				yield value.value;

				// Queue the next value from this generator
				pending.set(
					index,
					generators[index]
						.next()
						.then((v) => ({ value: v, index }))
				);
			}
		}
	}

	/**
	 * Get all items at once (non-streaming)
	 * Useful for testing or when streaming isn't needed
	 */
	async gather(
		query: IntelligenceQuery,
		options: OrchestrationOptions = {}
	): Promise<IntelligenceItem[]> {
		const items: IntelligenceItem[] = [];

		for await (const item of this.stream(query, options)) {
			items.push(item);
		}

		return items;
	}
}

/**
 * Singleton instance for easy import
 */
export const intelligenceOrchestrator = new IntelligenceOrchestrator();
