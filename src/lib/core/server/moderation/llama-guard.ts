/**
 * Llama Guard 4 12B via GROQ
 *
 * Safety classification using MLCommons hazard taxonomy.
 * Optimized for civic content with electoral misinformation (S13)
 * and defamation (S5) detection.
 *
 * Rate limits (Free tier):
 * - 30 requests/minute
 * - 15,000 tokens/minute
 * - 14,400 requests/day (~432K/month)
 *
 * @see https://console.groq.com/docs/model/meta-llama/llama-guard-4-12b
 */

import { env } from '$env/dynamic/private';
import type { MLCommonsHazard, SafetyResult } from './types';
import { HAZARD_DESCRIPTIONS, BLOCKING_HAZARDS } from './types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'meta-llama/llama-guard-4-12b';

/**
 * IMPORTANT: Llama Guard 4 does NOT use a system message.
 * The model is pre-trained for safety classification using MLCommons taxonomy.
 * Adding a system message overrides its native behavior and breaks classification.
 *
 * @see https://console.groq.com/docs/content-moderation
 */

/**
 * Parse Llama Guard 4 response into structured result
 *
 * PERMISSIVE POLICY: Only BLOCKING_HAZARDS (S1, S4) cause safe=false.
 * All other hazards are logged but content proceeds.
 */
function parseResponse(response: string): {
	safe: boolean;
	hazards: MLCommonsHazard[];
	blocking_hazards: MLCommonsHazard[];
} {
	const trimmed = response.trim().toLowerCase();

	if (trimmed === 'safe') {
		return { safe: true, hazards: [], blocking_hazards: [] };
	}

	// Parse "unsafe\nS1" or "unsafe\nS1,S2" format
	if (trimmed.startsWith('unsafe')) {
		const lines = response.trim().split('\n');
		const hazardLine = lines[1] || '';

		// Extract hazard codes (S1-S14)
		const hazardMatches = hazardLine.match(/S\d{1,2}/gi) || [];
		const hazards = hazardMatches
			.map((h) => h.toUpperCase())
			.filter((h): h is MLCommonsHazard => /^S(1[0-4]|[1-9])$/.test(h));

		// Only BLOCKING_HAZARDS (S1, S4) cause rejection
		const blocking_hazards = hazards.filter((h) =>
			BLOCKING_HAZARDS.includes(h)
		) as MLCommonsHazard[];

		// Safe if no blocking hazards detected (non-blocking hazards are allowed)
		const safe = blocking_hazards.length === 0;

		return { safe, hazards, blocking_hazards };
	}

	// Default to safe if parsing fails (fail-open for edge cases)
	console.warn('[llama-guard] Unexpected response format, defaulting to safe:', response);
	return { safe: true, hazards: [], blocking_hazards: [] };
}

/**
 * Classify content safety using Llama Guard 4 via GROQ
 *
 * @param content - Text content to classify
 * @returns SafetyResult with hazard categories
 * @throws Error if GROQ API fails
 */
export async function classifySafety(content: string): Promise<SafetyResult> {
	const apiKey = env.GROQ_API_KEY;

	if (!apiKey) {
		console.warn('[llama-guard] GROQ_API_KEY not configured, defaulting to safe');
		return {
			safe: true,
			hazards: [],
			blocking_hazards: [],
			hazard_descriptions: [],
			reasoning: 'GROQ API key not configured - safety check skipped',
			timestamp: new Date().toISOString(),
			model: 'llama-guard-4-12b'
		};
	}

	const startTime = Date.now();

	// CRITICAL: Do NOT add a system message - it breaks Llama Guard 4's native classification
	// The model is pre-trained with MLCommons S1-S14 taxonomy baked in
	const response = await fetch(GROQ_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [{ role: 'user', content }],
			temperature: 0,
			max_tokens: 100
		})
	});

	if (!response.ok) {
		const errorText = await response.text();

		// Handle rate limiting gracefully
		if (response.status === 429) {
			console.error('[llama-guard] Rate limited by GROQ:', errorText);
			throw new Error('Safety check rate limited. Please try again in a moment.');
		}

		console.error('[llama-guard] GROQ API error:', response.status, errorText);
		throw new Error(`Safety classification failed: ${response.status}`);
	}

	const data = await response.json();
	const modelResponse = data.choices?.[0]?.message?.content || 'safe';
	const { safe, hazards, blocking_hazards } = parseResponse(modelResponse);

	const latencyMs = Date.now() - startTime;

	// Log all hazards but only reject on blocking ones
	if (hazards.length > 0) {
		console.log(`[llama-guard] Classification complete in ${latencyMs}ms:`, {
			safe,
			all_hazards: hazards,
			blocking_hazards,
			tokens: data.usage?.total_tokens
		});
	} else {
		console.log(`[llama-guard] Classification complete in ${latencyMs}ms: safe`);
	}

	return {
		safe,
		hazards,
		blocking_hazards,
		hazard_descriptions: hazards.map((h) => HAZARD_DESCRIPTIONS[h]),
		reasoning: modelResponse,
		timestamp: new Date().toISOString(),
		model: 'llama-guard-4-12b'
	};
}

/**
 * Batch classify multiple content pieces
 * Respects GROQ rate limits (30 req/min)
 *
 * @param contents - Array of content strings
 * @returns Array of SafetyResults
 */
export async function classifySafetyBatch(contents: string[]): Promise<SafetyResult[]> {
	const results: SafetyResult[] = [];

	for (let i = 0; i < contents.length; i++) {
		const result = await classifySafety(contents[i]);
		results.push(result);

		// Rate limit: 30 req/min = 1 req per 2 seconds
		// Add buffer for safety
		if (i < contents.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 2100));
		}
	}

	return results;
}
