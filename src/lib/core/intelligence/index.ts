/**
 * Intelligence Module Exports
 *
 * Central export point for the intelligence orchestration system.
 */

// Core orchestrator
export { IntelligenceOrchestrator, intelligenceOrchestrator } from './orchestrator';

// Types
export type {
	IntelligenceQuery,
	IntelligenceItem,
	IntelligenceProvider,
	IntelligenceCategory,
	IntelligenceStreamEvent,
	IntelligenceItemEvent,
	IntelligenceProgressEvent,
	IntelligenceCompleteEvent,
	IntelligenceErrorEvent,
	OrchestrationOptions,
	GeographicScope
} from './types';

// Base provider for custom implementations
export { BaseIntelligenceProvider } from './providers/base';

// Built-in providers
export { NewsProvider } from './providers/news-provider';
export { LegislativeProvider } from './providers/legislative-provider';
export { CorporateProvider } from './providers/corporate-provider';
