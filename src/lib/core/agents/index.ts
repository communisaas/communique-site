/**
 * Gemini Agent Infrastructure - Public API
 *
 * Centralized exports for Gemini 3 Flash agent system.
 */

// Client functions
export {
	getGeminiClient,
	generate,
	interact,
	GEMINI_CONFIG,
	generateStream,
	generateStreamWithThoughts,
	generateWithThoughts
} from './gemini-client';

// Type definitions
export type {
	SubjectLineResponse,
	DecisionMaker,
	DecisionMakerResponse,
	Source,
	MessageResponse,
	GroundingMetadata,
	ConversationState,
	GenerateOptions,
	InteractionResponse,
	StreamChunk,
	StreamResultWithThoughts,
	// Clarification types (Phase 1)
	GeographicScope,
	TargetType,
	ClarificationOption,
	ClarificationQuestion,
	ClarificationQuestionId,
	ClarificationQuestionType,
	InferredContext,
	SubjectLineResponseWithClarification,
	ClarificationAnswers,
	// Decision-Maker Pipeline types
	ContactChannel,
	DecisionMakerCandidate,
	EnrichedDecisionMaker,
	ValidatedDecisionMaker
} from './types';

// JSON schemas
export { SUBJECT_LINE_SCHEMA, DECISION_MAKER_SCHEMA, MESSAGE_SCHEMA } from './schemas';

// Agent functions
export { generateSubjectLine } from './agents/subject-line';
export type { GenerateSubjectOptions, GenerateSubjectResult } from './agents/subject-line';

export { generateMessage } from './agents/message-writer';
export type { GenerateMessageOptions } from './agents/message-writer';

export { resolveDecisionMakers } from './agents/decision-maker';
export type { ResolveOptions } from './agents/decision-maker';

// Grounding utilities
export {
	extractSourcesFromGrounding,
	buildCitationMap,
	injectCitations,
	buildSourceList,
	mergeAndDeduplicateSources,
	inferSourceType
} from './utils/grounding';

// Clarification utilities (Phase 1)
export {
	needsClarification,
	hasCompleteOutput,
	calculateOverallConfidence,
	meetsConfidenceThreshold,
	getLeastConfidentDimensions
} from './utils/clarification-guards';

// Prompts
export { SUBJECT_LINE_PROMPT } from './prompts/subject-line';
export { MESSAGE_WRITER_PROMPT } from './prompts/message-writer';
// Note: DECISION_MAKER_PROMPT exists but is unused - phase-specific prompts are used instead

// Utilities for grounding mode (when JSON schema is incompatible)
export { extractJsonFromGroundingResponse, isSuccessfulExtraction } from './utils/grounding-json';

// Truncation recovery for structured output
export {
	recoverTruncatedJson,
	buildContinuationPrompt,
	mergeContinuation
} from './utils/truncation-recovery';
