/**
 * Decision-Maker Agent Exports
 */

export {
	resolveDecisionMakers,
	// Tool helpers
	getAgentToolDeclarations,
	processGeminiFunctionCall,
	handleDocumentToolCall
} from './decision-maker';

export type { AgenticToolContext } from './decision-maker';

// Re-export provider types
export type {
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerTargetType,
	GeographicScope
} from '../providers/types';

// Re-export ThoughtSegment types
export type { ThoughtSegment } from '$lib/core/thoughts/types';
