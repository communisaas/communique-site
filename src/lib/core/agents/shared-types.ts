/**
 * Shared Types for Agents and Providers
 *
 * This module contains type definitions shared between agents/ and providers/
 * to avoid circular dependencies. Both modules should import from here.
 *
 * @module agents/shared-types
 */

import type { CompositeThoughtEmitter } from '$lib/core/thoughts/composite-emitter';

// ============================================================================
// Pipeline Phase Types
// ============================================================================

/**
 * Pipeline phases for decision-maker resolution
 *
 * - discover: Initial research phase (finding roles/positions)
 * - lookup: Verification phase (confirming current holders)
 * - complete: Resolution finished
 */
export type PipelinePhase = 'discover' | 'lookup' | 'complete';

// ============================================================================
// Streaming Callback Types
// ============================================================================

/**
 * Callbacks for streaming progress updates during resolution
 *
 * Used by providers to report real-time progress to the UI.
 */
export interface StreamingCallbacks {
	/** Called when a thought/reasoning step is emitted */
	onThought?: (thought: string, phase: PipelinePhase) => void;
	/** Called when transitioning between pipeline phases */
	onPhase?: (phase: PipelinePhase, message: string) => void;
	/** Called to report numeric progress */
	onProgress?: (progress: {
		current: number;
		total: number;
		candidateName?: string;
		status?: string;
	}) => void;
}

// ============================================================================
// Target Types
// ============================================================================

/**
 * Categories of decision-making power structures
 * Routes to appropriate provider for research strategy
 *
 * NOTE: This is more specific than the clarification TargetType
 * which has broader categories (government | corporate | institutional | other)
 */
export type DecisionMakerTargetType =
	| 'congress'
	| 'state_legislature'
	| 'local_government'
	| 'corporate'
	| 'nonprofit'
	| 'education'
	| 'healthcare'
	| 'labor'
	| 'media';

/**
 * Alias for backward compatibility with imports
 * @deprecated Use DecisionMakerTargetType for clarity
 */
export type TargetType = DecisionMakerTargetType;

// ============================================================================
// Geographic Scope
// ============================================================================

/**
 * Geographic context for decision-maker resolution
 * Helps providers understand jurisdiction and scope
 */
export interface GeographicScope {
	/** ISO 3166-1 alpha-2 country code */
	country?: string;
	/** State/province code (e.g., "CA", "TX") */
	state?: string;
	/** City name */
	city?: string;
	/** Congressional district (e.g., "CA-11") */
	district?: string;
	/** Display name for UI (e.g., "San Francisco, CA") */
	displayName?: string;
}

// ============================================================================
// Resolution Context
// ============================================================================

/**
 * Input context for decision-maker resolution
 * Providers use this to determine HOW to research
 */
export interface ResolveContext {
	/** Type of target entity (routes to provider) */
	targetType: DecisionMakerTargetType;

	/** Entity name for corporate/institutional targets */
	targetEntity?: string;

	/** Entity homepage/website for research */
	targetUrl?: string;

	/** Subject line from campaign */
	subjectLine: string;

	/** Core message being sent */
	coreMessage: string;

	/** Topic tags for context */
	topics: string[];

	/** Geographic scope for jurisdiction-based targets */
	geographicScope?: GeographicScope;

	/** Voice sample (emotional peak from user input) */
	voiceSample?: string;

	/** Streaming callbacks for progress updates */
	streaming?: StreamingCallbacks;

	/**
	 * CompositeThoughtEmitter for two-phase streaming (Discovery + Verification).
	 * When provided, the composite provider will use this instead of raw callbacks,
	 * enabling proper phase state machine, confidence tracking, and verification boost.
	 */
	compositeEmitter?: CompositeThoughtEmitter;
}
