/**
 * Decision-Maker Providers — Pluggable Resolution Architecture
 *
 * Exports:
 * - Provider interface and types
 * - Composite provider (NEW DEFAULT - handles all targets)
 * - Gemini provider (Google Search grounding - legacy fallback)
 * - Firecrawl provider (website research - legacy fallback)
 * - Router for provider selection
 * - Singleton router instance
 *
 * NEW ARCHITECTURE (v2):
 * - CompositeProvider is the default for ALL target types
 * - Handles intelligent routing internally:
 *   - Government targets: Gemini-primary with Firecrawl fallback
 *   - Organizational targets: Firecrawl discovery + Gemini verification
 * - Legacy providers kept for backward compatibility and fallback
 *
 * To use legacy split routing, pass { useLegacyRouting: true } to router.resolve()
 * (Not recommended - this option is deprecated)
 */

// Types
export type {
	DecisionMakerTargetType,
	TargetType, // Alias for backward compatibility
	GeographicScope,
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerProvider,
	ProviderRegistration,
	RouterOptions
} from './types';

// Constants
export { CONFIDENCE } from './constants';
export type { ConfidenceValue } from './constants';

// Providers
export { CompositeDecisionMakerProvider } from './composite-provider';
export { GeminiDecisionMakerProvider } from './gemini-provider';
export { FirecrawlDecisionMakerProvider } from './firecrawl-provider';

// Router
export { DecisionMakerRouter, decisionMakerRouter } from './router';

// ============================================================================
// Provider Registration
// ============================================================================

import { CompositeDecisionMakerProvider } from './composite-provider';
import { GeminiDecisionMakerProvider } from './gemini-provider';
import { FirecrawlDecisionMakerProvider } from './firecrawl-provider';
import { decisionMakerRouter } from './router';

/**
 * Initialize default providers
 * Call this on app startup to register built-in providers
 *
 * Priority order:
 * - Composite (100): NEW DEFAULT for ALL target types
 *   - Handles intelligent routing internally
 *   - Government: Gemini-primary with Firecrawl fallback
 *   - Organizational: Firecrawl discovery + Gemini verification
 * - Gemini (10): Legacy fallback for government targets
 * - Firecrawl (10): Legacy fallback for organizational targets
 */
export function initializeProviders(): void {
	// Register Composite provider with HIGHEST priority (NEW DEFAULT)
	// This handles ALL target types with intelligent internal routing
	const compositeProvider = new CompositeDecisionMakerProvider();
	decisionMakerRouter.register(compositeProvider, 100);

	// Register Gemini provider as legacy fallback (government targets)
	// Used only if composite is unavailable or useLegacyRouting is true
	const geminiProvider = new GeminiDecisionMakerProvider();
	decisionMakerRouter.register(geminiProvider, 10);

	// Register Firecrawl provider as legacy fallback (organizational targets)
	// Used only if composite is unavailable or useLegacyRouting is true
	const firecrawlProvider = new FirecrawlDecisionMakerProvider();
	decisionMakerRouter.register(firecrawlProvider, 10);

	console.log('[providers] Default providers initialized');
	console.log('[providers] NEW DEFAULT: Composite provider (all targets, priority 100)');
	console.log('[providers] Legacy fallbacks: Gemini (government), Firecrawl (organizations)');
}

/**
 * Auto-initialize providers on module load
 * Ensures router is ready to use when imported
 */
initializeProviders();
