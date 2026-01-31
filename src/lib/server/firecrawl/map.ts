/**
 * Firecrawl Map API
 *
 * Discovers all URLs on a site before crawling. Useful for pre-crawling
 * leadership page discovery to identify team/about pages.
 *
 * Features:
 * - Site structure discovery via Map API
 * - Leadership/team page filtering
 * - MongoDB caching with 1-week TTL
 * - Rate limiting handling
 */

import { createHash } from 'crypto';
import { getDatabase } from '../mongodb';
import { createTTL } from '../mongodb/utils';
import type { Collection, ObjectId } from 'mongodb';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the Map API request
 */
export interface MapOptions {
	/** URL of the site to map */
	url: string;
	/** Maximum depth to crawl (default: 2) */
	maxDepth?: number;
	/** Include subdomains in results (default: false) */
	includeSubdomains?: boolean;
	/** Maximum number of links to return (default: 100) */
	limit?: number;
	/** Search query to filter results (optional) */
	search?: string;
	/** Ignore sitemap.xml (default: false) */
	ignoreSitemap?: boolean;
}

/**
 * Result from the Map API
 */
export interface MapResult {
	success: boolean;
	links: string[];
	error?: string;
	/** Number of links discovered before filtering */
	totalDiscovered?: number;
	/** Whether result came from cache */
	cached?: boolean;
}

/**
 * Filtered result with leadership page URLs
 */
export interface LeadershipMapResult extends MapResult {
	/** URLs identified as potential leadership/team pages */
	leadershipPages: string[];
	/** URLs identified as about/company pages */
	aboutPages: string[];
	/** All other discovered URLs */
	otherPages: string[];
}

/**
 * MongoDB document for cached map results
 */
interface SiteMapCacheDocument {
	_id?: ObjectId;
	/** SHA-256 hash of the URL for deduplication */
	urlHash: string;
	/** Original URL that was mapped */
	url: string;
	/** Domain extracted from URL */
	domain: string;
	/** All discovered links */
	links: string[];
	/** Pre-filtered leadership page URLs */
	leadershipPages: string[];
	/** Pre-filtered about page URLs */
	aboutPages: string[];
	/** Map options used for this request */
	options: Omit<MapOptions, 'url'>;
	/** Cache metadata */
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date;
	/** Access statistics */
	hitCount: number;
	lastAccessedAt?: Date;
}

// ============================================================================
// Constants
// ============================================================================

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';
const COLLECTION_NAME = 'site_map_cache';
const DEFAULT_CACHE_DAYS = 7; // 1-week TTL

/**
 * URL patterns that indicate leadership/team pages
 */
const LEADERSHIP_PATTERNS = [
	'/team',
	'/leadership',
	'/executives',
	'/board',
	'/management',
	'/directors',
	'/officers',
	'/people',
	'/staff',
	'/our-team',
	'/our-leadership',
	'/meet-the-team',
	'/meet-our-team',
	'/who-we-are'
];

/**
 * URL patterns that indicate about/company pages
 */
const ABOUT_PATTERNS = [
	'/about',
	'/about-us',
	'/company',
	'/organization',
	'/who-we-are',
	'/our-story',
	'/our-company',
	'/corporate',
	'/investor',
	'/investors',
	'/ir'
];

// ============================================================================
// Collection Accessor
// ============================================================================

/**
 * Get the Site Map Cache collection
 */
async function getSiteMapCacheCollection(): Promise<Collection<SiteMapCacheDocument>> {
	const db = await getDatabase();
	return db.collection<SiteMapCacheDocument>(COLLECTION_NAME);
}

// ============================================================================
// URL Filtering
// ============================================================================

/**
 * Check if a URL matches any of the given patterns
 */
function matchesPatterns(url: string, patterns: string[]): boolean {
	const urlLower = url.toLowerCase();
	return patterns.some(pattern => {
		// Check for exact path segment match
		const patternLower = pattern.toLowerCase();
		// Match /pattern, /pattern/, /pattern?..., /pattern#...
		const regex = new RegExp(`${patternLower}(?:[/?#]|$)`, 'i');
		return regex.test(urlLower);
	});
}

