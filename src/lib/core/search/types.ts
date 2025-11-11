/**
 * Type definitions for semantic search system with OpenAI embeddings
 *
 * Phase 4: Semantic Search Integration
 * - Privacy-preserving client-side search
 * - OpenAI text-embedding-3-large (3072 dimensions)
 * - Contextual boosting (geographic, temporal, network, impact)
 */

import type { TemplateJurisdiction } from '@prisma/client';

/**
 * Template with embedding data for semantic search
 */
export interface TemplateWithEmbedding {
	id: string;
	slug: string;
	title: string;
	description: string;
	category: string;
	location_embedding: number[] | null;
	topic_embedding: number[] | null;
	embedding_version: string;
	jurisdictions: TemplateJurisdiction[];
	quality_score: number;
	created_at: string;
}

/**
 * Contextual boosting factors for search ranking
 */
export interface BoostingFactors {
	geographic: number; // 0.0 - 2.0 (2x boost for local templates)
	temporal: number; // 0.0 - 1.5 (1.5x boost for recently popular)
	network: number; // 0.0 - 3.0 (3x boost for network effects)
	impact: number; // 0.0 - 2.0 (2x boost for high-quality templates)
}

/**
 * Ranked template with all scoring metadata
 */
export interface RankedTemplate extends TemplateWithEmbedding {
	similarity: number; // 0-1 cosine similarity
	boost: BoostingFactors;
	final_score: number; // similarity * total_boost
	rank: number; // Position in results (1-indexed)
}

/**
 * Cached search result for performance optimization
 */
export interface CachedSearchResult {
	query: string;
	results: RankedTemplate[];
	timestamp: string;
	expires_at: string;
}

/**
 * Cached embedding for avoiding redundant API calls
 */
export interface CachedEmbedding {
	text: string;
	embedding: number[];
	model: string; // 'text-embedding-3-large'
	timestamp: string;
	expires_at: string;
}

/**
 * User location for geographic boosting
 * Note: This should be imported from location inference engine
 * but included here for standalone functionality
 */
export interface InferredLocation {
	congressional_district?: string; // "TX-18"
	state_code?: string; // "TX"
	county_fips?: string; // "48453"
	city_fips?: string; // "4805000"
	city_name?: string; // "Austin"
	latitude?: number;
	longitude?: number;
	confidence: number; // 0-1
	source: 'ip' | 'browser' | 'oauth' | 'behavioral' | 'verified'; // Signal source
}

/**
 * OpenAI embedding API request
 */
export interface EmbeddingRequest {
	input: string | string[];
	model: 'text-embedding-3-large' | 'text-embedding-3-small';
	encoding_format?: 'float' | 'base64';
	dimensions?: number; // Optional dimensionality reduction
	user?: string; // User identifier for monitoring
}

/**
 * OpenAI embedding API response
 */
export interface EmbeddingResponse {
	object: 'list';
	data: Array<{
		object: 'embedding';
		embedding: number[];
		index: number;
	}>;
	model: string;
	usage: {
		prompt_tokens: number;
		total_tokens: number;
	};
}

/**
 * Batch embedding generation result
 */
export interface BatchEmbeddingResult {
	embeddings: number[][];
	model: string;
	total_tokens: number;
	cost_usd: number;
}

/**
 * Search query with options
 */
export interface SearchQuery {
	query: string;
	userLocation?: InferredLocation;
	limit?: number; // Max results (default: 20)
	minSimilarity?: number; // Minimum similarity threshold (default: 0.5)
	enableBoosting?: boolean; // Enable contextual boosting (default: true)
	jurisdictionFilter?: {
		type: 'federal' | 'state' | 'county' | 'city';
		value: string;
	};
}

/**
 * Search result with metadata
 */
export interface SearchResult {
	results: RankedTemplate[];
	query: string;
	total_results: number;
	query_embedding: number[];
	search_time_ms: number;
	cached: boolean;
}

/**
 * Ranking explanation for debugging
 */
export interface RankingExplanation {
	template_id: string;
	title: string;
	similarity: number;
	boost: BoostingFactors;
	final_score: number;
	rank: number;
	explanation: string; // Human-readable explanation
}

/**
 * Cost estimation for embedding generation
 */
export interface CostEstimate {
	text_length: number;
	estimated_tokens: number;
	cost_usd: number;
	model: string;
}
