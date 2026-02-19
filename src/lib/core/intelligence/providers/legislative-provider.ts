/**
 * Legislative Intelligence Provider
 *
 * Tracks bills, votes, and legislative activity from Congress and state legislatures.
 * Uses Congress.gov API or similar sources for federal legislation.
 */

import type {
	IntelligenceQuery,
	IntelligenceItem,
	IntelligenceCategory
} from '../types';
import { BaseIntelligenceProvider } from './base';

export class LegislativeProvider extends BaseIntelligenceProvider {
	readonly name = 'legislative';
	readonly categories: readonly IntelligenceCategory[] = ['legislative'];

	/**
	 * Legislative data changes less frequently than news
	 */
	protected get cacheHours(): number {
		return 24;
	}

	async *fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem> {
		// Only relevant for government targets
		if (
			query.targetType &&
			!['congress', 'state_legislature', 'local_government'].includes(query.targetType)
		) {
			return;
		}

		// Check cache
		const cached = await this.checkCache(query, 'legislative', this.cacheHours);

		if (cached.length > 0) {
			console.debug(`[${this.name}] Cache hit: ${cached.length} items`);
			for (const item of cached) {
				yield item;
			}
			return;
		}

		// Cache miss - fetch fresh data
		console.debug(`[${this.name}] Cache miss, fetching legislative data`);

		try {
			const items = await this.fetchLegislativeActivity(query);

			// Cache and yield
			await this.bulkCacheItems(items, 30); // Longer retention for legislation

			for (const item of items) {
				yield item;
			}
		} catch (error) {
			console.error(`[${this.name}] Failed to fetch legislative data:`, error);
			throw error;
		}
	}

	/**
	 * Fetch legislative activity from external sources
	 * NOT YET IMPLEMENTED: Requires Congress.gov API or ProPublica integration
	 */
	private async fetchLegislativeActivity(
		_query: IntelligenceQuery
	): Promise<IntelligenceItem[]> {
		throw new Error(
			'[LegislativeProvider] Not implemented. Requires Congress.gov API or ProPublica integration.'
		);
	}
}
