/**
 * Clarification Types for Subject Line Agent
 *
 * Design Philosophy:
 * - Agent has full autonomy to formulate questions
 * - Only two input types: location_picker (structured) and open_text (conversation)
 * - Feels like a conversation turn, not a form
 *
 * Perceptual Engineering:
 * - Match user's mental model: "talking to an intelligent agent"
 * - Location is structured because it's a lookup task (geocoding)
 * - Everything else is open text for richer signal
 */

// ============================================================================
// Question Types (minimal, intentional)
// ============================================================================

/**
 * location_picker: Uses LocationAutocomplete component for structured city/state/country selection
 * open_text: Free-form text input for richer, contextual responses
 */
export type ClarificationQuestionType = 'location_picker' | 'open_text';

// ============================================================================
// Clarification Question (agent-formulated)
// ============================================================================

export interface ClarificationQuestion {
	/** Unique identifier for this question (agent-generated, e.g., "location", "scope", "context") */
	id: string;

	/** The question text - formulated by agent in natural language, grounded in user's input */
	question: string;

	/** Input type: location_picker for geographic selection, open_text for everything else */
	type: ClarificationQuestionType;

	/** For open_text: placeholder hint for the input field */
	placeholder?: string;

	/** For location_picker: agent's best guess location to pre-fill (e.g., "San Francisco, CA") */
	prefilled_location?: string;

	/** For location_picker: what level of specificity is needed */
	location_level?: 'city' | 'state' | 'country';

	/** For location_picker: list of potential locations the agent inferred (e.g. ["Paris, TX", "Paris, France"]) */
	suggested_locations?: string[];

	/** Whether this question must be answered to proceed */
	required: boolean;
}

// ============================================================================
// Inferred Context (agent's reasoning trace)
// ============================================================================

export interface InferredContext {
	/** Agent's best guess at location, if any signals present */
	detected_location: string | null;

	/** Agent's interpretation of geographic scope */
	detected_scope: 'local' | 'state' | 'national' | 'international' | null;

	/** Agent's interpretation of power structure type */
	detected_target_type: 'government' | 'corporate' | 'institutional' | 'other' | null;

	/** Confidence scores for analytics (0-1) */
	location_confidence: number;
	scope_confidence: number;
	target_type_confidence: number;

	/** Agent's reasoning about why clarification is/isn't needed */
	reasoning?: string;
}

// ============================================================================
// Extended Subject Line Response
// ============================================================================

export interface SubjectLineResponseWithClarification {
	// Standard output (only present if no clarification needed)
	subject_line?: string;
	core_message?: string;
	topics?: string[];
	url_slug?: string;
	voice_sample?: string;

	// Clarification request (only present if clarification needed)
	needs_clarification?: boolean;
	clarification_questions?: ClarificationQuestion[];

	// Agent's reasoning and best guesses (always present)
	inferred_context: InferredContext;
}

// ============================================================================
// User Clarification Answers (flexible key-value)
// ============================================================================

/**
 * Answers keyed by question ID
 * Values are strings - agent interprets them in context
 */
export interface ClarificationAnswers {
	[questionId: string]: string;
}

// ============================================================================
// Conversation Context (stateless multi-turn)
// ============================================================================

/**
 * Full conversation context for stateless multi-turn
 * Frontend stores this and sends it back on clarification turn
 */
export interface ConversationContext {
	/** Original user description from turn 1 */
	originalDescription: string;

	/** Questions the agent asked */
	questionsAsked: ClarificationQuestion[];

	/** Agent's inferred context from turn 1 */
	inferredContext: InferredContext;

	/** User's answers keyed by question ID */
	answers: ClarificationAnswers;
}

// ============================================================================
// Convenience type aliases (for backwards compatibility)
// ============================================================================

export type GeographicScope = 'local' | 'state' | 'national' | 'international';
export type TargetType = 'government' | 'corporate' | 'institutional' | 'other';
