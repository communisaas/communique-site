/**
 * Decision-Maker Email Enrichment Agent
 *
 * Phase 2 of the decision-maker pipeline: enriches candidates from Phase 1
 * with verified email addresses via targeted Google Search queries.
 *
 * CRITICAL: Uses parallel execution with concurrency limits and graceful
 * degradation. Failed enrichments are filtered out rather than blocking.
 */

import { generate } from '../gemini-client';
import { DECISION_MAKER_ENRICHMENT_PROMPT } from '../prompts/decision-maker-enrichment';

// ========================================
// Type Definitions
// ========================================

/**
 * Decision-maker candidate from Phase 1 identification
 * This is the input to enrichment - comes from decision-maker-identification.ts
 */
export interface DecisionMakerCandidate {
	name: string;
	title: string;
	organization: string;
	reasoning: string;
	sourceUrl: string;
	confidence: number;
	contactChannel?: 'email' | 'form' | 'phone' | 'congress' | 'other';
}

/**
 * Enriched decision-maker with contact information
 * This is the output of Phase 2 - includes email discovery results
 */
export interface EnrichedDecisionMaker extends DecisionMakerCandidate {
	email?: string;
	emailSource?: string;
	emailConfidence?: number;
	enrichmentStatus: 'success' | 'not_found' | 'timeout' | 'error';
	enrichmentAttempts: number;
}

/**
 * Raw API response from Gemini email enrichment
 */
interface EmailEnrichmentResponse {
	email: string | null;
	source_url: string | null;
	confidence: number;
}

// ========================================
// Configuration
// ========================================

const ENRICHMENT_CONFIG = {
	concurrencyLimit: 3, // Max 3 concurrent Gemini calls
	timeoutMs: 20000, // 20 second timeout per enrichment
	temperature: 0.2, // Low temperature for factual accuracy
	maxOutputTokens: 1024 // Small response - just email + source + confidence
} as const;

// ========================================
// Main Enrichment Function
// ========================================

/**
 * Enrich decision-maker candidates with verified email addresses
 *
 * Takes candidates from Phase 1 and performs parallel email discovery
 * with controlled concurrency. Uses Promise.allSettled for graceful
 * failure handling.
 *
 * @param candidates - Decision-maker candidates from Phase 1
 * @returns Enriched candidates (only successful enrichments)
 *
 * @example
 * ```typescript
 * const candidates = await identifyDecisionMakerCandidates(options);
 * const enriched = await enrichWithContactInfo(candidates);
 * // enriched contains only candidates with verified emails
 * ```
 */
export async function enrichWithContactInfo(
	candidates: DecisionMakerCandidate[]
): Promise<EnrichedDecisionMaker[]> {
	const startTime = Date.now();
	console.log(
		`[decision-maker-enrichment] Starting enrichment for ${candidates.length} candidates...`
	);

	// Process candidates with concurrency control
	const results = await processWithConcurrency(
		candidates,
		(candidate) => enrichSingleCandidate(candidate),
		ENRICHMENT_CONFIG.concurrencyLimit
	);

	// Extract successful enrichments
	const enriched = results
		.filter(
			(result): result is PromiseFulfilledResult<EnrichedDecisionMaker> =>
				result.status === 'fulfilled'
		)
		.map((result) => result.value);

	// Log results
	const successCount = enriched.filter((e) => e.enrichmentStatus === 'success').length;
	const notFoundCount = enriched.filter((e) => e.enrichmentStatus === 'not_found').length;
	const errorCount = enriched.filter((e) => e.enrichmentStatus === 'error').length;
	const timeoutCount = enriched.filter((e) => e.enrichmentStatus === 'timeout').length;

	const latencyMs = Date.now() - startTime;

	console.log('[decision-maker-enrichment] Enrichment complete:', {
		total: candidates.length,
		success: successCount,
		notFound: notFoundCount,
		timeout: timeoutCount,
		error: errorCount,
		latencyMs
	});

	return enriched;
}

// ========================================
// Single Candidate Enrichment
// ========================================

/**
 * Enrich a single candidate with email information
 *
 * Makes a targeted Gemini search for the person's official email.
 * Includes timeout protection and comprehensive error handling.
 *
 * @param candidate - Single candidate to enrich
 * @returns Enriched candidate with email info
 */
