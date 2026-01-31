/**
 * Decision-Maker Provider Architecture
 *
 * Abstraction layer for pluggable decision-maker resolution strategies.
 * Enables routing between Gemini (Google Search grounding) and Firecrawl
 * (structured corporate data) based on target type.
 */

import type { ProcessedDecisionMaker } from '$lib/types/template';
import type { StreamingCallbacks, PipelinePhase } from '../agents/decision-maker';

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
}

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
}
