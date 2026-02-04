/**
 * Grounding Utilities
 *
 * Extract and process Google Search grounding metadata from Gemini responses
 */

import type { GroundingMetadata, Source } from '../types';

// ============================================================================
// Source Extraction
// ============================================================================

/**
 * Extract source URLs from Gemini grounding metadata
 */
export function extractSourcesFromGrounding(metadata: GroundingMetadata): string[] {
	const chunks = metadata.groundingChunks || [];
	return chunks.map((chunk) => chunk.web?.uri).filter((uri): uri is string => !!uri);
}

// ============================================================================
// Citation Mapping
// ============================================================================

/**
 * @deprecated Google Search grounding specific. Use verifyEmailInContent for Exa-based verification.
 *
 * Build inline citations from grounding supports
 * Maps text segments to source indices
 */
export function buildCitationMap(text: string, metadata: GroundingMetadata): Map<number, number[]> {
	const citationMap = new Map<number, number[]>();
	const supports = metadata.groundingSupports || [];

	for (const support of supports) {
		const endIndex = support.segment?.endIndex;
		const indices = support.groundingChunkIndices;

		if (endIndex !== undefined && indices?.length) {
			citationMap.set(endIndex, indices);
		}
	}

	return citationMap;
}

// ============================================================================
// Citation Injection
// ============================================================================

/**
 * @deprecated Google Search grounding specific. Use verifyEmailInContent for Exa-based verification.
 *
 * Inject citation markers into text based on grounding supports
 */
