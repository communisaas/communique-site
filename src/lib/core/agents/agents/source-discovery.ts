/**
 * Source Discovery Agent — Two-Phase Source Verification
 *
 * Phase 1 (Source Discovery): Search for sources on the topic using Google Search grounding.
 *   - Grounding enabled to get REAL URLs from search results.
 *   - Extracts actual URLs, titles, and relevance from search.
 *   - Returns discovered sources with metadata.
 *
 * Phase 2 (URL Validation): Verify each URL is accessible.
 *   - HEAD requests to confirm URLs exist.
 *   - Filters out broken/inaccessible URLs.
 *   - Returns verified source pool for message generation.
 *
 * This mirrors the decision-maker two-phase pattern:
 * discover → verify → present
 */

import { generateWithThoughts } from '../gemini-client';
import type { TokenUsage } from '../types';
import { extractJsonFromGroundingResponse, isSuccessfulExtraction } from '../utils/grounding-json';
import { validateUrls } from '../utils/url-validator';

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredSource {
	/** Citation number for the message */
	num: number;
	/** Article/page title */
	title: string;
	/** Actual URL from search results */
	url: string;
	/** Source type for categorization */
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy' | 'other';
	/** Brief description of what this source covers */
	snippet: string;
	/** How this source supports the message */
	relevance: string;
	/** Publication date if available */
	date?: string;
	/** Publisher/organization name */
	publisher?: string;
}

export interface VerifiedSource extends DiscoveredSource {
	/** URL was validated as accessible */
	validated: true;
	/** HTTP status code from validation */
	statusCode: number;
}

export interface SourceDiscoveryResult {
	/** All sources discovered from search */
	discovered: DiscoveredSource[];
	/** Sources that passed URL validation */
	verified: VerifiedSource[];
	/** Sources that failed validation (for debugging) */
	failed: Array<{ source: DiscoveredSource; error: string }>;
	/** Search queries used */
	searchQueries: string[];
	/** Total discovery time in ms */
	latencyMs: number;
	/** Token usage from the source discovery LLM call */
	tokenUsage?: TokenUsage;
}

export interface SourceDiscoveryOptions {
	/** Core message/topic to research */
	coreMessage: string;
	/** Subject line for context */
	subjectLine: string;
	/** Topic tags for search refinement */
	topics: string[];
	/** Geographic scope for local sources */
	geographicScope?: {
		type: 'international' | 'nationwide' | 'subnational';
		country?: string;
		subdivision?: string;
		locality?: string;
	};
	/** Minimum number of verified sources to return */
	minSources?: number;
	/** Maximum sources to discover (before validation) */
	maxSources?: number;
	/** Callback for streaming thoughts */
	onThought?: (thought: string) => void;
	/** Callback for phase updates */
	onPhase?: (phase: 'discover' | 'validate' | 'complete', message: string) => void;
}

// ============================================================================
// Prompts
// ============================================================================

const SOURCE_DISCOVERY_SYSTEM_PROMPT = `You are a research assistant finding credible sources for civic messages.

## Your Task

Search for high-quality sources that support the user's position. Return ONLY sources you find through search—never fabricate URLs.

## Source Quality Hierarchy

1. **Government sources** (.gov, official reports) — highest credibility
2. **Academic research** (peer-reviewed, .edu) — strong evidence
3. **Established journalism** (major outlets with fact-checking) — timely reporting
4. **Legal documents** (court filings, legislation) — authoritative
5. **Advocacy organizations** (if well-sourced) — issue expertise

## Search Strategy

Generate 3-5 targeted search queries:
- Include location if the issue is local
- Use specific terminology from the topic
- Include the current year in queries for legislation, policy changes, and government actions
- At least one query should target recent developments (e.g., "[topic] latest [YEAR]")
- Look for official government sources first

## Output Format

Return JSON with sources found through search:

{
  "search_queries": ["query 1", "query 2", ...],
  "sources": [
    {
      "num": 1,
      "title": "Exact title from search result",
      "url": "Exact URL from search result",
      "type": "journalism|research|government|legal|advocacy|other",
      "snippet": "Brief description of content",
      "relevance": "How this supports the message",
      "date": "Publication date if visible",
      "publisher": "Source organization"
    }
  ]
}

## Critical Rules

1. ONLY return URLs you found in search results
2. Copy URLs EXACTLY as they appear—do not modify or construct URLs
3. Tiered recency: news and government actions within last 6 months; research and data within last 2 years. More recent is always better.
4. Prioritize primary sources over aggregators
5. Include at least one government or academic source if available`;

