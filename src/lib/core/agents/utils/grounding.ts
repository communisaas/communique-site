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

