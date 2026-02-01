/**
 * Agent Type Definitions
 *
 * Shared interfaces for Gemini agent responses and grounding metadata
 */

// Re-export Source from shared types (canonical definition)
export type { Source } from '$lib/types/shared';

// Re-export decision-maker pipeline types from shared (for backward compatibility)
export type {
	ContactChannel,
	DecisionMakerCandidate,
	EnrichedDecisionMaker,
	ValidatedDecisionMaker
} from '$lib/types/shared';

// Import Source for use in interfaces
import type { Source } from '$lib/types/shared';

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

// Import SubjectLineResponseWithClarification for use within this file
import type { SubjectLineResponseWithClarification } from './types/clarification';

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

/**
 * Decision-maker from agent response
 *
 * This is the agent-specific DecisionMaker that includes all fields
 * returned by the decision-maker resolution pipeline.
 *
 * NOTE: For the type hierarchy (Base, WithContact, Enriched, Display),
 * see $lib/types/shared.ts
 */
export interface DecisionMaker {
	name: string;
	title: string;
	organization: string;
	email: string; // REQUIRED - guaranteed present after pipeline
	reasoning: string;
	sourceUrl: string; // Identity verification source
	emailSource: string; // Email verification source
	confidence: number;
	contactChannel: import('$lib/types/shared').ContactChannel;
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
	}>;
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
	/**
	 * Enable context caching for system instruction and schema.
	 * Reduces token costs by 90% on repeated requests with same context.
	 *
	 * Cache TTL options:
	 * - 'short': 1 hour (for dynamic content)
	 * - 'medium': 6 hours (for semi-stable content)
	 * - 'long': 24 hours (for stable prompts/schemas)
	 *
	 * Default: false (no caching)
	 */
	enableCaching?: boolean;
	/**
	 * Cache time-to-live duration.
	 * Only used when enableCaching=true.
	 * Default: 'long' (24 hours)
	 */
	cacheTTL?: 'short' | 'medium' | 'long';
	/**
	 * Display name for cache entry (for debugging).
	 * Only used when enableCaching=true.
	 */
	cacheDisplayName?: string;
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
	/** Grounding metadata from Google Search (when enableGrounding=true) */
	groundingMetadata?: GroundingMetadata;
	/** Extracted sources from grounding (for L1 inline citations) */
	sources?: Source[];
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
// NOTE: ContactChannel, DecisionMakerCandidate, EnrichedDecisionMaker, and
// ValidatedDecisionMaker are now defined in $lib/types/shared.ts and re-exported
// at the top of this file for backward compatibility.
