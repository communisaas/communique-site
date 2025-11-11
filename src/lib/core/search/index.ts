/**
 * Semantic Search Module
 *
 * Privacy-preserving semantic template discovery with OpenAI embeddings.
 *
 * Features:
 * - Client-side semantic search (server never sees queries)
 * - Contextual boosting (geographic, temporal, network, impact)
 * - IndexedDB caching for performance
 * - OpenAI text-embedding-3-large (3072 dimensions)
 *
 * Usage:
 * ```typescript
 * import { createSemanticSearch } from '$lib/core/search';
 *
 * // Initialize with templates
 * const search = await createSemanticSearch(templates, userLocation);
 *
 * // Search with boosting
 * const results = await search.search({
 *   query: "I can't afford rent",
 *   limit: 10,
 *   minSimilarity: 0.5
 * });
 * ```
 */

// Core types
export type {
	TemplateWithEmbedding,
	BoostingFactors,
	RankedTemplate,
	CachedSearchResult,
	CachedEmbedding,
	InferredLocation,
	SearchQuery,
	SearchResult,
	RankingExplanation,
	CostEstimate,
	EmbeddingRequest,
	EmbeddingResponse,
	BatchEmbeddingResult
} from './types';

// Core classes
export { EmbeddingSearch, createEmbeddingSearch } from './embedding-search';
export { ContextualBooster, createContextualBooster } from './contextual-boosting';
export { TemplateRanker, createTemplateRanker } from './ranking';
export { SearchCache, createSearchCache } from './cache';
export { OpenAIEmbeddingGenerator, createEmbeddingGenerator } from './openai-embeddings';

// Convenience function to create full search system
import type { TemplateWithEmbedding, InferredLocation } from './types';
import { EmbeddingSearch } from './embedding-search';
import { ContextualBooster } from './contextual-boosting';
import { TemplateRanker } from './ranking';
import { SearchCache } from './cache';

export interface SemanticSearch {
	search: TemplateRanker['rankTemplates'];
	searchWithMetadata: TemplateRanker['rankWithMetadata'];
	explainRanking: TemplateRanker['explainRanking'];
	getTopWithExplanations: TemplateRanker['getTopWithExplanations'];
	cache: SearchCache;
}

/**
 * Create semantic search system with all components
 */
export async function createSemanticSearch(
	templates: TemplateWithEmbedding[],
	userLocation: InferredLocation | null = null
): Promise<SemanticSearch> {
	// Initialize cache
	const cache = new SearchCache();
	await cache.init();

	// Create core components
	const embeddingSearch = new EmbeddingSearch(templates);
	const contextualBooster = new ContextualBooster(userLocation, templates);
	const ranker = new TemplateRanker(embeddingSearch, contextualBooster);

	return {
		search: ranker.rankTemplates.bind(ranker),
		searchWithMetadata: ranker.rankWithMetadata.bind(ranker),
		explainRanking: ranker.explainRanking.bind(ranker),
		getTopWithExplanations: ranker.getTopWithExplanations.bind(ranker),
		cache
	};
}
