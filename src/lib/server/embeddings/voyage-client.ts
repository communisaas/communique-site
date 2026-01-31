/**
 * Voyage AI Client
 *
 * Production-ready client for Voyage AI embeddings and reranking.
 *
 * Features:
 * - Automatic batching for efficiency
 * - Rate limiting and retry logic
 * - Cost tracking
 * - Error handling
 *
 * Cost (as of 2026-01):
 * - voyage-3: ~$0.06 per 1M tokens
 * - voyage-3-lite: ~$0.02 per 1M tokens
 * - rerank-2: ~$0.05 per 1M tokens
 */

import type {
	VoyageModel,
	VoyageInputType,
	EmbeddingRequest,
	EmbeddingResponse,
	RerankRequest,
	RerankResponse,
	VoyageError,
	BatchEmbeddingOptions,
	ContentType
} from './types';

// Voyage AI API configuration
const VOYAGE_API_BASE = 'https://api.voyageai.com/v1';
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

// Rate limiting and retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_BATCH_SIZE = 128; // Voyage AI limit
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Cost tracking for monitoring usage
 */
class CostTracker {
	private totalTokens = 0;
	private embeddingCalls = 0;
	private rerankCalls = 0;

	track(tokens: number, operation: 'embedding' | 'rerank') {
		this.totalTokens += tokens;
		if (operation === 'embedding') {
			this.embeddingCalls++;
		} else {
			this.rerankCalls++;
		}
	}

	getStats() {
		return {
			totalTokens: this.totalTokens,
			embeddingCalls: this.embeddingCalls,
			rerankCalls: this.rerankCalls,
			estimatedCost: this.totalTokens * 0.00000006 // $0.06 per 1M tokens
		};
	}

	reset() {
		this.totalTokens = 0;
		this.embeddingCalls = 0;
		this.rerankCalls = 0;
	}
}

export const costTracker = new CostTracker();

/**
 * Content types that should use the voyage-law-2 model
 * These benefit from the 6-10% accuracy improvement for legal/legislative text
 */
const LEGAL_CONTENT_TYPES: ContentType[] = ['legislative', 'legal', 'regulatory'];

/**
 * Get the appropriate Voyage AI model for a given content type
 *
 * Uses voyage-law-2 for legislative, legal, and regulatory content
 * which provides 6-10% better accuracy for legal text.
 * Falls back to voyage-3 for all other content types.
 *
 * @param contentType - The type of content being embedded
 * @returns The recommended Voyage AI model for the content type
 *
 * @example
 * const model = getEmbeddingModelForContent('legislative'); // 'voyage-law-2'
 * const model = getEmbeddingModelForContent('news');        // 'voyage-3'
 * const model = getEmbeddingModelForContent();              // 'voyage-3' (default)
 */
export function getEmbeddingModelForContent(contentType?: ContentType): VoyageModel {
	if (contentType && LEGAL_CONTENT_TYPES.includes(contentType)) {
		return 'voyage-law-2';
	}
	return 'voyage-3';
}

/**
 * Validate API key is configured
 */
function validateApiKey(): void {
	if (!VOYAGE_API_KEY) {
		throw new Error(
			'VOYAGE_API_KEY environment variable is not set. ' +
				'Get your API key at https://dash.voyageai.com/'
		);
	}
}

/**
 * Make a request to Voyage AI with retry logic
 */
