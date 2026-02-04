/**
 * MongoDB Index Management
 *
 * Ensures all necessary indexes are created for optimal query performance.
 * Includes TTL indexes for automatic document expiration.
 */

import type { CreateIndexesOptions } from 'mongodb';
import {
	getIntelligenceCollection,
	getParsedDocumentsCollection
} from './collections';

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
			ensureIntelligenceIndexes(),
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
		const [intel, parsedDocs] = await Promise.all([
			getIntelligenceCollection(),
			getParsedDocumentsCollection()
		]);

		await Promise.all([
			intel.dropIndexes(),
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
	collectionName: 'intelligence' | 'parsed_documents'
): Promise<void> {
	let collection;

	switch (collectionName) {
		case 'intelligence':
			collection = await getIntelligenceCollection();
			break;
		case 'parsed_documents':
			collection = await getParsedDocumentsCollection();
			break;
	}

	const indexes = await collection.listIndexes().toArray();
	console.log(`[MongoDB Indexes] Indexes for ${collectionName}:`, indexes);
}
