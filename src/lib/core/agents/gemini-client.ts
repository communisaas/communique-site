/**
 * Gemini AI Client for Agent Infrastructure
 *
 * Centralized SDK wrapper for Gemini 3 Flash integration with:
 * - Singleton client initialization
 * - Structured output with JSON schemas
 * - Google Search grounding
 * - Multi-turn conversations (simulated until Interactions API is available)
 * - Retry logic with exponential backoff (1s, 2s, 4s)
 * - Max 3 retries for RESOURCE_EXHAUSTED errors
 */

import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';
import type { GenerateContentResponse, GenerateContentConfig } from '@google/genai';
import type { GenerateOptions, InteractionResponse } from './types';

// ============================================================================
// Client Singleton
// ============================================================================

let client: GoogleGenAI | null = null;

/**
 * Initialize and return the Gemini client
 *
 * Uses singleton pattern to reuse the same client instance.
 * Throws if GEMINI_API_KEY is not configured.
 *
 * @returns GoogleGenAI client instance
 * @throws Error if GEMINI_API_KEY environment variable not set
 */
export function getGeminiClient(): GoogleGenAI {
	if (!client) {
		if (!env.GEMINI_API_KEY) {
			throw new Error(
				'GEMINI_API_KEY environment variable not set. Get key from: https://aistudio.google.com/apikey'
			);
		}
		client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
	}
	return client;
}

// ============================================================================
// Configuration
// ============================================================================

export const GEMINI_CONFIG = {
	model: 'gemini-2.5-flash',
	defaults: {
		temperature: 0.3,
		maxOutputTokens: 8192,
		thinkingLevel: 'medium' as const
	}
} as const;

// ============================================================================
// Generate Content (Single-turn)
// ============================================================================

/**
 * Generate content using Gemini with optional grounding and structured output
 *
 * Single-turn generation with support for:
 * - Temperature control
 * - Google Search grounding
 * - JSON schema enforcement
 * - System instructions
 * - Thinking levels (low/medium/high) - not yet available in SDK v1.28.0
 *
 * Includes retry logic for rate limits (RESOURCE_EXHAUSTED).
 * Uses exponential backoff: 1s, 2s, 4s.
 *
 * @param prompt - User prompt to generate from
 * @param options - Generation configuration options
 * @returns Generated content response
 * @throws Error on API failures or invalid configuration
 *
 * @example
 * ```typescript
 * const response = await generate('Analyze this issue...', {
 *   temperature: 0.4,
 *   enableGrounding: true,
 *   responseSchema: SUBJECT_LINE_SCHEMA
 * });
 * ```
 */
export async function generate(
	prompt: string,
	options: GenerateOptions = {}
): Promise<GenerateContentResponse> {
	const ai = getGeminiClient();

	const config: GenerateContentConfig = {
		temperature: options.temperature ?? GEMINI_CONFIG.defaults.temperature,
		maxOutputTokens: options.maxOutputTokens ?? GEMINI_CONFIG.defaults.maxOutputTokens
	};

	// Add grounding if enabled
	// NOTE: Google Search grounding is INCOMPATIBLE with JSON response schema
	// When grounding is enabled, we must parse the response manually
	if (options.enableGrounding) {
		config.tools = [{ googleSearch: {} }];
		// Cannot use responseMimeType with tools - Gemini API limitation
		console.log('[agents/gemini-client] Using grounding mode (no JSON schema)');
	} else if (options.responseSchema) {
		// Only add structured output if NOT using grounding
		config.responseMimeType = 'application/json';
		config.responseSchema = options.responseSchema;
		console.log('[agents/gemini-client] Using JSON schema mode (no grounding)');
	}

	// Add system instruction if provided
	if (options.systemInstruction) {
		config.systemInstruction = options.systemInstruction;
	}

	// Note: thinkingConfig.thinkingLevel is not yet supported in SDK v1.28.0
	// Keeping parameter for future API compatibility
	// When available, uncomment:
	// if (options.thinkingLevel) {
	//   config.thinkingConfig = { thinkingLevel: options.thinkingLevel };
	// }

	// Retry logic with exponential backoff
	const maxRetries = 3;
	const retryDelay = 1000; // 1 second base delay

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await ai.models.generateContent({
				model: GEMINI_CONFIG.model,
				contents: prompt,
				config
			});
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
							`[agents/gemini-client] Rate limit exceeded, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
						);
						await new Promise((resolve) => setTimeout(resolve, delay));
						continue;
					}
				} else if (errorCode === 'INVALID_ARGUMENT') {
					// Invalid input - don't retry
					throw new Error(
						`[agents/gemini-client] Invalid input: ${error instanceof Error ? error.message : String(error)}`
					);
				} else if (errorCode === 'UNAUTHENTICATED') {
					// Invalid API key - don't retry
					throw new Error(
						'[agents/gemini-client] Invalid GEMINI_API_KEY. Get key from: https://aistudio.google.com/apikey'
					);
				}
			}

			// Unknown error or last attempt - throw
			if (isLastAttempt) {
				console.error('[agents/gemini-client] Generation failed:', error);
				throw new Error(
					`[agents/gemini-client] Failed to generate content after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`
				);
			}

			// Retry with exponential backoff
			const delay = retryDelay * Math.pow(2, attempt);
			console.warn(`[agents/gemini-client] Generation failed, retrying in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw new Error('[agents/gemini-client] Max retries exceeded (should not reach here)');
}

// ============================================================================
// Stateful Interaction (Multi-turn)
// ============================================================================

/**
 * Create a stateful interaction for multi-turn conversations
 *
 * Note: The Gemini SDK's Interactions API is not yet available in v1.28.0.
 * This implementation simulates multi-turn conversations using generate()
 * with manual state tracking via interaction IDs.
 *
 * For true multi-turn support, the interaction ID should be used to
 * maintain conversation history in application state, then pass the full
 * conversation context to generate() on each turn.
 *
 * @param input - User input text
 * @param options - Generation configuration
 * @returns InteractionResponse with outputs and interaction ID
 *
 * @example
 * ```typescript
 * // First turn
 * const result1 = await interact('Analyze this issue...', {
 *   systemInstruction: SUBJECT_LINE_PROMPT,
 *   responseSchema: SUBJECT_LINE_SCHEMA
 * });
 *
 * // Refinement turn
 * const result2 = await interact('Make it more specific', {
 *   previousInteractionId: result1.id,
 *   systemInstruction: SUBJECT_LINE_PROMPT,
 *   responseSchema: SUBJECT_LINE_SCHEMA
 * });
 * ```
 */
export async function interact(
	input: string,
	options: GenerateOptions = {}
): Promise<InteractionResponse> {
	// Use generate() since Interactions API isn't available yet in SDK v1.28.0
	// When ai.interactions.create() becomes available, replace this implementation
	const response = await generate(input, options);

	// Extract text from response
	const outputs = response.text || '';

	// Generate or reuse interaction ID for multi-turn tracking
	// In a real implementation, this ID would be used to retrieve conversation history
	const id =
		options.previousInteractionId ||
		`interaction-${Date.now()}-${Math.random().toString(36).substring(7)}`;

	return {
		id,
		outputs,
		model: GEMINI_CONFIG.model
	};
}
