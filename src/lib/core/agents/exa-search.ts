/**
 * Exa Search Domain Service
 *
 * Orchestrates Exa API calls for discovering decision-maker role holders.
 * Groups roles by organization to minimize search count, constructs targeted
 * queries, and fetches page contents for contact extraction.
 *
 * Two-step workflow:
 * 1. searchForRoleHolders() - Metadata-only search ($0.005/search for 1-25 results)
 * 2. fetchPageContents() - Full content for selected URLs ($0.001/page)
 *
 * @module agents/exa-search
 */

import { getExaClient, getSearchRateLimiter, getContentsRateLimiter } from '$lib/server/exa';
import type { ThoughtEmitter } from '$lib/core/thoughts/emitter';
import type { ActionTargetType } from '$lib/core/thoughts/types';

// ============================================================================
// Types
// ============================================================================

/** A single search result from Exa (metadata only, no content) */
export interface ExaSearchHit {
	url: string;
	title: string;
	publishedDate?: string;
	author?: string;
	score?: number;
}

/** Results for one organization's search (may cover multiple roles) */
export interface ExaOrgSearchResult {
	organization: string;
	roleIndices: number[];  // indices into the original roles array
	hits: ExaSearchHit[];
	query: string;
}

/** Resolved page content from Exa */
export interface ExaPageContent {
	url: string;
	title: string;
	text: string;           // markdown content
	publishedDate?: string;
	statusCode?: number;
}

/** Options for search operations */
export interface ExaSearchOptions {
	currentYear: string;
	emitter?: ThoughtEmitter;
	maxSearches?: number;     // default: 5
	resultsPerSearch?: number; // default: 25 (max before 5x price jump at 26)
}

/** Options for content fetching */
export interface ExaContentOptions {
	emitter?: ThoughtEmitter;
	maxCharacters?: number;   // default: 10000
}

/** Role discovered in Phase 1 (matches gemini-provider.ts internal type) */
export interface DiscoveredRole {
	position: string;
	organization: string;
	jurisdiction: string;
	reasoning: string;
	search_query: string;
}

// ============================================================================
// Organization Normalization
// ============================================================================

/** Suffixes to strip when normalizing organization names for grouping */
const ORG_SUFFIXES = /\b(inc\.?|llc\.?|corp\.?|corporation|company|co\.?|ltd\.?|limited|plc|l\.?p\.?|group|holdings)\b/gi;

/**
 * Normalize an organization name for grouping comparison.
 * Strips legal suffixes, lowercases, and trims whitespace.
 */
