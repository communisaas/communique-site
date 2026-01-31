/**
 * MongoDB Index Management
 *
 * Ensures all necessary indexes are created for optimal query performance.
 * Includes TTL indexes for automatic document expiration.
 */

import type { CreateIndexesOptions } from 'mongodb';
import {
	getOrganizationsCollection,
	getIntelligenceCollection,
	getDecisionMakerCacheCollection,
	getParsedDocumentsCollection
} from './collections';

/**
 * Create all indexes for the Organizations collection
 */
async function ensureOrganizationIndexes(): Promise<void> {
	const collection = await getOrganizationsCollection();

	console.log('[MongoDB Indexes] Creating organization indexes...');

	// TTL index - automatically delete expired documents
	await collection.createIndex(
		{ expiresAt: 1 },
		{
			expireAfterSeconds: 0,
			name: 'ttl_expiresAt'
		} as CreateIndexesOptions
	);

	// Unique index on normalized name for fast lookups
	await collection.createIndex(
		{ normalizedName: 1 },
		{
			unique: true,
			name: 'unique_normalizedName'
		} as CreateIndexesOptions
	);

	// Index on website for lookups
	await collection.createIndex(
		{ website: 1 },
		{
			name: 'idx_website'
		} as CreateIndexesOptions
	);

	// Compound index for filtering by source and date
	await collection.createIndex(
		{ source: 1, createdAt: -1 },
		{
			name: 'idx_source_createdAt'
		} as CreateIndexesOptions
	);

	// Text index for full-text search
	await collection.createIndex(
		{
			name: 'text',
			about: 'text',
			'leadership.name': 'text',
			'leadership.title': 'text'
		},
		{
			name: 'idx_text_search',
			weights: {
				name: 10,
				about: 5,
				'leadership.name': 3,
				'leadership.title': 2
			}
		} as CreateIndexesOptions
	);

	// Vector search index will be created separately via Atlas UI
	// as it requires specific Atlas Search configuration
	// Index name: vector_search_organizations
	// Field: embedding
	// Dimensions: 1024 (Voyage AI)
	// Similarity: cosine

	console.log('[MongoDB Indexes] Organization indexes created');
}

/**
 * Create all indexes for the Intelligence collection
 */
async function ensureIntelligenceIndexes(): Promise<void> {
	const collection = await getIntelligenceCollection();

	console.log('[MongoDB Indexes] Creating intelligence indexes...');

	// TTL index - automatically delete expired documents
	await collection.createIndex(
		{ expiresAt: 1 },
		{
			expireAfterSeconds: 0,
			name: 'ttl_expiresAt'
		} as CreateIndexesOptions
	);

	// Index on category and published date
	await collection.createIndex(
		{ category: 1, publishedAt: -1 },
		{
			name: 'idx_category_publishedAt'
		} as CreateIndexesOptions
	);

	// Index on topics for filtering
	await collection.createIndex(
		{ topics: 1 },
		{
			name: 'idx_topics'
		} as CreateIndexesOptions
	);

	// Index on entities for named entity search
	await collection.createIndex(
		{ entities: 1 },
		{
			name: 'idx_entities'
		} as CreateIndexesOptions
	);

	// Compound index for relevance sorting
	await collection.createIndex(
		{ category: 1, relevanceScore: -1, publishedAt: -1 },
		{
			name: 'idx_category_relevance_date'
		} as CreateIndexesOptions
	);

	// Index on geographic scope
	await collection.createIndex(
		{ geographicScope: 1 },
		{
			name: 'idx_geographicScope'
		} as CreateIndexesOptions
	);

	// Text index for full-text search
	await collection.createIndex(
		{
			title: 'text',
			snippet: 'text',
			source: 'text'
		},
		{
			name: 'idx_text_search',
			weights: {
				title: 10,
				snippet: 5,
				source: 3
			}
		} as CreateIndexesOptions
	);

	// Vector search index will be created separately via Atlas UI
	// Index name: vector_search_intelligence
	// Field: embedding
	// Dimensions: 1024 (Voyage AI)
	// Similarity: cosine

	console.log('[MongoDB Indexes] Intelligence indexes created');
}

/**
 * Create all indexes for the Decision Maker Cache collection
 */