/**
 * Filter discovered URLs into leadership, about, and other categories
 */
export function filterLeadershipUrls(links: string[]): {
	leadershipPages: string[];
	aboutPages: string[];
	otherPages: string[];
} {
	const leadershipPages: string[] = [];
	const aboutPages: string[] = [];
	const otherPages: string[] = [];

	for (const link of links) {
		if (matchesPatterns(link, LEADERSHIP_PATTERNS)) {
			leadershipPages.push(link);
		} else if (matchesPatterns(link, ABOUT_PATTERNS)) {
			aboutPages.push(link);
		} else {
			otherPages.push(link);
		}
	}

	return { leadershipPages, aboutPages, otherPages };
}

// ============================================================================
// Caching
// ============================================================================

/**
 * Generate cache key from URL
 */
function generateUrlHash(url: string): string {
	// Normalize URL before hashing
	const normalized = url.toLowerCase().replace(/\/$/, '');
	return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/**
 * Get cached map result if available
 */
async function getCachedMapResult(url: string): Promise<SiteMapCacheDocument | null> {
	try {
		const collection = await getSiteMapCacheCollection();
		const urlHash = generateUrlHash(url);

		const cached = await collection.findOneAndUpdate(
			{ urlHash },
			{
				$inc: { hitCount: 1 },
				$set: { lastAccessedAt: new Date() }
			},
			{ returnDocument: 'after' }
		);

		return cached;
	} catch (error) {
		console.error('[firecrawl-map] Cache lookup error:', error);
		return null;
	}
}

/**
 * Cache map result to MongoDB
 */
async function cacheMapResult(
	url: string,
	links: string[],
	leadershipPages: string[],
	aboutPages: string[],
	options: Omit<MapOptions, 'url'>
): Promise<void> {
	try {
		const collection = await getSiteMapCacheCollection();
		const urlHash = generateUrlHash(url);
		const now = new Date();

		await collection.updateOne(
			{ urlHash },
			{
				$set: {
					url,
					domain: extractDomain(url),
					links,
					leadershipPages,
					aboutPages,
					options,
					updatedAt: now,
					expiresAt: createTTL(DEFAULT_CACHE_DAYS)
				},
				$setOnInsert: {
					urlHash,
					createdAt: now,
					hitCount: 0
				}
			},
			{ upsert: true }
		);

		console.log('[firecrawl-map] Cached map result:', {
			url,
			linkCount: links.length,
			leadershipCount: leadershipPages.length
		});
	} catch (error) {
		console.error('[firecrawl-map] Cache write error:', error);
		// Don't throw - caching failure shouldn't break the flow
	}
}

// ============================================================================
// Firecrawl Map API
// ============================================================================

/**
 * Call Firecrawl Map API directly
 */
async function callFirecrawlMapApi(options: MapOptions): Promise<{ links: string[]; error?: string }> {
	const apiKey = process.env.FIRECRAWL_API_KEY;

	if (!apiKey) {
		return { links: [], error: 'Firecrawl API key not configured' };
	}

	const url = `${FIRECRAWL_BASE_URL}/map`;

	const body: Record<string, unknown> = {
		url: options.url,
		limit: options.limit ?? 100
	};

	// Add optional parameters if provided
	if (options.search) {
		body.search = options.search;
	}
	if (options.ignoreSitemap !== undefined) {
		body.ignoreSitemap = options.ignoreSitemap;
	}
	if (options.includeSubdomains !== undefined) {
		body.includeSubdomains = options.includeSubdomains;
	}

	console.log('[firecrawl-map] Calling Map API:', {
		url: options.url,
		limit: body.limit,
		hasSearch: !!options.search
	});

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify(body)
		});

		// Handle rate limiting
		if (response.status === 429) {
			const retryAfter = response.headers.get('Retry-After');
			console.warn('[firecrawl-map] Rate limited, retry after:', retryAfter);
			return {
				links: [],
				error: `Rate limited. Retry after ${retryAfter || 'unknown'} seconds.`
			};
		}

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unable to read error response');
			console.error('[firecrawl-map] API error:', response.status, errorText);
			return {
				links: [],
				error: `Firecrawl Map API error (${response.status}): ${errorText}`
			};
		}

		const data = await response.json();

		// Firecrawl Map API returns { success: boolean, links: string[] }
		if (!data.success) {
			return {
				links: [],
				error: data.error || 'Map API returned success: false'
			};
		}

		return { links: data.links || [] };
	} catch (error) {
		console.error('[firecrawl-map] Request error:', error);
		return {
			links: [],
			error: `Request failed: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Map a website to discover all URLs
 *
 * @param options - Map options including URL and optional filters
 * @returns MapResult with discovered links
 *
 * @example
 * const result = await mapSite({
 *   url: 'https://company.com',
 *   limit: 100
 * });
 * console.log(result.links);
 */
export async function mapSite(options: MapOptions): Promise<MapResult> {
	console.log('[firecrawl-map] mapSite called:', options);

	// Check cache first
	const cached = await getCachedMapResult(options.url);
	if (cached) {
		console.log('[firecrawl-map] Cache hit:', {
			url: options.url,
			linkCount: cached.links.length,
			age: Math.round((Date.now() - cached.createdAt.getTime()) / (1000 * 60 * 60))
		});

		return {
			success: true,
			links: cached.links,
			totalDiscovered: cached.links.length,
			cached: true
		};
	}

	// Call Firecrawl Map API
	const { links, error } = await callFirecrawlMapApi(options);

	if (error) {
		return {
			success: false,
			links: [],
			error
		};
	}

	// Filter and cache results
	const { leadershipPages, aboutPages } = filterLeadershipUrls(links);

	await cacheMapResult(
		options.url,
		links,
		leadershipPages,
		aboutPages,
		{
			maxDepth: options.maxDepth,
			includeSubdomains: options.includeSubdomains,
			limit: options.limit,
			search: options.search,
			ignoreSitemap: options.ignoreSitemap
		}
	);

	return {
		success: true,
		links,
		totalDiscovered: links.length,
		cached: false
	};
}

/**
 * Map a website and filter for leadership/team pages
 *
 * This is the primary function for pre-crawling leadership page discovery.
 * It maps the site and categorizes URLs into leadership, about, and other pages.
 *
 * @param options - Map options including URL and optional filters
 * @returns LeadershipMapResult with categorized URLs
 *
 * @example
 * const result = await mapSiteForLeadership({
 *   url: 'https://company.com',
 *   limit: 200
 * });
 *
 * // Prioritize leadership pages for crawling
 * const pagesToCrawl = [
 *   ...result.leadershipPages,
 *   ...result.aboutPages
 * ];
 */
export async function mapSiteForLeadership(options: MapOptions): Promise<LeadershipMapResult> {
	console.log('[firecrawl-map] mapSiteForLeadership called:', options);

	// Check cache first
	const cached = await getCachedMapResult(options.url);
	if (cached) {
		console.log('[firecrawl-map] Cache hit for leadership map:', {
			url: options.url,
			leadershipCount: cached.leadershipPages.length,
			aboutCount: cached.aboutPages.length
		});

		return {
			success: true,
			links: cached.links,
			leadershipPages: cached.leadershipPages,
			aboutPages: cached.aboutPages,
			otherPages: cached.links.filter(
				link => !cached.leadershipPages.includes(link) && !cached.aboutPages.includes(link)
			),
			totalDiscovered: cached.links.length,
			cached: true
		};
	}

	// Call Firecrawl Map API
	const { links, error } = await callFirecrawlMapApi(options);

	if (error) {
		return {
			success: false,
			links: [],
			leadershipPages: [],
			aboutPages: [],
			otherPages: [],
			error
		};
	}

	// Filter URLs
	const { leadershipPages, aboutPages, otherPages } = filterLeadershipUrls(links);

	console.log('[firecrawl-map] Filtered results:', {
		total: links.length,
		leadership: leadershipPages.length,
		about: aboutPages.length,
		other: otherPages.length
	});

	// Cache results
	await cacheMapResult(
		options.url,
		links,
		leadershipPages,
		aboutPages,
		{
			maxDepth: options.maxDepth,
			includeSubdomains: options.includeSubdomains,
			limit: options.limit,
			search: options.search,
			ignoreSitemap: options.ignoreSitemap
		}
	);

	return {
		success: true,
		links,
		leadershipPages,
		aboutPages,
		otherPages,
		totalDiscovered: links.length,
		cached: false
	};
}

/**
 * Search for leadership pages directly using Map API search
 *
 * Uses the Map API's built-in search functionality to find pages
 * matching leadership-related keywords.
 *
 * @param url - Base URL of the site to search
 * @param searchTerms - Optional custom search terms (defaults to leadership terms)
 * @returns MapResult with matching URLs
 *
 * @example
 * const result = await searchLeadershipPages('https://company.com');
 * console.log(result.links); // URLs matching leadership keywords
 */
export async function searchLeadershipPages(
	url: string,
	searchTerms?: string
): Promise<MapResult> {
	const defaultSearch = 'leadership team executive board management about';

	return mapSite({
		url,
		search: searchTerms || defaultSearch,
		limit: 50
	});
}

/**
 * Invalidate cached map result for a URL
 *
 * @param url - URL to invalidate cache for
 * @returns true if cache was invalidated
 */
export async function invalidateMapCache(url: string): Promise<boolean> {
	try {
		const collection = await getSiteMapCacheCollection();
		const urlHash = generateUrlHash(url);

		const result = await collection.deleteOne({ urlHash });
		return result.deletedCount > 0;
	} catch (error) {
		console.error('[firecrawl-map] Cache invalidation error:', error);
		return false;
	}
}

/**
 * Get cache statistics for site maps
 */
export async function getMapCacheStats(): Promise<{
	totalEntries: number;
	totalLinks: number;
	avgLinksPerSite: number;
	oldestEntry?: Date;
	newestEntry?: Date;
}> {
	try {
		const collection = await getSiteMapCacheCollection();

		const stats = await collection.aggregate([
			{
				$group: {
					_id: null,
					totalEntries: { $sum: 1 },
					totalLinks: { $sum: { $size: '$links' } },
					avgLinksPerSite: { $avg: { $size: '$links' } },
					oldestEntry: { $min: '$createdAt' },
					newestEntry: { $max: '$createdAt' }
				}
			}
		]).toArray();

		if (stats.length === 0) {
			return {
				totalEntries: 0,
				totalLinks: 0,
				avgLinksPerSite: 0
			};
		}

		return {
			totalEntries: stats[0].totalEntries,
			totalLinks: stats[0].totalLinks,
			avgLinksPerSite: Math.round(stats[0].avgLinksPerSite * 10) / 10,
			oldestEntry: stats[0].oldestEntry,
			newestEntry: stats[0].newestEntry
		};
	} catch (error) {
		console.error('[firecrawl-map] Cache stats error:', error);
		return {
			totalEntries: 0,
			totalLinks: 0,
			avgLinksPerSite: 0
		};
	}
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Ensure indexes exist for the site map cache collection
 * Should be called on server startup
 */
export async function ensureSiteMapCacheIndexes(): Promise<void> {
	try {
		const collection = await getSiteMapCacheCollection();

		console.log('[firecrawl-map] Creating site map cache indexes...');

		// TTL index for automatic cleanup
		await collection.createIndex(
			{ expiresAt: 1 },
			{ expireAfterSeconds: 0, name: 'ttl_expiresAt' }
		);

		// Unique index on URL hash for deduplication
		await collection.createIndex(
			{ urlHash: 1 },
			{ unique: true, name: 'unique_urlHash' }
		);

		// Index on domain for domain-level queries
		await collection.createIndex(
			{ domain: 1 },
			{ name: 'idx_domain' }
		);

		// Index on hit count for cache statistics
		await collection.createIndex(
			{ hitCount: -1, lastAccessedAt: -1 },
			{ name: 'idx_hitCount_lastAccessed' }
		);

		console.log('[firecrawl-map] Site map cache indexes created');
	} catch (error) {
		console.error('[firecrawl-map] Index creation error:', error);
	}
}
