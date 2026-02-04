/**
 * Semantic Search Service Layer
 *
 * High-level service abstraction for semantic search operations.
 * Extends the base MongoDB service with vector search capabilities.
 */

import { createEmbedding, rerankDocuments } from '../embeddings';
import {
	semanticSearchIntelligence,
	findSimilarIntelligence,
	hybridSearchIntelligence
} from './vector-search';
import type {
	VectorSearchOptions,
	IntelligenceVectorFilters,
	VectorSearchResult
} from './vector-search';
import type { IntelligenceItemDocument } from './schema';

/**
 * Semantic Intelligence Search Service
 */
export class SemanticIntelligenceService {
	/**
	 * Search intelligence items by natural language query
	 *
	 * Uses vector search to find semantically similar content.
	 *
	 * @example
	 * const results = await SemanticIntelligenceService.search(
	 *   'renewable energy tax credits',
	 *   { categories: ['legislative'], limit: 10 }
	 * );
	 */
	static async search(
		query: string,
		options: IntelligenceVectorFilters & VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
		return semanticSearchIntelligence(query, options, options);
	}

	/**
	 * Search with automatic reranking for improved precision
	 *
	 * First performs vector search, then reranks top results using Voyage AI's
	 * reranking model for better accuracy.
	 *
	 * @example
	 * const results = await SemanticIntelligenceService.searchWithReranking(
	 *   'climate change legislation',
	 *   { categories: ['legislative'], limit: 20, rerankTopK: 5 }
	 * );
	 */
	static async searchWithReranking(
		query: string,
		options: IntelligenceVectorFilters &
			VectorSearchOptions & {
				rerankTopK?: number;
			} = {}
	): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
		const { rerankTopK = 10, ...searchOptions } = options;

		// Get initial results (fetch more for reranking)
		const initialLimit = searchOptions.limit || 20;
		const candidates = await semanticSearchIntelligence(
			query,
			searchOptions,
			{ ...searchOptions, limit: Math.max(initialLimit, rerankTopK * 2) }
		);

		if (candidates.length === 0) {
			return [];
		}

		// Rerank using Voyage AI
		const textsToRerank = candidates.map((c) => `${c.document.title}. ${c.document.snippet}`);

		const rerankResults = await rerankDocuments(query, textsToRerank, {
			topK: rerankTopK
		});

		// Map rerank results back to documents
		return rerankResults.map((r) => ({
			document: candidates[r.index].document,
			score: r.relevanceScore
		}));
	}

	/**
	 * Hybrid search combining vector and full-text search
	 *
	 * Often provides better results than pure vector search by combining
	 * semantic similarity with keyword matching.
	 *
	 * @example
	 * const results = await SemanticIntelligenceService.hybridSearch(
	 *   'H.R. 842 renewable energy',
	 *   { categories: ['legislative'] }
	 * );
	 */
	static async hybridSearch(
		query: string,
		options: IntelligenceVectorFilters & VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
		return hybridSearchIntelligence(query, options, options);
	}

	/**
	 * Find items similar to a given item
	 *
	 * Useful for "related content" features.
	 *
	 * @example
	 * const similar = await SemanticIntelligenceService.findSimilar(
	 *   itemId,
	 *   { limit: 5, minScore: 0.8 }
	 * );
	 */
	static async findSimilar(
		itemId: string | import('mongodb').ObjectId,
		options: VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
		return findSimilarIntelligence(itemId, options);
	}

	/**
	 * Get intelligence relevant to a specific embedding
	 *
	 * Useful when you already have an embedding (e.g., from a template or message).
	 *
	 * @example
	 * const [messageEmbedding] = await createEmbedding(messageText);
	 * const relevant = await SemanticIntelligenceService.findByEmbedding(
	 *   messageEmbedding,
	 *   { categories: ['news'], limit: 5 }
	 * );
	 */
	static async findByEmbedding(
		embedding: number[],
		options: IntelligenceVectorFilters & VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItemDocument>[]> {
		const { limit = 10, minScore = 0, numCandidates = 100 } = options;

		const collection = await import('./collections').then((m) =>
			m.getIntelligenceCollection()
		);

		// Build filter
		const filter: Record<string, unknown> = {};

		if (options.categories && options.categories.length > 0) {
			filter.category = { $in: options.categories };
		}

		if (options.topics && options.topics.length > 0) {
			filter.topics = { $in: options.topics };
		}

		// Vector search pipeline
		const pipeline: any[] = [
			{
				$vectorSearch: {
					index: 'intelligence_vector_index',
					path: 'embedding',
					queryVector: embedding,
					numCandidates: Math.max(numCandidates, limit * 2),
					limit,
					...(Object.keys(filter).length > 0 && { filter })
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

		const results = await collection
			.aggregate<IntelligenceItemDocument & { score: number }>(pipeline)
			.toArray();

		return results.map((doc) => ({
			document: doc,
			score: doc.score
		}));
	}
}

/**
 * Unified Semantic Search Service
 */
export class SemanticSearchService {
	static intelligence = SemanticIntelligenceService;

	/**
	 * Health check for semantic search capabilities
	 *
	 * Verifies:
	 * - Voyage AI API is accessible
	 * - Vector indexes exist
	 * - Embeddings can be generated
	 */
	static async healthCheck(): Promise<{
		voyageAI: boolean;
		intelligenceIndex: boolean;
	}> {
		const results = {
			voyageAI: false,
			intelligenceIndex: false
		};

		// Check Voyage AI
		try {
			await import('../embeddings').then((m) => m.voyageHealthCheck());
			results.voyageAI = true;
		} catch (error) {
			console.error('[Semantic Search] Voyage AI health check failed:', error);
		}

		// Check intelligence index (try a simple search)
		try {
			const [testEmbedding] = await createEmbedding('test query', {
				model: 'voyage-3-lite'
			});

			await import('./collections')
				.then((m) => m.getIntelligenceCollection())
				.then((col) =>
					col
						.aggregate([
							{
								$vectorSearch: {
									index: 'intelligence_vector_index',
									path: 'embedding',
									queryVector: testEmbedding,
									numCandidates: 10,
									limit: 1
								}
							}
						])
						.toArray()
				);

			results.intelligenceIndex = true;
		} catch (error) {
			console.error('[Semantic Search] Intelligence index check failed:', error);
		}

		return results;
	}
}