export function injectCitations(text: string, metadata: GroundingMetadata): string {
	const supports = metadata.groundingSupports || [];
	const chunks = metadata.groundingChunks || [];

	// Sort by endIndex descending to inject from end (preserves indices)
	const sortedSupports = [...supports].sort(
		(a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
	);

	let result = text;

	for (const support of sortedSupports) {
		const endIndex = support.segment?.endIndex;
		const indices = support.groundingChunkIndices;

		if (endIndex === undefined || !indices?.length) continue;

		// Build citation string [1][2]
		const citations = indices
			.filter((i) => chunks[i]?.web?.uri)
			.map((i) => `[${i + 1}]`)
			.join('');

		if (citations) {
			result = result.slice(0, endIndex) + citations + result.slice(endIndex);
		}
	}

	return result;
}

// ============================================================================
// Source List Building
// ============================================================================

/**
 * Build source list from grounding chunks
 */
export function buildSourceList(metadata: GroundingMetadata): Source[] {
	const chunks = metadata.groundingChunks || [];

	return chunks
		.map((chunk, index) => {
			const uri = chunk.web?.uri;
			if (!uri) return null;
			return {
				num: index + 1,
				title: chunk.web?.title || 'Source',
				url: uri,
				type: inferSourceType(uri) as Source['type']
			};
		})
		.filter((source): source is Source => source !== null);
}

/**
 * Infer source type from URL
 */
export function inferSourceType(
	url: string
): 'government' | 'legal' | 'research' | 'advocacy' | 'journalism' {
	const urlLower = url.toLowerCase();
	if (urlLower.includes('.gov')) return 'government';
	if (urlLower.includes('law') || urlLower.includes('legal')) return 'legal';
	if (urlLower.includes('research') || urlLower.includes('.edu')) return 'research';
	if (urlLower.includes('ngo') || urlLower.includes('.org')) return 'advocacy';
	return 'journalism';
}

// ============================================================================
// Source Merging
// ============================================================================

/**
 * Merge sources from response with grounding sources
 */
export function mergeAndDeduplicateSources(
	responseSources: Source[],
	groundingSources: Source[]
): Source[] {
	const seen = new Set<string>();
	const merged: Source[] = [];

	// Add response sources first (higher priority)
	for (const source of responseSources) {
		if (!seen.has(source.url)) {
			seen.add(source.url);
			merged.push(source);
		}
	}

	// Add grounding sources with renumbered indices
	for (const source of groundingSources) {
		if (!seen.has(source.url)) {
			seen.add(source.url);
			merged.push({
				...source,
				num: merged.length + 1
			});
		}
	}

	return merged;
}

// ============================================================================
// Grounded Source Mapping for Entities
// ============================================================================

/**
 * @deprecated Google Search grounding specific. Use verifyEmailInContent for Exa-based verification.
 *
 * Find verified grounding sources for an entity by searching for its text in the response.
 *
 * This is the KEY function for preventing hallucinated sources:
 * - Instead of trusting LLM-generated URLs, we find which grounding chunks actually
 *   support the text mentioning this entity.
 * - We search for the entity's name/title/org in the raw response text
 * - We check which groundingSupports cover those text positions
 * - We return the grounding chunk URIs as verified sources
 *
 * @param entitySearchTerms - Array of strings to search for (e.g., [name, title, org])
 * @param rawResponseText - The raw text response from Gemini
 * @param metadata - Grounding metadata from the response
 * @returns Array of verified source URLs backed by grounding
 */
export function findGroundedSourcesForEntity(
	entitySearchTerms: string[],
	rawResponseText: string,
	metadata: GroundingMetadata
): string[] {
	const supports = metadata.groundingSupports || [];
	const chunks = metadata.groundingChunks || [];

	if (supports.length === 0 || chunks.length === 0) {
		return [];
	}

	// Find all positions where entity terms appear in the response
	const entityPositions: Array<{ start: number; end: number }> = [];
	const textLower = rawResponseText.toLowerCase();

	for (const term of entitySearchTerms) {
		if (!term || term.length < 3) continue;
		const termLower = term.toLowerCase();
		let pos = 0;
		while ((pos = textLower.indexOf(termLower, pos)) !== -1) {
			entityPositions.push({ start: pos, end: pos + term.length });
			pos += term.length;
		}
	}

	if (entityPositions.length === 0) {
		return [];
	}

	// Find which grounding supports overlap with entity positions
	const matchingChunkIndices = new Set<number>();

	for (const support of supports) {
		const segStart = support.segment?.startIndex ?? 0;
		const segEnd = support.segment?.endIndex ?? 0;
		const chunkIndices = support.groundingChunkIndices || [];

		// Check if this support segment overlaps with any entity position
		for (const entityPos of entityPositions) {
			// Overlap check: segments overlap if one starts before the other ends
			if (segStart <= entityPos.end && segEnd >= entityPos.start) {
				for (const idx of chunkIndices) {
					matchingChunkIndices.add(idx);
				}
			}
		}
	}

	// Extract URLs from matching chunks (deduplicated)
	const urls: string[] = [];
	const seenUrls = new Set<string>();

	for (const idx of matchingChunkIndices) {
		const chunk = chunks[idx];
		const uri = chunk?.web?.uri;
		if (uri && !seenUrls.has(uri)) {
			seenUrls.add(uri);
			urls.push(uri);
		}
	}

	return urls;
}

/**
 * Score a source URL for authority/relevance to a specific entity.
 * Higher scores = more authoritative sources.
 */
export function scoreSourceAuthority(
	url: string,
	title: string | undefined,
	entityName: string,
	entityOrganization: string
): number {
	let score = 0;
	const urlLower = url.toLowerCase();
	const titleLower = (title || '').toLowerCase();
	const nameLower = entityName.toLowerCase();
	const orgLower = entityOrganization.toLowerCase();

	// Extract domain for matching
	let domain = '';
	let domainBase = '';
	try {
		const urlObj = new URL(url);
		domain = urlObj.hostname.toLowerCase();
		// Extract base domain without TLD (e.g., "apple" from "apple.com")
		domainBase = domain.replace(/^www\./, '').split('.')[0];
	} catch {
		domain = urlLower;
		domainBase = urlLower;
	}

	// Normalize organization name - extract key words for matching
	// "Pacific Gas & Electric Company" -> ["pacific", "gas", "electric"]
	// "Apple Inc." -> ["apple"]
	const orgWords = orgLower
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter(w => w.length > 2 && !['inc', 'llc', 'corp', 'company', 'the', 'of', 'and'].includes(w));

	const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);

	// ========================================================================
	// Tier 1: Official organization sources (highest priority)
	// ========================================================================

	// Domain base matches any significant org word (e.g., "apple" matches "Apple Inc.")
	const domainMatchesOrg = orgWords.some(word =>
		domainBase.includes(word) || word.includes(domainBase)
	);

	if (domainMatchesOrg) {
		score += 100;
	}

	// Full domain contains org words (handles subdomains like investor.apple.com)
	if (!domainMatchesOrg) {
		const domainContainsOrg = orgWords.some(word => domain.includes(word));
		if (domainContainsOrg) {
			score += 70;
		}
	}

	// ========================================================================
	// Tier 2: Contact/directory pages (very high value)
	// ========================================================================

	const contactSignals = ['/contact', '/staff', '/directory', '/leadership', '/team', '/about', '/people', '/members', '/officials'];
	for (const signal of contactSignals) {
		if (urlLower.includes(signal)) {
			score += 50;
			break;
		}
	}

	// Title suggests contact/directory page
	const titleContactSignals = ['contact', 'staff', 'directory', 'leadership', 'team', 'about us', 'our people', 'meet'];
	for (const signal of titleContactSignals) {
		if (titleLower.includes(signal)) {
			score += 30;
			break;
		}
	}

	// ========================================================================
	// Tier 3: Institutional TLD boost (modest)
	// ========================================================================

	// Small boost for institutional TLDs - but not a major factor
	if (domain.endsWith('.gov')) score += 20;
	else if (domain.endsWith('.edu')) score += 15;
	else if (domain.endsWith('.org')) score += 10;

	// ========================================================================
	// Tier 4: Entity name appears in URL/title
	// ========================================================================

	// URL contains person's name
	for (const word of nameWords) {
		if (urlLower.includes(word)) {
			score += 20;
			break;
		}
	}

	// Title contains person's name (strong signal this page is about them)
	for (const word of nameWords) {
		if (titleLower.includes(word)) {
			score += 25;
			break;
		}
	}

	// Full name in title is very strong
	if (titleLower.includes(nameLower)) {
		score += 15;
	}

	// ========================================================================
	// Tier 5: Contact-likelihood boost
	// ========================================================================

	// These sources are good for verifying identity but unlikely to have email addresses
	// We don't penalize them - we just give extra boost to contact-likely sources

	// Official press release pages often have contact info
	if (urlLower.includes('/press') || urlLower.includes('/news') || urlLower.includes('/media')) {
		if (domain.endsWith('.gov') || domain.endsWith('.edu') || domainMatchesOrg) {
			// Press page on official org site - likely has media contact
			score += 15;
		}
	}

	return score;
}

