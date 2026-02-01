/**
 * Stream Event Type Definitions
 *
 * Domain-specific SSE event schema instantiations built on BaseStreamEvent.
 * Provides type-safe event definitions for different streaming contexts.
 *
 * @module events/types
 */

import type { BaseStreamEvent } from './base';
import type { ThoughtSegment, PhaseState, KeyMoment } from '../thoughts/types';
import type { ConfidentThoughtSegment, PhaseChangeEvent, ConfidenceUpdateEvent } from '../thoughts/composite-emitter';
import type { IntelligenceItem, IntelligenceCategory } from '../intelligence/types';
import type { Source } from '../agents/types';
import type { ParsedDocument } from '$lib/server/reducto/types';

// ============================================================================
// Thought Stream Events (Agent Reasoning Display)
// ============================================================================

/**
 * Data payload for thought streaming events
 */
export interface ThoughtData {
	/** Thought segment with content and metadata */
	segment?: ThoughtSegment;
	/** Phase state for phase-change events */
	phase?: PhaseState;
	/** Previous phase name (for transitions) */
	from?: string;
	/** New phase name (for transitions) */
	to?: string;
	/** Thought ID for confidence updates */
	thoughtId?: string;
	/** Previous confidence level */
	previousConfidence?: number;
	/** New confidence level */
	newConfidence?: number;
	/** Key moment for pinned items */
	moment?: KeyMoment;
	/** Total segments count (for complete events) */
	totalSegments?: number;
	/** Duration in ms (for complete events) */
	duration?: number;
}

/**
 * SSE events for thought streaming (agent reasoning visualization)
 *
 * Event types:
 * - segment: New thought segment emitted
 * - phase-change: Phase transition (discovery -> verification)
 * - confidence: Confidence level updated after verification
 * - key_moment: Important item pinned to Key Moments footer
 * - progress: General progress update
 * - complete: Stream finished successfully
 * - error: Stream encountered an error
 */
export type ThoughtStreamEvent = BaseStreamEvent<
	'segment' | 'phase-change' | 'confidence' | 'key_moment',
	ThoughtData
>;

// ============================================================================
// Composite Stream Events (Two-Phase Discovery + Verification)
// ============================================================================

/**
 * Data payload for composite streaming events
 */
export interface CompositeData {
	/** Thought segment with confidence tracking */
	segment?: ConfidentThoughtSegment | ThoughtSegment;
	/** Phase transition event */
	phaseChange?: PhaseChangeEvent;
	/** Confidence update event */
	confidenceUpdate?: ConfidenceUpdateEvent;
	/** Document collection for L2 previews */
	documents?: Array<[string, ParsedDocument]>;
	/** Document count */
	documentCount?: number;
	/** Grounding sources for L1 citations */
	sources?: Source[];
	/** Source count */
	sourceCount?: number;
}

/**
 * SSE events for composite streaming (two-phase flow)
 *
 * Event types:
 * - segment: Thought segment with phase and confidence
 * - phase-change: Composite phase transition
 * - confidence: Verification-based confidence boost
 * - documents: Parsed documents for L2 preview
 * - sources: Grounding sources for L1 citations
 * - progress: General progress update
 * - complete: Stream finished successfully
 * - error: Stream encountered an error
 *
 * @deprecated Use normalized event structure with 'data' field
 */
export type CompositeStreamEvent = BaseStreamEvent<
	'segment' | 'phase-change' | 'confidence' | 'documents' | 'sources',
	CompositeData
>;

// ============================================================================
// Subject Generation Stream Events
// ============================================================================

/**
 * Data payload for subject generation streaming
 */
export interface SubjectData {
	/** Thought content during generation */
	content?: string;
	/** Partial subject line (incremental) */
	partial?: string;
	/** Final subject line response */
	subjectLine?: string;
	/** Core message extracted */
	coreMessage?: string;
	/** Topics identified */
	topics?: string[];
	/** URL slug generated */
	urlSlug?: string;
	/** Voice sample preserved */
	voiceSample?: string;
	/** Clarification questions if needed */
	clarification?: unknown;
}

/**
 * SSE events for subject line generation
 *
 * Event types:
 * - thought: Agent reasoning during generation
 * - partial: Incremental subject line content
 * - clarification: Clarification needed from user
 * - progress: General progress update
 * - complete: Final subject line response
 * - error: Generation failed
 */
export type SubjectStreamEvent = BaseStreamEvent<
	'thought' | 'partial' | 'clarification',
	SubjectData
>;

// ============================================================================
// Intelligence Stream Events
// ============================================================================

/**
 * Data payload for intelligence gathering streaming
 */
export interface IntelligenceData {
	/** Intelligence item discovered */
	item?: IntelligenceItem;
	/** Category being processed */
	category?: IntelligenceCategory;
	/** Progress message */
	message?: string;
	/** Item count so far */
	itemCount?: number;
	/** Total items found */
	totalItems?: number;
	/** Duration in milliseconds */
	durationMs?: number;
	/** Whether error is recoverable */
	recoverable?: boolean;
}

