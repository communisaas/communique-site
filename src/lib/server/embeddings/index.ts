/**
 * Embeddings Module - Public API
 *
 * Exports for the Voyage AI embeddings layer.
 * Use these functions throughout the application for semantic search capabilities.
 */

export {
	createEmbedding,
	createBatchEmbeddings,
	rerankDocuments,
	cosineSimilarity,
	estimateTokenCount,
	estimateEmbeddingCost,
	healthCheck as voyageHealthCheck,
	costTracker,
	getEmbeddingModelForContent
} from './voyage-client';

export type {
	VoyageModel,
	VoyageInputType,
	ContentType,
	EmbeddingRequest,
	EmbeddingResponse,
	RerankRequest,
	RerankResponse,
	RerankResult,
	BatchEmbeddingOptions,
	SimilarityMetric,
	SimilarityResult,
	CachedEmbedding
} from './types';

export { MODEL_DIMENSIONS } from './types';
