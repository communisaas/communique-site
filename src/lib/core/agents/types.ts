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

// Import clarification types (needed locally for SubjectStreamEvent)
import type { SubjectLineResponseWithClarification as _SubjectLineResponseWithClarification } from './types/clarification';

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
	sourceUrl: string; // Identity/person verification source
	emailSource: string; // Email-specific verification source
	emailGrounded: boolean; // true = email found verbatim in search results
	emailSourceTitle?: string; // Title of page where email was found
	confidence: number;
	contactChannel: string;
	// Legacy field for backward compatibility (deprecated)
	provenance?: string;
	source_url?: string;
}

export interface Source {
	num: number;
	title: string;
	url: string;
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy' | 'other';
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

/**
 * @deprecated Google Search grounding specific. The Exa-backed pipeline uses
 * content-based verification instead of grounding metadata.
 */
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
// Token Usage
// ============================================================================

/**
 * Token usage metadata from Gemini API responses.
 * Maps to GenerateContentResponseUsageMetadata from @google/genai.
 */
export interface TokenUsage {
	promptTokens: number;
	candidatesTokens: number;
	thoughtsTokens?: number;
	totalTokens: number;
}

/**
 * Sum multiple TokenUsage objects (for multi-call agents).
 * Returns undefined if all inputs are undefined.
 */
export function sumTokenUsage(...usages: (TokenUsage | undefined)[]): TokenUsage | undefined {
	const defined = usages.filter((u): u is TokenUsage => u !== undefined);
	if (defined.length === 0) return undefined;
	return {
		promptTokens: defined.reduce((s, u) => s + u.promptTokens, 0),
		candidatesTokens: defined.reduce((s, u) => s + u.candidatesTokens, 0),
		thoughtsTokens: defined.some((u) => u.thoughtsTokens !== undefined)
			? defined.reduce((s, u) => s + (u.thoughtsTokens ?? 0), 0)
			: undefined,
		totalTokens: defined.reduce((s, u) => s + u.totalTokens, 0)
	};
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
	/** Token usage from the Gemini API (when available) */
	tokenUsage?: TokenUsage;
}

/**
 * SSE event types for streaming subject generation
 */
export type SubjectStreamEvent =
	| { type: 'thought'; content: string }
	| { type: 'clarification'; data: _SubjectLineResponseWithClarification }
	| { type: 'complete'; data: _SubjectLineResponseWithClarification }
	| { type: 'error'; message: string };