// ============================================================================
// Content-based Email Verification (Exa Search)
// ============================================================================

/**
 * Result of content-based email verification
 */
export interface ContentEmailVerification {
	/** The email that was checked */
	email: string;
	/** Whether the email was found verbatim in page content */
	verified: boolean;
	/** URL of the page containing the email */
	sourceUrl?: string;
	/** Title of the page containing the email */
	sourceTitle?: string;
}

/**
 * Verify an email appears verbatim in fetched page content.
 *
 * Dramatically simpler than grounding-based verification: checks if the email
 * string appears in any of the provided page contents and returns the most
 * authoritative source.
 *
 * @param email - Email address to verify
 * @param pages - Fetched page contents to search through
 * @param entityName - Person's name (for source authority ranking)
 * @param entityOrganization - Organization name (for source authority ranking)
 * @returns Verification result with source URL if found
 */
export function verifyEmailInContent(
	email: string,
	pages: Array<{ url: string; title: string; text: string }>,
	entityName?: string,
	entityOrganization?: string
): ContentEmailVerification {
	if (!email || email === 'NO_EMAIL_FOUND' || !email.includes('@')) {
		return { email: email || '', verified: false };
	}

	const emailLower = email.toLowerCase();

	// Find all pages containing this email
	const matchingPages = pages.filter(p =>
		p.text.toLowerCase().includes(emailLower)
	);

	if (matchingPages.length === 0) {
		return { email, verified: false };
	}

	// Single match — return immediately
	if (matchingPages.length === 1) {
		return {
			email,
			verified: true,
			sourceUrl: matchingPages[0].url,
			sourceTitle: matchingPages[0].title
		};
	}

	// Multiple matches — rank by authority score and pick best
	const ranked = matchingPages
		.map(p => ({
			url: p.url,
			title: p.title,
			score: scoreSourceAuthority(p.url, p.title, entityName || '', entityOrganization || '')
		}))
		.sort((a, b) => b.score - a.score);

	return {
		email,
		verified: true,
		sourceUrl: ranked[0].url,
		sourceTitle: ranked[0].title
	};
}

