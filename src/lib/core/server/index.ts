/**
 * Server Module - Barrel Export
 *
 * Server-side utilities and services consolidated under core/server.
 * Provides a clean API boundary for backend functionality.
 */

// Analytics & Percolation
export * from './percolation-engine';

// Security & Auth
export * from './verification-sessions';

// Data Processing
export * from './district-metrics';
export * from './sentiment-basic';
export * from './sentiment-storage';

// Convenience exports
export { runPercolationAnalysis, formatPercolationResponse } from './percolation-engine';
export { getDistrictMetrics as processDistrictMetrics } from './district-metrics';
export {
	analyzeSentimentBasic as analyzeSentiment,
	classifyBasicSentiment as classifyPoliticalSentiment
} from './sentiment-basic';
export { storeSingleUserSentiment } from './sentiment-storage';
