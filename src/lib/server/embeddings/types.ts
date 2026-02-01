/**
 * Voyage AI Embeddings - Type Definitions
 *
 * Type definitions for Voyage AI embedding generation and vector operations.
 * Voyage AI provides embeddings optimized for retrieval and semantic search.
 *
 * Models (Voyage 4 Series - January 2026):
 * - voyage-4: General-purpose, 1024 dimensions, best for documents/storage ($0.06/1M tokens)
 * - voyage-4-lite: 1024 dimensions, 3x cheaper, <5% quality loss - use for queries ($0.02/1M tokens)
 * - voyage-law-2: 1024 dimensions, optimized for legal/legislative content ($0.12/1M tokens)
 *
 * Note: Voyage 4 series supports shared embedding space - embeddings from different
 * voyage-4 models are compatible and don't require reindexing when switching models.
 */

/**
 * Voyage AI model identifiers
 * - voyage-4: General-purpose, best for documents/storage (highest quality)
 * - voyage-4-lite: 3x cheaper, <5% quality loss for queries (use for search)
 * - voyage-law-2: Optimized for legal/legislative content (6-10% better for legal text)
 */
export type VoyageModel = 'voyage-4' | 'voyage-4-lite' | 'voyage-law-2';

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
 * Note: Voyage 4 series supports flexible dimensions (256, 512, 1024, 2048)
 * voyage-law-2 has fixed 1024 dimensions
 */
export const MODEL_DIMENSIONS: Record<VoyageModel, number> = {
	'voyage-4': 1024,
	'voyage-4-lite': 1024,
	'voyage-law-2': 1024
};

/**
 * Request to generate a single or batch of embeddings
 * Note: Uses snake_case to match Voyage AI API contract
 */
export interface EmbeddingRequest {
	/** Text or array of texts to embed */
	input: string | string[];
	/** Model to use for embedding generation */
	model: VoyageModel;
	/** Input type for optimization (snake_case per API spec) */
	input_type?: VoyageInputType | null;
	/** Truncate input if it exceeds token limit (default: true) */
	truncation?: boolean;
	/** Output dimension for flexible dimension models (256, 512, 1024, 2048) */
	output_dimension?: number;
	/** Output data type (float, int8, uint8, binary, ubinary) */
	output_dtype?: 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';
	/** Index signature for Record<string, unknown> compatibility */
	[key: string]: unknown;
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
 * Note: Uses snake_case to match Voyage AI API contract
 */
export interface RerankRequest {
	/** Search query */
	query: string;
	/** Documents to rerank */
	documents: string[] | RerankDocument[];
	/** Model to use (rerank-2.5 is latest and recommended) */
	model?: 'rerank-2.5' | 'rerank-2.5-lite' | 'rerank-2' | 'rerank-2-lite';
	/** Number of top results to return (snake_case per API spec) */
	top_k?: number;
	/** Return documents in response (snake_case per API spec) */
	return_documents?: boolean;
	/** Truncate inputs to fit context limits (default: true) */
	truncation?: boolean;
	/** Index signature for Record<string, unknown> compatibility */
	[key: string]: unknown;
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
 * Note: API returns snake_case (relevance_score), we normalize to camelCase internally
 */
export interface RerankResult {
	/** Index in the input documents array */
	index: number;
	/** Relevance score (0-1, higher is better) - normalized from API's relevance_score */
	relevanceScore: number;
	/** Original document (if return_documents: true) */
	document?: string | RerankDocument;
}

/**
 * Raw reranking result from Voyage AI API (snake_case)
 * Used internally for API response parsing
 */
export interface RawRerankResult {
	/** Index in the input documents array */
	index: number;
	/** Relevance score (0-1, higher is better) */
	relevance_score: number;
	/** Original document (if return_documents: true) */
	document?: string | RerankDocument;
}

/**
 * Raw response from Voyage AI reranking API (snake_case)
 * Used internally for API response parsing
 */
export interface RawRerankResponse {
	/** List type indicator */
	object: 'list';
	/** Reranked results sorted by relevance (snake_case from API) */
	data: RawRerankResult[];
	/** Model used for reranking */
	model: string;
	/** Token usage */
	usage: {
		total_tokens: number;
	};
}

/**
 * Normalized response from Voyage AI reranking API (camelCase)
 */
export interface RerankResponse {
	/** Reranked results sorted by relevance (normalized to camelCase) */
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
