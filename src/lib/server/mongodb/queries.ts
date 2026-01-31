/**
 * MongoDB Query Builders
 *
 * Type-safe query builders for common database operations.
 * Provides a fluent API for constructing MongoDB queries.
 */

import type { Filter, FindOptions, ObjectId } from 'mongodb';
import {
	getOrganizationsCollection,
	getIntelligenceCollection,
	getDecisionMakerCacheCollection
} from './collections';
import type {
	OrganizationDocument,
	IntelligenceItemDocument,
	DecisionMakerCacheDocument,
	IntelligenceCategory,
	GeographicScope
} from './schema';
import { normalizeName, buildTopicQuery, isExpired } from './utils';

// ============================================================================
// Organization Queries
// ============================================================================

/**
 * Find organization by normalized name
 */
export async function findOrganizationByName(
	name: string
): Promise<OrganizationDocument | null> {
	const collection = await getOrganizationsCollection();
	const normalized = normalizeName(name);

	return collection.findOne({ normalizedName: normalized });
}

/**
 * Find organization by website domain
 */
export async function findOrganizationByWebsite(
	website: string
): Promise<OrganizationDocument | null> {
	const collection = await getOrganizationsCollection();

	// Try exact match first
	let org = await collection.findOne({ website });

	// If not found, try without protocol
	if (!org) {
		const domain = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
		org = await collection.findOne({
			website: { $regex: domain, $options: 'i' }
		});
	}

	return org;
}

/**
 * Search organizations by text
 */
export async function searchOrganizations(
	searchText: string,
	options: FindOptions = {}
): Promise<OrganizationDocument[]> {
	const collection = await getOrganizationsCollection();

	return collection
		.find(
			{ $text: { $search: searchText } },
			{
				...options,
				projection: {
					...options.projection,
					score: { $meta: 'textScore' }
				},
				sort: { score: { $meta: 'textScore' } }
			}
		)
		.toArray();
}

/**
 * Find organizations by industry
 */
export async function findOrganizationsByIndustry(
	industry: string,
	limit = 50
): Promise<OrganizationDocument[]> {
	const collection = await getOrganizationsCollection();

	return collection
		.find({ industry })
		.sort({ createdAt: -1 })
		.limit(limit)
		.toArray();
}

/**
 * Upsert organization (create or update)
 */
export async function upsertOrganization(
	org: Omit<OrganizationDocument, '_id'>
): Promise<ObjectId> {
	const collection = await getOrganizationsCollection();

	const result = await collection.findOneAndUpdate(
		{ normalizedName: org.normalizedName },
		{
			$set: {
				...org,
				updatedAt: new Date()
			},
			$setOnInsert: {
				createdAt: new Date()
			}
		},
		{
			upsert: true,
			returnDocument: 'after'
		}
	);

	return result!._id;
}

// ============================================================================
// Intelligence Queries
// ============================================================================

export interface IntelligenceQueryOptions {
	category?: IntelligenceCategory;
	topics?: string[];
	geographicScope?: GeographicScope;
	startDate?: Date;
	endDate?: Date;
	minRelevanceScore?: number;
	limit?: number;
	skip?: number;
}

/**
 * Query intelligence items with filters
 */
export async function queryIntelligence(
	options: IntelligenceQueryOptions
): Promise<IntelligenceItemDocument[]> {
	const collection = await getIntelligenceCollection();

	const filter: Filter<IntelligenceItemDocument> = {};

	// Category filter
	if (options.category) {
		filter.category = options.category;
	}

	// Topic filter
	if (options.topics && options.topics.length > 0) {
		Object.assign(filter, buildTopicQuery(options.topics));
	}

	// Geographic scope
	if (options.geographicScope) {
		filter.geographicScope = options.geographicScope;
	}

	// Date range
	if (options.startDate || options.endDate) {
		filter.publishedAt = {};
		if (options.startDate) {
			filter.publishedAt.$gte = options.startDate;
		}
		if (options.endDate) {
			filter.publishedAt.$lte = options.endDate;
		}
	}

	// Relevance score
	if (options.minRelevanceScore !== undefined) {
		filter.relevanceScore = { $gte: options.minRelevanceScore };
	}

	return collection
		.find(filter)
		.sort({ relevanceScore: -1, publishedAt: -1 })
		.skip(options.skip || 0)
		.limit(options.limit || 20)
		.toArray();
}

/**
 * Find intelligence by topics (ordered by relevance and recency)
 */
export async function findIntelligenceByTopics(
	topics: string[],
	limit = 20
): Promise<IntelligenceItemDocument[]> {
	return queryIntelligence({ topics, limit });
}

/**
 * Find recent intelligence by category
 */
