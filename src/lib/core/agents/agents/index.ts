/**
 * Decision-Maker Agent Exports
 */

export {
	resolveDecisionMakersV2 as resolveDecisionMakers,
	// Tool helpers
	getAgentToolDeclarations,
	processGeminiFunctionCall,
	handleDocumentToolCall
} from './decision-maker';

// Re-export provider types
export type {
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerTargetType,
	GeographicScope
} from '../providers/types';

// Re-export ThoughtSegment types
export type { ThoughtSegment } from '$lib/core/thoughts/types';
