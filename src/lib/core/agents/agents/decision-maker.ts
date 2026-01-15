/**
 * Decision-Maker Resolver Agent
 *
 * Orchestrates the three-phase decision-maker enrichment pipeline:
 * 1. Identification - Find candidates with Google Search grounding
 * 2. Enrichment - Discover contact info for each candidate
 * 3. Validation - Filter and merge verified decision-makers
 *
 * CRITICAL: This agent MUST use Google Search grounding to find verifiable
 * decision-makers. Without grounding, the model will hallucinate names.
 */

import { identifyDecisionMakerCandidates } from './decision-maker-identification';
import { enrichWithContactInfo } from './decision-maker-enrichment';
import { validateAndMerge } from './decision-maker-validation';
import type { ValidatedDecisionMaker, DecisionMakerResponse } from '../types';

// ========================================
// Options Interface
// ========================================

export interface ResolveOptions {
	subjectLine: string;
	coreIssue: string;
	topics: string[];
	voiceSample?: string;
	urlSlug?: string;
}

// ========================================
// Decision-Maker Resolution
// ========================================

/**
 * Resolve decision-makers for a given issue
 *
 * Orchestrates the three-phase enrichment pipeline to find REAL, verifiable
 * people with power and their contact information.
 *
 * Pipeline:
 * 1. Identification - Find 3-5 candidates with Google Search grounding
 * 2. Enrichment - Discover email addresses for each candidate (parallel)
 * 3. Validation - Filter to only verified, contactable decision-makers
 *
 * @param options - Resolution options (subject, issue, topics, voiceSample)
 * @returns Decision-maker response with research summary and pipeline stats
 *
 * @example
 * ```typescript
 * const result = await resolveDecisionMakers({
 *   subjectLine: 'Amazon Warehouse Safety Violations',
 *   coreIssue: 'Workers facing unsafe conditions and pressure',
 *   topics: ['safety', 'warehouse', 'wages'],
 *   voiceSample: 'My coworker collapsed from heat and they told him to walk it off'
 * });
 *
 * console.log(result.decision_makers);
 * // [
 * //   { name: 'Andy Jassy', title: 'CEO', organization: 'Amazon', email: '...', ... },
 * //   { name: 'Beth Galetti', title: 'SVP, People Experience', email: '...', ... }
 * // ]
 * console.log(result.pipeline_stats);
 * // { candidates_found: 5, enrichments_succeeded: 3, validations_passed: 2, total_latency_ms: 28543 }
 * ```
 */
