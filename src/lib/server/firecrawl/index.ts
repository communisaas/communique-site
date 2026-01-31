/**
 * Firecrawl Server Module
 *
 * Server-side utilities for Firecrawl API operations.
 *
 * This module provides:
 * - Map API: Site structure discovery for pre-crawling analysis
 * - Leadership page filtering: Identify team/about pages
 * - MongoDB caching: 1-week TTL for map results
 *
 * The core Firecrawl client (Agent API) is located in:
 * src/lib/core/agents/providers/firecrawl-client.ts
 *
 * @example
 * ```typescript
 * import { mapSiteForLeadership, searchLeadershipPages } from '$lib/server/firecrawl';
 *
 * // Map a site and get categorized URLs
 * const result = await mapSiteForLeadership({
 *   url: 'https://company.com',
 *   limit: 200
 * });
 *
 * // Use leadership pages for targeted crawling
 * const priorityPages = [
 *   ...result.leadershipPages,
 *   ...result.aboutPages
 * ];
 * ```
 */

// ============================================================================
// Map API - Site structure discovery
// ============================================================================

export {
	// Core functions
	mapSite,
	mapSiteForLeadership,
	searchLeadershipPages,

	// Filtering utility
	filterLeadershipUrls,

	// Cache management
	invalidateMapCache,
	getMapCacheStats,
	ensureSiteMapCacheIndexes,

	// Types
	type MapOptions,
	type MapResult,
	type LeadershipMapResult
} from './map';
