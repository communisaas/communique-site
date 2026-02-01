/**
 * Firecrawl Server Module
 *
 * Server-side utilities for Firecrawl API operations.
 *
 * This module provides:
 * - Map API: Site structure discovery for pre-crawling analysis
 * - Observer API: Real-time page monitoring for change detection
 * - Enrich API: Contact enrichment from email/LinkedIn
 * - Leadership page filtering: Identify team/about pages
 * - MongoDB caching: 1-week TTL for map results, 7-day TTL for enrichment
 *
 * The core Firecrawl client (Agent API) is located in:
 * src/lib/core/agents/providers/firecrawl-client.ts
 *
 * @example
 * ```typescript
 * import {
 *   mapSiteForLeadership,
 *   searchLeadershipPages,
 *   enrichContact,
 *   createObserver,
 *   listObservers
 * } from '$lib/server/firecrawl';
 *
 * // Map a site and get categorized URLs
 * const mapResult = await mapSiteForLeadership({
 *   url: 'https://company.com',
 *   limit: 200
 * });
 *
 * // Use leadership pages for targeted crawling
 * const priorityPages = [
 *   ...mapResult.leadershipPages,
 *   ...mapResult.aboutPages
 * ];
 *
 * // Enrich contact from email
 * const enrichResult = await enrichContact({
 *   email: 'jane.doe@company.com',
 *   includeCompany: true
 * });
 *
 * console.log(enrichResult.person.name);
 * console.log(enrichResult.company?.industry);
 *
 * // Create an observer for leadership page changes
 * const observer = await createObserver({
 *   url: 'https://company.com/leadership',
 *   selector: '.executive-team',
 *   interval: 60,
 *   webhookUrl: 'https://my-app.com/webhooks/changes'
 * });
 *
 * // List all active observers
 * const observers = await listObservers({ status: 'active' });
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
	type MapLink,
	type LeadershipMapResult
} from './map';

// ============================================================================
// Observer API - Page monitoring via Change Tracking
// Uses Firecrawl's /scrape endpoint with changeTracking format
// Observer state is stored in MongoDB, checked periodically via runObserverChecks()
// ============================================================================

export {
	// Core functions
	createObserver,
	getObserverStatus,
	pauseObserver,
	resumeObserver,
	deleteObserver,
	listObservers,
	updateObserver,

	// Change tracking via scheduled checks
	checkObserver,
	getObserversNeedingCheck,
	runObserverChecks,

	// Change history
	getObserverChanges,
	recordChange,

	// Statistics
	getObserverStats,

	// Index management
	ensureObserverIndexes,

	// Types
	type ObserverOptions,
	type ObserverResult,
	type ObserverStatus,
	type ChangeEvent,
	type ChangeType
} from './observer';

// ============================================================================
// Enrich API - Contact enrichment
// ============================================================================

export {
	// Core function
	enrichContact,

	// Cache management
	hasEnrichmentCache,
	invalidateEnrichmentCache,
	getEnrichmentCacheStats,
	ensureEnrichmentCacheIndexes,

	// Types
	type EnrichOptions,
	type EnrichResult,
	type EnrichedPerson,
	type EnrichedContact,
	type EnrichedCompany
} from './enrich';
