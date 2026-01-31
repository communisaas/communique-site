/**
 * Voyage AI Embeddings - Type Definitions
 *
 * Type definitions for Voyage AI embedding generation and vector operations.
 * Voyage AI provides embeddings optimized for retrieval and semantic search.
 *
 * Models:
 * - voyage-3: Latest model, 1024 dimensions, best for general-purpose retrieval
 * - voyage-3-lite: Faster, 512 dimensions, good for high-throughput scenarios
 */

/**
 * Voyage AI model identifiers
 * - voyage-3: General-purpose, best for most content types
 * - voyage-3-lite: Faster, good for high-throughput scenarios
 * - voyage-law-2: Optimized for legal/legislative content (6-10% better for legal text)
 */
export type VoyageModel = 'voyage-3' | 'voyage-3-lite' | 'voyage-law-2';

/**
 * Content types for automatic model selection
 * Legislative/legal/regulatory content uses voyage-law-2 for better accuracy
 */
export type ContentType =
	| 'legislative'
	| 'legal'
	| 'regulatory'
	| 'general'
	| 'news'
	| 'research'
	| 'policy';

/**
 * Input type affects how the model processes the text
 * - document: For content being indexed/stored (default)
 * - query: For search queries (optimized for retrieval)
 */
export type VoyageInputType = 'document' | 'query';

/**
 * Embedding vector dimensions based on model
 * Note: voyage-law-2 has the same dimensions as voyage-3
 */
export const MODEL_DIMENSIONS: Record<VoyageModel, number> = {
	'voyage-3': 1024,
	'voyage-3-lite': 512,
	'voyage-law-2': 1024
};

/**
 * Request to generate a single or batch of embeddings
 */
export interface EmbeddingRequest {
	/** Text or array of texts to embed */
	input: string | string[];
	/** Model to use for embedding generation */
	model: VoyageModel;
	/** Input type for optimization */
	inputType?: VoyageInputType;
	/** Truncate input if it exceeds token limit (default: true) */
	truncate?: boolean;
}

/**
 * Individual embedding result
 */
export interface EmbeddingData {
	/** The embedding vector */
	embedding: number[];
	/** Index in the input array (for batch requests) */
	index: number;
}

/**
 * Response from Voyage AI embeddings API
 */
export interface EmbeddingResponse {
	/** Array of embedding results */
	data: EmbeddingData[];
	/** Model used for generation */
	model: string;
	/** Token usage statistics */
	usage: {
		total_tokens: number;
	};
}

/**
 * Error response from Voyage AI
 */
export interface VoyageError {
	error: {
		message: string;
		type: string;
		code?: string;
	};
}

/**
 * Reranking request for improving search precision
 */
export interface RerankRequest {
	/** Search query */
	query: string;
	/** Documents to rerank */
	documents: string[] | RerankDocument[];
	/** Model to use (rerank-2 is latest) */
	model?: 'rerank-2' | 'rerank-lite-1';
	/** Number of top results to return */
	topK?: number;
	/** Return documents in response */
	returnDocuments?: boolean;
}

/**
 * Document with metadata for reranking
 */
export interface RerankDocument {
	/** Document text content */
	text: string;
	/** Optional metadata */
	[key: string]: unknown;
}

/**
 * Individual reranking result
 */
export interface RerankResult {
	/** Index in the input documents array */
	index: number;
	/** Relevance score (0-1, higher is better) */
	relevanceScore: number;
	/** Original document (if returnDocuments: true) */
	document?: string | RerankDocument;
}

/**
 * Response from Voyage AI reranking API
 */
export interface RerankResponse {
	/** Reranked results sorted by relevance */
	results: RerankResult[];
	/** Model used for reranking */
	model: string;
	/** Token usage */
	usage: {
		total_tokens: number;
	};
}

/**
 * Cached embedding with metadata
 * Used to avoid regenerating embeddings for the same text
 */
export interface CachedEmbedding {
	/** Original text */
	text: string;
	/** Generated embedding vector */
	embedding: number[];
	/** Model used */
	model: VoyageModel;
	/** Input type used */
	inputType: VoyageInputType;
	/** When it was generated */
	createdAt: Date;
}

/**
 * Options for batch embedding generation
 */
export interface BatchEmbeddingOptions {
	/** Model to use (overrides contentType-based selection) */
	model?: VoyageModel;
	/** Input type */
	inputType?: VoyageInputType;
	/** Content type for automatic model selection (ignored if model is specified) */
	contentType?: ContentType;
	/** Batch size (Voyage supports up to 128 per request) */
	batchSize?: number;
	/** Show progress for large batches */
	showProgress?: boolean;
}

/**
 * Similarity metrics for comparing embeddings
 */
export type SimilarityMetric = 'cosine' | 'dotProduct' | 'euclidean';

/**
 * Result of a similarity search
 */
export interface SimilarityResult<T = unknown> {
	/** The matched item */
	item: T;
	/** Similarity score (interpretation depends on metric) */
	score: number;
	/** The embedding used (optional, for debugging) */
	embedding?: number[];
}
