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

// Export emitter option types
export type { ThinkOptions, InsightOptions, RecommendOptions } from './emitter';

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
