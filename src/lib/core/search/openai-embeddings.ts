/**
 * OpenAI Embedding Generation Service
 *
 * Provides text-embedding-3-large embeddings (3072 dimensions) for semantic search.
 * Handles rate limiting, cost estimation, and batch generation.
 *
 * Security: API key stored server-side only. Client calls server endpoint for generation.
 *
 * Cost: $0.00013/1k tokens (text-embedding-3-large)
 * Performance: ~500 tokens/s, ~2-3s for typical template
 */

import type {
	EmbeddingRequest,
	EmbeddingResponse,
	BatchEmbeddingResult,
	CostEstimate
} from './types';

export class OpenAIEmbeddingGenerator {
	private apiKey: string;
	private model: 'text-embedding-3-large' | 'text-embedding-3-small';
	private baseURL = 'https://api.openai.com/v1';
	private maxRetries = 3;
	private retryDelay = 1000; // 1 second

	constructor(
		apiKey: string,
		model: 'text-embedding-3-large' | 'text-embedding-3-small' = 'text-embedding-3-large'
	) {
		if (!apiKey) {
			throw new Error('OpenAI API key is required');
		}
		this.apiKey = apiKey;
		this.model = model;
	}

	/**
	 * Generate embedding for a single text
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		if (!text || text.trim().length === 0) {
			throw new Error('Text cannot be empty');
		}

		const request: EmbeddingRequest = {
			input: text,
			model: this.model,
			encoding_format: 'float'
		};

		const response = await this.callOpenAI(request);
		return response.data[0].embedding;
	}

	/**
	 * Generate embeddings for multiple texts (batch processing)
	 * More efficient than individual calls due to single API request
	 */
	async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
		if (texts.length === 0) {
			throw new Error('No texts provided for batch generation');
		}

		// OpenAI supports up to 2048 inputs per request
		if (texts.length > 2048) {
			throw new Error('Batch size exceeds OpenAI limit of 2048 texts');
		}

		const request: EmbeddingRequest = {
			input: texts,
			model: this.model,
			encoding_format: 'float'
		};

		const response = await this.callOpenAI(request);

		// Sort by index to ensure correct order
		const sorted = response.data.sort((a, b) => a.index - b.index);

		return {
			embeddings: sorted.map((item) => item.embedding),
			model: response.model,
			total_tokens: response.usage.total_tokens,
			cost_usd: this.calculateCost(response.usage.total_tokens)
		};
	}

	/**
	 * Call OpenAI API with automatic retries
	 */
	private async callOpenAI(request: EmbeddingRequest): Promise<EmbeddingResponse> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < this.maxRetries; attempt++) {
			try {
				const response = await fetch(`${this.baseURL}/embeddings`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${this.apiKey}`
					},
					body: JSON.stringify(request)
				});

				if (!response.ok) {
					const errorData = (await response.json()) as { error?: { message?: string } };
					const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

					// Don't retry on authentication errors
					if (response.status === 401 || response.status === 403) {
						throw new Error(`OpenAI API authentication failed: ${errorMessage}`);
					}

					// Don't retry on invalid request errors
					if (response.status === 400) {
						throw new Error(`OpenAI API invalid request: ${errorMessage}`);
					}

					// Retry on rate limit or server errors
					if (response.status === 429 || response.status >= 500) {
						lastError = new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
						await this.sleep(this.retryDelay * Math.pow(2, attempt));
						continue;
					}

					throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
				}

				const data = (await response.json()) as EmbeddingResponse;
				return data;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Don't retry on non-retriable errors
				if (
					lastError.message.includes('authentication') ||
					lastError.message.includes('invalid request')
				) {
					throw lastError;
				}

				// Wait before retrying
				if (attempt < this.maxRetries - 1) {
					await this.sleep(this.retryDelay * Math.pow(2, attempt));
				}
			}
		}

		throw lastError || new Error('OpenAI API call failed after retries');
	}

	/**
	 * Estimate cost for generating embeddings
	 */
	estimateCost(textLength: number): CostEstimate {
		// Rough estimation: ~0.75 tokens per character
		const estimatedTokens = Math.ceil(textLength * 0.75);

		// Cost per 1k tokens
		const costPer1kTokens = this.model === 'text-embedding-3-large' ? 0.00013 : 0.00002;

		return {
			text_length: textLength,
			estimated_tokens: estimatedTokens,
			cost_usd: (estimatedTokens / 1000) * costPer1kTokens,
			model: this.model
		};
	}

	/**
	 * Calculate actual cost from token usage
	 */
	private calculateCost(tokens: number): number {
		const costPer1kTokens = this.model === 'text-embedding-3-large' ? 0.00013 : 0.00002;
		return (tokens / 1000) * costPer1kTokens;
	}

	/**
	 * Utility: Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Create embedding generator instance (server-side only)
 * DO NOT use this directly on client - call server endpoint instead
 */
export function createEmbeddingGenerator(apiKey: string): OpenAIEmbeddingGenerator {
	return new OpenAIEmbeddingGenerator(apiKey, 'text-embedding-3-large');
}