// ============================================================================
// Main Discovery Function
// ============================================================================

/**
 * Discover and verify sources for a civic message
 *
 * Two-phase approach:
 * 1. Search for sources using Google Search grounding
 * 2. Validate each URL is accessible
 */
export async function discoverSources(
	options: SourceDiscoveryOptions
): Promise<SourceDiscoveryResult> {
	const startTime = Date.now();
	const { coreMessage, subjectLine, topics, geographicScope, onThought, onPhase } = options;
	const minSources = options.minSources ?? 3;
	const maxSources = options.maxSources ?? 8;

	console.log('[source-discovery] Starting two-phase source discovery...');
	console.log('[source-discovery] Topic:', subjectLine);

	// Build location context for search
	let locationContext = '';
	if (geographicScope) {
		if (geographicScope.locality) {
			locationContext = `Location: ${geographicScope.locality}, ${geographicScope.subdivision || ''} ${geographicScope.country || ''}`.trim();
		} else if (geographicScope.subdivision) {
			locationContext = `Location: ${geographicScope.subdivision}, ${geographicScope.country || ''}`.trim();
		} else if (geographicScope.country) {
			locationContext = `Location: ${geographicScope.country}`;
		}
	}

	// Build temporal context
	const currentDate = new Date().toISOString().split('T')[0];
	const currentYear = new Date().getFullYear();

	const prompt = `Today is ${currentDate}. Current year: ${currentYear}.

Find credible sources for this civic message:

Subject: ${subjectLine}
Core Message: ${coreMessage}
Topics: ${topics.join(', ')}
${locationContext ? `\n${locationContext}` : ''}

Search for ${maxSources} high-quality sources. Prioritize:
- Recent developments, actions, or decisions related to this issue
- Government reports or official sources
- Local news coverage (if applicable)
- Data and academic research

Include at least one search targeting recent activity (use ${currentYear} in the query).

Return the sources you find through search.`;

	// ====================================================================
	// Phase 1: Source Discovery with Google Search Grounding
	// ====================================================================

	onPhase?.('discover', 'Searching for credible sources...');

	console.log('[source-discovery] Phase 1: Discovering sources with grounding...');

	interface DiscoveryResponse {
		search_queries: string[];
		sources: DiscoveredSource[];
	}

	const result = await generateWithThoughts<DiscoveryResponse>(
		prompt,
		{
			systemInstruction: SOURCE_DISCOVERY_SYSTEM_PROMPT,
			temperature: 0.3,
			thinkingLevel: 'medium',
			enableGrounding: true, // Critical: enables real web search
			maxOutputTokens: 65536 // Maximum for Gemini 2.5+ to prevent truncation
		},
		onThought
	);

	const extraction = extractJsonFromGroundingResponse<DiscoveryResponse>(result.rawText || '{}');

	if (!isSuccessfulExtraction(extraction)) {
		// Log technical details for debugging (visible in browser console)
		console.error('[source-discovery] Phase 1 JSON extraction failed:', {
			error: extraction.error,
			rawTextLength: result.rawText?.length,
			rawTextTail: result.rawText?.slice(-200)
		});
		// User-friendly error - doesn't break their vibe
		throw new Error('Our research service hit a snag. Please try again.');
	}

	const discovered = extraction.data?.sources || [];
	const searchQueries = extraction.data?.search_queries || [];

	console.log('[source-discovery] Phase 1 complete:', {
		sourcesFound: discovered.length,
		queries: searchQueries
	});

	if (discovered.length === 0) {
		onPhase?.('complete', 'No sources found through search');
		return {
			discovered: [],
			verified: [],
			failed: [],
			searchQueries,
			latencyMs: Date.now() - startTime,
			tokenUsage: result.tokenUsage,
		};
	}

	// Number sources sequentially
	discovered.forEach((source, index) => {
		source.num = index + 1;
	});

	// Bridging thought
	if (onThought) {
		onThought(
			`Found ${discovered.length} potential sources. Now validating URLs are accessible...`
		);
	}

	// ====================================================================
	// Phase 2: URL Validation
	// ====================================================================

	onPhase?.('validate', `Validating ${discovered.length} source URLs...`);

	console.log('[source-discovery] Phase 2: Validating URLs...');

	const urls = discovered.map((s) => s.url);
	const validationResults = await validateUrls(urls);

	const verified: VerifiedSource[] = [];
	const failed: Array<{ source: DiscoveredSource; error: string }> = [];

	for (let i = 0; i < discovered.length; i++) {
		const source = discovered[i];
		const validation = validationResults[i];

		if (validation.isValid) {
			verified.push({
				...source,
				validated: true,
				statusCode: validation.statusCode || 200,
				// Update URL if redirect occurred
				url: validation.finalUrl || source.url
			});
		} else {
			failed.push({
				source,
				error: validation.error || `HTTP ${validation.statusCode}`
			});
			console.warn(
				`[source-discovery] URL validation failed: ${source.url} - ${validation.error}`
			);
		}
	}

	// Renumber verified sources
	verified.forEach((source, index) => {
		source.num = index + 1;
	});

	const latencyMs = Date.now() - startTime;

	console.log('[source-discovery] Phase 2 complete:', {
		discovered: discovered.length,
		verified: verified.length,
		failed: failed.length,
		latencyMs
	});

	// Check if we have enough sources
	if (verified.length < minSources) {
		console.warn(
			`[source-discovery] Only ${verified.length} verified sources (wanted ${minSources})`
		);
	}

	onPhase?.('complete', `Verified ${verified.length} of ${discovered.length} sources`);

	return {
		discovered,
		verified,
		failed,
		searchQueries,
		latencyMs,
		tokenUsage: result.tokenUsage,
	};
}

