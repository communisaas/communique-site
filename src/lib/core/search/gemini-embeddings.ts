/**
 * Google Gemini Embedding Integration
 *
 * Replaces OpenAI text-embedding-3-large with Google gemini-embedding-001
 *
 * Benefits:
 * - Better performance: 66.3% vs 64.6% MTEB benchmark
 * - FREE tier: Unlimited in Google AI Studio
 * - Multilingual: 100+ languages
 * - Flexible dimensions: 768, 1536, or 3072 (lossless truncation via MRL)
 *
 * API: @google/genai v1.28.0+
 * Model: gemini-embedding-001
 * Dimensions: 768 (recommended for production)
 * Cost: $0.15 per 1M tokens (or FREE in Google AI Studio)
 */

import { GoogleGenAI } from '@google/genai';

/**
 * Embedding configuration
 */
export const EMBEDDING_CONFIG = {
	model: 'gemini-embedding-001' as const,
	dimensions: 768, // Recommended: 768, 1536, or 3072
	maxInputTokens: 2048,
	batchSize: 100 // Max texts per batch request
} as const;

/**
 * Task types for Gemini embeddings
 * Optimizes embeddings for specific use cases
 */
export type EmbeddingTaskType =
	| 'RETRIEVAL_DOCUMENT' // Indexing documents for search (templates)
	| 'RETRIEVAL_QUERY' // User search queries
	| 'SEMANTIC_SIMILARITY' // Text similarity comparison
	| 'CLASSIFICATION' // Text categorization
	| 'CLUSTERING'; // Grouping similar texts

/**
 * Embedding generation options
 */
export interface EmbeddingOptions {
	/** Task type (default: RETRIEVAL_DOCUMENT) */
	taskType?: EmbeddingTaskType;
	/** Output dimensions (default: 768) */
	dimensions?: number;
	/** Max retry attempts (default: 3) */
	maxRetries?: number;
	/** Initial retry delay in ms (default: 1000) */
	retryDelay?: number;
}

/**
 * Initialize Gemini AI client
 */
function getGeminiClient(): GoogleGenAI {
	const apiKey = process.env.GEMINI_API_KEY;

	if (!apiKey) {
		throw new Error(
			'GEMINI_API_KEY environment variable not set. Get key from: https://aistudio.google.com/apikey'
		);
	}

	return new GoogleGenAI({ apiKey });
}

/**
 * Generate embedding for a single text
 *
 * @param text - Text to embed (max 2,048 tokens)
 * @param options - Embedding options
 * @returns Float array of embedding values
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding('Hello world');
 * console.log(embedding.length); // 768
 * ```
 */
