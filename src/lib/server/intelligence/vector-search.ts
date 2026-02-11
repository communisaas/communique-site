/**
 * Intelligence Vector Search (pgvector — replaces mongodb/vector-search.ts)
 */

import { db } from '$lib/core/db';
import { createEmbedding } from '../embeddings';
import type { ContentType } from '../embeddings';
import type {
	IntelligenceItem,
	IntelligenceCategory,
	IntelligenceVectorFilters,
	VectorSearchOptions,
	VectorSearchResult
} from './types';

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

export async function semanticSearchIntelligence(
	query: string,
	filters: IntelligenceVectorFilters = {},
	options: VectorSearchOptions = {}
): Promise<VectorSearchResult<IntelligenceItem>[]> {
	const { limit = 10, minScore = 0, contentType } = options;

	const effectiveContentType =
		contentType ||
		(filters.categories?.length === 1 ? categoryToContentType(filters.categories[0]) : undefined);

	const [queryEmbedding] = await createEmbedding(query, {
		inputType: 'query',
		contentType: effectiveContentType as ContentType | undefined
	});

	const vectorStr = `[${queryEmbedding.join(',')}]`;

	// pgvector cosine distance search with filters
	const results = await db.$queryRaw<(IntelligenceItem & { score: number })[]>`
		SELECT
			i.*,
			(1 - (i.embedding <=> ${vectorStr}::vector(1024)))::float AS score
		FROM intelligence i
		WHERE i.embedding IS NOT NULL
			AND (${filters.categories ?? null}::text[] IS NULL OR i.category = ANY(${filters.categories ?? []}::text[]))
			AND (${filters.topics ?? null}::text[] IS NULL OR i.topics && ${filters.topics ?? []}::text[])
			AND (${filters.minRelevanceScore ?? null}::float IS NULL OR i.relevance_score >= ${filters.minRelevanceScore ?? 0})
			AND (${filters.publishedAfter ?? null}::timestamptz IS NULL OR i.published_at >= ${filters.publishedAfter ?? new Date(0)}::timestamptz)
			AND (${filters.publishedBefore ?? null}::timestamptz IS NULL OR i.published_at <= ${filters.publishedBefore ?? new Date()}::timestamptz)
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

export async function findSimilarIntelligence(
	itemId: string,
	options: VectorSearchOptions = {}
): Promise<VectorSearchResult<IntelligenceItem>[]> {
	const { limit = 5, minScore = 0.7 } = options;

	const results = await db.$queryRaw<(IntelligenceItem & { score: number })[]>`
		SELECT
			i.*,
			(1 - (i.embedding <=> (SELECT embedding FROM intelligence WHERE id = ${itemId})))::float AS score
		FROM intelligence i
		WHERE i.id != ${itemId}
			AND i.embedding IS NOT NULL
		ORDER BY i.embedding <=> (SELECT embedding FROM intelligence WHERE id = ${itemId})
		LIMIT ${limit}
	`;

	return results
		.filter((r) => r.score >= minScore)
		.map((doc) => ({
			document: doc,
			score: doc.score
		}));
}

export async function hybridSearchIntelligence(
	query: string,
	filters: IntelligenceVectorFilters = {},
	options: VectorSearchOptions = {}
): Promise<VectorSearchResult<IntelligenceItem>[]> {
	const { limit = 10, contentType } = options;

	const effectiveContentType =
		contentType ||
		(filters.categories?.length === 1 ? categoryToContentType(filters.categories[0]) : undefined);

	const [queryEmbedding] = await createEmbedding(query, {
		inputType: 'query',
		contentType: effectiveContentType as ContentType | undefined
	});

	const vectorStr = `[${queryEmbedding.join(',')}]`;

	// Call the hybrid_search_intelligence SQL function (RRF)
	const results = await db.$queryRaw<(IntelligenceItem & { score: number })[]>`
		SELECT * FROM hybrid_search_intelligence(
			${query},
			${vectorStr}::vector(1024),
			${limit},
			1.0,
			1.0,
			50,
			${filters.categories ?? null}::text[],
			${filters.topics ?? null}::text[],
			${filters.minRelevanceScore ?? null}::float,
			${filters.publishedAfter ?? null}::timestamptz,
			${filters.publishedBefore ?? null}::timestamptz
		)
	`;

	return results.map((doc) => ({
		document: doc,
		score: doc.score
	}));
}
