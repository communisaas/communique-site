/**
 * Unit Tests — clarification-guards.ts
 *
 * Exhaustive coverage for type guards and confidence helpers:
 *   needsClarification, hasCompleteOutput, calculateOverallConfidence,
 *   meetsConfidenceThreshold, getLeastConfidentDimensions
 *
 * These are pure functions — no mocking required.
 */

import { describe, it, expect } from 'vitest';
import {
	needsClarification,
	hasCompleteOutput,
	calculateOverallConfidence,
	meetsConfidenceThreshold,
	getLeastConfidentDimensions
} from '$lib/core/agents/utils/clarification-guards';
import type {
	SubjectLineResponseWithClarification,
	InferredContext,
	ClarificationQuestion
} from '$lib/core/agents/types';

// ============================================================================
// Helpers
// ============================================================================

/** Build a minimal InferredContext with overridable confidence scores */
function makeContext(overrides: Partial<InferredContext> = {}): InferredContext {
	return {
		detected_location: null,
		detected_scope: null,
		detected_target_type: null,
		location_confidence: 0.5,
		scope_confidence: 0.5,
		target_type_confidence: 0.5,
		...overrides
	};
}

/** Build a minimal ClarificationQuestion */
function makeQuestion(overrides: Partial<ClarificationQuestion> = {}): ClarificationQuestion {
	return {
		id: 'location',
		question: 'Where is this happening?',
		type: 'location_picker',
		required: true,
		...overrides
	};
}

/** Build a minimal SubjectLineResponseWithClarification */
function makeResponse(
	overrides: Partial<SubjectLineResponseWithClarification> = {}
): SubjectLineResponseWithClarification {
	return {
		inferred_context: makeContext(),
		...overrides
	};
}

// ============================================================================
// Tests: needsClarification
// ============================================================================