export async function resolveDecisionMakers(
	options: ResolveOptions
): Promise<DecisionMakerResponse> {
	const startTime = Date.now();

	try {
		// ========================================
		// Phase 1: Identify Candidates
		// ========================================
		console.log('[decision-maker] Phase 1: Identifying candidates...');
		const phase1Start = Date.now();

		const candidates = await identifyDecisionMakerCandidates(options);

		const phase1Duration = Date.now() - phase1Start;
		console.log(
			`[decision-maker] Phase 1 complete: Found ${candidates.length} candidates (${phase1Duration}ms)`
		);

		// Early return if no candidates found
		if (candidates.length === 0) {
			console.log('[decision-maker] No candidates found, returning empty result');
			return {
				decision_makers: [],
				research_summary:
					'No verifiable decision-makers found for this issue. Try refining the subject line or core issue to be more specific.',
				pipeline_stats: {
					candidates_found: 0,
					enrichments_succeeded: 0,
					validations_passed: 0,
					total_latency_ms: Date.now() - startTime
				}
			};
		}

		// ========================================
		// Phase 2: Enrich with Contact Info
		// ========================================
		console.log('[decision-maker] Phase 2: Enriching with contact info...');
		const phase2Start = Date.now();

		const enriched = await enrichWithContactInfo(candidates);

		const phase2Duration = Date.now() - phase2Start;
		console.log(
			`[decision-maker] Phase 2 complete: Enriched ${enriched.length}/${candidates.length} candidates (${phase2Duration}ms)`
		);

		// Check if all enrichments failed
		if (enriched.length === 0) {
			console.warn('[decision-maker] All enrichments failed, checking for rate limits');

			// Check if any enrichment failed due to rate limiting
			const hasRateLimitError = candidates.length > 0; // If we had candidates but zero enriched, likely rate limited

			return {
				decision_makers: [],
				research_summary: hasRateLimitError
					? 'Found potential decision-makers but could not retrieve contact information due to rate limiting. Please try again in a few minutes.'
					: 'Found potential decision-makers but could not verify their contact information. Try refining the issue to be more specific.',
				pipeline_stats: {
					candidates_found: candidates.length,
					enrichments_succeeded: 0,
					validations_passed: 0,
					total_latency_ms: Date.now() - startTime
				}
			};
		}

		// ========================================
		// Phase 3: Validate and Merge
		// ========================================
		console.log('[decision-maker] Phase 3: Validating and merging...');
		const phase3Start = Date.now();

		const validated = validateAndMerge(enriched);

		const phase3Duration = Date.now() - phase3Start;
		console.log(
			`[decision-maker] Phase 3 complete: Validated ${validated.length}/${enriched.length} decision-makers (${phase3Duration}ms)`
		);

		// Check if validation filtered everything out
		if (validated.length === 0) {
			console.warn('[decision-maker] All candidates filtered out during validation');

			return {
				decision_makers: [],
				research_summary:
					'Found potential decision-makers but could not verify their email addresses. Contact information may not be publicly available for this issue.',
				pipeline_stats: {
					candidates_found: candidates.length,
					enrichments_succeeded: enriched.length,
					validations_passed: 0,
					total_latency_ms: Date.now() - startTime
				}
			};
		}

		// ========================================
		// Build Research Summary
		// ========================================
		const totalLatency = Date.now() - startTime;

		const summary = buildResearchSummary(candidates.length, enriched.length, validated.length);

		console.log(`[decision-maker] Pipeline complete in ${totalLatency}ms:`, {
			candidates: candidates.length,
			enriched: enriched.length,
			validated: validated.length,
			names: validated.map((dm) => dm.name)
		});

		return {
			decision_makers: validated,
			research_summary: summary,
			pipeline_stats: {
				candidates_found: candidates.length,
				enrichments_succeeded: enriched.length,
				validations_passed: validated.length,
				total_latency_ms: totalLatency
			}
		};
	} catch (error) {
		const totalLatency = Date.now() - startTime;

		console.error('[decision-maker] Pipeline error:', {
			error: error instanceof Error ? error.message : String(error),
			latency: totalLatency
		});

		throw new Error(
			`Failed to resolve decision-makers: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// ========================================
// Helper Functions
// ========================================

/**
 * Build an intelligent research summary
 *
 * Creates a human-readable summary of the pipeline's research results,
 * explaining what was found and any notable gaps.
 *
 * @param candidatesFound - Number of candidates identified in Phase 1
 * @param enrichmentsSucceeded - Number of candidates with contact info found in Phase 2
 * @param validationsPassed - Number of candidates with verified emails in Phase 3
 * @returns Research summary string
 */
function buildResearchSummary(
	candidatesFound: number,
	enrichmentsSucceeded: number,
	validationsPassed: number
): string {
	const parts: string[] = [];

	// Primary result
	parts.push(
		`Found ${validationsPassed} decision-maker${validationsPassed === 1 ? '' : 's'} with verified contact information.`
	);

	// Notable gaps
	if (candidatesFound > enrichmentsSucceeded) {
		const missingEmails = candidatesFound - enrichmentsSucceeded;
		parts.push(
			`Could not find contact info for ${missingEmails} candidate${missingEmails === 1 ? '' : 's'}.`
		);
	}

	if (enrichmentsSucceeded > validationsPassed) {
		const failedValidation = enrichmentsSucceeded - validationsPassed;
		parts.push(
			`${failedValidation} email${failedValidation === 1 ? '' : 's'} could not be verified.`
		);
	}

	// Success context
	if (validationsPassed > 0) {
		parts.push('All returned decision-makers have validated email addresses for direct contact.');
	}

	return parts.join(' ');
}
