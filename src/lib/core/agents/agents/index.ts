/**
 * Decision-Maker Agent Exports
 *
 * Provides both legacy and enhanced versions of the decision-maker agent:
 * - v1: Original implementation with raw text streaming
 * - v2: Enhanced with ThoughtStream (structured segments, citations, memory)
 */

// V1: Legacy implementation (backward compatibility)
export {
	resolveDecisionMakers,
	type ResolveOptions,
	type StreamingCallbacks,
	type PipelinePhase
} from './decision-maker';

// V2: Enhanced ThoughtStream integration
export {
	resolveDecisionMakersV2,
	resolveDecisionMakersWithThoughts
} from './decision-maker-v2';

// Re-export provider types for convenience
export type {
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerTargetType,
	GeographicScope
} from '../providers/types';

// Re-export ThoughtSegment types
export type { ThoughtSegment } from '$lib/core/thoughts/types';