export async function generateEmbedding(
	text: string,
	options: EmbeddingOptions = {}
): Promise<number[]> {
	const {
		taskType = 'RETRIEVAL_DOCUMENT',
		dimensions = EMBEDDING_CONFIG.dimensions,
		maxRetries = 3,
		retryDelay = 1000
	} = options;

	const ai = getGeminiClient();

	// Validate input length (rough estimate: 1 token ≈ 4 characters)
	const estimatedTokens = Math.ceil(text.length / 4);
	if (estimatedTokens > EMBEDDING_CONFIG.maxInputTokens) {
		throw new Error(
			`Text too long: ${estimatedTokens} tokens (max: ${EMBEDDING_CONFIG.maxInputTokens}). Truncate input.`
		);
	}

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const result = await ai.models.embedContent({
				model: EMBEDDING_CONFIG.model,
				contents: [text],
				config: {
					outputDimensionality: dimensions,
					taskType: taskType
				}
			});

			if (!result.embeddings || result.embeddings.length === 0) {
				throw new Error('No embeddings returned from Gemini API');
			}

			return result.embeddings[0].values;
		} catch (error) {
			const isLastAttempt = attempt === maxRetries - 1;

			// Check for specific error types
			if (error && typeof error === 'object' && 'code' in error) {
				const errorCode = (error as { code: string }).code;

				if (errorCode === 'RESOURCE_EXHAUSTED') {
					// Rate limit exceeded - retry with exponential backoff
					if (!isLastAttempt) {
						const delay = retryDelay * Math.pow(2, attempt);
						console.warn(
							`Rate limit exceeded, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
						);
						await new Promise((resolve) => setTimeout(resolve, delay));
						continue;
					}
				} else if (errorCode === 'INVALID_ARGUMENT') {
					// Invalid input - don't retry
					throw new Error(
						`Invalid input: ${error instanceof Error ? error.message : String(error)}`
					);
				} else if (errorCode === 'UNAUTHENTICATED') {
					// Invalid API key - don't retry
					throw new Error(
						'Invalid GEMINI_API_KEY. Get key from: https://aistudio.google.com/apikey'
					);
				}
			}

			// Unknown error or last attempt - throw
			if (isLastAttempt) {
				throw new Error(
					`Failed to generate embedding after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`
				);
			}

			// Retry with exponential backoff
			const delay = retryDelay * Math.pow(2, attempt);
			console.warn(`Embedding generation failed, retrying in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw new Error('Max retries exceeded (should not reach here)');
}

/**
 * Generate embeddings for multiple texts in a single batch request
 *
 * More efficient than calling generateEmbedding() multiple times.
 * Uses batch API endpoint with better rate limits.
 *
 * @param texts - Array of texts to embed (max 100 texts, each max 2,048 tokens)
 * @param options - Embedding options
 * @returns Array of float arrays (one per text)
 *
 * @example
 * ```typescript
 * const embeddings = await generateBatchEmbeddings([
 *   'First text',
 *   'Second text',
 *   'Third text'
 * ]);
 * console.log(embeddings.length); // 3
 * console.log(embeddings[0].length); // 768
 * ```
 */
export async function generateBatchEmbeddings(
	texts: string[],
	options: EmbeddingOptions = {}
): Promise<number[][]> {
	if (texts.length === 0) {
		return [];
	}

	if (texts.length > EMBEDDING_CONFIG.batchSize) {
		throw new Error(
			`Batch size too large: ${texts.length} (max: ${EMBEDDING_CONFIG.batchSize}). Split into multiple batches.`
		);
	}

	const {
		taskType = 'RETRIEVAL_DOCUMENT',
		dimensions = EMBEDDING_CONFIG.dimensions,
		maxRetries = 3,
		retryDelay = 1000
	} = options;

	const ai = getGeminiClient();

	// Validate input lengths
	for (const text of texts) {
		const estimatedTokens = Math.ceil(text.length / 4);
		if (estimatedTokens > EMBEDDING_CONFIG.maxInputTokens) {
			throw new Error(
				`Text too long: ${estimatedTokens} tokens (max: ${EMBEDDING_CONFIG.maxInputTokens}). Truncate input.`
			);
		}
	}

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const result = await ai.models.embedContent({
				model: EMBEDDING_CONFIG.model,
				contents: texts,
				config: {
					outputDimensionality: dimensions,
					taskType: taskType
				}
			});

			if (!result.embeddings || result.embeddings.length !== texts.length) {
				throw new Error(
					`Expected ${texts.length} embeddings, got ${result.embeddings?.length || 0}`
				);
			}

			return result.embeddings.map((e) => e.values);
		} catch (error) {
			const isLastAttempt = attempt === maxRetries - 1;

			// Check for specific error types
			if (error && typeof error === 'object' && 'code' in error) {
				const errorCode = (error as { code: string }).code;

				if (errorCode === 'RESOURCE_EXHAUSTED') {
					// Rate limit exceeded - retry with exponential backoff
					if (!isLastAttempt) {
						const delay = retryDelay * Math.pow(2, attempt);
						console.warn(
							`Rate limit exceeded, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
						);
						await new Promise((resolve) => setTimeout(resolve, delay));
						continue;
					}
				} else if (errorCode === 'INVALID_ARGUMENT') {
					// Invalid input - don't retry
					throw new Error(
						`Invalid input: ${error instanceof Error ? error.message : String(error)}`
					);
				} else if (errorCode === 'UNAUTHENTICATED') {
					// Invalid API key - don't retry
					throw new Error(
						'Invalid GEMINI_API_KEY. Get key from: https://aistudio.google.com/apikey'
					);
				}
			}

			// Unknown error or last attempt - throw
			if (isLastAttempt) {
				throw new Error(
					`Failed to generate batch embeddings after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`
				);
			}

			// Retry with exponential backoff
			const delay = retryDelay * Math.pow(2, attempt);
			console.warn(`Batch embedding generation failed, retrying in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw new Error('Max retries exceeded (should not reach here)');
}

/**
 * Estimate token count for a text
 *
 * Rough approximation: 1 token ≈ 4 characters
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for embedding generation
 *
 * Pricing: $0.15 per 1M tokens (or FREE in Google AI Studio)
 *
 * @param tokens - Number of tokens
 * @returns Estimated cost in USD
 */
export function estimateCost(tokens: number): number {
	return (tokens / 1_000_000) * 0.15;
}

/**
 * Check if text exceeds max input length
 *
 * @param text - Text to check
 * @returns true if text is too long
 */
export function exceedsMaxLength(text: string): boolean {
	return estimateTokens(text) > EMBEDDING_CONFIG.maxInputTokens;
}

/**
 * Truncate text to fit within max input length
 *
 * Preserves whole words when possible.
 *
 * @param text - Text to truncate
 * @param maxTokens - Maximum tokens (default: 2048)
 * @returns Truncated text
 */
export function truncateText(
	text: string,
	maxTokens: number = EMBEDDING_CONFIG.maxInputTokens
): string {
	const estimatedTokens = estimateTokens(text);

	if (estimatedTokens <= maxTokens) {
		return text;
	}

	// Calculate max characters (1 token ≈ 4 chars)
	const maxChars = maxTokens * 4;

	// Find last space before max chars to avoid cutting words
	const truncated = text.slice(0, maxChars);
	const lastSpace = truncated.lastIndexOf(' ');

	if (lastSpace > maxChars * 0.8) {
		// If last space is within 80% of max, truncate there
		return truncated.slice(0, lastSpace) + '...';
	}

	// Otherwise truncate at max chars
	return truncated + '...';
}
