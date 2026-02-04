/**
 * MongoDB Atlas Vector Search Queries
 *
 * Semantic search capabilities using MongoDB Atlas Vector Search and Voyage AI embeddings.
 *
 * Features:
 * - Vector similarity search across intelligence items
 * - Hybrid search combining full-text and semantic search
 * - Pre-filtering support (category, topics, dates)
 * - Configurable similarity metrics
 */

import type { Document as MongoDocument } from 'mongodb';
import { getIntelligenceCollection } from './collections';
import { createEmbedding } from '../embeddings';
import type { ContentType } from '../embeddings';
import type {
	IntelligenceItemDocument,
	IntelligenceCategory
} from './schema';

/**
 * Map IntelligenceCategory to ContentType for model selection
 * Legislative and regulatory categories use voyage-law-2 for better accuracy
 */
function categoryToContentType(category?: IntelligenceCategory): ContentType | undefined {
	if (!category) return undefined;

	switch (category) {
		case 'legislative':
			return 'legislative';
		case 'regulatory':
			return 'regulatory';
		case 'news':
			return 'news';
		default:
			return 'general';
	}
}

/**
 * Options for vector search queries
 */
export interface VectorSearchOptions {
	/** Maximum number of results to return */
	limit?: number;
	/** Minimum similarity score (0-1) */
	minScore?: number;
	/** Number of candidates to examine (higher = more accurate but slower) */
	numCandidates?: number;
	/** Include the similarity score in results */
	includeScore?: boolean;
	/** Content type for embedding model selection (voyage-law-2 for legal content) */
	contentType?: ContentType;
}

/**
 * Filter options for intelligence vector search
 */
export interface IntelligenceVectorFilters {
	/** Filter by category */
	categories?: IntelligenceCategory[];
	/** Filter by topics (matches any) */
	topics?: string[];
	/** Only include items published after this date */
	publishedAfter?: Date;
	/** Only include items published before this date */
	publishedBefore?: Date;
	/** Minimum relevance score */
	minRelevanceScore?: number;
}

/**
 * Result from vector search with score
 */
export interface VectorSearchResult<T> {
	/** The matched document */
	document: T;
	/** Similarity score from vector search */
	score: number;
}

/**
 * Search intelligence items by semantic similarity
 *
 * @param query - Natural language query
 * @param filters - Optional filters to narrow results
 * @param options - Search options
 * @returns Matching intelligence items with similarity scores
 *
 * @example
 * const results = await semanticSearchIntelligence(
 *   'renewable energy legislation',
 *   { categories: ['legislative'], publishedAfter: new Date('2025-01-01') },
 *   { limit: 10, minScore: 0.7 }
 * );
 */
export async function semanticSearchIntelligence(
	query: string,
	filters: IntelligenceVectorFilters = {},
	options: VectorSearchOptions = {}
): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
	const { limit = 10, minScore = 0, numCandidates = 100, includeScore = true, contentType } =
		options;

	// Determine content type from filter categories if not explicitly provided
	// If filtering by legislative/regulatory categories, use voyage-law-2 for better accuracy
	const effectiveContentType =
		contentType ||
		(filters.categories?.length === 1 ? categoryToContentType(filters.categories[0]) : undefined);

	// Generate query embedding with appropriate model
	const [queryEmbedding] = await createEmbedding(query, {
		inputType: 'query',
		contentType: effectiveContentType
	});

	// Build filter object
	const filter: MongoDocument = {};

	if (filters.categories && filters.categories.length > 0) {
		filter.category = { $in: filters.categories };
	}

	if (filters.topics && filters.topics.length > 0) {
		filter.topics = { $in: filters.topics };
	}

	if (filters.publishedAfter || filters.publishedBefore) {
		filter.publishedAt = {};
		if (filters.publishedAfter) {
			filter.publishedAt.$gte = filters.publishedAfter;
		}
		if (filters.publishedBefore) {
			filter.publishedAt.$lte = filters.publishedBefore;
		}
	}

	if (filters.minRelevanceScore !== undefined) {
		filter.relevanceScore = { $gte: filters.minRelevanceScore };
	}

	// Build aggregation pipeline
	const pipeline: MongoDocument[] = [
		{
			$vectorSearch: {
				index: 'intelligence_vector_index',
				path: 'embedding',
				queryVector: queryEmbedding,
				numCandidates: Math.max(numCandidates, limit * 2),
				limit: limit,
				...(Object.keys(filter).length > 0 && { filter })
			}
		}
	];

	// Add score and project fields
	if (includeScore) {
		pipeline.push({
			$addFields: {
				score: { $meta: 'vectorSearchScore' }
			}
		});
	}

	// Filter by minimum score if specified
	if (minScore > 0) {
		pipeline.push({
			$match: {
				score: { $gte: minScore }
			}
		});
	}

	const collection = await getIntelligenceCollection();
	const results = await collection.aggregate<IntelligenceItemDocument & { score?: number }>(
		pipeline
	).toArray();

	return results.map((doc) => ({
		document: doc,
		score: doc.score || 0
	}));
}

