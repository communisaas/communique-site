/**
 * Intelligence Module - Public API
 * Replaces src/lib/server/mongodb/ for intelligence operations.
 */

// Types
export type {
	IntelligenceItem,
	IntelligenceCategory,
	GeographicScope,
	Sentiment,
	VectorSearchResult,
	IntelligenceQueryOptions,
	IntelligenceVectorFilters,
	VectorSearchOptions
} from './types';

// Queries
export {
	queryIntelligence,
	findIntelligenceByTopics,
	findRecentIntelligence,
	insertIntelligenceItem,
	insertIntelligenceWithEmbedding,
	bulkInsertIntelligence
} from './queries';

// Vector search
export {
	semanticSearchIntelligence,
	findSimilarIntelligence,
	hybridSearchIntelligence
} from './vector-search';

// Service layer
export { IntelligenceService } from './service';
export { SemanticIntelligenceService, SemanticSearchService } from './semantic-service';