async function ensureDecisionMakerCacheIndexes(): Promise<void> {
	const collection = await getDecisionMakerCacheCollection();

	console.log('[MongoDB Indexes] Creating decision maker cache indexes...');

	// TTL index - automatically delete expired documents
	await collection.createIndex(
		{ expiresAt: 1 },
		{
			expireAfterSeconds: 0,
			name: 'ttl_expiresAt'
		} as CreateIndexesOptions
	);

	// Unique index on query hash for deduplication
	await collection.createIndex(
		{ queryHash: 1 },
		{
			unique: true,
			name: 'unique_queryHash'
		} as CreateIndexesOptions
	);

	// Compound index for cache lookups
	await collection.createIndex(
		{ targetType: 1, targetEntity: 1, topics: 1 },
		{
			name: 'idx_cache_lookup'
		} as CreateIndexesOptions
	);

	// Index on hit count for cache eviction strategies
	await collection.createIndex(
		{ hitCount: -1, lastHitAt: -1 },
		{
			name: 'idx_hitCount_lastHitAt'
		} as CreateIndexesOptions
	);

	// Index on provider
	await collection.createIndex(
		{ provider: 1 },
		{
			name: 'idx_provider'
		} as CreateIndexesOptions
	);

	console.log('[MongoDB Indexes] Decision maker cache indexes created');
}

/**
 * Create all indexes for the Parsed Documents Cache collection
 */
async function ensureParsedDocumentsIndexes(): Promise<void> {
	const collection = await getParsedDocumentsCollection();

	console.log('[MongoDB Indexes] Creating parsed documents indexes...');

	// TTL index - automatically delete expired documents (30 days)
	await collection.createIndex(
		{ expiresAt: 1 },
		{
			expireAfterSeconds: 0,
			name: 'ttl_expiresAt'
		} as CreateIndexesOptions
	);

	// Unique index on sourceUrlHash for deduplication
	await collection.createIndex(
		{ sourceUrlHash: 1 },
		{
			unique: true,
			name: 'unique_sourceUrlHash'
		} as CreateIndexesOptions
	);

	// Index on sourceUrl for lookups
	await collection.createIndex(
		{ sourceUrl: 1 },
		{
			name: 'idx_sourceUrl'
		} as CreateIndexesOptions
	);

	// Index on documentType for filtering
	await collection.createIndex(
		{ documentType: 1 },
		{
			name: 'idx_documentType'
		} as CreateIndexesOptions
	);

	// Compound index for type and date filtering
	await collection.createIndex(
		{ documentType: 1, createdAt: -1 },
		{
			name: 'idx_documentType_createdAt'
		} as CreateIndexesOptions
	);

	// Index on hit count for cache statistics
	await collection.createIndex(
		{ hitCount: -1, lastAccessedAt: -1 },
		{
			name: 'idx_hitCount_lastAccessed'
		} as CreateIndexesOptions
	);

	console.log('[MongoDB Indexes] Parsed documents indexes created');
}

/**
 * Ensure all indexes exist across all collections
 * Should be called on server startup or during deployment
 *
 * @example
 * // In your server startup hook (hooks.server.ts)
 * import { ensureAllIndexes } from '$lib/server/mongodb/indexes';
 * await ensureAllIndexes();
 */
export async function ensureAllIndexes(): Promise<void> {
	console.log('[MongoDB Indexes] Starting index creation...');

	try {
		await Promise.all([
			ensureOrganizationIndexes(),
			ensureIntelligenceIndexes(),
			ensureDecisionMakerCacheIndexes(),
			ensureParsedDocumentsIndexes()
		]);

		console.log('[MongoDB Indexes] All indexes created successfully');
	} catch (error) {
		console.error('[MongoDB Indexes] Error creating indexes:', error);
		throw new Error(
			`Failed to create MongoDB indexes: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Drop all indexes (useful for testing or index rebuilding)
 * WARNING: This will drop all indexes except _id
 */
export async function dropAllIndexes(): Promise<void> {
	console.log('[MongoDB Indexes] Dropping all indexes...');

	try {
		const [orgs, intel, cache, parsedDocs] = await Promise.all([
			getOrganizationsCollection(),
			getIntelligenceCollection(),
			getDecisionMakerCacheCollection(),
			getParsedDocumentsCollection()
		]);

		await Promise.all([
			orgs.dropIndexes(),
			intel.dropIndexes(),
			cache.dropIndexes(),
			parsedDocs.dropIndexes()
		]);

		console.log('[MongoDB Indexes] All indexes dropped');
	} catch (error) {
		console.error('[MongoDB Indexes] Error dropping indexes:', error);
		throw error;
	}
}

/**
 * List all indexes for a collection (debugging utility)
 */
export async function listCollectionIndexes(
	collectionName: 'organizations' | 'intelligence' | 'decision_maker_cache' | 'parsed_documents'
): Promise<void> {
	let collection;

	switch (collectionName) {
		case 'organizations':
			collection = await getOrganizationsCollection();
			break;
		case 'intelligence':
			collection = await getIntelligenceCollection();
			break;
		case 'decision_maker_cache':
			collection = await getDecisionMakerCacheCollection();
			break;
		case 'parsed_documents':
			collection = await getParsedDocumentsCollection();
			break;
	}

	const indexes = await collection.listIndexes().toArray();
	console.log(`[MongoDB Indexes] Indexes for ${collectionName}:`, indexes);
}
