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
			console.log(`[${this.name}] Cache hit: ${cached.length} items`);
			for (const item of cached) {
				yield item;
			}
			return;
		}

		// Cache miss - fetch fresh data
		console.log(`[${this.name}] Cache miss, fetching legislative data`);

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
	 * TODO: Integrate with Congress.gov API, ProPublica Congress API
	 */
	private async fetchLegislativeActivity(
		query: IntelligenceQuery
	): Promise<IntelligenceItem[]> {
		// For MVP: Return placeholder data
		// In production, this would call:
		// - Congress.gov API (free, official)
		// - ProPublica Congress API (easier to use)
		// - State legislature APIs (varies by state)
		// - GovTrack.us API

		const items: IntelligenceItem[] = [];

		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 700));

		// Generate placeholder items
		for (const topic of query.topics.slice(0, 2)) {
			const billNumber = `H.R. ${Math.floor(Math.random() * 9000) + 1000}`;

			const item: IntelligenceItem = {
				id: this.generateItemId(
					`https://www.congress.gov/bill/${billNumber}`,
					'legislative'
				),
				category: 'legislative',
				title: `${billNumber}: Legislation Related to ${topic}`,
				summary: `Placeholder bill about ${topic}. In production, this would contain actual bill summaries, sponsors, and status from Congress.gov API.`,
				sourceUrl: `https://www.congress.gov/bill/${billNumber}`,
				sourceName: 'U.S. Congress',
				publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
				relevanceScore: 0.75,
				topics: [topic],
				entities: [
					{
						name: 'House of Representatives',
						type: 'organization'
					}
				],
				isActionable: true,
				metadata: {
					placeholder: true,
					billNumber,
					status: 'Introduced',
					integrationNeeded: 'Congress.gov API or ProPublica'
				}
			};

			items.push(item);
		}

		return items;
	}

	/**
	 * Helper to determine appropriate Congress session
	 */
	private getCurrentCongress(): number {
		const year = new Date().getFullYear();
		// Congress sessions are 2 years, starting in odd years
		return Math.floor((year - 1789) / 2) + 1;
	}
}