async function voyageRequest<T>(
	endpoint: string,
	body: Record<string, unknown>,
	retryCount = 0
): Promise<T> {
	validateApiKey();

	const url = `${VOYAGE_API_BASE}${endpoint}`;

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${VOYAGE_API_KEY}`
			},
			body: JSON.stringify(body),
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		// Handle rate limiting
		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
			const delay = Math.min(retryAfter * 1000, 60000); // Max 60s

			if (retryCount < MAX_RETRIES) {
				console.warn(
					`[Voyage AI] Rate limited, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return voyageRequest<T>(endpoint, body, retryCount + 1);
			}

			throw new Error(`Rate limited after ${MAX_RETRIES} retries`);
		}

		// Handle other errors
		if (!response.ok) {
			const error: VoyageError = await response.json();
			throw new Error(
				`Voyage AI API error (${response.status}): ${error.error?.message || 'Unknown error'}`
			);
		}

		const data = await response.json();
		return data as T;
	} catch (error) {
		// Retry on network errors
		if (retryCount < MAX_RETRIES && error instanceof Error) {
			const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff

			console.warn(
				`[Voyage AI] Request failed, retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
				error.message
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
			return voyageRequest<T>(endpoint, body, retryCount + 1);
		}

		throw error;
	}
}

/**
 * Generate embeddings for a single text or batch of texts
 *
 * @param input - Single text string or array of texts
 * @param options - Embedding options
 * @returns Array of embedding vectors (always returns array, even for single input)
 *
 * @example
 * // Single text
 * const [embedding] = await createEmbedding('Climate change policy');
 *
 * // Batch
 * const embeddings = await createEmbedding([
 *   'First document',
 *   'Second document'
 * ]);
 *
 * // With content type for automatic model selection
 * const [embedding] = await createEmbedding('HR 1234 Amendment', {
 *   contentType: 'legislative' // Uses voyage-law-2
 * });
 */
export async function createEmbedding(
	input: string | string[],
	options: {
		model?: VoyageModel;
		inputType?: VoyageInputType;
		contentType?: ContentType;
	} = {}
): Promise<number[][]> {
	// Determine model: explicit model > contentType-derived model > default
	const model = options.model || getEmbeddingModelForContent(options.contentType);
	const inputType = options.inputType || 'document';

	// Log which model is being used for debugging
	const inputCount = Array.isArray(input) ? input.length : 1;
	console.log(
		`[Voyage AI] Creating embeddings: model=${model}, inputType=${inputType}, count=${inputCount}${options.contentType ? `, contentType=${options.contentType}` : ''}`
	);

	const request: EmbeddingRequest = {
		input,
		model,
		inputType
	};

	const response = await voyageRequest<EmbeddingResponse>('/embeddings', request);

	// Track cost
	costTracker.track(response.usage.total_tokens, 'embedding');

	// Return embeddings sorted by index
	return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Generate embeddings for large batches with automatic chunking
 *
 * Automatically splits input into batches of 128 (Voyage limit)
 * and processes them sequentially to avoid rate limits.
 *
 * @param texts - Array of texts to embed
 * @param options - Batch embedding options
 * @returns Array of embedding vectors in same order as input
 *
 * @example
 * const texts = await loadDocuments(); // 500 documents
 * const embeddings = await createBatchEmbeddings(texts, {
 *   model: 'voyage-3',
 *   batchSize: 64,
 *   showProgress: true
 * });
 *
 * // With content type for automatic model selection
 * const embeddings = await createBatchEmbeddings(legislativeDocs, {
 *   contentType: 'legislative', // Uses voyage-law-2
 *   showProgress: true
 * });
 */
export async function createBatchEmbeddings(
	texts: string[],
	options: BatchEmbeddingOptions = {}
): Promise<number[][]> {
	const {
		model: explicitModel,
		contentType,
		inputType = 'document',
		batchSize = 64, // Conservative default
		showProgress = false
	} = options;

	// Determine model: explicit model > contentType-derived model > default
	const model = explicitModel || getEmbeddingModelForContent(contentType);

	const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE);
	const batches: string[][] = [];

	// Split into batches
	for (let i = 0; i < texts.length; i += effectiveBatchSize) {
		batches.push(texts.slice(i, i + effectiveBatchSize));
	}

	if (showProgress) {
		console.log(
			`[Voyage AI] Processing ${texts.length} texts in ${batches.length} batches of ${effectiveBatchSize}`
		);
	}

	const allEmbeddings: number[][] = [];

	// Process batches sequentially to avoid rate limits
	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];

		if (showProgress && i % 10 === 0) {
			console.log(`[Voyage AI] Processing batch ${i + 1}/${batches.length}...`);
		}

		const embeddings = await createEmbedding(batch, { model, inputType });
		allEmbeddings.push(...embeddings);

		// Small delay between batches to avoid rate limits
		if (i < batches.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	if (showProgress) {
		console.log(`[Voyage AI] Completed ${texts.length} embeddings`);
		console.log(`[Voyage AI] Cost stats:`, costTracker.getStats());
	}

	return allEmbeddings;
}

/**
 * Rerank documents by relevance to a query
 *
 * Improves precision of vector search results by using a cross-encoder
 * model to directly score query-document pairs.
 *
 * @param query - Search query
 * @param documents - Documents to rerank (strings or objects with text field)
 * @param options - Reranking options
 * @returns Reranked results sorted by relevance (highest first)
 *
 * @example
 * const results = await rerankDocuments(
 *   'renewable energy legislation',
 *   vectorSearchResults.map(r => r.snippet),
 *   { topK: 5 }
 * );
 *
 * // Results are sorted by relevanceScore descending
 * results.forEach(r => {
 *   console.log(`Score: ${r.relevanceScore}, Doc: ${documents[r.index]}`);
 * });
 */
export async function rerankDocuments(
	query: string,
	documents: string[],
	options: {
		model?: 'rerank-2' | 'rerank-lite-1';
		topK?: number;
		returnDocuments?: boolean;
	} = {}
): Promise<RerankResponse['results']> {
	const { model = 'rerank-2', topK = 10, returnDocuments = false } = options;

	// Voyage rerank has a limit of 1000 documents
	if (documents.length > 1000) {
		console.warn(
			`[Voyage AI] Rerank limited to 1000 documents, truncating from ${documents.length}`
		);
		documents = documents.slice(0, 1000);
	}

	const request: RerankRequest = {
		query,
		documents,
		model,
		topK,
		returnDocuments
	};

	const response = await voyageRequest<RerankResponse>('/rerank', request);

	// Track cost
	costTracker.track(response.usage.total_tokens, 'rerank');

	return response.results;
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score (0-1, higher is more similar)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

	return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Estimate token count for a text (rough approximation)
 * Useful for cost estimation before making API calls
 *
 * @param text - Input text
 * @returns Approximate token count
 */
export function estimateTokenCount(text: string): number {
	// Rough estimate: ~1 token per 4 characters for English
	// Voyage uses a tokenizer similar to OpenAI's cl100k_base
	return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for embedding a batch of texts
 *
 * @param texts - Texts to embed
 * @param model - Model to use
 * @returns Estimated cost in USD
 */
export function estimateEmbeddingCost(texts: string[], model: VoyageModel = 'voyage-3'): number {
	const totalTokens = texts.reduce((sum, text) => sum + estimateTokenCount(text), 0);

	// Pricing (per 1M tokens)
	const pricePerMillion = model === 'voyage-3' ? 0.06 : 0.02;

	return (totalTokens / 1_000_000) * pricePerMillion;
}

/**
 * Health check for Voyage AI API
 * Verifies API key is valid and service is reachable
 *
 * @returns true if healthy, false otherwise
 */
export async function healthCheck(): Promise<boolean> {
	try {
		validateApiKey();

		// Generate a simple embedding as health check
		await createEmbedding('test', { model: 'voyage-3-lite' });

		console.log('[Voyage AI] Health check passed');
		return true;
	} catch (error) {
		console.error('[Voyage AI] Health check failed:', error);
		return false;
	}
}
