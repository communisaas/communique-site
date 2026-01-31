/**
 * Decision-Maker Providers — Pluggable Resolution Architecture
 *
 * Exports:
 * - Provider interface and types
 * - Gemini provider (Google Search grounding)
 * - Router for provider selection
 * - Singleton router instance
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

// Providers
export { GeminiDecisionMakerProvider } from './gemini-provider';
export { FirecrawlDecisionMakerProvider } from './firecrawl-provider';

// Router
export { DecisionMakerRouter, decisionMakerRouter } from './router';

// ============================================================================
// Provider Registration
// ============================================================================

import { GeminiDecisionMakerProvider } from './gemini-provider';
import { FirecrawlDecisionMakerProvider } from './firecrawl-provider';
import { decisionMakerRouter } from './router';

/**
 * Initialize default providers
 * Call this on app startup to register built-in providers
 */
export function initializeProviders(): void {
	// Register Gemini provider with priority 10 (government targets)
	const geminiProvider = new GeminiDecisionMakerProvider();
	decisionMakerRouter.register(geminiProvider, 10);

	// Register Firecrawl provider with priority 10 (organizational targets)
	const firecrawlProvider = new FirecrawlDecisionMakerProvider();
	decisionMakerRouter.register(firecrawlProvider, 10);

	console.log('[providers] Default providers initialized');
	console.log('[providers] Registered: Gemini (government), Firecrawl (organizations)');
}

/**
 * Auto-initialize providers on module load
 * Ensures router is ready to use when imported
 */
initializeProviders();
