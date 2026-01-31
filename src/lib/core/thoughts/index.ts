/**
 * Structured Thought Emission Module
 *
 * Core data model for agent reasoning visualization.
 * Provides type-safe interfaces for thought segments, citations,
 * action traces, and progressive disclosure.
 *
 * @module thoughts
 */

// Export the ThoughtEmitter service
export { ThoughtEmitter } from './emitter';

// Export the CompositeThoughtEmitter for two-phase streaming
export {
	CompositeThoughtEmitter,
	createCompositeEmitter,
	COMPOSITE_TIMING,
	BASE_CONFIDENCE
} from './composite-emitter';

// Export emitter option types
export type { ThinkOptions, InsightOptions, RecommendOptions } from './types';

// Export composite emitter types
export type {
	CompositePhase,
	ConfidentThoughtSegment,
	PhaseChangeEvent,
	ConfidenceUpdateEvent,
	CompositeEvent,
	ConfidentSegmentCallback,
	PhaseChangeCallback,
	ConfidenceUpdateCallback
} from './composite-emitter';

// Export all types
export type {
	// Thought Segments
	ThoughtSegment,
	ThoughtSegmentType,
	ThoughtEmphasis,
	// Progressive Disclosure
	ThoughtExpansion,
	StructuredData,
	// Citations
	Citation,
	CitationSource,
	CitationSourceType,
	// Action Traces
	ActionTrace,
	ActionHandle,
	ActionType,
	ActionStatus,
	ActionTargetType,
	PageVisit,
	RetrievalResult,
	// Key Moments
	KeyMoment,
	KeyMomentType,
	// Phase State
	PhaseState,
	PhaseStatus,
	// Utility Types
	ThoughtSegmentGroup,
	ThoughtStreamEvent,
	ThoughtRenderOptions
} from './types';
