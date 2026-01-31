/**
 * MongoDB Service Layer
 *
 * High-level service abstraction for common business operations.
 * Provides a clean API for application code to interact with MongoDB
 * without needing to know the underlying query details.
 */

import type { ObjectId } from 'mongodb';
import {
	findOrganizationByName,
	findOrganizationByWebsite,
	upsertOrganization,
	queryIntelligence,
	insertIntelligenceItem,
	bulkInsertIntelligence,
	findCachedDecisionMakers,
	cacheDecisionMakers,
	getCacheStatistics
} from './queries';
import type {
	OrganizationDocument,
	IntelligenceItemDocument,
	DecisionMakerDocument,
	IntelligenceCategory,
	TargetType
} from './schema';
import { generateQueryHash, normalizeName, createTTL } from './utils';

// ============================================================================
// Organization Service
// ============================================================================

export class OrganizationService {
	/**
	 * Find organization by name or website
	 * Tries name first, then falls back to website
	 */
	static async findOrganization(
		identifier: string
	): Promise<OrganizationDocument | null> {
		// Try by name first
		let org = await findOrganizationByName(identifier);

		// If not found and looks like a URL, try by website
		if (!org && (identifier.includes('.') || identifier.startsWith('http'))) {
			org = await findOrganizationByWebsite(identifier);
		}

		return org;
	}

	/**
	 * Cache an organization profile from Firecrawl
	 * Sets sensible defaults for TTL and metadata
	 */
	static async cacheOrganizationProfile(data: {
		name: string;
		website: string;
		about?: string;
		industry?: string;
		headquarters?: OrganizationDocument['headquarters'];
		leadership?: OrganizationDocument['leadership'];
		policyPositions?: OrganizationDocument['policyPositions'];
		contacts?: OrganizationDocument['contacts'];
		embedding?: number[];
		cacheDays?: number;
	}): Promise<ObjectId> {
		return upsertOrganization({
			name: data.name,
			normalizedName: normalizeName(data.name),
			website: data.website,
			about: data.about,
			industry: data.industry,
			headquarters: data.headquarters,
			leadership: data.leadership || [],
			policyPositions: data.policyPositions || [],
			contacts: data.contacts || {},
			embedding: data.embedding,
			source: 'firecrawl',
			createdAt: new Date(),
			updatedAt: new Date(),
			expiresAt: createTTL(data.cacheDays || 30)
		});
	}

	/**
	 * Get organizations that should be refreshed
	 * Returns orgs whose cache is expiring soon
	 */
	static async getOrganizationsNeedingRefresh(
		daysThreshold = 7
	): Promise<OrganizationDocument[]> {
		const collection = await import('./collections').then((m) =>
			m.getOrganizationsCollection()
		);

		const thresholdDate = new Date();
		thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

		return collection
			.find({
				expiresAt: { $lte: thresholdDate, $gte: new Date() }
			})
			.toArray();
	}
}

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
// Decision Maker Cache Service
// ============================================================================

export class DecisionMakerCacheService {
	/**
	 * Get decision makers with automatic caching
	 * Checks cache first, returns cached results if available
	 */
	static async getDecisionMakers(params: {
		targetType: TargetType;
		targetEntity: string;
		topics?: string[];
		geographicScope?: string;
		provider?: string;
		cacheDays?: number;
		// Callback to fetch if cache miss
		fetchFn?: () => Promise<DecisionMakerDocument[]>;
	}): Promise<{
		decisionMakers: DecisionMakerDocument[];
		cached: boolean;
	}> {
		// Generate cache key
		const queryHash = generateQueryHash({
			targetType: params.targetType,
			targetEntity: params.targetEntity,
			topics: params.topics || [],
			geographicScope: params.geographicScope
		});

		// Check cache
		const cached = await findCachedDecisionMakers(queryHash);
		if (cached) {
			return {
				decisionMakers: cached.decisionMakers,
				cached: true
			};
		}

		// Cache miss - fetch if function provided
		if (params.fetchFn) {
			const decisionMakers = await params.fetchFn();

			// Cache the results
			await cacheDecisionMakers({
				queryHash,
				targetType: params.targetType,
				targetEntity: params.targetEntity,
				topics: params.topics,
				geographicScope: params.geographicScope,
				decisionMakers,
				provider: params.provider || 'unknown',
				expiresAt: createTTL(params.cacheDays || 7)
			});

			return {
				decisionMakers,
				cached: false
			};
		}

		// No fetch function and cache miss
		return {
			decisionMakers: [],
			cached: false
		};
	}

	/**
	 * Invalidate cache for specific parameters
	 */
	static async invalidateCache(params: {
		targetType: TargetType;
		targetEntity: string;
		topics?: string[];
		geographicScope?: string;
	}): Promise<boolean> {
		const queryHash = generateQueryHash({
			targetType: params.targetType,
			targetEntity: params.targetEntity,
			topics: params.topics || [],
			geographicScope: params.geographicScope
		});

		const collection = await import('./collections').then((m) =>
			m.getDecisionMakerCacheCollection()
		);

		const result = await collection.deleteOne({ queryHash });
		return result.deletedCount > 0;
	}

	/**
	 * Get cache performance metrics
	 */
	static async getCacheMetrics(): Promise<{
		totalEntries: number;
		byProvider: Array<{
			provider: string;
			entries: number;
			totalHits: number;
			avgHitCount: number;
		}>;
	}> {
		const stats = await getCacheStatistics();

		const totalEntries = stats.reduce(
			(sum, stat) => sum + (stat.totalEntries as number),
			0
		);

		const byProvider = stats.map((stat) => ({
			provider: stat._id as string,
			entries: stat.totalEntries as number,
			totalHits: stat.totalHits as number,
			avgHitCount: stat.avgHitCount as number
		}));

		return {
			totalEntries,
			byProvider
		};
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
	static organizations = OrganizationService;
	static intelligence = IntelligenceService;
	static decisionMakers = DecisionMakerCacheService;

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
		organizations: number;
		intelligence: number;
		cacheEntries: number;
		cacheMetrics: Awaited<
			ReturnType<typeof DecisionMakerCacheService.getCacheMetrics>
		>;
	}> {
		const [orgsCol, intelCol, cacheCol] = await Promise.all([
			import('./collections').then((m) => m.getOrganizationsCollection()),
			import('./collections').then((m) => m.getIntelligenceCollection()),
			import('./collections').then((m) => m.getDecisionMakerCacheCollection())
		]);

		const [organizations, intelligence, cacheEntries, cacheMetrics] =
			await Promise.all([
				orgsCol.countDocuments(),
				intelCol.countDocuments(),
				cacheCol.countDocuments(),
				DecisionMakerCacheService.getCacheMetrics()
			]);

		return {
			organizations,
			intelligence,
			cacheEntries,
			cacheMetrics
		};
	}
}

// Export everything
export default MongoDBService;
