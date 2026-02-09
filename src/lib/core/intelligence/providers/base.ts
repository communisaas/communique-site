/**
 * Base Intelligence Provider
 *
 * Abstract base class providing common functionality for intelligence providers.
 * Handles caching, error recovery, and common utility methods.
 */

import type {
	IntelligenceProvider,
	IntelligenceQuery,
	IntelligenceItem,
	IntelligenceCategory
} from '../types';
import { IntelligenceService } from '$lib/server/intelligence/service';
import type { IntelligenceItem as IntelligenceItemDocument } from '$lib/server/intelligence/types';

/**
 * Abstract base provider with common caching and utility methods
 */
export abstract class BaseIntelligenceProvider implements IntelligenceProvider {
	abstract readonly name: string;
	abstract readonly categories: readonly IntelligenceCategory[];

	/**
	 * Default cache duration in hours
	 * Override in subclass for category-specific caching
	 */
	protected get cacheHours(): number {
		return 24;
	}

	/**
	 * Check MongoDB cache for existing intelligence
	 * Returns cached items that match the query and are still fresh
	 */
	protected async checkCache(
		query: IntelligenceQuery,
		category: IntelligenceCategory,
		maxAgeHours = this.cacheHours
	): Promise<IntelligenceItem[]> {
		const cutoffDate = new Date();
		cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

		const cached = await IntelligenceService.getRelevantIntelligence({
			topics: query.topics,
			categories: [category],
			minRelevanceScore: 0.5,
			limit: 20
		});

		// Filter to items within cache window
		return cached
			.filter(
				(item) =>
					item.publishedAt >= cutoffDate && (!item.expiresAt || item.expiresAt > new Date())
			)
			.map((doc) => this.documentToItem(doc));
	}

	/**
	 * Cache an intelligence item to MongoDB
	 */
	protected async cacheItem(
		item: IntelligenceItem,
		retentionDays = 7
	): Promise<void> {
		try {
			await IntelligenceService.storeIntelligence({
				category: item.category,
				title: item.title,
				source: item.sourceName,
				sourceUrl: item.sourceUrl,
				publishedAt: item.publishedAt,
				snippet: item.summary,
				topics: item.topics,
				entities: item.entities.map((e) => e.name),
				relevanceScore: item.relevanceScore,
				sentiment: item.sentiment,
				retentionDays
			});
		} catch (error) {
			// Don't fail the stream if caching fails
			console.error(`[${this.name}] Failed to cache item:`, error);
		}
	}

	/**
	 * Bulk cache multiple items
	 */
	protected async bulkCacheItems(
		items: IntelligenceItem[],
		retentionDays = 7
	): Promise<void> {
		try {
			await IntelligenceService.bulkStoreIntelligence(
				items.map((item) => ({
					category: item.category,
					title: item.title,
					source: item.sourceName,
					sourceUrl: item.sourceUrl,
					publishedAt: item.publishedAt,
					snippet: item.summary,
					topics: item.topics,
					entities: item.entities.map((e) => e.name),
					relevanceScore: item.relevanceScore,
					sentiment: item.sentiment,
					retentionDays
				}))
			);
		} catch (error) {
			console.error(`[${this.name}] Failed to bulk cache items:`, error);
		}
	}

	/**
	 * Convert MongoDB document to IntelligenceItem
	 */
	protected documentToItem(doc: IntelligenceItemDocument): IntelligenceItem {
		return {
			id: doc._id.toString(),
			category: doc.category,
			title: doc.title,
			summary: doc.snippet,
			sourceUrl: doc.sourceUrl,
			sourceName: doc.source,
			publishedAt: doc.publishedAt,
			relevanceScore: doc.relevanceScore || 0.5,
			topics: doc.topics,
			entities: doc.entities.map((name) => ({
				name,
				type: 'other' as const
			})),
			sentiment: doc.sentiment,
			isActionable: true
		};
	}

	/**
	 * Generate a unique ID for an item based on URL
	 */
	protected generateItemId(url: string, category: IntelligenceCategory): string {
		// Simple hash function for consistency
		let hash = 0;
		const input = `${category}:${url}`;

		for (let i = 0; i < input.length; i++) {
			const char = input.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}

		return `${category}_${Math.abs(hash).toString(16)}`;
	}

	/**
	 * Calculate relevance score based on topic matching
	 * Simple heuristic - can be overridden for more sophisticated scoring
	 */
	protected calculateRelevance(
		text: string,
		topics: string[]
	): number {
		const lowerText = text.toLowerCase();
		const matches = topics.filter((topic) =>
			lowerText.includes(topic.toLowerCase())
		);

		if (matches.length === 0) return 0.3;
		if (matches.length === topics.length) return 1.0;

		return 0.5 + (matches.length / topics.length) * 0.5;
	}

	/**
	 * Abstract method - subclasses must implement
	 */
	abstract fetch(query: IntelligenceQuery): AsyncGenerator<IntelligenceItem>;
}
