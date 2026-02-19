/**
 * News Intelligence Provider
 *
 * Gathers recent news coverage related to query topics.
 * For MVP, uses a placeholder implementation that can be enhanced
 * with real news APIs (NewsAPI, Perplexity) later.
 */

import type {
	IntelligenceQuery,
	IntelligenceItem,
	IntelligenceCategory
} from '../types';
import { BaseIntelligenceProvider } from './base';

export class NewsProvider extends BaseIntelligenceProvider {
	readonly name = 'news';
	readonly categories: readonly IntelligenceCategory[] = ['news'];

	/**
	 * News is time-sensitive - shorter cache duration
	 */
	protected get cacheHours(): number {
		return 4;
	}

	async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
		// Check cache first
		const cached = await this.checkCache(query, 'news', this.cacheHours);

		if (cached.length > 0) {
			console.debug(`[${this.name}] Cache hit: ${cached.length} items`);
			for (const item of cached) {
				yield item;
			}
			return;
		}

		// Cache miss - fetch fresh news
		console.debug(`[${this.name}] Cache miss, fetching fresh news`);

		try {
			const items = await this.fetchNews(query);

			// Cache and yield
			await this.bulkCacheItems(items, 7);

			for (const item of items) {
				yield item;
			}
		} catch (error) {
			console.error(`[${this.name}] Failed to fetch news:`, error);
			throw error;
		}
	}

	/**
	 * Fetch news items from external source
	 * NOT YET IMPLEMENTED: Requires NewsAPI or Perplexity integration
	 */
	private async fetchNews(_query: IntelligenceQuery): Promise<IntelligenceItem[]> {
		throw new Error(
			'[NewsProvider] Not implemented. Requires NewsAPI or Perplexity API integration.'
		);
	}
}