async function enrichSingleCandidate(
	candidate: DecisionMakerCandidate
): Promise<EnrichedDecisionMaker> {
	const startTime = Date.now();
	console.log(`[decision-maker-enrichment] Enriching: ${candidate.name} (${candidate.title})`);

	try {
		// Build targeted search query
		const query = buildEnrichmentQuery(candidate);

		// Call Gemini with timeout protection
		const response = await Promise.race([
			generate(query, {
				systemInstruction: DECISION_MAKER_ENRICHMENT_PROMPT,
				temperature: ENRICHMENT_CONFIG.temperature,
				maxOutputTokens: ENRICHMENT_CONFIG.maxOutputTokens,
				enableGrounding: true // CRITICAL: Enable Google Search
			}),
			timeoutPromise(ENRICHMENT_CONFIG.timeoutMs)
		]);

		// Handle timeout
		if (response === 'TIMEOUT') {
			console.warn(
				`[decision-maker-enrichment] Timeout after ${ENRICHMENT_CONFIG.timeoutMs}ms: ${candidate.name}`
			);
			return {
				...candidate,
				enrichmentStatus: 'timeout',
				enrichmentAttempts: 1
			};
		}

		// Parse response
		const emailData = parseEnrichmentResponse(response.text || '{}');

		// Log result
		const latencyMs = Date.now() - startTime;
		if (emailData.email) {
			console.log(
				`[decision-maker-enrichment] Found email for ${candidate.name}: ${emailData.email} (confidence: ${emailData.confidence}) [${latencyMs}ms]`
			);
		} else {
			console.log(
				`[decision-maker-enrichment] No email found for ${candidate.name} [${latencyMs}ms]`
			);
		}

		// Return enriched candidate
		return {
			...candidate,
			email: emailData.email || undefined,
			emailSource: emailData.source_url || undefined,
			emailConfidence: emailData.confidence,
			enrichmentStatus: emailData.email ? 'success' : 'not_found',
			enrichmentAttempts: 1
		};
	} catch (error) {
		const latencyMs = Date.now() - startTime;
		console.error(
			`[decision-maker-enrichment] Error enriching ${candidate.name}:`,
			error,
			`[${latencyMs}ms]`
		);

		return {
			...candidate,
			enrichmentStatus: 'error',
			enrichmentAttempts: 1
		};
	}
}

// ========================================
// Helper Functions
// ========================================

/**
 * Build targeted search query for email discovery
 *
 * Constructs a focused query combining name, title, organization, and
 * optional domain hint from sourceUrl.
 *
 * @param candidate - Candidate to search for
 * @returns Search query string
 */
function buildEnrichmentQuery(candidate: DecisionMakerCandidate): string {
	// Extract domain from source URL for site-specific search
	const domain = extractDomain(candidate.sourceUrl);
	const siteHint = domain ? ` site:${domain}` : '';

	// Build targeted query
	const query = `Find the official contact email for:

Name: ${candidate.name}
Title: ${candidate.title}
Organization: ${candidate.organization}

Search for their verified email address${siteHint}. Look for official contact pages, press listings, staff directories, or public leadership pages.

Remember: Return ONLY verifiable emails from credible public sources. Never guess or construct email addresses.`;

	return query;
}

/**
 * Extract domain from URL for targeted search
 *
 * @param url - Source URL
 * @returns Domain or empty string
 */
function extractDomain(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.hostname;
	} catch {
		return '';
	}
}

/**
 * Parse Gemini enrichment response
 *
 * Handles various response formats including markdown code blocks.
 *
 * @param responseText - Raw response text
 * @returns Parsed email enrichment data
 */
function parseEnrichmentResponse(responseText: string): EmailEnrichmentResponse {
	try {
		// Strip markdown code blocks if present
		let cleaned = responseText.trim();
		const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			cleaned = jsonMatch[1].trim();
		}

		// Extract JSON object if surrounded by text
		const jsonStartIndex = cleaned.indexOf('{');
		const jsonEndIndex = cleaned.lastIndexOf('}');
		if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
			cleaned = cleaned.slice(jsonStartIndex, jsonEndIndex + 1);
		}

		// Parse JSON
		const data = JSON.parse(cleaned) as EmailEnrichmentResponse;

		// Validate structure
		return {
			email: data.email || null,
			source_url: data.source_url || null,
			confidence: typeof data.confidence === 'number' ? data.confidence : 0
		};
	} catch (error) {
		console.error('[decision-maker-enrichment] JSON parse error:', error);
		console.error('[decision-maker-enrichment] Raw text:', responseText);

		// Return empty result on parse failure
		return {
			email: null,
			source_url: null,
			confidence: 0
		};
	}
}

/**
 * Create a timeout promise that resolves after specified milliseconds
 *
 * @param ms - Timeout in milliseconds
 * @returns Promise that resolves to 'TIMEOUT'
 */
function timeoutPromise(ms: number): Promise<'TIMEOUT'> {
	return new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), ms));
}

/**
 * Process items with controlled concurrency
 *
 * Implements a sliding window of concurrent operations to avoid
 * overwhelming the API or hitting rate limits.
 *
 * @param items - Items to process
 * @param processor - Async function to process each item
 * @param concurrency - Maximum concurrent operations
 * @returns Array of settled results
 */
async function processWithConcurrency<T, R>(
	items: T[],
	processor: (item: T) => Promise<R>,
	concurrency: number
): Promise<PromiseSettledResult<R>[]> {
	const results: PromiseSettledResult<R>[] = [];
	const executing: Set<Promise<void>> = new Set();

	for (const item of items) {
		// Create promise that processes item and stores result
		const p = processor(item).then(
			(value) => {
				results.push({ status: 'fulfilled', value });
			},
			(reason) => {
				results.push({ status: 'rejected', reason });
			}
		);

		// Wrap in a promise that removes itself from executing set when done
		const tracked = p.finally(() => {
			executing.delete(tracked);
		});

		executing.add(tracked);

		// If we've hit concurrency limit, wait for one to complete
		if (executing.size >= concurrency) {
			await Promise.race(executing);
		}
	}

	// Wait for all remaining promises to complete
	await Promise.all(Array.from(executing));

	return results;
}
