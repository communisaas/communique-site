/**
 * JSON Schemas for Gemini Structured Output
 *
 * These schemas enforce response structure for agent outputs
 */

// ============================================================================
// Subject Line Schema (Extended with Clarification Support)
// ============================================================================

export const SUBJECT_LINE_SCHEMA = {
	type: 'object',
	properties: {
		// Standard output (optional when clarification needed)
		subject_line: {
			type: 'string',
			description: 'Compelling subject line for the issue (max 80 chars)'
		},
		core_issue: {
			type: 'string',
			description: 'One-sentence distillation of the core problem'
		},
		topics: {
			type: 'array',
			items: { type: 'string' },
			minItems: 1,
			maxItems: 5,
			description: 'Topic clusters this issue relates to (1-5 tags)'
		},
		url_slug: {
			type: 'string',
			description: 'URL-safe slug for the template (lowercase, hyphens)'
		},
		voice_sample: {
			type: 'string',
			description:
				'The most visceral phrase from input - the emotional peak that downstream agents should channel (1-2 sentences, verbatim or near-verbatim from input)'
		},

		// Clarification request (optional)
		needs_clarification: {
			type: 'boolean',
			description: 'True if agent needs user clarification before generating'
		},
		clarification_questions: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description:
							'Unique identifier for this question (e.g., "location", "context", "target")'
					},
					question: {
						type: 'string',
						description: 'Natural language question formulated by agent, grounded in user input'
					},
					type: {
						type: 'string',
						enum: ['location_picker', 'open_text'],
						description: 'location_picker for geographic selection, open_text for everything else'
					},
					placeholder: {
						type: 'string',
						description: 'For open_text: hint text for the input field'
					},
					prefilled_location: {
						type: 'string',
						description:
							'For location_picker: agent best guess to pre-fill (e.g., "San Francisco, CA")'
					},
					location_level: {
						type: 'string',
						enum: ['city', 'state', 'country'],
						description: 'For location_picker: what specificity is needed'
					},
					required: {
						type: 'boolean',
						description: 'Whether this question must be answered'
					}
				},
				required: ['id', 'question', 'type', 'required']
			},
			maxItems: 2,
			description: 'Agent-formulated clarifying questions (max 2)'
		},

		// Inferred context (always required)
		inferred_context: {
			type: 'object',
			properties: {
				detected_location: {
					type: ['string', 'null'],
					description: 'Best guess location string (e.g., "San Francisco, CA")'
				},
				detected_scope: {
					type: ['string', 'null'],
					enum: ['local', 'state', 'national', 'international', null],
					description: 'Best guess geographic scope'
				},
				detected_target_type: {
					type: ['string', 'null'],
					enum: ['government', 'corporate', 'institutional', 'other', null],
					description: 'Best guess power structure type'
				},
				location_confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: 'Confidence in location detection (0-1)'
				},
				scope_confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: 'Confidence in scope detection (0-1)'
				},
				target_type_confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: 'Confidence in target type detection (0-1)'
				},
				reasoning: {
					type: 'string',
					description: 'Agent reasoning about why clarification is/isnt needed'
				}
			},
			required: [
				'detected_location',
				'detected_scope',
				'detected_target_type',
				'location_confidence',
				'scope_confidence',
				'target_type_confidence'
			],
			description: "Agent's inferred context, confidence scores, and reasoning"
		}
	},
	required: ['inferred_context']
};

// ============================================================================
// Decision Maker Schema
// ============================================================================

export const DECISION_MAKER_SCHEMA = {
	type: 'object',
	properties: {
		decision_makers: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					title: { type: 'string' },
					organization: { type: 'string' },
					email: { type: 'string' },
					provenance: {
						type: 'string',
						description: 'Why this person has power over this issue'
					},
					source_url: { type: 'string' },
					confidence: {
						type: 'number',
						minimum: 0,
						maximum: 1
					}
				},
				required: ['name', 'title', 'organization', 'provenance', 'confidence']
			},
			maxItems: 10
		},
		research_summary: { type: 'string' }
	},
	required: ['decision_makers']
};

// ============================================================================
// Message Schema
// ============================================================================

export const MESSAGE_SCHEMA = {
	type: 'object',
	properties: {
		message: {
			type: 'string',
			description: 'The full message body with citation markers [1], [2], etc.'
		},
		subject: {
			type: 'string',
			description: 'Email subject line'
		},
		sources: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					num: { type: 'integer' },
					title: { type: 'string' },
					url: { type: 'string' },
					type: {
						type: 'string',
						enum: ['journalism', 'research', 'government', 'legal', 'advocacy']
					}
				},
				required: ['num', 'title', 'url', 'type']
			}
		},
		research_log: {
			type: 'array',
			items: { type: 'string' }
		}
	},
	required: ['message', 'subject', 'sources']
};
