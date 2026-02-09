/**
 * Semantic Search Service Layer (pgvector — replaces mongodb/semantic-service.ts)
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
	VectorSearchResult,
	IntelligenceItem
} from './types';

export class SemanticIntelligenceService {
	static async search(
		query: string,
		options: IntelligenceVectorFilters & VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItem>[]> {
		return semanticSearchIntelligence(query, options, options);
	}

	static async searchWithReranking(
		query: string,
		options: IntelligenceVectorFilters &
			VectorSearchOptions & {
				rerankTopK?: number;
			} = {}
	): Promise<VectorSearchResult<IntelligenceItem>[]> {
		const { rerankTopK = 10, ...searchOptions } = options;

		const initialLimit = searchOptions.limit || 20;
		const candidates = await semanticSearchIntelligence(query, searchOptions, {
			...searchOptions,
			limit: Math.max(initialLimit, rerankTopK * 2)
		});

		if (candidates.length === 0) {
			return [];
		}

		const textsToRerank = candidates.map((c) => `${c.document.title}. ${c.document.snippet}`);

		const rerankResults = await rerankDocuments(query, textsToRerank, {
			topK: rerankTopK
		});

		return rerankResults.map((r) => ({
			document: candidates[r.index].document,
			score: r.relevanceScore
		}));
	}

	static async hybridSearch(
		query: string,
		options: IntelligenceVectorFilters & VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItem>[]> {
		return hybridSearchIntelligence(query, options, options);
	}

	static async findSimilar(
		itemId: string,
		options: VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItem>[]> {
		return findSimilarIntelligence(itemId, options);
	}

	static async findByEmbedding(
		embedding: number[],
		options: IntelligenceVectorFilters & VectorSearchOptions = {}
	): Promise<VectorSearchResult<IntelligenceItem>[]> {
		const { limit = 10, minScore = 0 } = options;
		const { db } = await import('$lib/core/db');

		const vectorStr = `[${embedding.join(',')}]`;

		const results = await db.$queryRaw<(IntelligenceItem & { score: number })[]>`
			SELECT
				i.*,
				(1 - (i.embedding <=> ${vectorStr}::vector(1024)))::float AS score
			FROM intelligence i
			WHERE i.embedding IS NOT NULL
				AND (${options.categories ?? null}::text[] IS NULL OR i.category = ANY(${options.categories ?? []}::text[]))
				AND (${options.topics ?? null}::text[] IS NULL OR i.topics && ${options.topics ?? []}::text[])
			ORDER BY i.embedding <=> ${vectorStr}::vector(1024)
			LIMIT ${limit}
		`;

		return results
			.filter((r) => r.score >= minScore)
			.map((doc) => ({
				document: doc,
				score: doc.score
			}));
	}
}

export class SemanticSearchService {
	static intelligence = SemanticIntelligenceService;
}
