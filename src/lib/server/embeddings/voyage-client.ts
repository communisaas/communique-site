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
 * - voyage-4: ~$0.06 per 1M tokens
 * - voyage-4-lite: ~$0.02 per 1M tokens
 * - voyage-law-2: ~$0.12 per 1M tokens
 * - rerank-2.5: ~$0.05 per 1M tokens
 *
 * Note: Voyage 4 series supports shared embedding space - embeddings from
 * voyage-4 and voyage-4-lite are compatible without reindexing.
 */

import type {
	VoyageModel,
	VoyageInputType,
	EmbeddingRequest,
	EmbeddingResponse,
	RerankRequest,
	RerankResponse,
	RawRerankResponse,
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
 * Cost per 1M tokens by model (as of January 2026)
 */
const MODEL_COSTS: Record<VoyageModel, number> = {
	'voyage-4': 0.06,
	'voyage-4-lite': 0.02,
	'voyage-law-2': 0.12
};

/**
 * Cost tracking for monitoring usage and savings
 */
class CostTracker {
	private totalTokens = 0;
	private embeddingCalls = 0;
	private rerankCalls = 0;
	private tokensByModel: Record<VoyageModel, number> = {
		'voyage-4': 0,
		'voyage-4-lite': 0,
		'voyage-law-2': 0
	};

	track(tokens: number, operation: 'embedding' | 'rerank', model?: VoyageModel) {
		this.totalTokens += tokens;
		if (operation === 'embedding') {
			this.embeddingCalls++;
			if (model) {
				this.tokensByModel[model] += tokens;
			}
		} else {
			this.rerankCalls++;
		}
	}

	getStats() {
		// Calculate actual cost based on model usage
		const actualCost = Object.entries(this.tokensByModel).reduce((sum, [model, tokens]) => {
			return sum + (tokens / 1_000_000) * MODEL_COSTS[model as VoyageModel];
		}, 0);

		// Calculate what cost would have been with voyage-4 for everything
		const costIfAllVoyage4 = (this.tokensByModel['voyage-4-lite'] / 1_000_000) * MODEL_COSTS['voyage-4'];
		const liteTokenSavings = costIfAllVoyage4 - (this.tokensByModel['voyage-4-lite'] / 1_000_000) * MODEL_COSTS['voyage-4-lite'];

		return {
			totalTokens: this.totalTokens,
			embeddingCalls: this.embeddingCalls,
			rerankCalls: this.rerankCalls,
			tokensByModel: { ...this.tokensByModel },
			estimatedCost: actualCost,
			liteSavings: liteTokenSavings, // Cost saved by using voyage-4-lite instead of voyage-4
			savingsPercent: liteTokenSavings > 0 ? ((liteTokenSavings / (actualCost + liteTokenSavings)) * 100).toFixed(1) : '0'
		};
	}

	reset() {
		this.totalTokens = 0;
		this.embeddingCalls = 0;
		this.rerankCalls = 0;
		this.tokensByModel = {
			'voyage-4': 0,
			'voyage-4-lite': 0,
			'voyage-law-2': 0
		};
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
 * Falls back to voyage-4 for all other content types.
 *
 * @param contentType - The type of content being embedded
 * @returns The recommended Voyage AI model for the content type
 *
 * @example
 * const model = getEmbeddingModelForContent('legislative'); // 'voyage-law-2'
 * const model = getEmbeddingModelForContent('news');        // 'voyage-4'
 * const model = getEmbeddingModelForContent();              // 'voyage-4' (default)
 */
export function getEmbeddingModelForContent(contentType?: ContentType): VoyageModel {
	if (contentType && LEGAL_CONTENT_TYPES.includes(contentType)) {
		return 'voyage-law-2';
	}
	return 'voyage-4';
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
 * Determine the optimal model based on inputType and contentType
 *
 * Model selection priority:
 * 1. Explicit model option (highest priority)
 * 2. ContentType-derived model (voyage-law-2 for legal content)
 * 3. InputType-based selection:
 *    - 'query' -> voyage-4-lite (3x cheaper, <5% quality loss)
 *    - 'document' -> voyage-4 (highest quality for storage)
 *
 * Note: Voyage 4 series embeddings are compatible across models (shared embedding space),
 * so mixing voyage-4 for documents and voyage-4-lite for queries works seamlessly.
 *
 * @param options - Embedding options
 * @returns Selected model and whether it was auto-selected
 */
function selectEmbeddingModel(options: {
	model?: VoyageModel;
	inputType?: VoyageInputType;
	contentType?: ContentType;
}): { model: VoyageModel; autoSelected: boolean } {
	const inputType = options.inputType || 'document';

	// Priority 1: Explicit model override
	if (options.model) {
		return { model: options.model, autoSelected: false };
	}

	// Priority 2: ContentType-derived model (for legal content)
	if (options.contentType && LEGAL_CONTENT_TYPES.includes(options.contentType)) {
		return { model: 'voyage-law-2', autoSelected: true };
	}

	// Priority 3: Auto-select based on inputType
	// - Use voyage-4-lite for queries (3x cheaper, <5% quality loss)
	// - Use voyage-4 for documents (highest quality for storage)
	// Note: Voyage 4 series has shared embedding space - mixing models is safe
	if (inputType === 'query') {
		return { model: 'voyage-4-lite', autoSelected: true };
	}

	// Default: voyage-4 for documents
	return { model: 'voyage-4', autoSelected: true };
}

/**
 * Generate embeddings for a single text or batch of texts
 *
 * Model auto-selection (Phase 2B cost optimization):
 * - query inputType: Uses voyage-4-lite (3x cheaper, <5% quality loss)
 * - document inputType: Uses voyage-4 (highest quality for storage)
 * - Override with explicit model option if needed
 *
 * Note: Voyage 4 series has shared embedding space - mixing voyage-4 for
 * documents and voyage-4-lite for queries works seamlessly without reindexing.
 *
 * @param input - Single text string or array of texts
 * @param options - Embedding options
 * @returns Array of embedding vectors (always returns array, even for single input)
 *
 * @example
 * // Query embedding (auto-selects voyage-4-lite)
 * const [queryEmbed] = await createEmbedding('search term', { inputType: 'query' });
 *
 * // Document embedding (auto-selects voyage-4)
 * const [docEmbed] = await createEmbedding('Document content');
 *
 * // Force specific model
 * const [embed] = await createEmbedding('text', { model: 'voyage-4' });
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
	const inputType = options.inputType || 'document';
	const { model, autoSelected } = selectEmbeddingModel(options);

	// Log which model is being used for debugging
	const inputCount = Array.isArray(input) ? input.length : 1;
	const selectionNote = autoSelected
		? model === 'voyage-4-lite'
			? ' (auto: 3x cheaper for queries)'
			: model === 'voyage-law-2'
				? ' (auto: legal content)'
				: ' (auto: default for documents)'
		: ' (explicit)';
	console.log(
		`[Voyage AI] Creating embeddings: model=${model}${selectionNote}, inputType=${inputType}, count=${inputCount}${options.contentType ? `, contentType=${options.contentType}` : ''}`
	);

	// Build request with snake_case field names per Voyage AI API spec
	const request: EmbeddingRequest = {
		input,
		model,
		input_type: inputType // API uses snake_case
	};

	const response = await voyageRequest<EmbeddingResponse>('/embeddings', request);

	// Track cost with model info for savings calculation
	costTracker.track(response.usage.total_tokens, 'embedding', model);

	// Return embeddings sorted by index
	return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Generate embeddings for large batches with automatic chunking
 *
 * Automatically splits input into batches of 128 (Voyage limit)
 * and processes them sequentially to avoid rate limits.
 *
 * Model auto-selection (Phase 2B cost optimization):
 * - query inputType: Uses voyage-4-lite (3x cheaper, <5% quality loss)
 * - document inputType: Uses voyage-4 (highest quality for storage)
 * - Override with explicit model option if needed
 *
 * Note: Voyage 4 series has shared embedding space - mixing voyage-4 for
 * documents and voyage-4-lite for queries works seamlessly without reindexing.
 *
 * @param texts - Array of texts to embed
 * @param options - Batch embedding options
 * @returns Array of embedding vectors in same order as input
 *
 * @example
 * // Document embeddings (auto-selects voyage-4)
 * const embeddings = await createBatchEmbeddings(documents, {
 *   showProgress: true
 * });
 *
 * // Query embeddings (auto-selects voyage-4-lite, 3x cheaper)
 * const embeddings = await createBatchEmbeddings(queries, {
 *   inputType: 'query',
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

	// Use selectEmbeddingModel for consistent model selection across functions
	const { model, autoSelected } = selectEmbeddingModel({
		model: explicitModel,
		inputType,
		contentType
	});

	const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE);
	const batches: string[][] = [];

	// Split into batches
	for (let i = 0; i < texts.length; i += effectiveBatchSize) {
		batches.push(texts.slice(i, i + effectiveBatchSize));
	}

	if (showProgress) {
		const selectionNote = autoSelected
			? model === 'voyage-4-lite'
				? ' (auto: 3x cheaper for queries)'
				: ''
			: ' (explicit)';
		console.log(
			`[Voyage AI] Processing ${texts.length} texts in ${batches.length} batches of ${effectiveBatchSize}, model=${model}${selectionNote}`
		);
	}

	const allEmbeddings: number[][] = [];

	// Process batches sequentially to avoid rate limits
	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];

			if (showProgress && i % 10 === 0) {
			console.log(`[Voyage AI] Processing batch ${i + 1}/${batches.length}...`);
		}

		// Pass through the explicit model and inputType to avoid re-selecting
		const embeddings = await createEmbedding(batch, { model, inputType });
		allEmbeddings.push(...embeddings);

		// Small delay between batches to avoid rate limits
		if (i < batches.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	if (showProgress) {
		console.log(`[Voyage AI] Completed ${texts.length} embeddings`);
		const stats = costTracker.getStats();
		console.log(`[Voyage AI] Cost stats:`, stats);
		if (parseFloat(stats.savingsPercent) > 0) {
			console.log(`[Voyage AI] Saved ${stats.savingsPercent}% by using voyage-4-lite for queries`);
		}
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
		model?: 'rerank-2.5' | 'rerank-2.5-lite' | 'rerank-2' | 'rerank-2-lite';
		topK?: number;
		returnDocuments?: boolean;
	} = {}
): Promise<RerankResponse['results']> {
	const { model = 'rerank-2.5', topK = 10, returnDocuments = false } = options;

	// Voyage rerank has a limit of 1000 documents
	if (documents.length > 1000) {
		console.warn(
			`[Voyage AI] Rerank limited to 1000 documents, truncating from ${documents.length}`
		);
		documents = documents.slice(0, 1000);
	}

	// Build request with snake_case field names per Voyage AI API spec
	const request: RerankRequest = {
		query,
		documents,
		model,
		top_k: topK, // API uses snake_case
		return_documents: returnDocuments // API uses snake_case
	};

	// API returns snake_case (relevance_score), need to normalize
	const rawResponse = await voyageRequest<RawRerankResponse>('/rerank', request);

	// Track cost
	costTracker.track(rawResponse.usage.total_tokens, 'rerank');

	// Normalize snake_case response to camelCase for internal use
	const normalizedResults: RerankResponse['results'] = rawResponse.data.map((result) => ({
		index: result.index,
		relevanceScore: result.relevance_score, // Normalize to camelCase
		document: result.document
	}));

	return normalizedResults;
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
 * @param model - Model to use (defaults to voyage-4)
 * @returns Estimated cost in USD
 */
export function estimateEmbeddingCost(texts: string[], model: VoyageModel = 'voyage-4'): number {
	const totalTokens = texts.reduce((sum, text) => sum + estimateTokenCount(text), 0);

	return (totalTokens / 1_000_000) * MODEL_COSTS[model];
}

/**
 * Estimate cost savings by using voyage-4-lite for queries
 *
 * @param queryTexts - Query texts that would use voyage-4-lite
 * @returns Estimated savings in USD compared to using voyage-4
 */
export function estimateQuerySavings(queryTexts: string[]): {
	voyage4Cost: number;
	voyage4LiteCost: number;
	savings: number;
	savingsPercent: string;
} {
	const voyage4Cost = estimateEmbeddingCost(queryTexts, 'voyage-4');
	const voyage4LiteCost = estimateEmbeddingCost(queryTexts, 'voyage-4-lite');
	const savings = voyage4Cost - voyage4LiteCost;

	return {
		voyage4Cost,
		voyage4LiteCost,
		savings,
		savingsPercent: ((savings / voyage4Cost) * 100).toFixed(1)
	};
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
		await createEmbedding('test', { model: 'voyage-4-lite' });

		console.log('[Voyage AI] Health check passed');
		return true;
	} catch (error) {
		console.error('[Voyage AI] Health check failed:', error);
		return false;
	}
}