/**
 * Find similar intelligence items to a given item
 *
 * Uses the item's embedding to find semantically similar content.
 *
 * @param itemId - ID of the intelligence item
 * @param options - Search options
 * @returns Similar intelligence items
 *
 * @example
 * const similar = await findSimilarIntelligence(
 *   new ObjectId('...'),
 *   { limit: 5, minScore: 0.8 }
 * );
 */
export async function findSimilarIntelligence(
	itemId: string | import('mongodb').ObjectId,
	options: VectorSearchOptions = {}
): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
	const { ObjectId } = await import('mongodb');
	const { limit = 5, minScore = 0.7, numCandidates = 50 } = options;

	const collection = await getIntelligenceCollection();

	// Convert string to ObjectId if needed
	const objectId = typeof itemId === 'string' ? new ObjectId(itemId) : itemId;

	// Get the source item
	const sourceItem = await collection.findOne({ _id: objectId });

	if (!sourceItem || !sourceItem.embedding) {
		throw new Error('Intelligence item not found or has no embedding');
	}

	// Search using the item's embedding
	const pipeline: MongoDocument[] = [
		{
			$vectorSearch: {
				index: 'intelligence_vector_index',
				path: 'embedding',
				queryVector: sourceItem.embedding,
				numCandidates: Math.max(numCandidates, limit * 2),
				limit: limit + 1, // +1 to exclude self
				filter: {
					_id: { $ne: objectId } // Exclude the source item
				}
			}
		},
		{
			$addFields: {
				score: { $meta: 'vectorSearchScore' }
			}
		}
	];

	if (minScore > 0) {
		pipeline.push({
			$match: {
				score: { $gte: minScore }
			}
		});
	}

	const results = await collection.aggregate<IntelligenceItemDocument & { score: number }>(
		pipeline
	).toArray();

	return results.map((doc) => ({
		document: doc,
		score: doc.score
	}));
}

/**
 * Hybrid search combining full-text and vector search
 *
 * Uses Reciprocal Rank Fusion (RRF) to combine results from both search methods.
 * This often provides better results than either method alone.
 *
 * @param query - Search query
 * @param filters - Optional filters
 * @param options - Search options
 * @returns Combined search results
 *
 * @example
 * const results = await hybridSearchIntelligence(
 *   'climate change legislation',
 *   { categories: ['legislative'] },
 *   { limit: 10 }
 * );
 */
export async function hybridSearchIntelligence(
	query: string,
	filters: IntelligenceVectorFilters = {},
	options: VectorSearchOptions = {}
): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
	const { limit = 10, contentType } = options;

	// Determine content type from filter categories if not explicitly provided
	const effectiveContentType =
		contentType ||
		(filters.categories?.length === 1 ? categoryToContentType(filters.categories[0]) : undefined);

	// Generate query embedding for vector search with appropriate model
	const [queryEmbedding] = await createEmbedding(query, {
		inputType: 'query',
		contentType: effectiveContentType
	});

	// Build filter object
	const filter: MongoDocument = {};

	if (filters.categories && filters.categories.length > 0) {
		filter.category = { $in: filters.categories };
	}

	if (filters.topics && filters.topics.length > 0) {
		filter.topics = { $in: filters.topics };
	}

	const collection = await getIntelligenceCollection();

	// Pipeline using $rankFusion
	const pipeline: MongoDocument[] = [
		{
			$rankFusion: {
				input: {
					pipelines: {
						// Vector search pipeline
						vectorSearch: [
							{
								$vectorSearch: {
									index: 'intelligence_vector_index',
									path: 'embedding',
									queryVector: queryEmbedding,
									numCandidates: 100,
									limit: limit * 2,
									...(Object.keys(filter).length > 0 && { filter })
								}
							}
						],
						// Full-text search pipeline
						textSearch: [
							{
								$search: {
									index: 'intelligence_text_index',
									text: {
										query: query,
										path: ['title', 'snippet']
									},
									...(Object.keys(filter).length > 0 && { filter })
								}
							},
							{ $limit: limit * 2 }
						]
					}
				}
			}
		},
		{
			$addFields: {
				score: { $meta: 'rankFusionScore' }
			}
		},
		{ $limit: limit }
	];

	const results = await collection.aggregate<IntelligenceItemDocument & { score: number }>(
		pipeline
	).toArray();

	return results.map((doc) => ({
		document: doc,
		score: doc.score
	}));
}
