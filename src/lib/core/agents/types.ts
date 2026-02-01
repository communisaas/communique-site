/**
 * Agent Type Definitions
 *
 * Shared interfaces for Gemini agent responses and grounding metadata
 */

/**
 * Standardized geographic scope encoding (ISO 3166)
 *
 * Three types, one discriminated union:
 * - international: crosses national borders
 * - nationwide: single country (ISO 3166-1 alpha-2)
 * - subnational: country + optional subdivision (ISO 3166-2) + optional locality
 */
export type GeoScope =
	| { type: 'international' }
	| { type: 'nationwide'; country: string; displayName?: string }
	| {
			type: 'subnational';
			country: string;
			subdivision?: string;
			locality?: string;
			displayName?: string;
	  };

// Re-export clarification types
export type {
	GeographicScope,
	TargetType,
	ClarificationQuestion,
	ClarificationQuestionType,
	InferredContext,
	SubjectLineResponseWithClarification,
	ClarificationAnswers,
	ConversationContext
} from './types/clarification';

// ============================================================================
// Agent Response Types
// ============================================================================

export interface SubjectLineResponse {
	subject_line: string;
	core_message: string;
	topics: string[];
	url_slug: string;
	voice_sample: string; // The emotional peak from raw input - carries through pipeline
}

export interface DecisionMaker {
	name: string;
	title: string;
	organization: string;
	email: string; // REQUIRED - guaranteed present after pipeline
	reasoning: string;
	sourceUrl: string; // Identity verification source
	emailSource: string; // Email verification source
	confidence: number;
	contactChannel: ContactChannel;
	// Legacy field for backward compatibility (deprecated)
	provenance?: string;
	source_url?: string;
}

export interface DecisionMakerResponse {
	decision_makers: DecisionMaker[];
	research_summary?: string;
	pipeline_stats?: {
		candidates_found: number;
		enrichments_succeeded: number;
		validations_passed: number;
		total_latency_ms: number;
	};
}

export interface Source {
	num: number;
	title: string;
	url: string;
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy';
}

export interface MessageResponse {
	message: string;
	sources: Source[];
	research_log: string[];
	geographic_scope?: GeoScope;
}

// ============================================================================
// Grounding Metadata
// ============================================================================

export interface GroundingMetadata {
	webSearchQueries?: string[];
	groundingChunks?: Array<{
		web?: { uri?: string; title?: string };
	}>;
	groundingSupports?: Array<{
		segment?: { startIndex: number; endIndex: number };
		groundingChunkIndices?: number[];
		/** Confidence scores (0-1) for each grounding chunk index */
		confidenceScores?: number[];
	}>;
	/** Search entry point HTML for rendering Google Search suggestions */
	searchEntryPoint?: { renderedContent?: string };
}

// ============================================================================
// Conversation State
// ============================================================================

export interface ConversationState {
	interactionId: string;
	createdAt: Date;
	expiresAt: Date;
}

// ============================================================================
// Gemini Client Options
// ============================================================================

export interface GenerateOptions {
	temperature?: number;
	maxOutputTokens?: number;
	thinkingLevel?: 'low' | 'medium' | 'high';
	enableGrounding?: boolean;
	responseSchema?: object;
	systemInstruction?: string;
	previousInteractionId?: string;
	/**
	 * When true, streams thinking summaries from Gemini.
	 * IMPORTANT: This disables responseMimeType (incompatible with thoughts).
	 * JSON must be requested in the system prompt and parsed manually.
	 */
	streamThoughts?: boolean;
}

/**
 * Interaction response interface
 * For multi-turn conversation state tracking
 */
export interface InteractionResponse {
	id: string;
	outputs: string;
	model: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Streaming chunk from Gemini with thinking support
 */
export interface StreamChunk {
	type: 'thought' | 'text' | 'complete' | 'error';
	content: string;
}

/**
 * Enhanced streaming result with thoughts and parsed data
 * Used when streamThoughts=true to get both thinking summaries and structured output
 */
export interface StreamResultWithThoughts<T = unknown> {
	/** Thinking summaries streamed during generation */
	thoughts: string[];
	/** Raw text output (before JSON extraction) */
	rawText: string;
	/** Parsed structured data (null if parsing failed) */
	data: T | null;
	/** Whether JSON extraction succeeded */
	parseSuccess: boolean;
	/** Parse error message if extraction failed */
	parseError?: string;
	/**
	 * Grounding metadata from Google Search (when enableGrounding=true)
	 * Contains verified source URLs in groundingChunks - use these instead of
	 * trusting URLs generated in the LLM's text output.
	 */
	groundingMetadata?: GroundingMetadata;
}

/**
 * SSE event types for streaming subject generation
 */
export type SubjectStreamEvent =
	| { type: 'thought'; content: string }
	| { type: 'partial'; content: string }
	| { type: 'clarification'; data: SubjectLineResponseWithClarification }
	| { type: 'complete'; data: SubjectLineResponseWithClarification }
	| { type: 'error'; message: string };

// ============================================================================
// Decision-Maker Pipeline Types
// ============================================================================

export type ContactChannel = 'email' | 'form' | 'phone' | 'congress' | 'other';

export interface DecisionMakerCandidate {
	name: string;
	title: string;
	organization: string;
	reasoning: string;
	sourceUrl: string;
	confidence: number;
	contactChannel?: ContactChannel;
}

export interface EnrichedDecisionMaker extends DecisionMakerCandidate {
	email?: string;
	emailSource?: string;
	emailConfidence?: number;
	enrichmentStatus: 'success' | 'not_found' | 'timeout' | 'error';
	enrichmentAttempts: number;
}

export interface ValidatedDecisionMaker {
	name: string;
	title: string;
	organization: string;
	email: string; // REQUIRED - guaranteed present
	reasoning: string;
	sourceUrl: string;
	emailSource: string;
	confidence: number;
	contactChannel: ContactChannel;
}
