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
// Role Discovery Schema (Phase 1 of two-phase decision-maker resolution)
// ============================================================================

export const ROLE_DISCOVERY_SCHEMA = {
	type: 'object',
	properties: {
		roles: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					position: {
						type: 'string',
						description: 'Title/role (e.g., "Mayor", "CEO", "Chair of Senate Committee")'
					},
					organization: {
						type: 'string',
						description: 'Specific organization (e.g., "City of San Francisco")'
					},
					jurisdiction: {
						type: 'string',
						description: 'Geographic or institutional scope (e.g., "San Francisco, CA")'
					},
					reasoning: {
						type: 'string',
						description: 'Why this position has power over the issue'
					},
					search_query: {
						type: 'string',
						description: 'Suggested search query to find the current holder'
					}
				},
				required: ['position', 'organization', 'jurisdiction', 'reasoning', 'search_query']
			},
			minItems: 3,
			maxItems: 12
		}
	},
	required: ['roles']
};

// ============================================================================
// Decision Maker Schema (used by Phase 2 output / legacy)
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
				required: [
					'name',
					'title',
					'organization',
					'provenance',
					'email',
					'source_url',
					'confidence'
				]
			},
			maxItems: 10
		},
		research_summary: { type: 'string' }
	},
	required: ['decision_makers', 'research_summary']
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
		},
		geographic_scope: {
			type: 'object',
			description: 'ISO 3166 geographic scope. type=international (no other fields), type=nationwide (country: ISO 3166-1), type=subnational (country + optional subdivision ISO 3166-2 + optional locality city name)',
			properties: {
				type: {
					type: 'string',
					enum: ['international', 'nationwide', 'subnational'],
					description: 'Scope type'
				},
				country: {
					type: 'string',
					description: 'ISO 3166-1 alpha-2 country code (e.g. "US", "GB", "JP")'
				},
				subdivision: {
					type: 'string',
					description: 'ISO 3166-2 subdivision code (e.g. "US-CA", "GB-ENG", "JP-13")'
				},
				locality: {
					type: 'string',
					description: 'City or locality name (e.g. "San Francisco", "London")'
				}
			},
			required: ['type']
		}
	},
	required: ['message', 'sources', 'geographic_scope']
};