/**
 * SSE events for intelligence gathering
 *
 * Event types:
 * - item: New intelligence item discovered
 * - category-progress: Progress within a category
 * - category-complete: Category finished processing
 * - progress: General progress update
 * - complete: All gathering finished
 * - error: Gathering failed
 */
export type IntelligenceStreamEvent = BaseStreamEvent<
	'item' | 'category-progress' | 'category-complete',
	IntelligenceData
>;

// ============================================================================
// Message Generation Stream Events
// ============================================================================

/**
 * Data payload for message generation streaming
 */
export interface MessageData {
	/** Thought content during generation */
	content?: string;
	/** Current pipeline phase */
	phase?: string;
	/** Phase description message */
	phaseMessage?: string;
	/** Final message content */
	message?: string;
	/** Verified sources */
	sources?: Source[];
	/** Research log entries */
	researchLog?: string[];
}

/**
 * SSE events for message generation
 *
 * Event types:
 * - thought: Agent reasoning during generation
 * - phase-change: Pipeline phase transition
 * - progress: General progress update
 * - complete: Final message with sources
 * - error: Generation failed
 */
export type MessageStreamEvent = BaseStreamEvent<
	'thought' | 'phase-change',
	MessageData
>;

// ============================================================================
// Decision-Maker Resolution Stream Events
// ============================================================================

/**
 * Data payload for decision-maker resolution streaming
 */
export interface DecisionMakerData {
	/** Thought segment */
	segment?: ThoughtSegment | ConfidentThoughtSegment;
	/** Phase information */
	phase?: string;
	/** Confidence level */
	confidence?: number;
	/** Phase transition from */
	from?: string;
	/** Phase transition to */
	to?: string;
	/** Timestamp */
	timestamp?: number;
	/** Thought ID for updates */
	thoughtId?: string;
	/** Previous confidence */
	previousConfidence?: number;
	/** New confidence */
	newConfidence?: number;
	/** Verification status */
	verified?: boolean;
	/** Documents for L2 previews */
	documents?: Array<[string, ParsedDocument]>;
	/** Document count */
	documentCount?: number;
	/** Sources for L1 citations */
	sources?: Source[];
	/** Source count */
	sourceCount?: number;
	/** Enrichment progress */
	current?: number;
	/** Enrichment total */
	total?: number;
	/** Candidate name being enriched */
	name?: string;
	/** Enrichment status */
	status?: string;
}

/**
 * SSE events for decision-maker resolution
 *
 * Event types:
 * - segment: Thought segment (v2)
 * - phase-change: Phase transition (v2)
 * - confidence: Confidence update (v2 composite)
 * - documents: Parsed documents for L2 preview
 * - sources: Grounding sources for L1 citations
 * - thought: Raw thought text (v1 legacy)
 * - enrichment-progress: Enrichment progress (v1 legacy)
 * - progress: General progress update
 * - complete: Final decision-makers result
 * - error: Resolution failed
 */
export type DecisionMakerStreamEvent = BaseStreamEvent<
	'segment' | 'phase-change' | 'confidence' | 'documents' | 'sources' | 'thought' | 'enrichment-progress',
	DecisionMakerData
>;

// ============================================================================
// Worker Events (ZK Proof Generation)
// ============================================================================

/**
 * Data payload for worker events
 * Note: Uses different structure than SSE events (non-streaming worker protocol)
 */
export interface WorkerEventData {
	/** Worker status */
	status?: 'idle' | 'initializing' | 'ready' | 'proving' | 'error';
	/** Progress stage description */
	stage?: string;
	/** Progress percentage (0-100) */
	percent?: number;
	/** Proof result */
	result?: {
		success: boolean;
		proof?: Uint8Array;
		publicInputs?: Record<string, unknown>;
		nullifier?: string;
		error?: string;
	};
	/** Computed merkle root */
	merkleRoot?: string;
	/** Computed hash */
	hash?: string;
	/** Error message */
	message?: string;
}

// Re-export WorkerEvent from canonical location
// This ensures single source of truth while maintaining backward compatibility
export type { WorkerEvent, WorkerCommand } from '../proof/worker-protocol';

// ============================================================================
// Backward Compatibility - Legacy Event Aliases
// ============================================================================

/**
 * @deprecated Use ThoughtStreamEvent with 'phase-change' event type
 *
 * Legacy type that used 'phase' instead of 'phase-change'.
 * Maintained for backward compatibility with existing consumers.
 */
export type LegacyThoughtStreamEvent =
	| { type: 'segment'; segment: ThoughtSegment }
	| { type: 'phase'; phase: PhaseState; from?: string; to: string }
	| { type: 'confidence'; thoughtId: string; previousConfidence: number; newConfidence: number }
	| { type: 'key_moment'; moment: KeyMoment }
	| { type: 'complete'; totalSegments: number; duration: number }
	| { type: 'error'; error: string };

/**
 * Mapping from legacy to standard event types
 */
export const EVENT_TYPE_ALIASES: Record<string, string> = {
	'phase': 'phase-change',
	'segment': 'segment',
	'confidence': 'confidence',
	'key_moment': 'key_moment'
};

/**
 * Normalize event type from legacy to standard
 */
export function normalizeEventType(type: string): string {
	return EVENT_TYPE_ALIASES[type] || type;
}