/**
 * @deprecated Google Search grounding specific. Use verifyEmailInContent for Exa-based verification.
 *
 * Find the best single source for an entity from grounding metadata.
 *
 * Uses sophisticated scoring to prioritize:
 * 1. Official organization pages (organization's own website)
 * 2. Contact/staff/directory pages
 * 3. Government/education/nonprofit TLDs
 * 4. Pages that mention the person by name
 * 5. Deprioritizes news articles and social media
 */
export function findBestGroundedSource(
	entitySearchTerms: string[],
	rawResponseText: string,
	metadata: GroundingMetadata,
	entityName?: string,
	entityOrganization?: string
): string {
	const sources = findGroundedSourcesForEntity(entitySearchTerms, rawResponseText, metadata);

	if (sources.length === 0) {
		return '';
	}

	// If we don't have entity info, fall back to simple TLD preference
	if (!entityName || !entityOrganization) {
		const official = sources.find((url) => {
			const lower = url.toLowerCase();
			return lower.includes('.gov') || lower.includes('.edu') || lower.includes('.org');
		});
		return official || sources[0];
	}

	// Get titles for each source from grounding chunks
	const chunks = metadata.groundingChunks || [];
	const sourceWithScores = sources.map(url => {
		const chunk = chunks.find(c => c.web?.uri === url);
		const title = chunk?.web?.title;
		const score = scoreSourceAuthority(url, title, entityName, entityOrganization);
		return { url, title, score };
	});

	// Sort by score descending
	sourceWithScores.sort((a, b) => b.score - a.score);

	const best = sourceWithScores[0];
	if (best.score > 0) {
		console.log(`[grounding] Best source for ${entityName}: ${best.url} (score: ${best.score})`);
	}

	return best.url;
}

// ============================================================================
// Email-Specific Grounding Verification
// ============================================================================

/**
 * Result of verifying whether an email address is grounded in search results
 */
export interface EmailGroundingResult {
	/** The email address checked */
	email: string;
	/** Whether the email appears in a grounded text segment */
	isGrounded: boolean;
	/** Source URL that contains this email (if grounded) */
	sourceUrl?: string;
	/** Title of the source (if grounded) */
	sourceTitle?: string;
	/** The grounded text segment containing this email */
	segmentText?: string;
	/** Confidence score from grounding metadata (0-1, if available) */
	confidence?: number;
}

/**
 * @deprecated Google Search grounding specific. Use verifyEmailInContent for Exa-based verification.
 *
 * Verify whether a specific email address is grounded in the response.
 *
 * This is CRITICAL for preventing email hallucination:
 * - We check if the email itself (not just the person's name) appears in a grounded segment
 * - If the email appears in the response but ISN'T grounded, it was likely pattern-inferred
 * - Only grounded emails should be trusted as verified
 * - When multiple sources contain the email, we pick the most authoritative one
 *
 * @param email - The email address to verify
 * @param rawResponseText - The raw text response from Gemini
 * @param metadata - Grounding metadata from the response
 * @param entityName - Person's name (for source ranking)
 * @param entityOrganization - Person's organization (for source ranking)
 * @returns EmailGroundingResult with verification status and source info
 */