function normalizeOrgName(org: string): string {
	return org
		.toLowerCase()
		.replace(ORG_SUFFIXES, '')
		.replace(/[.,]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

// ============================================================================
// Target Type Inference
// ============================================================================

/**
 * Infer an ActionTargetType from an organization name for thought emission.
 * Returns undefined if no clear type can be determined.
 */
function inferTargetType(organization: string): ActionTargetType | undefined {
	const org = organization.toLowerCase();

	if (org.includes('congress') || org.includes('senate') || org.includes('house of representatives')) {
		return 'congress';
	}
	if (org.includes('state legislature') || org.includes('state assembly') || org.includes('state senate')) {
		return 'state_legislature';
	}
	if (
		org.includes('city of') ||
		org.includes('county of') ||
		org.includes('town of') ||
		org.includes('borough of') ||
		org.includes('municipality') ||
		org.includes('city council') ||
		org.includes('board of supervisors')
	) {
		return 'local_government';
	}
	if (org.includes('university') || org.includes('college') || org.includes('school district')) {
		return 'education';
	}
	if (org.includes('hospital') || org.includes('health') || org.includes('medical center')) {
		return 'healthcare';
	}
	if (org.includes('union') || org.includes('labor') || org.includes('workers')) {
		return 'labor';
	}
	if (org.includes('news') || org.includes('media') || org.includes('press') || org.includes('broadcast')) {
		return 'media';
	}
	if (org.endsWith(' foundation') || org.includes('nonprofit') || org.includes('non-profit') || org.includes('ngo')) {
		return 'nonprofit';
	}

	return undefined;
}

// ============================================================================
// Query Construction
// ============================================================================

/**
 * Extract key role terms from a position title.
 * Strips common filler words and returns distinctive terms.
 */
function extractRoleKeywords(positions: string[]): string {
	const stopWords = new Set([
		'of', 'the', 'and', 'for', 'in', 'on', 'at', 'to', 'a', 'an', 'or'
	]);

	const keywords = new Set<string>();

	for (const position of positions) {
		const words = position.split(/\s+/);
		for (const word of words) {
			const cleaned = word.replace(/[^a-zA-Z]/g, '');
			if (cleaned.length > 2 && !stopWords.has(cleaned.toLowerCase())) {
				keywords.add(cleaned);
			}
		}
	}

	return Array.from(keywords).join(' ');
}

/**
 * Build a search query for a group of roles at one organization.
 */
function buildSearchQuery(
	organization: string,
	positions: string[],
	currentYear: string
): string {
	const roleKeywords = extractRoleKeywords(positions);
	return `${organization} leadership staff contact ${roleKeywords} ${currentYear}`;
}

// ============================================================================
// Role Grouping
// ============================================================================

interface OrgGroup {
	/** Display name (original casing from first role encountered) */
	displayName: string;
	/** Indices into the original roles array */
	roleIndices: number[];
	/** Position titles in this group */
	positions: string[];
}

/**
 * Group roles by normalized organization name.
 * Returns groups ordered by number of roles (descending) to prioritize
 * organizations with more relevant positions.
 */
function groupRolesByOrganization(roles: DiscoveredRole[]): OrgGroup[] {
	const groups = new Map<string, OrgGroup>();

	for (let i = 0; i < roles.length; i++) {
		const role = roles[i];
		const normalized = normalizeOrgName(role.organization);

		const existing = groups.get(normalized);
		if (existing) {
			existing.roleIndices.push(i);
			existing.positions.push(role.position);
		} else {
			groups.set(normalized, {
				displayName: role.organization,
				roleIndices: [i],
				positions: [role.position]
			});
		}
	}

	// Sort by number of roles descending so highest-value orgs get searched first
	return Array.from(groups.values()).sort(
		(a, b) => b.roleIndices.length - a.roleIndices.length
	);
}

// ============================================================================
// Function 1: searchForRoleHolders
// ============================================================================

/**
 * Search Exa for people who hold specific positions at organizations.
 *
 * Groups roles by organization to minimize search count, then executes
 * metadata-only searches (no content, cheapest tier).
 *
 * @param roles - Discovered roles from Phase 1
 * @param options - Search configuration (year, emitter, limits)
 * @returns Array of per-organization search results
 */
export async function searchForRoleHolders(
	roles: DiscoveredRole[],
	options: ExaSearchOptions
): Promise<ExaOrgSearchResult[]> {
	if (roles.length === 0) {
		return [];
	}

	const maxSearches = options.maxSearches ?? 5;
	const resultsPerSearch = options.resultsPerSearch ?? 25;

	// Group roles by organization
	const orgGroups = groupRolesByOrganization(roles);

	// Determine which groups get individual searches vs. batched queries
	let searchGroups: Array<{
		organization: string;
		roleIndices: number[];
		positions: string[];
	}>;

	// Map OrgGroups to the search group format
	const toSearchGroup = (g: OrgGroup) => ({
		organization: g.displayName,
		roleIndices: g.roleIndices,
		positions: g.positions
	});

	if (orgGroups.length <= maxSearches) {
		// Each org gets its own search
		searchGroups = orgGroups.map(toSearchGroup);
	} else {
		// Top (maxSearches - 1) orgs get individual searches,
		// remaining orgs are batched into one broader query
		const individual = orgGroups.slice(0, maxSearches - 1).map(toSearchGroup);
		const remaining = orgGroups.slice(maxSearches - 1);

		const batchedIndices: number[] = [];
		const batchedPositions: string[] = [];
		const batchedOrgNames: string[] = [];

		for (const group of remaining) {
			batchedIndices.push(...group.roleIndices);
			batchedPositions.push(...group.positions);
			batchedOrgNames.push(group.displayName);
		}

		searchGroups = [
			...individual,
			{
				organization: batchedOrgNames.join(', '),
				roleIndices: batchedIndices,
				positions: batchedPositions
			}
		];
	}

	// Execute searches with rate limiting
	const exa = getExaClient();
	const searchRateLimiter = getSearchRateLimiter();
	const results: ExaOrgSearchResult[] = [];

	// Build search functions for rate-limited execution
	const searchFunctions = searchGroups.map((group) => {
		const query = buildSearchQuery(
			group.organization,
			group.positions,
			options.currentYear
		);

		return async (): Promise<ExaOrgSearchResult> => {
			// Start thought trace for this search
			const targetType = inferTargetType(group.organization);
			const research = options.emitter?.startResearch(group.organization, targetType);

			console.log(`[exa-search] Searching: "${query}"`);

			const response = await exa.search(query, {
				numResults: resultsPerSearch,
				type: 'auto',
				contents: false as const
			});

			// Map SDK results to ExaSearchHit format
			const hits: ExaSearchHit[] = response.results.map((result) => ({
				url: result.url,
				title: result.title || '',
				publishedDate: result.publishedDate,
				author: result.author,
				score: result.score
			}));

			// Emit thought traces for each result
			for (const hit of hits) {
				research?.addPage?.(hit.url, hit.title, true);
			}
			research?.addFinding(`Found ${hits.length} results for ${group.organization}`);
			research?.complete(`Search complete for ${group.organization}`);

			return {
				organization: group.organization,
				roleIndices: group.roleIndices,
				hits,
				query
			};
		};
	});

	// Execute with staggered timing to respect rate limits
	const rateLimitedResults = await searchRateLimiter.executeStaggered(
		searchFunctions,
		'exa-role-search'
	);

	// Process results, handling rate limiter wrapper
	for (let i = 0; i < rateLimitedResults.length; i++) {
		const result = rateLimitedResults[i];
		const group = searchGroups[i];
		const query = buildSearchQuery(group.organization, group.positions, options.currentYear);

		if (result.success && result.data) {
			results.push(result.data);

			if (result.wasRateLimited) {
				console.log(`[exa-search] Search for "${group.organization}" succeeded after rate limit retry`);
			}
		} else {
			// Log failure and emit error thought
			const targetType = inferTargetType(group.organization);
			const research = options.emitter?.startResearch(group.organization, targetType);
			research?.error(`Search failed: ${result.error || 'Unknown error'}`);

			console.error(`[exa-search] Search failed for "${group.organization}":`, result.error);

			// Return empty result so pipeline can continue
			results.push({
				organization: group.organization,
				roleIndices: group.roleIndices,
				hits: [],
				query
			});
		}
	}

	console.log(
		`[exa-search] Completed ${results.length} searches, total hits: ${results.reduce((sum, r) => sum + r.hits.length, 0)}`
	);

	return results;
}

// ============================================================================
// Function 2: fetchPageContents
// ============================================================================

/**
 * Fetch full page content from Exa for a set of URLs.
 *
 * Uses livecrawl: 'preferred' to get fresh content from government sites
 * that may require JavaScript rendering. Returns markdown text suitable
 * for email/contact extraction.
 *
 * @param urls - URLs to fetch content from
 * @param options - Content fetching configuration
 * @returns Array of successfully fetched page contents
 */
export async function fetchPageContents(
	urls: string[],
	options?: ExaContentOptions
): Promise<ExaPageContent[]> {
	if (urls.length === 0) {
		return [];
	}

	const maxCharacters = options?.maxCharacters ?? 10000;

	const action = options?.emitter?.startAction(
		'search',
		`Fetching content from ${urls.length} pages...`
	);

	const exa = getExaClient();
	const contentsRateLimiter = getContentsRateLimiter();

	console.log(`[exa-search] Fetching contents for ${urls.length} URLs`);

	// Execute with rate limiting and retry
	const result = await contentsRateLimiter.execute(
		async () => exa.getContents(urls, {
			text: { maxCharacters },
			livecrawl: 'preferred'
		}),
		`exa-contents-${urls.length}-urls`
	);

	if (!result.success) {
		console.error('[exa-search] Content fetch failed:', result.error);
		action?.error(`Content fetch failed: ${result.error}`);
		return [];
	}

	if (result.wasRateLimited) {
		console.log(`[exa-search] Content fetch succeeded after rate limit retry (${result.attempts} attempts)`);
	}

	// Map results to ExaPageContent, filtering out failures
	const contents: ExaPageContent[] = [];

	for (const apiResult of result.data!.results) {
		if (!apiResult.text) {
			console.log(`[exa-search] No text content for ${apiResult.url}, skipping`);
			continue;
		}

		contents.push({
			url: apiResult.url,
			title: apiResult.title || '',
			text: apiResult.text,
			publishedDate: apiResult.publishedDate
		});
	}

	const successCount = contents.length;
	const failedCount = urls.length - successCount;

	if (failedCount > 0) {
		console.log(`[exa-search] ${failedCount}/${urls.length} URLs returned no content`);
	}

	action?.addFinding(`Retrieved content from ${successCount}/${urls.length} pages`);
	action?.complete(`Content fetched: ${successCount} pages`);

	return contents;
}
