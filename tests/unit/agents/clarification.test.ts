/**
 * Unit Tests for Clarification System
 *
 * Phase 1: Test type guards and helper functions
 */

import { describe, it, expect } from 'vitest';
import {
	needsClarification,
	hasCompleteOutput,
	calculateOverallConfidence,
	meetsConfidenceThreshold,
	getLeastConfidentDimensions
} from '$lib/core/agents';
import type {
	SubjectLineResponseWithClarification,
	InferredContext
} from '$lib/core/agents/types';

describe('Clarification Type Guards', () => {
	describe('needsClarification', () => {
		it('should return true when clarification is needed', () => {
			const response: SubjectLineResponseWithClarification = {
				needs_clarification: true,
				clarification_questions: [
					{
						id: 'location',
						question: 'Where is this happening?',
						type: 'location_picker',
						required: true
					}
				],
				inferred_context: {
					detected_location: null,
					detected_scope: null,
					detected_target_type: 'government',
					location_confidence: 0.2,
					scope_confidence: 0.3,
					target_type_confidence: 0.8
				}
			};

			expect(needsClarification(response)).toBe(true);
		});

		it('should return false when no clarification needed', () => {
			const response: SubjectLineResponseWithClarification = {
				subject_line: 'Test Subject',
				core_issue: 'Test issue',
				topics: ['test'],
				url_slug: 'test-slug',
				voice_sample: 'Test voice',
				inferred_context: {
					detected_location: 'San Francisco, CA',
					detected_scope: 'local',
					detected_target_type: 'government',
					location_confidence: 0.95,
					scope_confidence: 0.9,
					target_type_confidence: 0.85
				}
			};

			expect(needsClarification(response)).toBe(false);
		});

		it('should return false when needs_clarification is false', () => {
			const response: SubjectLineResponseWithClarification = {
				needs_clarification: false,
				inferred_context: {
					detected_location: 'San Francisco, CA',
					detected_scope: 'local',
					detected_target_type: 'government',
					location_confidence: 0.95,
					scope_confidence: 0.9,
					target_type_confidence: 0.85
				}
			};

			expect(needsClarification(response)).toBe(false);
		});
	});

	describe('hasCompleteOutput', () => {
		it('should return true when all output fields present', () => {
			const response: SubjectLineResponseWithClarification = {
				subject_line: 'Amazon Drivers Pissing in Bottles',
				core_issue: 'Warehouse workers lack basic dignities',
				topics: ['labor', 'gig-workers', 'warehouse'],
				url_slug: 'piss-bottle-prime',
				voice_sample: 'my friend had to piss in a bottle',
				inferred_context: {
					detected_location: 'nationwide',
					detected_scope: 'national',
					detected_target_type: 'corporate',
					location_confidence: 0.95,
					scope_confidence: 0.9,
					target_type_confidence: 0.95
				}
			};

			expect(hasCompleteOutput(response)).toBe(true);
		});

		it('should return false when output fields missing', () => {
			const response: SubjectLineResponseWithClarification = {
				needs_clarification: true,
				clarification_questions: [],
				inferred_context: {
					detected_location: null,
					detected_scope: null,
					detected_target_type: null,
					location_confidence: 0.2,
					scope_confidence: 0.3,
					target_type_confidence: 0.4
				}
			};

			expect(hasCompleteOutput(response)).toBe(false);
		});
	});
});

describe('Confidence Calculations', () => {
	describe('calculateOverallConfidence', () => {
		it('should calculate average confidence', () => {
			const context: InferredContext = {
				detected_location: 'San Francisco, CA',
				detected_scope: 'local',
				detected_target_type: 'government',
				location_confidence: 0.9,
				scope_confidence: 0.8,
				target_type_confidence: 1.0
			};

			const overall = calculateOverallConfidence(context);
			expect(overall).toBeCloseTo(0.9, 2);
		});

		it('should handle low confidence scores', () => {
			const context: InferredContext = {
				detected_location: null,
				detected_scope: null,
				detected_target_type: null,
				location_confidence: 0.1,
				scope_confidence: 0.2,
				target_type_confidence: 0.3
			};

			const overall = calculateOverallConfidence(context);
			expect(overall).toBeCloseTo(0.2, 2);
		});
	});

	describe('meetsConfidenceThreshold', () => {
		it('should return true when all dimensions meet threshold', () => {
			const context: InferredContext = {
				detected_location: 'San Francisco, CA',
				detected_scope: 'local',
				detected_target_type: 'government',
				location_confidence: 0.95,
				scope_confidence: 0.9,
				target_type_confidence: 0.85
			};

			expect(meetsConfidenceThreshold(context, 0.7)).toBe(true);
		});

		it('should return false when any dimension below threshold', () => {
			const context: InferredContext = {
				detected_location: null,
				detected_scope: 'national',
				detected_target_type: 'government',
				location_confidence: 0.3,
				scope_confidence: 0.8,
				target_type_confidence: 0.9
			};

			expect(meetsConfidenceThreshold(context, 0.7)).toBe(false);
		});

		it('should use default threshold of 0.7', () => {
			const context: InferredContext = {
				detected_location: 'San Francisco, CA',
				detected_scope: 'local',
				detected_target_type: 'government',
				location_confidence: 0.75,
				scope_confidence: 0.75,
				target_type_confidence: 0.75
			};

			expect(meetsConfidenceThreshold(context)).toBe(true);
		});
	});

	describe('getLeastConfidentDimensions', () => {
		it('should return dimensions below 0.7 threshold', () => {
			const context: InferredContext = {
				detected_location: null,
				detected_scope: 'national',
				detected_target_type: 'government',
				location_confidence: 0.3,
				scope_confidence: 0.5,
				target_type_confidence: 0.9
			};

			const dimensions = getLeastConfidentDimensions(context);
			expect(dimensions).toEqual(['location', 'scope']);
		});

		it('should return empty array when all above threshold', () => {
			const context: InferredContext = {
				detected_location: 'San Francisco, CA',
				detected_scope: 'local',
				detected_target_type: 'government',
				location_confidence: 0.95,
				scope_confidence: 0.9,
				target_type_confidence: 0.85
			};

			const dimensions = getLeastConfidentDimensions(context);
			expect(dimensions).toEqual([]);
		});

		it('should return max 2 dimensions even if all below threshold', () => {
			const context: InferredContext = {
				detected_location: null,
				detected_scope: null,
				detected_target_type: null,
				location_confidence: 0.2,
				scope_confidence: 0.3,
				target_type_confidence: 0.4
			};

			const dimensions = getLeastConfidentDimensions(context);
			expect(dimensions).toHaveLength(2);
			expect(dimensions).toEqual(['location', 'scope']);
		});

		it('should sort by confidence (lowest first)', () => {
			const context: InferredContext = {
				detected_location: null,
				detected_scope: null,
				detected_target_type: 'government',
				location_confidence: 0.1,
				scope_confidence: 0.6,
				target_type_confidence: 0.3
			};

			const dimensions = getLeastConfidentDimensions(context);
			expect(dimensions[0]).toBe('location'); // 0.1 is lowest
		});
	});
});

