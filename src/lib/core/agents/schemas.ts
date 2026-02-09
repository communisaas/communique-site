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
					suggested_locations: {
						type: 'array',
						items: { type: 'string' },
						description: 'List of potential location strings for user to choose from'
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
		core_message: {
			type: 'string',
			description: 'One sentence: what the user is saying + who has power to act'
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
		detected_ask: {
			type: ['string', 'null'],
			description:
				'The specific action the person wants, extracted verbatim from their input. Null if they did not state one explicitly.'
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
				detected_urgency: {
					type: ['string', 'null'],
					enum: ['breaking', 'recent', 'ongoing', 'structural', null],
					description:
						"Issue's temporal character: breaking (days), recent (weeks), ongoing (no clear boundary), structural (systemic)"
				},
				urgency_confidence: {
					type: 'number',
					minimum: 0,
					maximum: 1,
					description: '0-1 confidence in urgency classification'
				},
				detected_ask: {
					type: ['string', 'null'],
					description:
						'The specific action the person wants, extracted verbatim. Null if implicit.'
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

