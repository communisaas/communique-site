/**
 * Scope Validation & Cross-Verification (Epic 4)
 *
 * Validate AI-extracted scope against user's actual location
 * Detect hallucinations and reduce false positives
 *
 * Validation priority (highest to lowest trust):
 * 1. Verified address (self.xyz, Didit.me) - highest trust
 * 2. OAuth location (Google, Facebook) - medium trust
 * 3. IP geolocation - low trust (VPNs exist)
 *
 * Confidence adjustments:
 * - Match verified address: +0.1 boost
 * - Mismatch verified address: -0.3 penalty (likely hallucination)
 * - Country mismatch (OAuth): -0.2 penalty
 * - Country mismatch (IP): -0.05 penalty (VPNs common, don't penalize heavily)
 */

import type { ScopeMapping } from '$lib/utils/scope-mapper-international';

export interface ValidationContext {
	ip_location?: { country: string; region?: string }; // From IP geolocation
	oauth_location?: { country: string; region?: string }; // From Google/Facebook OAuth
	verified_address?: { district: string; state: string }; // From self.xyz or Didit.me
}

export interface ValidationResult {
	validated: boolean;
	confidence_adjustment: number; // -0.3 to +0.1
	reason: string;
	should_show_warning: boolean; // True if likely hallucination
}

/**
 * Validate AI-extracted scope against user context
 *
 * Cross-reference extracted location with user's known location
 * Detect hallucinations, reduce false positives
 *
 * @param extracted - AI-extracted ScopeMapping
 * @param userContext - User's location context (verified address, OAuth, IP)
 * @returns ValidationResult with confidence adjustment and reasoning
 */
export function validateScope(
	extracted: ScopeMapping,
	userContext: ValidationContext
): ValidationResult {
	// Priority 1: Verified address (highest trust)
	if (userContext.verified_address?.district) {
		const { district, state } = userContext.verified_address;

		// Exact district match
		if (extracted.district_code === district) {
			return {
				validated: true,
				confidence_adjustment: +0.1,
				reason: 'Matches verified address district',
				should_show_warning: false
			};
		}

		// State match (template is region-level)
		if (extracted.scope_level === 'region' && extracted.region_code === state) {
			return {
				validated: true,
				confidence_adjustment: +0.05,
				reason: 'Matches verified address state',
				should_show_warning: false
			};
		}

		// Nationwide template (user-verified but template is national)
		if (extracted.scope_level === 'country') {
			return {
				validated: true,
				confidence_adjustment: 0,
				reason: 'Nationwide template (user verified in specific district)',
				should_show_warning: false
			};
		}

		// Mismatch - likely hallucination
		return {
			validated: false,
			confidence_adjustment: -0.3,
			reason: `Extracted ${extracted.display_text} but user verified in ${district}`,
			should_show_warning: true
		};
	}

	// Priority 2: OAuth location (medium trust)
	if (userContext.oauth_location) {
		const { country, region } = userContext.oauth_location;

		// Country mismatch
		if (extracted.country_code !== country) {
			return {
				validated: false,
				confidence_adjustment: -0.2,
				reason: `Country mismatch: extracted ${extracted.country_code}, OAuth ${country}`,
				should_show_warning: true
			};
		}

		// Region mismatch (if template is region-level)
		if (extracted.scope_level === 'region' && region && extracted.region_code !== region) {
			return {
				validated: false,
				confidence_adjustment: -0.15,
				reason: `Region mismatch: extracted ${extracted.region_code}, OAuth ${region}`,
				should_show_warning: true
			};
		}

		// Country matches
		return {
			validated: true,
			confidence_adjustment: +0.05,
			reason: 'Country matches OAuth location',
			should_show_warning: false
		};
	}

	// Priority 3: IP location (lowest trust - VPNs exist)
	if (userContext.ip_location) {
		const { country, region } = userContext.ip_location;

		// Country mismatch (don't penalize heavily - could be VPN)
		if (extracted.country_code !== country) {
			return {
				validated: false,
				confidence_adjustment: -0.05,
				reason: 'Country mismatch with IP (possible VPN)',
				should_show_warning: false // Don't warn - VPNs are common
			};
		}

		// Region mismatch (if template is region-level)
		if (extracted.scope_level === 'region' && region && extracted.region_code !== region) {
			return {
				validated: false,
				confidence_adjustment: -0.05,
				reason: 'Region mismatch with IP (possible VPN)',
				should_show_warning: false
			};
		}

		// Country matches
		return {
			validated: true,
			confidence_adjustment: 0,
			reason: 'Country matches IP location',
			should_show_warning: false
		};
	}

	// No validation context available
	return {
		validated: false,
		confidence_adjustment: 0,
		reason: 'No user context for validation',
		should_show_warning: false
	};
}

/**
 * Apply validation result to extracted scope
 *
 * Adjust confidence based on validation, clamp to [0, 1]
 *
 * @param extracted - AI-extracted ScopeMapping
 * @param validationResult - Validation result from validateScope()
 * @returns Updated ScopeMapping with adjusted confidence
 */
export function applyValidation(
	extracted: ScopeMapping,
	validationResult: ValidationResult
): ScopeMapping {
	const adjustedConfidence = Math.max(
		0,
		Math.min(1, extracted.confidence + validationResult.confidence_adjustment)
	);

	return {
		...extracted,
		confidence: adjustedConfidence
	};
}
