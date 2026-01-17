/**
 * Decision-Maker Identification (Phase 1)
 *
 * Uses Gemini 3 Flash with Google Search grounding to identify decision-maker
 * CANDIDATES without requiring email addresses.
 *
 * This is Phase 1 of the Decision-Maker Enrichment Pipeline:
 * - Phase 1: Identify REAL people with verifiable power (this file)
 * - Phase 2: Enrich candidates with contact info (decision-maker-enrichment.ts)
 * - Phase 3: Validate and merge (decision-maker-validation.ts)
 *
 * CRITICAL: This phase uses Google Search grounding to find verifiable
 * decision-makers. Without grounding, the model will hallucinate names.
 */

import { generate } from '../gemini-client';
import { extractSourcesFromGrounding } from '../utils/grounding';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import { DECISION_MAKER_IDENTIFICATION_PROMPT } from '../prompts/decision-maker-identification';
import type { GroundingMetadata, DecisionMakerCandidate, ContactChannel } from '../types';

// ========================================
// Type Definitions (Import from types.ts for single source of truth)
// ========================================

// Re-export for backwards compatibility with existing consumers
export type { DecisionMakerCandidate, ContactChannel };

/**
 * Options for decision-maker identification
 */
export interface IdentificationOptions {
	/** Subject line describing the issue */
	subjectLine: string;
	/** Core issue explanation */
	coreIssue: string;
	/** Topic tags indicating what the issue is about */
	topics: string[];
	/** Voice sample (optional) - the emotional core of the complaint */
	voiceSample?: string;
	/** URL slug for the template (optional) */
	urlSlug?: string;
}

/**
 * Response from identification phase
 */
interface IdentificationResponse {
	decision_makers: DecisionMakerCandidate[];
	research_summary: string;
}

// ========================================
// Identification Function
// ========================================

/**
 * Identify decision-maker candidates for a given issue
 *
 * Uses Google Search grounding to find REAL, verifiable people with power.
 * Returns 3-5 candidates with provenance and sources.
 *
 * This is Phase 1 - focuses on finding the RIGHT PEOPLE, not contact info.
 * Email discovery happens in Phase 2 (decision-maker-enrichment.ts).
 *
 * @param options - Identification options (subject, issue, topics, voiceSample)
 * @returns Array of decision-maker candidates
 * @throws Error on API failures or if no candidates found
 *
 * @example
 * ```typescript
 * const candidates = await identifyDecisionMakerCandidates({
 *   subjectLine: 'Amazon Warehouse Safety Violations',
 *   coreIssue: 'Workers facing unsafe conditions and pressure',
 *   topics: ['safety', 'warehouse', 'wages'],
 *   voiceSample: 'My coworker collapsed from heat and they told him to walk it off'
 * });
 *
 * console.log(candidates);
 * // [
 * //   {
 * //     name: 'Andy Jassy',
 * //     title: 'CEO',
 * //     organization: 'Amazon',
 * //     reasoning: 'As CEO of Amazon, Jassy has direct operational authority...',
 * //     sourceUrl: 'https://www.aboutamazon.com/about-us/leadership',
 * //     confidence: 0.95,
 * //     contactChannel: 'form'
 * //   }
 * // ]
 * ```
 */
