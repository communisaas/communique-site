/**
 * Decision-Maker Resolution Agent — Two-Phase Architecture
 *
 * LEGACY INTERFACE: This file maintains backward compatibility.
 * New code should use the provider architecture in ./providers/
 *
 * Phase 1 (Role Discovery): Identify POSITIONS with power over the issue.
 *   - No grounding. Uses responseSchema for guaranteed JSON.
 *   - LLM reasons about institutional power structure without activating name associations.
 *
 * Phase 2 (Person Lookup): Search for who CURRENTLY holds each role.
 *   - Google Search grounding enabled.
 *   - Information flow inverted: search first, extract name from results.
 *   - Eliminates confirmation bias from stale parametric memory.
 *
 * Two calls total (not N+1): Phase 2 is a single batched grounding call.
 */

import { decisionMakerRouter } from '../providers';
import type { ResolveContext } from '../providers';
import type { DecisionMakerResponse, DecisionMaker } from '../types';
import type { ProcessedDecisionMaker } from '$lib/types/template';

// ============================================================================
// Public Interface — Exported for backward compatibility
// ============================================================================

// Re-export shared types for backward compatibility
export type { PipelinePhase, StreamingCallbacks } from '../shared-types';

// Import for local use
import type { StreamingCallbacks } from '../shared-types';

export interface ResolveOptions {
	subjectLine: string;
	coreMessage: string;
	topics: string[];
	voiceSample?: string;
	urlSlug?: string;
	streaming?: StreamingCallbacks;
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve decision-makers using the provider architecture.
 *
 * LEGACY FUNCTION: Maintained for backward compatibility.
 * Defaults to local_government target type and delegates to router.
 *
 * @deprecated Use decisionMakerRouter.resolve() directly for new code
 */
export async function resolveDecisionMakers(
	options: ResolveOptions
): Promise<DecisionMakerResponse> {
	const { subjectLine, coreMessage, topics, voiceSample, streaming } = options;

	console.log('[decision-maker] LEGACY API: Delegating to provider router');

	// Build resolution context for router
	const context: ResolveContext = {
		targetType: 'local_government', // Default for backward compatibility
		subjectLine,
		coreMessage,
		topics,
		voiceSample,
		streaming
	};

	try {
		// Delegate to router
		const result = await decisionMakerRouter.resolve(context);

		// Convert provider result to legacy format
		return convertToLegacyResponse(result);
	} catch (error) {
		console.error('[decision-maker] Resolution error:', error);
		throw new Error(
			`Failed to resolve decision-makers: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert provider result to legacy DecisionMakerResponse format
 */
function convertToLegacyResponse(
	result: import('../providers').DecisionMakerResult
): DecisionMakerResponse {
	const decisionMakers = result.decisionMakers.map(processedToDecisionMaker);

	return {
		decision_makers: decisionMakers,
		research_summary: result.researchSummary || 'Decision-makers resolved successfully.',
		pipeline_stats: {
			candidates_found: result.decisionMakers.length,
			enrichments_succeeded: result.decisionMakers.filter((dm) => dm.email).length,
			validations_passed: result.decisionMakers.length,
			total_latency_ms: result.latencyMs
		}
	};
}

/**
 * Convert ProcessedDecisionMaker to DecisionMaker format
 */
function processedToDecisionMaker(processed: ProcessedDecisionMaker): DecisionMaker {
	return {
		name: processed.name,
		title: processed.title,
		organization: processed.organization,
		email: processed.email || '',
		reasoning: processed.reasoning,
		sourceUrl: processed.source || '',
		emailSource: processed.source || '',
		confidence: 0.8,
		contactChannel: 'email',
		provenance: processed.provenance
	};
}
