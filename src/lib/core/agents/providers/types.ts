/**
 * Decision-Maker Provider Architecture
 *
 * Abstraction layer for pluggable decision-maker resolution strategies.
 * Enables routing between Gemini (Google Search grounding) and Firecrawl
 * (structured corporate data) based on target type.
 */

import type { ProcessedDecisionMaker } from '$lib/types/template';

// Import shared types for use in this file
import type {
	PipelinePhase as _PipelinePhase,
	StreamingCallbacks as _StreamingCallbacks,
	DecisionMakerTargetType as _DecisionMakerTargetType,
	TargetType as _TargetType,
	GeographicScope as _GeographicScope,
	ResolveContext as _ResolveContext
} from '../shared-types';

// Re-export shared types that are used by both agents/ and providers/
// This avoids circular dependencies between the two modules
export type {
	PipelinePhase,
	StreamingCallbacks,
	DecisionMakerTargetType,
	TargetType,
	GeographicScope,
	ResolveContext
} from '../shared-types';

// Type aliases for use within this file
type DecisionMakerTargetType = _DecisionMakerTargetType;
type ResolveContext = _ResolveContext;

// ============================================================================
// Resolution Result
// ============================================================================

/**
 * Result from decision-maker resolution
 * Standardized output across all providers
 */
export interface DecisionMakerResult {
	/** Resolved decision-makers with contact info */
	decisionMakers: ProcessedDecisionMaker[];

	/** Provider that generated this result */
	provider: string;

	/** Optional: organization profile data (for corporate targets) */
	orgProfile?: unknown;

	/** Whether result came from cache */
	cacheHit: boolean;

	/** Total resolution time in milliseconds */
	latencyMs: number;

	/** Optional: research summary from provider */
	researchSummary?: string;

	/** Optional: provider-specific metadata */
	metadata?: Record<string, unknown>;

	/**
	 * Parsed documents from document tool invocations.
	 * Map keyed by document ID for L2 preview access.
	 * Only populated when document tool is called during resolution.
	 */
	documents?: Map<string, import('$lib/server/reducto/types').ParsedDocument>;

	/**
	 * Grounding sources from Google Search for L1 inline citations.
	 * Extracted from Gemini groundingMetadata when grounding is enabled.
	 */
	sources?: import('../types').Source[];
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Decision-maker provider interface
 * All providers must implement this contract
 */
export interface DecisionMakerProvider {
	/** Provider name for logging and routing */
	readonly name: string;

	/** Target types this provider can handle */
	readonly supportedTargetTypes: readonly DecisionMakerTargetType[];

	/**
	 * Check if this provider can resolve the given context
	 * Allows for dynamic capability checks beyond just target type
	 */
	canResolve(context: ResolveContext): boolean;

	/**
	 * Resolve decision-makers for the given context
	 * @throws Error if resolution fails
	 */
	resolve(context: ResolveContext): Promise<DecisionMakerResult>;
}

// ============================================================================
// Router Configuration
// ============================================================================

/**
 * Provider registration for router
 */
export interface ProviderRegistration {
	provider: DecisionMakerProvider;
	/** Priority when multiple providers support the same target type (higher wins) */
	priority: number;
}

/**
 * Router options for resolution
 */
export interface RouterOptions {
	/** Whether to allow fallback to other providers on failure */
	allowFallback?: boolean;
	/** Preferred provider name (if available) */
	preferredProvider?: string;
	/** Maximum resolution time before timeout (ms) */
	timeoutMs?: number;
	/**
	 * Force legacy split routing (Gemini for gov, Firecrawl for org).
	 * @deprecated Use the new composite provider architecture instead.
	 * The composite provider handles both target types with intelligent
	 * strategy selection and fallback. This flag exists only for
	 * backward compatibility and will be removed in a future version.
	 */
	useLegacyRouting?: boolean;
}
