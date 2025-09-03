/**
 * Server Module - Barrel Export
 * 
 * Server-side utilities and services consolidated under core/server.
 * Provides a clean API boundary for backend functionality.
 */

// Analytics & Percolation
export * from './percolation-engine';
export * from './sheaf-fusion';
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
export * from './selfxyz-config';

// Convenience exports
export { analyzeCivicInformationCascades, storeCascadeAnalysis } from './percolation-engine';
export { apiSecurityMiddleware, validateApiKey } from './api-security';
export { processDistrictMetrics } from './district-metrics';
export { analyzeSentiment, classifyPoliticalSentiment } from './sentiment-basic';
export { storeSingleUserSentiment } from './sentiment-storage';