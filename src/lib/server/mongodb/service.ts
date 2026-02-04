/**
 * MongoDB Service Layer
 *
 * High-level service abstraction for common business operations.
 * Provides a clean API for application code to interact with MongoDB
 * without needing to know the underlying query details.
 */

import type { ObjectId } from 'mongodb';
import {
	queryIntelligence,
	insertIntelligenceItem,
	bulkInsertIntelligence
} from './queries';
import type {
	IntelligenceItemDocument,
	IntelligenceCategory
} from './schema';
import { createTTL } from './utils';

// ============================================================================
// Intelligence Service
// ============================================================================

export class IntelligenceService {
	/**
	 * Store a news article or intelligence item
	 * Automatically sets creation date and default TTL
	 */
	static async storeIntelligence(data: {
		category: IntelligenceCategory;
		title: string;
		source: string;
		sourceUrl: string;
		publishedAt: Date;
		snippet: string;
		topics?: string[];
		entities?: string[];
		embedding?: number[];
		relevanceScore?: number;
		sentiment?: IntelligenceItemDocument['sentiment'];
		geographicScope?: IntelligenceItemDocument['geographicScope'];
		retentionDays?: number;
	}): Promise<ObjectId> {
		return insertIntelligenceItem({
			category: data.category,
			title: data.title,
			source: data.source,
			sourceUrl: data.sourceUrl,
			publishedAt: data.publishedAt,
			snippet: data.snippet,
			topics: data.topics || [],
			entities: data.entities || [],
			embedding: data.embedding,
			relevanceScore: data.relevanceScore,
			sentiment: data.sentiment,
			geographicScope: data.geographicScope,
			expiresAt: createTTL(data.retentionDays || 90)
		});
	}

	/**
	 * Store multiple intelligence items in batch
	 */
	static async bulkStoreIntelligence(
		items: Parameters<typeof IntelligenceService.storeIntelligence>[0][]
	): Promise<ObjectId[]> {
		const documents = items.map((item) => ({
			category: item.category,
			title: item.title,
			source: item.source,
			sourceUrl: item.sourceUrl,
			publishedAt: item.publishedAt,
			snippet: item.snippet,
			topics: item.topics || [],
			entities: item.entities || [],
			embedding: item.embedding,
			relevanceScore: item.relevanceScore,
			sentiment: item.sentiment,
			geographicScope: item.geographicScope,
			expiresAt: createTTL(item.retentionDays || 90)
		}));

		return bulkInsertIntelligence(documents);
	}

	/**
	 * Get intelligence relevant to a message topic
	 * Returns recent, high-relevance items
	 */
	static async getRelevantIntelligence(params: {
		topics: string[];
		categories?: IntelligenceCategory[];
		minRelevanceScore?: number;
		limit?: number;
	}): Promise<IntelligenceItemDocument[]> {
		const items: IntelligenceItemDocument[] = [];

		// Query each category if specified, otherwise query all
		const categories = params.categories || [
			'news',
			'legislative',
			'regulatory'
		];

		for (const category of categories) {
			const results = await queryIntelligence({
				category,
				topics: params.topics,
				minRelevanceScore: params.minRelevanceScore || 0.5,
				limit: Math.ceil((params.limit || 10) / categories.length)
			});
			items.push(...results);
		}

		// Sort by relevance and date
		return items
			.sort((a, b) => {
				const scoreA = a.relevanceScore || 0;
				const scoreB = b.relevanceScore || 0;
				if (scoreA !== scoreB) return scoreB - scoreA;
				return b.publishedAt.getTime() - a.publishedAt.getTime();
			})
			.slice(0, params.limit || 10);
	}
}

// ============================================================================
// Unified MongoDB Service
// ============================================================================

/**
 * Main service class that combines all MongoDB operations
 * Use this for a unified interface to the database
 */
export class MongoDBService {
	static intelligence = IntelligenceService;

	/**
	 * Health check for MongoDB connection
	 */
	static async healthCheck(): Promise<{
		connected: boolean;
		database: string;
		collections: number;
	}> {
		try {
			const { testMongoConnection, getDatabase } = await import('../mongodb');

			const connected = await testMongoConnection();
			if (!connected) {
				return { connected: false, database: '', collections: 0 };
			}

			const db = await getDatabase();
			const collections = await db.listCollections().toArray();

			return {
				connected: true,
				database: db.databaseName,
				collections: collections.length
			};
		} catch (error) {
			console.error('MongoDB health check failed:', error);
			return { connected: false, database: '', collections: 0 };
		}
	}

	/**
	 * Get comprehensive database statistics
	 */
	static async getStatistics(): Promise<{
		intelligence: number;
	}> {
		const intelCol = await import('./collections').then((m) =>
			m.getIntelligenceCollection()
		);

		const intelligence = await intelCol.countDocuments();

		return {
			intelligence
		};
	}
}

// Export everything
export default MongoDBService;