export async function findRecentIntelligence(
	category: IntelligenceCategory,
	days = 7,
	limit = 50
): Promise<IntelligenceItemDocument[]> {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	return queryIntelligence({ category, startDate, limit });
}

/**
 * Insert intelligence item
 */
export async function insertIntelligenceItem(
	item: Omit<IntelligenceItemDocument, '_id' | 'createdAt'>
): Promise<ObjectId> {
	const collection = await getIntelligenceCollection();

	const result = await collection.insertOne({
		...item,
		createdAt: new Date()
	} as IntelligenceItemDocument);

	return result.insertedId;
}

/**
 * Bulk insert intelligence items
 */
export async function bulkInsertIntelligence(
	items: Omit<IntelligenceItemDocument, '_id' | 'createdAt'>[]
): Promise<ObjectId[]> {
	const collection = await getIntelligenceCollection();

	const documents = items.map((item) => ({
		...item,
		createdAt: new Date()
	})) as IntelligenceItemDocument[];

	const result = await collection.insertMany(documents);

	return Object.values(result.insertedIds);
}

// ============================================================================
// Decision Maker Cache Queries
// ============================================================================

export interface CacheLookupParams {
	targetType: DecisionMakerCacheDocument['targetType'];
	targetEntity: string;
	topics?: string[];
	geographicScope?: string;
}

/**
 * Find cached decision makers by query hash
 */
export async function findCachedDecisionMakers(
	queryHash: string
): Promise<DecisionMakerCacheDocument | null> {
	const collection = await getDecisionMakerCacheCollection();

	const cached = await collection.findOne({ queryHash });

	// Check if expired
	if (cached && isExpired(cached.expiresAt)) {
		return null;
	}

	// Update hit count
	if (cached) {
		await collection.updateOne(
			{ _id: cached._id },
			{
				$inc: { hitCount: 1 },
				$set: { lastHitAt: new Date() }
			}
		);
	}

	return cached;
}

/**
 * Cache decision makers with automatic hit tracking
 */
export async function cacheDecisionMakers(
	params: CacheLookupParams & {
		queryHash: string;
		decisionMakers: DecisionMakerCacheDocument['decisionMakers'];
		provider: string;
		expiresAt?: Date;
	}
): Promise<ObjectId> {
	const collection = await getDecisionMakerCacheCollection();

	const result = await collection.findOneAndUpdate(
		{ queryHash: params.queryHash },
		{
			$set: {
				targetType: params.targetType,
				targetEntity: params.targetEntity,
				topics: params.topics,
				geographicScope: params.geographicScope,
				decisionMakers: params.decisionMakers,
				provider: params.provider,
				expiresAt: params.expiresAt,
				createdAt: new Date()
			},
			$setOnInsert: {
				hitCount: 0
			}
		},
		{
			upsert: true,
			returnDocument: 'after'
		}
	);

	return result!._id;
}

/**
 * Get cache statistics
 */
export async function getCacheStatistics() {
	const collection = await getDecisionMakerCacheCollection();

	const stats = await collection
		.aggregate([
			{
				$group: {
					_id: '$provider',
					totalEntries: { $sum: 1 },
					totalHits: { $sum: '$hitCount' },
					avgHitCount: { $avg: '$hitCount' }
				}
			},
			{
				$sort: { totalEntries: -1 }
			}
		])
		.toArray();

	return stats;
}

/**
 * Clear expired cache entries manually
 * (TTL index does this automatically, but this can be used for immediate cleanup)
 */
export async function clearExpiredCache(): Promise<number> {
	const collection = await getDecisionMakerCacheCollection();

	const result = await collection.deleteMany({
		expiresAt: { $lte: new Date() }
	});

	return result.deletedCount;
}

/**
 * Get most popular cache entries
 */
export async function getPopularCacheEntries(
	limit = 10
): Promise<DecisionMakerCacheDocument[]> {
	const collection = await getDecisionMakerCacheCollection();

	return collection
		.find()
		.sort({ hitCount: -1, lastHitAt: -1 })
		.limit(limit)
		.toArray();
}

// ============================================================================
// Cross-Collection Queries
// ============================================================================

/**
 * Find organizations mentioned in intelligence items
 */
export async function findOrganizationsInIntelligence(
	organizationNames: string[]
): Promise<{
	organizations: OrganizationDocument[];
	intelligence: IntelligenceItemDocument[];
}> {
	const [orgs, intel] = await Promise.all([
		getOrganizationsCollection(),
		getIntelligenceCollection()
	]);

	const normalizedNames = organizationNames.map(normalizeName);

	const [organizations, intelligence] = await Promise.all([
		orgs.find({ normalizedName: { $in: normalizedNames } }).toArray(),
		intel.find({ entities: { $in: organizationNames } }).toArray()
	]);

	return { organizations, intelligence };
}
