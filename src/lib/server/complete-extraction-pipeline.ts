/**
 * COMPLETE GEOGRAPHIC SCOPE EXTRACTION PIPELINE
 *
 * Epic 1-2-3-4-5: Fuzzy + Geocoding + LLM + Validation + Learning
 *
 * This file provides the COMPLETE 4-layer extraction pipeline that can be
 * integrated into any extraction endpoint (generate-message, template creator, etc.)
 *
 * COVERAGE TARGETS:
 * - Layer 1 (Regex): 70-80% coverage, <1ms
 * - Layer 2 (Fuzzy): 85% coverage, <5ms
 * - Layer 3 (Geocoding): 95% coverage, ~200ms (cached)
 * - Layer 4 (LLM): 99% coverage, ~1-2s (cached)
 *
 * COST TARGETS:
 * - Geocoding: < $50/month (free tier)
 * - LLM: < $20/month (cached, only for edge cases)
 * - Total: < $70/month at 10K templates/month
 */

import { mapLocationToScope } from '$lib/utils/scope-mapper-international';
import type { ScopeMapping } from '$lib/utils/scope-mapper-international';
import { fuzzyMatchScope } from '$lib/utils/fuzzy-scope-matcher';
import { geocodeLocation, geocodeResultToScopeMapping } from './geocoding';
import { getCachedGeocode, setCachedGeocode } from './geocoding-cache';
import { checkRateLimit } from './geocoding-rate-limiter';
import { extractWithLLMCached } from './llm-cache';
import type { LLMExtractionContext } from './llm-scope-extraction';
import { validateScope, applyValidation } from './scope-validator';
import type { ValidationContext } from './scope-validator';

/**
 * Complete extraction pipeline with all 4 layers + validation
 *
 * @param message - Template message body
 * @param subject - Template subject line
 * @param countryCode - ISO country code (default: US)
 * @param llmContext - Optional context for LLM (decision makers, domain)
 * @param userContext - Optional user location for validation
 * @returns ScopeMapping with extraction_method and confidence, or null if all layers fail
 */
export async function extractGeographicScopeComplete(
	message: string,
	subject: string,
	countryCode: string = 'US',
	llmContext?: LLMExtractionContext,
	userContext?: ValidationContext
): Promise<ScopeMapping | null> {
	const combinedText = `${subject} ${message}`.toLowerCase();

	// ============= LAYER 1: REGEX (Fast Path, 70-80% coverage) =============
	const regexResult = tryRegexExtraction(combinedText, countryCode);
	if (regexResult && regexResult.confidence >= 0.8) {
		// High confidence regex match - validate and return
		return userContext
			? applyValidation(regexResult, validateScope(regexResult, userContext))
			: regexResult;
	}

	// ============= LAYER 2: FUZZY (Abbreviations/Typos, 85% coverage) =============
	const fuzzyResult = await fuzzyMatchScope(combinedText, countryCode);
	if (fuzzyResult && fuzzyResult.confidence >= 0.75) {
		// High confidence fuzzy match - validate and return
		return userContext
			? applyValidation(fuzzyResult, validateScope(fuzzyResult, userContext))
			: fuzzyResult;
	}

	// ============= LAYER 3: GEOCODING (Addresses/Landmarks, 95% coverage) =============
	// Check cache first
	const cachedGeocode = await getCachedGeocode(combinedText);
	if (cachedGeocode) {
		const geocodeResult = geocodeResultToScopeMapping(cachedGeocode);
		if (geocodeResult.confidence >= 0.7) {
			return userContext
				? applyValidation(geocodeResult, validateScope(geocodeResult, userContext))
				: geocodeResult;
		}
	}

	// Check rate limit before calling API
	const rateLimitCheck = checkRateLimit();
	if (rateLimitCheck.allowed) {
		const geocodeResult = await geocodeLocation(combinedText, { timeout: 2000 });
		if (geocodeResult) {
			await setCachedGeocode(combinedText, geocodeResult);
			const scopeMapping = geocodeResultToScopeMapping(geocodeResult);
			if (scopeMapping.confidence >= 0.7) {
				return userContext
					? applyValidation(scopeMapping, validateScope(scopeMapping, userContext))
					: scopeMapping;
			}
		}
	}

	// ============= LAYER 4: LLM (Edge Cases, 99% coverage) =============
	// Only use LLM when:
	// 1. All previous layers failed OR
	// 2. Previous layers returned low confidence (< 0.7)
	const shouldUseLLM =
		(!regexResult && !fuzzyResult && !cachedGeocode) ||
		(regexResult && regexResult.confidence < 0.7) ||
		(fuzzyResult && fuzzyResult.confidence < 0.7);

	if (shouldUseLLM) {
		const llmResult = await extractWithLLMCached(message, subject, llmContext);
		if (llmResult) {
			return userContext
				? applyValidation(llmResult, validateScope(llmResult, userContext))
				: llmResult;
		}
	}

	// ============= FALLBACK =============
	// Return best available result even if low confidence
	const bestResult = regexResult || fuzzyResult || null;
	if (bestResult && userContext) {
		return applyValidation(bestResult, validateScope(bestResult, userContext));
	}

	return bestResult;
}

/**
 * Try regex extraction (Layer 1)
 *
 * @param combinedText - Lowercased subject + message
 * @param countryCode - ISO country code
 * @returns ScopeMapping or null
 */
function tryRegexExtraction(combinedText: string, countryCode: string): ScopeMapping | null {
	// Pattern 1: Congressional district (CA-12, NY-15)
	const districtPattern = /\b([a-z]{2})-(\d{1,2})\b/gi;
	const districtMatch = districtPattern.exec(combinedText);
	if (districtMatch) {
		return mapLocationToScope(districtMatch[0], countryCode);
	}

	// Pattern 2: State names
	const statePatterns = [
		/\bcalifornia\b/,
		/\bnew york\b/,
		/\btexas\b/,
		/\bflorida\b/,
		/\billinois\b/,
		/\bpennsylvania\b/,
		/\bohio\b/,
		/\bgeorgia\b/,
		/\bmichigan\b/,
		/\bnorth carolina\b/,
		/\bin (california|new york|texas|florida|illinois)\b/
	];

	for (const pattern of statePatterns) {
		const match = pattern.exec(combinedText);
		if (match) {
			const stateName = match[0].replace(/^in /, '').trim();
			return mapLocationToScope(stateName, countryCode);
		}
	}

	// Pattern 3: Nationwide/federal
	const nationwidePatterns = [
		/\bnationwide\b/,
		/\ball states\b/,
		/\bfederal\b/,
		/\bacross america\b/,
		/\bacross the (country|nation|united states)\b/
	];

	for (const pattern of nationwidePatterns) {
		if (pattern.test(combinedText)) {
			return mapLocationToScope('nationwide', countryCode);
		}
	}

	return null;
}
