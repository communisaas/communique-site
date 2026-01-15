/**
 * Phase 3: Decision-Maker Validation & Merge
 *
 * Filters enriched candidates to only those with verified emails,
 * validates email format and domain plausibility, merges Phase 1+2 data,
 * and sorts by combined confidence.
 *
 * NO API CALLS - Pure transformation logic only.
 */

import type { EnrichedDecisionMaker, ValidatedDecisionMaker } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Known generic email domains that are acceptable for decision-makers
 * (government officials, executives sometimes use personal emails publicly)
 */
const KNOWN_GENERIC_DOMAINS = [
	'senate.gov',
	'house.gov',
	'state.gov',
	'congress.gov',
	'gov.uk',
	'gov.au',
	'gov.ca',
	'gmail.com',
	'outlook.com',
	'hotmail.com',
	'yahoo.com'
];

/**
 * Email format validation regex
 * Basic check for: local-part@domain.tld
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Extract possible domain patterns from organization name
 *
 * @example
 * extractDomainFromOrg("Amazon") -> ["amazon"]
 * extractDomainFromOrg("U.S. Senate") -> ["senate", "gov"]
 * extractDomainFromOrg("Stanford University") -> ["stanford", "edu"]
 *
 * @param org - Organization name
 * @returns Array of possible domain patterns (lowercase, no spaces)
 */
function extractDomainFromOrg(org: string): string[] {
	const normalized = org
		.toLowerCase()
		.replace(/[^\w\s]/g, '')
		.trim();
	const words = normalized.split(/\s+/);

	const patterns: string[] = [];

	// Add each significant word (>2 chars)
	for (const word of words) {
		if (word.length > 2 && !['the', 'and', 'for'].includes(word)) {
			patterns.push(word);
		}
	}

	// Add common TLDs based on organization type
	if (
		normalized.includes('university') ||
		normalized.includes('college') ||
		normalized.includes('school')
	) {
		patterns.push('edu');
	}
	if (
		normalized.includes('senate') ||
		normalized.includes('house') ||
		normalized.includes('government') ||
		normalized.includes('congress')
	) {
		patterns.push('gov');
	}

	return patterns;
}

/**
 * Validate email format and domain plausibility
 *
 * Checks:
 * 1. Email exists
 * 2. Basic format validation (regex)
 * 3. Domain plausibility (relates to organization OR is known generic domain OR high confidence)
 *
 * @param enriched - Enriched decision-maker candidate
 * @returns true if email is valid and plausible
 */
function validateEmail(enriched: EnrichedDecisionMaker): boolean {
	// Must have email
	if (!enriched.email) {
		return false;
	}

	// Format validation
	if (!EMAIL_REGEX.test(enriched.email)) {
		console.log(
			`[decision-maker-validation] Invalid email format: ${enriched.email} (${enriched.name})`
		);
		return false;
	}

	// Extract email domain
	const emailDomain = enriched.email.split('@')[1].toLowerCase();

	// Check if domain is a known generic domain
	if (KNOWN_GENERIC_DOMAINS.includes(emailDomain)) {
		return true;
	}

	// Extract organization domain patterns
	const orgPatterns = extractDomainFromOrg(enriched.organization);

	// Check if email domain contains any organization pattern
	const isPlausible = orgPatterns.some((pattern) => emailDomain.includes(pattern));

	// If not plausible, check if confidence is very high (>= 0.8)
	if (!isPlausible && (enriched.emailConfidence ?? 0) >= 0.8) {
		console.log(
			`[decision-maker-validation] Domain mismatch but high confidence: ${enriched.email} (${enriched.name})`
		);
		return true;
	}

	if (!isPlausible) {
		console.log(
			`[decision-maker-validation] Domain plausibility failed: ${enriched.email} does not match ${enriched.organization}`
		);
	}

	return isPlausible;
}

/**
 * Calculate combined confidence score from identity and email confidence
 *
 * Weighting:
 * - 60% identity confidence (from Phase 1)
 * - 40% email confidence (from Phase 2)
 *
 * @param enriched - Enriched decision-maker candidate
 * @returns Combined confidence score (0-1, rounded to 2 decimal places)
 */
function calculateCombinedConfidence(enriched: EnrichedDecisionMaker): number {
	const identityWeight = 0.6;
	const emailWeight = 0.4;

	const identityConfidence = enriched.confidence;
	const emailConfidence = enriched.emailConfidence ?? 0;

	const combined = identityWeight * identityConfidence + emailWeight * emailConfidence;

	// Round to 2 decimal places
	return Math.round(combined * 100) / 100;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate enriched decision-makers and merge into final format
 *
 * Pipeline:
 * 1. Filter candidates with valid, plausible emails
 * 2. Transform to ValidatedDecisionMaker format (email is guaranteed)
 * 3. Calculate combined confidence scores
 * 4. Sort by confidence descending
 *
 * @param enriched - Array of enriched decision-maker candidates
 * @returns Array of validated decision-makers with guaranteed emails, sorted by confidence
 */
export function validateAndMerge(enriched: EnrichedDecisionMaker[]): ValidatedDecisionMaker[] {
	console.log(`[decision-maker-validation] Validating ${enriched.length} enriched candidates`);

	// Filter and transform
	const validated = enriched
		.filter((candidate) => {
			const isValid = validateEmail(candidate);
			if (!isValid) {
				console.log(
					`[decision-maker-validation] Filtered out: ${candidate.name} (${candidate.enrichmentStatus})`
				);
			}
			return isValid;
		})
		.map((candidate): ValidatedDecisionMaker => {
			const confidence = calculateCombinedConfidence(candidate);

			return {
				name: candidate.name,
				title: candidate.title,
				organization: candidate.organization,
				email: candidate.email!, // Guaranteed by filter
				reasoning: candidate.reasoning,
				sourceUrl: candidate.sourceUrl,
				emailSource: candidate.emailSource ?? candidate.sourceUrl, // Fallback to identity source
				confidence,
				contactChannel: candidate.contactChannel ?? 'email'
			};
		})
		.sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending

	console.log(
		`[decision-maker-validation] ✓ Validated ${validated.length}/${enriched.length} decision-makers`
	);

	// Log validation summary
	if (validated.length > 0) {
		console.log(
			`[decision-maker-validation] Confidence range: ${validated[validated.length - 1].confidence.toFixed(2)} - ${validated[0].confidence.toFixed(2)}`
		);
	} else if (enriched.length > 0) {
		console.log(`[decision-maker-validation] ⚠️ All candidates filtered out (no verified emails)`);
	}

	return validated;
}