describe('needsClarification', () => {
	it('returns true when needs_clarification=true and questions are present', () => {
		const response = makeResponse({
			needs_clarification: true,
			clarification_questions: [makeQuestion()]
		});
		expect(needsClarification(response)).toBe(true);
	});

	it('returns true with multiple clarification questions', () => {
		const response = makeResponse({
			needs_clarification: true,
			clarification_questions: [
				makeQuestion({ id: 'location' }),
				makeQuestion({ id: 'scope', question: 'What scope?', type: 'open_text' })
			]
		});
		expect(needsClarification(response)).toBe(true);
	});

	it('returns false when needs_clarification is false', () => {
		const response = makeResponse({
			needs_clarification: false,
			clarification_questions: [makeQuestion()]
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false when needs_clarification is undefined', () => {
		const response = makeResponse({
			clarification_questions: [makeQuestion()]
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false when clarification_questions is an empty array', () => {
		const response = makeResponse({
			needs_clarification: true,
			clarification_questions: []
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false when clarification_questions is undefined', () => {
		const response = makeResponse({
			needs_clarification: true
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false when clarification_questions is not an array', () => {
		const response = makeResponse({
			needs_clarification: true,
			clarification_questions: 'not an array' as unknown as ClarificationQuestion[]
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false for a complete response with no clarification fields', () => {
		const response = makeResponse({
			subject_line: 'Test',
			core_message: 'Test message',
			topics: ['env'],
			url_slug: 'test-slug',
			voice_sample: 'voice sample'
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false when needs_clarification is null (coerced falsy)', () => {
		const response = makeResponse({
			needs_clarification: null as unknown as boolean
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false when needs_clarification is 0 (falsy number)', () => {
		const response = makeResponse({
			needs_clarification: 0 as unknown as boolean
		});
		expect(needsClarification(response)).toBe(false);
	});

	it('returns false when needs_clarification is "true" (string, not boolean)', () => {
		const response = makeResponse({
			needs_clarification: 'true' as unknown as boolean,
			clarification_questions: [makeQuestion()]
		});
		// Strict equality check: 'true' === true is false
		expect(needsClarification(response)).toBe(false);
	});
});

// ============================================================================
// Tests: hasCompleteOutput
// ============================================================================

describe('hasCompleteOutput', () => {
	it('returns true when all five output fields are present and typed correctly', () => {
		const response = makeResponse({
			subject_line: 'Stop the Pipeline',
			core_message: 'A pipeline threatens our water supply',
			topics: ['environment', 'water', 'infrastructure'],
			url_slug: 'stop-the-pipeline',
			voice_sample: 'This pipeline will ruin our watershed'
		});
		expect(hasCompleteOutput(response)).toBe(true);
	});

	it('returns true even if clarification fields are also present', () => {
		const response = makeResponse({
			subject_line: 'Test',
			core_message: 'Test msg',
			topics: [],
			url_slug: 'test',
			voice_sample: 'sample',
			needs_clarification: false
		});
		expect(hasCompleteOutput(response)).toBe(true);
	});

	it('returns true with empty topics array (still an array)', () => {
		const response = makeResponse({
			subject_line: 'Test',
			core_message: 'Test',
			topics: [],
			url_slug: 'slug',
			voice_sample: 'voice'
		});
		expect(hasCompleteOutput(response)).toBe(true);
	});

	it('returns false when subject_line is missing', () => {
		const response = makeResponse({
			core_message: 'Test',
			topics: ['env'],
			url_slug: 'slug',
			voice_sample: 'voice'
		});
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns false when core_message is missing', () => {
		const response = makeResponse({
			subject_line: 'Test',
			topics: ['env'],
			url_slug: 'slug',
			voice_sample: 'voice'
		});
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns false when topics is missing', () => {
		const response = makeResponse({
			subject_line: 'Test',
			core_message: 'Test',
			url_slug: 'slug',
			voice_sample: 'voice'
		});
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns false when url_slug is missing', () => {
		const response = makeResponse({
			subject_line: 'Test',
			core_message: 'Test',
			topics: ['env'],
			voice_sample: 'voice'
		});
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns false when voice_sample is missing', () => {
		const response = makeResponse({
			subject_line: 'Test',
			core_message: 'Test',
			topics: ['env'],
			url_slug: 'slug'
		});
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns false when all output fields are missing', () => {
		const response = makeResponse();
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns false when topics is a string instead of array', () => {
		const response = makeResponse({
			subject_line: 'Test',
			core_message: 'Test',
			topics: 'environment' as unknown as string[],
			url_slug: 'slug',
			voice_sample: 'voice'
		});
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns false when subject_line is a number instead of string', () => {
		const response = makeResponse({
			subject_line: 42 as unknown as string,
			core_message: 'Test',
			topics: ['env'],
			url_slug: 'slug',
			voice_sample: 'voice'
		});
		expect(hasCompleteOutput(response)).toBe(false);
	});

	it('returns true with empty string values (still strings)', () => {
		const response = makeResponse({
			subject_line: '',
			core_message: '',
			topics: [],
			url_slug: '',
			voice_sample: ''
		});
		expect(hasCompleteOutput(response)).toBe(true);
	});
});

// ============================================================================
// Tests: calculateOverallConfidence
// ============================================================================

describe('calculateOverallConfidence', () => {
	it('calculates arithmetic mean of three confidence scores', () => {
		const context = makeContext({
			location_confidence: 0.9,
			scope_confidence: 0.8,
			target_type_confidence: 1.0
		});
		expect(calculateOverallConfidence(context)).toBeCloseTo(0.9, 5);
	});

	it('returns 0 when all scores are 0', () => {
		const context = makeContext({
			location_confidence: 0,
			scope_confidence: 0,
			target_type_confidence: 0
		});
		expect(calculateOverallConfidence(context)).toBe(0);
	});

	it('returns 1 when all scores are 1', () => {
		const context = makeContext({
			location_confidence: 1,
			scope_confidence: 1,
			target_type_confidence: 1
		});
		expect(calculateOverallConfidence(context)).toBe(1);
	});

	it('handles mixed low confidence scores', () => {
		const context = makeContext({
			location_confidence: 0.1,
			scope_confidence: 0.2,
			target_type_confidence: 0.3
		});
		expect(calculateOverallConfidence(context)).toBeCloseTo(0.2, 5);
	});

	it('handles asymmetric scores (one low, two high)', () => {
		const context = makeContext({
			location_confidence: 0.1,
			scope_confidence: 0.9,
			target_type_confidence: 0.9
		});
		// (0.1 + 0.9 + 0.9) / 3 = 0.6333
		expect(calculateOverallConfidence(context)).toBeCloseTo(0.6333, 3);
	});

	it('handles very small floating point values', () => {
		const context = makeContext({
			location_confidence: 0.001,
			scope_confidence: 0.002,
			target_type_confidence: 0.003
		});
		expect(calculateOverallConfidence(context)).toBeCloseTo(0.002, 5);
	});

	it('handles NaN propagation (NaN in input leads to NaN output)', () => {
		const context = makeContext({
			location_confidence: NaN,
			scope_confidence: 0.5,
			target_type_confidence: 0.5
		});
		expect(calculateOverallConfidence(context)).toBeNaN();
	});

	it('handles scores at exactly the midpoint', () => {
		const context = makeContext({
			location_confidence: 0.5,
			scope_confidence: 0.5,
			target_type_confidence: 0.5
		});
		expect(calculateOverallConfidence(context)).toBe(0.5);
	});

	it('handles scores slightly above and below threshold', () => {
		const context = makeContext({
			location_confidence: 0.69,
			scope_confidence: 0.70,
			target_type_confidence: 0.71
		});
		expect(calculateOverallConfidence(context)).toBeCloseTo(0.7, 5);
	});
});

// ============================================================================
// Tests: meetsConfidenceThreshold
// ============================================================================

describe('meetsConfidenceThreshold', () => {
	it('returns true when all dimensions are above the threshold', () => {
		const context = makeContext({
			location_confidence: 0.9,
			scope_confidence: 0.8,
			target_type_confidence: 0.85
		});
		expect(meetsConfidenceThreshold(context, 0.7)).toBe(true);
	});

	it('returns false when any single dimension is below threshold', () => {
		const context = makeContext({
			location_confidence: 0.3,
			scope_confidence: 0.8,
			target_type_confidence: 0.9
		});
		expect(meetsConfidenceThreshold(context, 0.7)).toBe(false);
	});

	it('returns false when all dimensions are below threshold', () => {
		const context = makeContext({
			location_confidence: 0.1,
			scope_confidence: 0.2,
			target_type_confidence: 0.3
		});
		expect(meetsConfidenceThreshold(context, 0.7)).toBe(false);
	});

	it('uses default threshold of 0.7 when not specified', () => {
		const above = makeContext({
			location_confidence: 0.75,
			scope_confidence: 0.75,
			target_type_confidence: 0.75
		});
		expect(meetsConfidenceThreshold(above)).toBe(true);

		const below = makeContext({
			location_confidence: 0.69,
			scope_confidence: 0.75,
			target_type_confidence: 0.75
		});
		expect(meetsConfidenceThreshold(below)).toBe(false);
	});

	it('returns true when dimensions exactly equal the threshold (>=)', () => {
		const context = makeContext({
			location_confidence: 0.7,
			scope_confidence: 0.7,
			target_type_confidence: 0.7
		});
		expect(meetsConfidenceThreshold(context, 0.7)).toBe(true);
	});

	it('returns false when one dimension is epsilon below threshold', () => {
		const context = makeContext({
			location_confidence: 0.6999999,
			scope_confidence: 0.7,
			target_type_confidence: 0.7
		});
		expect(meetsConfidenceThreshold(context, 0.7)).toBe(false);
	});

	it('works with threshold of 0 (everything passes)', () => {
		const context = makeContext({
			location_confidence: 0,
			scope_confidence: 0,
			target_type_confidence: 0
		});
		expect(meetsConfidenceThreshold(context, 0)).toBe(true);
	});

	it('works with threshold of 1 (only perfect scores pass)', () => {
		const perfect = makeContext({
			location_confidence: 1,
			scope_confidence: 1,
			target_type_confidence: 1
		});
		expect(meetsConfidenceThreshold(perfect, 1)).toBe(true);

		const almostPerfect = makeContext({
			location_confidence: 0.99,
			scope_confidence: 1,
			target_type_confidence: 1
		});
		expect(meetsConfidenceThreshold(almostPerfect, 1)).toBe(false);
	});

	it('works with a low threshold (0.1)', () => {
		const context = makeContext({
			location_confidence: 0.1,
			scope_confidence: 0.15,
			target_type_confidence: 0.2
		});
		expect(meetsConfidenceThreshold(context, 0.1)).toBe(true);
	});

	it('works with a high threshold (0.95)', () => {
		const context = makeContext({
			location_confidence: 0.96,
			scope_confidence: 0.97,
			target_type_confidence: 0.98
		});
		expect(meetsConfidenceThreshold(context, 0.95)).toBe(true);
	});

	it('checks ALL dimensions independently (not average)', () => {
		// Average is (0.3 + 0.9 + 0.9) / 3 = 0.7, which meets threshold
		// But location_confidence is 0.3, which does NOT
		const context = makeContext({
			location_confidence: 0.3,
			scope_confidence: 0.9,
			target_type_confidence: 0.9
		});
		expect(meetsConfidenceThreshold(context, 0.7)).toBe(false);
	});
});

// ============================================================================
// Tests: getLeastConfidentDimensions
// ============================================================================

describe('getLeastConfidentDimensions', () => {
	it('returns dimensions below 0.7 threshold, sorted by confidence ascending', () => {
		const context = makeContext({
			location_confidence: 0.3,
			scope_confidence: 0.5,
			target_type_confidence: 0.9
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toEqual(['location', 'scope']);
	});

	it('returns empty array when all dimensions are at or above 0.7', () => {
		const context = makeContext({
			location_confidence: 0.7,
			scope_confidence: 0.8,
			target_type_confidence: 0.9
		});
		expect(getLeastConfidentDimensions(context)).toEqual([]);
	});

	it('returns at most 2 dimensions even when all 3 are below threshold', () => {
		const context = makeContext({
			location_confidence: 0.1,
			scope_confidence: 0.2,
			target_type_confidence: 0.3
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toHaveLength(2);
		expect(dims).toEqual(['location', 'scope']);
	});

	it('returns lowest confidence first', () => {
		const context = makeContext({
			location_confidence: 0.5,
			scope_confidence: 0.2,
			target_type_confidence: 0.6
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims[0]).toBe('scope'); // 0.2 is lowest
		expect(dims[1]).toBe('location'); // 0.5 is next
	});

	it('returns single dimension when only one is below threshold', () => {
		const context = makeContext({
			location_confidence: 0.3,
			scope_confidence: 0.8,
			target_type_confidence: 0.9
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toEqual(['location']);
	});

	it('handles tied confidence values', () => {
		const context = makeContext({
			location_confidence: 0.4,
			scope_confidence: 0.4,
			target_type_confidence: 0.9
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toHaveLength(2);
		// Both should be present (order of ties depends on sort stability)
		expect(dims).toContain('location');
		expect(dims).toContain('scope');
	});

	it('handles all tied values below threshold (returns first 2 by sort order)', () => {
		const context = makeContext({
			location_confidence: 0.5,
			scope_confidence: 0.5,
			target_type_confidence: 0.5
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toHaveLength(2);
	});

	it('handles confidence scores at exactly 0.7 (not below threshold)', () => {
		const context = makeContext({
			location_confidence: 0.7,
			scope_confidence: 0.7,
			target_type_confidence: 0.7
		});
		expect(getLeastConfidentDimensions(context)).toEqual([]);
	});

	it('handles confidence of 0 (extreme low)', () => {
		const context = makeContext({
			location_confidence: 0,
			scope_confidence: 0.8,
			target_type_confidence: 0.9
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toEqual(['location']);
	});

	it('preserves correct dimension names in output', () => {
		const context = makeContext({
			location_confidence: 0.1,
			scope_confidence: 0.8,
			target_type_confidence: 0.2
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toContain('location');
		expect(dims).toContain('target_type');
		expect(dims).not.toContain('scope');
	});

	it('handles confidence scores at 0.69 (just below threshold)', () => {
		const context = makeContext({
			location_confidence: 0.69,
			scope_confidence: 0.71,
			target_type_confidence: 0.72
		});
		const dims = getLeastConfidentDimensions(context);
		expect(dims).toEqual(['location']);
	});
});