/**
 * Parse a date string and return days since that date, or null if unparseable.
 * Handles ISO, English date formats, and partial dates (e.g., "January 2026").
 */
function daysSince(dateStr: string | undefined): number | null {
	if (!dateStr || dateStr === 'Unknown') return null;
	const parsed = new Date(dateStr);
	if (isNaN(parsed.getTime())) return null;
	return Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format verified sources for inclusion in message generation prompt.
 * Sources are sorted by freshness (most recent first) and annotated
 * with days-ago to give the message writer unambiguous recency signals.
 */
export function formatSourcesForPrompt(sources: VerifiedSource[]): string {
	if (sources.length === 0) {
		return 'No verified sources available. Write the message without citations.';
	}

	// Calculate freshness for each source
	const withAge = sources.map((s) => ({ source: s, age: daysSince(s.date) }));

	// Sort: known-recent first, then known-older, then unknown-date last
	withAge.sort((a, b) => {
		if (a.age === null && b.age === null) return 0;
		if (a.age === null) return 1;
		if (b.age === null) return -1;
		return a.age - b.age;
	});

	// Build freshness summary
	const knownAges = withAge.filter((w) => w.age !== null);
	const recentCount = knownAges.filter((w) => w.age! <= 30).length;
	const freshest = knownAges.length > 0 ? knownAges[0].age : null;
	const freshnessSummary =
		freshest !== null
			? `Freshest source: ${freshest} days old. ${recentCount} of ${sources.length} sources from the last 30 days.`
			: '';

	const formatted = withAge
		.map(({ source: s, age }) => {
			const dateField = s.date || 'Unknown';
			const ageAnnotation = age !== null ? ` (${age} days ago)` : '';
			return `[${s.num}] ${s.title}
   URL: ${s.url}
   Type: ${s.type}
   Publisher: ${s.publisher || 'Unknown'}
   Date: ${dateField}${ageAnnotation}
   Relevance: ${s.relevance}
   Snippet: ${s.snippet}`;
		})
		.join('\n\n');

	return `## Verified Sources (cite using [1], [2], etc.)
${freshnessSummary ? `\n${freshnessSummary}\n` : ''}
${formatted}

IMPORTANT: You may ONLY cite sources from this list. Use the exact URLs provided.
Do not fabricate or modify URLs. If a source doesn't fit, don't cite it.`;
}
