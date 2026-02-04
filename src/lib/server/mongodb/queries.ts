/**
 * MongoDB Query Builders
 *
 * Type-safe query builders for common database operations.
 * Provides a fluent API for constructing MongoDB queries.
 */

import type { Filter, ObjectId } from 'mongodb';
import { getIntelligenceCollection } from './collections';
import type {
	IntelligenceItemDocument,
	IntelligenceCategory,
	GeographicScope
} from './schema';
import { buildTopicQuery } from './utils';

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
