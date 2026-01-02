/**
 * Type Guards and Helpers for Clarification Responses
 *
 * Phase 1: Utilities for working with subject line clarification flows
 */

import type {
	SubjectLineResponseWithClarification,
	ClarificationQuestion,
	InferredContext
} from '../types';

/**
 * Type guard: Check if response needs clarification
 */
export function needsClarification(
	response: SubjectLineResponseWithClarification
): response is SubjectLineResponseWithClarification & {
	needs_clarification: true;
	clarification_questions: ClarificationQuestion[];
} {
	return (
		response.needs_clarification === true &&
		Array.isArray(response.clarification_questions) &&
		response.clarification_questions.length > 0
	);
}

/**
 * Type guard: Check if response has complete output
 */
export function hasCompleteOutput(
	response: SubjectLineResponseWithClarification
): response is SubjectLineResponseWithClarification & {
	subject_line: string;
	core_issue: string;
	topics: string[];
	url_slug: string;
	voice_sample: string;
} {
	return (
		typeof response.subject_line === 'string' &&
		typeof response.core_issue === 'string' &&
		Array.isArray(response.topics) &&
		typeof response.url_slug === 'string' &&
		typeof response.voice_sample === 'string'
	);
}

/**
 * Calculate overall confidence from inferred context
 */
export function calculateOverallConfidence(context: InferredContext): number {
	const { location_confidence, scope_confidence, target_type_confidence } = context;
	return (location_confidence + scope_confidence + target_type_confidence) / 3;
}

/**
 * Determine if context meets confidence threshold
 */
export function meetsConfidenceThreshold(
	context: InferredContext,
	threshold: number = 0.7
): boolean {
	return (
		context.location_confidence >= threshold &&
		context.scope_confidence >= threshold &&
		context.target_type_confidence >= threshold
	);
}

/**
 * Get the least confident dimension(s) from inferred context
 */
export function getLeastConfidentDimensions(context: InferredContext): string[] {
	const dimensions = [
		{ name: 'location', confidence: context.location_confidence },
		{ name: 'scope', confidence: context.scope_confidence },
		{ name: 'target_type', confidence: context.target_type_confidence }
	];

	dimensions.sort((a, b) => a.confidence - b.confidence);

	// Return up to 2 lowest confidence dimensions below threshold
	return dimensions
		.filter((d) => d.confidence < 0.7)
		.slice(0, 2)
		.map((d) => d.name);
}