export function verifyEmailGrounding(
	email: string,
	rawResponseText: string,
	metadata: GroundingMetadata,
	entityName?: string,
	entityOrganization?: string
): EmailGroundingResult {
	const supports = metadata.groundingSupports || [];
	const chunks = metadata.groundingChunks || [];

	// Handle NO_EMAIL_FOUND sentinel
	if (!email || email === 'NO_EMAIL_FOUND' || email.toUpperCase() === 'NO_EMAIL_FOUND') {
		return { email, isGrounded: false };
	}

	// Find where email appears in response text
	const emailLower = email.toLowerCase();
	const textLower = rawResponseText.toLowerCase();
	const emailPos = textLower.indexOf(emailLower);

	if (emailPos === -1) {
		// Email not found in response text at all
		// This can happen if email is only in JSON structure, not prose
		// Try a more lenient search - check if email domain appears grounded
		const domain = email.split('@')[1];
		if (domain) {
			const domainPos = textLower.indexOf(domain.toLowerCase());
			if (domainPos !== -1) {
				// Domain found, check if it's grounded
				for (const support of supports) {
					const segStart = support.segment?.startIndex ?? 0;
					const segEnd = support.segment?.endIndex ?? 0;

					if (segStart <= domainPos && segEnd >= domainPos + domain.length) {
						const chunkIdx = support.groundingChunkIndices?.[0];
						const chunk = chunks[chunkIdx ?? -1];
						const confidence = support.confidenceScores?.[0];

						return {
							email,
							isGrounded: false, // Domain grounded, but not full email
							sourceUrl: chunk?.web?.uri,
							sourceTitle: chunk?.web?.title,
							segmentText: rawResponseText.slice(segStart, segEnd),
							confidence
						};
					}
				}
			}
		}
		return { email, isGrounded: false };
	}

	const emailEnd = emailPos + email.length;

	// Collect ALL grounding sources that contain this email
	interface MatchingSource {
		url: string;
		title?: string;
		segmentText: string;
		confidence?: number;
		score: number;
	}
	const matchingSources: MatchingSource[] = [];

	for (const support of supports) {
		const segStart = support.segment?.startIndex ?? 0;
		const segEnd = support.segment?.endIndex ?? 0;

		// Does this support segment contain the email?
		if (segStart <= emailPos && segEnd >= emailEnd) {
			// Email is within a grounded segment - collect all linked chunks
			const chunkIndices = support.groundingChunkIndices || [];
			const confidenceScores = support.confidenceScores || [];

			for (let i = 0; i < chunkIndices.length; i++) {
				const chunkIdx = chunkIndices[i];
				const chunk = chunks[chunkIdx];
				if (!chunk?.web?.uri) continue;

				const url = chunk.web.uri;
				const title = chunk.web.title;

				// Score this source for authority
				const score = entityName && entityOrganization
					? scoreSourceAuthority(url, title, entityName, entityOrganization)
					: 0;

				matchingSources.push({
					url,
					title,
					segmentText: rawResponseText.slice(segStart, Math.min(segEnd, segStart + 200)),
					confidence: confidenceScores[i],
					score
				});
			}
		}
	}

	if (matchingSources.length === 0) {
		// Email found in text but not in any grounded segment
		console.log(`[grounding] Email "${email}" found in response but NOT GROUNDED (likely inferred)`);
		return { email, isGrounded: false };
	}

	// Sort by authority score and pick the best source
	matchingSources.sort((a, b) => b.score - a.score);
	const best = matchingSources[0];

	console.log(`[grounding] Email "${email}" is GROUNDED from ${best.url} (score: ${best.score}, ${matchingSources.length} sources found)`);

	return {
		email,
		isGrounded: true,
		sourceUrl: best.url,
		sourceTitle: best.title,
		segmentText: best.segmentText,
		confidence: best.confidence
	};
}

/**
 * Batch verify multiple emails and return summary statistics
 */
export function verifyEmailsGrounding(
	emails: string[],
	rawResponseText: string,
	metadata: GroundingMetadata
): {
	results: EmailGroundingResult[];
	summary: {
		total: number;
		grounded: number;
		ungrounded: number;
		noEmail: number;
	};
} {
	const results = emails.map((email) => verifyEmailGrounding(email, rawResponseText, metadata));

	const grounded = results.filter((r) => r.isGrounded).length;
	const noEmail = results.filter(
		(r) => !r.email || r.email === 'NO_EMAIL_FOUND'
	).length;
	const ungrounded = results.length - grounded - noEmail;

	return {
		results,
		summary: {
			total: results.length,
			grounded,
			ungrounded,
			noEmail
		}
	};
}
