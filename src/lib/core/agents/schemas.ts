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
		// Decision field - ALWAYS required
		needs_clarification: {
			type: 'boolean',
			description: 'true = ask clarifying questions, false = generate subject line'
		},

		// Clarification questions - ALWAYS required (empty array if not clarifying)
		clarification_questions: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'Unique ID: "location", "scope", or "target"'
					},
					question: {
						type: 'string',
						description: 'Natural question grounded in user input'
					},
					type: {
						type: 'string',
						enum: ['location_picker', 'open_text'],
						description: 'location_picker for geography, open_text for everything else'
					},
					placeholder: {
						type: 'string',
						description: 'Hint text for open_text input'
					},
					location_level: {
						type: 'string',
						enum: ['city', 'state', 'country'],
						description: 'For location_picker: geographic level'
					},
					required: {
						type: 'boolean',
						description: 'Is this question required?'
					}
				},
				required: ['id', 'question', 'type', 'required']
			},
			maxItems: 2,
			description: 'If needs_clarification=true: 1-2 questions. If false: empty array []'
		},

		// Generation output - only when needs_clarification=false
		subject_line: {
			type: 'string',
			description: 'Compelling subject line (max 80 chars)'
		},
		core_issue: {
			type: 'string',
			description: 'One sentence: problem + who has power + who is harmed'
		},
		topics: {
			type: 'array',
			items: { type: 'string' },
			maxItems: 5,
			description: '1-5 lowercase topic tags'
		},
		url_slug: {
			type: 'string',
			description: 'URL slug: 2-4 words, lowercase, hyphens'
		},
		voice_sample: {
			type: 'string',
			description: 'Most visceral phrase from input (1-2 sentences, verbatim)'
		},

		// Context - ALWAYS required
		inferred_context: {
			type: 'object',
			properties: {
				detected_location: {
					type: ['string', 'null'],
					description: 'Best guess location'
				},
				detected_scope: {
					type: ['string', 'null'],
					enum: ['local', 'state', 'national', 'international', null],
					description: 'Geographic scope'
				},
				detected_target_type: {
					type: ['string', 'null'],
					enum: ['government', 'corporate', 'institutional', 'other', null],
					description: 'Power structure type'
				},
				location_confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: '0-1 confidence in location'
				},
				scope_confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: '0-1 confidence in scope'
				},
				target_type_confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: '0-1 confidence in target type'
				},
				reasoning: {
					type: 'string',
					description: 'Why clarification is or is not needed'
				}
			},
			required: [
				'detected_location',
				'detected_scope',
				'detected_target_type',
				'location_confidence',
				'scope_confidence',
				'target_type_confidence',
				'reasoning'
			],
			description: 'Inferred context with confidence scores'
		}
	},
	required: ['needs_clarification', 'clarification_questions', 'inferred_context']
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