export async function identifyDecisionMakerCandidates(
	options: IdentificationOptions
): Promise<DecisionMakerCandidate[]> {
	const startTime = Date.now();
	const { subjectLine, coreIssue, topics, voiceSample, urlSlug } = options;

	console.log('[decision-maker-identification] Phase 1: Identifying candidates...');
	console.log('[decision-maker-identification] Subject:', subjectLine);
	console.log('[decision-maker-identification] Topics:', topics);

	// Build prompt with issue context and voice sample
	const voiceBlock = voiceSample ? `\nVoice Sample (the human stakes):\n"${voiceSample}"\n` : '';

	const prompt = `Find the decision-makers for this issue:

Subject: ${subjectLine}
Core Issue: ${coreIssue}
Topics: ${topics.join(', ')}
${urlSlug ? `URL Slug: ${urlSlug}` : ''}${voiceBlock}
Research and identify 3-5 specific people who have direct power over this issue.
For each person, explain WHY they have power and provide source URLs proving it.

Use Google Search to find current, verifiable information. Only include REAL people
you can verify through credible sources. Never invent names or guess positions.

IMPORTANT: Return your response as valid JSON matching this exact structure:
{
  "decision_makers": [
    {
      "name": "Full Name",
      "title": "Current Job Title",
      "organization": "Organization Name",
      "reasoning": "Why this person has power over this issue",
      "source_url": "URL proving this information",
      "confidence": 0.0-1.0,
      "contact_channel": "email" | "form" | "phone" | "congress" | "other"
    }
  ],
  "research_summary": "Summary of why these people were selected"
}

Return ONLY the JSON object, no additional text before or after.`;

	try {
		// Call Gemini with Google Search grounding enabled
		// NOTE: Grounding mode is incompatible with JSON schema enforcement
		// We must parse the response manually
		const response = await generate(prompt, {
			systemInstruction: DECISION_MAKER_IDENTIFICATION_PROMPT,
			temperature: 0.2, // Low temperature for factual accuracy
			thinkingLevel: 'high', // Deep reasoning for research
			enableGrounding: true, // CRITICAL: Enable Google Search
			maxOutputTokens: 4096
		});

		// Parse response using shared grounding-json utility
		// (Handles markdown code blocks, surrounding text, trailing commas, etc.)
		const extraction = extractJsonFromGroundingResponse<IdentificationResponse>(response.text || '{}');

		if (!isSuccessfulExtraction(extraction)) {
			console.error('[decision-maker-identification] JSON extraction failed:', extraction.error);
			console.error('[decision-maker-identification] Cleaned text:', extraction.cleanedText);
			throw new Error(`JSON parse failed: ${extraction.error}`);
		}

		const data = extraction.data;

		// Extract grounding metadata for enhanced sources
		const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

		if (groundingMetadata) {
			const groundingSources = extractSourcesFromGrounding(
				groundingMetadata as unknown as GroundingMetadata
			);

			// Cross-reference candidates with grounding sources
			// If a candidate doesn't have a source_url, try to find one
			data.decision_makers = data.decision_makers.map((candidate) => ({
				...candidate,
				sourceUrl:
					candidate.sourceUrl ||
					(candidate as { source_url?: string }).source_url ||
					findMatchingSource(candidate, groundingSources) ||
					''
			}));

			// Log search queries for debugging
			if (groundingMetadata.webSearchQueries && groundingMetadata.webSearchQueries.length > 0) {
				console.log(
					'[decision-maker-identification] Google Search queries:',
					groundingMetadata.webSearchQueries
				);
			}
		}

		// Validate and normalize candidates
		const candidates = validateCandidates(data.decision_makers);

		// Limit to max 5 candidates (for enrichment phase cost control)
		const limitedCandidates = candidates.slice(0, 5);

		const latencyMs = Date.now() - startTime;

		// Log results
		console.log('[decision-maker-identification] Results:', {
			count: limitedCandidates.length,
			names: limitedCandidates.map((c) => c.name),
			avgConfidence:
				limitedCandidates.reduce((sum, c) => sum + c.confidence, 0) / limitedCandidates.length,
			latencyMs
		});

		console.log('[decision-maker-identification] Research summary:', data.research_summary);

		return limitedCandidates;
	} catch (error) {
		console.error('[decision-maker-identification] Identification error:', error);
		throw new Error(
			`Failed to identify decision-makers: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// ========================================
// Validation Helpers
// ========================================

/**
 * Validate and normalize candidate data
 *
 * Ensures all required fields are present and properly formatted.
 * Filters out invalid candidates.
 *
 * @param rawCandidates - Raw candidates from Gemini response
 * @returns Validated candidates
 */
function validateCandidates(rawCandidates: unknown[]): DecisionMakerCandidate[] {
	const validated: DecisionMakerCandidate[] = [];

	for (const rawUnknown of rawCandidates) {
		// Type guard: ensure raw is an object
		if (!rawUnknown || typeof rawUnknown !== 'object') {
			console.warn('[decision-maker-identification] Skipping non-object candidate:', rawUnknown);
			continue;
		}

		const raw = rawUnknown as Record<string, unknown>;

		// Check required fields
		if (!raw.name || typeof raw.name !== 'string') {
			console.warn('[decision-maker-identification] Skipping candidate without name:', raw);
			continue;
		}

		if (!raw.title || typeof raw.title !== 'string') {
			console.warn('[decision-maker-identification] Skipping candidate without title:', raw);
			continue;
		}

		if (!raw.organization || typeof raw.organization !== 'string') {
			console.warn('[decision-maker-identification] Skipping candidate without organization:', raw);
			continue;
		}

		if (!raw.reasoning || typeof raw.reasoning !== 'string') {
			console.warn('[decision-maker-identification] Skipping candidate without reasoning:', raw);
			continue;
		}

		// Handle both camelCase and snake_case from API response
		const sourceUrl =
			(raw.sourceUrl as string) || (raw.source_url as string) || (raw.source as string);
		if (!sourceUrl || typeof sourceUrl !== 'string') {
			console.warn('[decision-maker-identification] Skipping candidate without source_url:', raw);
			continue;
		}

		// Validate confidence is a number between 0 and 1
		let confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.5;
		if (confidence < 0 || confidence > 1) {
			console.warn(
				`[decision-maker-identification] Invalid confidence ${confidence}, defaulting to 0.5`
			);
			confidence = 0.5;
		}

		// Normalize contact_channel
		const contactChannel = normalizeContactChannel(
			(raw.contactChannel as string) || (raw.contact_channel as string)
		);

		// Build validated candidate
		validated.push({
			name: raw.name,
			title: raw.title,
			organization: raw.organization,
			reasoning: raw.reasoning,
			sourceUrl,
			confidence,
			contactChannel
		});
	}

	return validated;
}

/**
 * Normalize contact channel to valid type
 *
 * @param channel - Raw contact channel value
 * @returns Normalized ContactChannel or undefined
 */
function normalizeContactChannel(channel: string | undefined): ContactChannel | undefined {
	if (!channel) return undefined;

	const normalized = channel.toLowerCase().trim();

	if (normalized === 'email') return 'email';
	if (normalized === 'form') return 'form';
	if (normalized === 'phone') return 'phone';
	if (normalized === 'congress') return 'congress';
	if (normalized === 'other') return 'other';

	// Default to undefined if unrecognized
	return undefined;
}

/**
 * Find a matching source URL for a candidate
 *
 * Attempts to match organization name to source URLs from grounding.
 * Used when the model doesn't explicitly provide a source_url.
 *
 * @param candidate - Candidate to find source for
 * @param sources - Available source URLs from grounding
 * @returns Matching URL or undefined
 */
function findMatchingSource(
	candidate: DecisionMakerCandidate,
	sources: string[]
): string | undefined {
	const organization = candidate.organization;
	if (!organization) return undefined;

	// Try to match organization name to source URLs
	const orgLower = organization.toLowerCase();
	const orgSlug = orgLower.replace(/\s+/g, ''); // Remove spaces for URL matching

	// Look for URLs containing the organization name
	return sources.find((url) => {
		const urlLower = url.toLowerCase();
		return (
			urlLower.includes(orgSlug) ||
			urlLower.includes(orgLower) ||
			// Try individual words from org name
			orgLower.split(/\s+/).some((word) => word.length > 3 && urlLower.includes(word))
		);
	});
}