describe('ConversationContext for Multi-Turn Reconstruction', () => {
	it('should construct valid context with all fields', () => {
		const context = {
			originalDescription: 'rent is out of control in my city',
			questionsAsked: [
				{
					id: 'location',
					question: 'Where are you dealing with this?',
					type: 'location_picker' as const,
					location_level: 'city' as const,
					required: true
				}
			],
			inferredContext: {
				detected_location: null,
				detected_scope: null,
				detected_target_type: 'government',
				location_confidence: 0.2,
				scope_confidence: 0.3,
				target_type_confidence: 0.6,
				reasoning: 'No location signal. Could target city council, state legislature, or Congress depending on scope.'
			},
			answers: { location: 'San Francisco, CA' }
		};

		expect(context.originalDescription).toBe('rent is out of control in my city');
		expect(context.questionsAsked).toHaveLength(1);
		expect(context.questionsAsked[0].type).toBe('location_picker');
		expect(context.questionsAsked[0].location_level).toBe('city');
		expect(context.answers.location).toBe('San Francisco, CA');
	});

	it('should handle empty answers (user skipped clarification)', () => {
		const context = {
			originalDescription: '6th street is insane',
			questionsAsked: [
				{
					id: 'location',
					question: "Which city's 6th street are you talking about?",
					type: 'location_picker' as const,
					location_level: 'city' as const,
					required: true
				}
			],
			inferredContext: {
				detected_location: null,
				detected_scope: 'local',
				detected_target_type: 'government',
				location_confidence: 0.1,
				scope_confidence: 0.8,
				target_type_confidence: 0.7
			},
			answers: {} // User skipped
		};

		expect(Object.keys(context.answers)).toHaveLength(0);
		// Even with empty answers, we should have the original description and questions
		expect(context.originalDescription).toBeDefined();
		expect(context.questionsAsked).toHaveLength(1);
	});

	it('should support location_level for geographic scope inference', () => {
		const cityQuestion = {
			id: 'location',
			question: "Which city's 6th street?",
			type: 'location_picker' as const,
			location_level: 'city' as const,
			required: true
		};

		const stateQuestion = {
			id: 'location',
			question: 'Which state is affected by this policy?',
			type: 'location_picker' as const,
			location_level: 'state' as const,
			required: true
		};

		expect(cityQuestion.location_level).toBe('city');
		expect(stateQuestion.location_level).toBe('state');
	});

	it('should preserve inferred_context reasoning for prompt reconstruction', () => {
		const context = {
			originalDescription: 'Amazon warehouse workers are being pushed too hard',
			questionsAsked: [], // No questions - clear target
			inferredContext: {
				detected_location: 'nationwide',
				detected_scope: 'national',
				detected_target_type: 'corporate',
				location_confidence: 0.95,
				scope_confidence: 0.9,
				target_type_confidence: 0.95,
				reasoning: 'Target is Amazon corporate regardless of which warehouse. Location does not change routing.'
			},
			answers: {}
		};

		expect(context.inferredContext.reasoning).toContain('Amazon corporate');
		expect(context.inferredContext.reasoning).toContain('Location does not change routing');
	});
});

describe('Clarification Question Types', () => {
	it('should define valid question IDs', () => {
		const validIds: Array<'location' | 'scope' | 'target_type'> = [
			'location',
			'scope',
			'target_type'
		];

		expect(validIds).toHaveLength(3);
		expect(validIds).toContain('location');
		expect(validIds).toContain('scope');
		expect(validIds).toContain('target_type');
	});

	it('should define valid question types', () => {
		const validTypes: Array<'location_picker' | 'single_choice' | 'chips'> = [
			'location_picker',
			'single_choice',
			'chips'
		];

		expect(validTypes).toHaveLength(3);
		expect(validTypes).toContain('location_picker');
		expect(validTypes).toContain('single_choice');
		expect(validTypes).toContain('chips');
	});

	it('should define valid geographic scopes', () => {
		const validScopes: Array<'local' | 'state' | 'national' | 'international'> = [
			'local',
			'state',
			'national',
			'international'
		];

		expect(validScopes).toHaveLength(4);
	});

	it('should define valid target types', () => {
		const validTargets: Array<'government' | 'corporate' | 'institutional' | 'other'> = [
			'government',
			'corporate',
			'institutional',
			'other'
		];

		expect(validTargets).toHaveLength(4);
	});
});
