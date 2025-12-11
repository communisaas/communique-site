/**
 * Server Module - Barrel Export
 *
 * Server-side utilities and services consolidated under core/server.
 * Provides a clean API boundary for backend functionality.
 */

// Analytics & Percolation
export * from './percolation-engine';
export * from './civic-analytics';

// Security & Auth
export * from './api-security';
export * from './verification-sessions';

// Data Processing
export * from './district-metrics';
export * from './sentiment-basic';
export * from './sentiment-classification';
export * from './sentiment-storage';

// Utilities
export * from './reserved-slugs';

// Convenience exports
export { runPercolationAnalysis, formatPercolationResponse } from './percolation-engine';
export { createSecurityMiddleware as apiSecurityMiddleware, validateApiKey } from './api-security';
export { getDistrictMetrics as processDistrictMetrics } from './district-metrics';
export {
	analyzeSentimentBasic as analyzeSentiment,
	classifyBasicSentiment as classifyPoliticalSentiment
} from './sentiment-basic';
export { storeSingleUserSentiment } from './sentiment-storage';
