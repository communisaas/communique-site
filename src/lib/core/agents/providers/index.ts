/**
 * Decision-Maker Providers
 *
 * Single Gemini provider handles all target types via Google Search grounding.
 * Router selects providers by priority; target type is an open string.
 */

// Types
export type {
	DecisionMakerTargetType,
	GeographicScope,
	ResolveContext,
	DecisionMakerResult,
	DecisionMakerProvider,
	ProviderRegistration,
	RouterOptions
} from './types';

// Provider
export { GeminiDecisionMakerProvider } from './gemini-provider';

// Router
export { DecisionMakerRouter, decisionMakerRouter } from './router';

// ============================================================================
// Provider Registration
// ============================================================================

import { GeminiDecisionMakerProvider } from './gemini-provider';
import { decisionMakerRouter } from './router';

/**
 * Initialize default providers.
 * Called automatically on module load.
 */
export function initializeProviders(): void {
	const geminiProvider = new GeminiDecisionMakerProvider();
	decisionMakerRouter.register(geminiProvider, 100);
	console.debug('[providers] Gemini provider registered (priority 100)');
}

initializeProviders();
