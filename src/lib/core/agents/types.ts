/**
 * Agent Type Definitions
 *
 * Shared interfaces for Gemini agent responses and grounding metadata
 */

import type { ScopeMapping } from '$lib/utils/scope-mapper-international';

// Re-export clarification types
export type {
	GeographicScope,
	TargetType,
	ClarificationOption,
	ClarificationQuestion,
	ClarificationQuestionId,
	ClarificationQuestionType,
	InferredContext,
	SubjectLineResponseWithClarification,
	ClarificationAnswers
} from './types/clarification';

// ============================================================================
// Agent Response Types
// ============================================================================

export interface SubjectLineResponse {
	subject_line: string;
	core_issue: string;
	topics: string[];
	url_slug: string;
	voice_sample: string; // The emotional peak from raw input - carries through pipeline
}

export interface DecisionMaker {
	name: string;
	title: string;
	organization: string;
	email?: string;
	provenance: string;
	source_url?: string;
	confidence: number;
}

export interface DecisionMakerResponse {
	decision_makers: DecisionMaker[];
	research_summary?: string;
}

export interface Source {
	num: number;
	title: string;
	url: string;
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy';
}

export interface MessageResponse {
	message: string;
	subject: string;
	sources: Source[];
	research_log: string[];
	geographic_scope?: ScopeMapping;
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
