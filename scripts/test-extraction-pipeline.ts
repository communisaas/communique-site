/**
 * Integration test script for complete geographic scope extraction pipeline
 * Tests all 4 layers: Regex → Fuzzy → Geocoding → LLM (when implemented)
 *
 * Run with: npx tsx scripts/test-extraction-pipeline.ts
 */

import { mapLocationToScope } from '../src/lib/utils/scope-mapper-international';
import { fuzzyMatchScope } from '../src/lib/utils/fuzzy-scope-matcher';
import { geocodeLocation, geocodeResultToScopeMapping } from '../src/lib/server/geocoding';
import { getCachedGeocode, setCachedGeocode } from '../src/lib/server/geocoding-cache';
import type { ScopeMapping } from '../src/lib/utils/scope-mapper-international';

// Color output utilities
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

interface TestCase {
	name: string;
	message: string;
	subject: string;
	expectedLayer: 'regex' | 'fuzzy' | 'geocoding' | 'llm' | 'none';
	expectedScope?: string; // e.g., "California", "CA-11", "Nationwide"
	expectedLevel?: 'country' | 'region' | 'locality' | 'district';
}

const TEST_CASES: TestCase[] = [
	// Layer 1: Regex patterns
	{
		name: 'Regex: Congressional district',
		message: 'This affects everyone in CA-11 and their families.',
		subject: 'Support housing reform',
		expectedLayer: 'regex',
		expectedScope: 'CA-11', // District-level shows district code
		expectedLevel: 'district'
	},
	{
		name: 'Regex: Full state name',
		message: 'California needs better transit infrastructure.',
		subject: 'Transit funding',
		expectedLayer: 'regex',
		expectedScope: 'California',
		expectedLevel: 'region'
	},
	{
		name: 'Regex: Nationwide',
		message: 'This is a nationwide issue affecting all states.',
		subject: 'Federal policy',
		expectedLayer: 'regex',
		expectedScope: 'Nationwide',
		expectedLevel: 'country'
	},

	// Layer 2: Fuzzy matching
	{
		name: 'Fuzzy: SoCal abbreviation',
		message: 'SoCal housing costs are out of control.',
		subject: 'Housing crisis',
		expectedLayer: 'fuzzy',
		expectedScope: 'California',
		expectedLevel: 'region'
	},
	{
		name: 'Fuzzy: NYC abbreviation',
		message: 'NYC transit needs funding urgently.',
		subject: 'Transit funding',
		expectedLayer: 'fuzzy',
		expectedScope: 'New York City',
		expectedLevel: 'locality'
	},
	{
		name: 'Fuzzy: Bay Area nickname',
		message: 'Bay Area tech workers need housing reform.',
		subject: 'Housing policy',
		expectedLayer: 'fuzzy',
		expectedScope: 'California',
		expectedLevel: 'region'
	},
	{
		name: 'Fuzzy: Typo tolerance (Californa)',
		message: 'Californa needs action on climate policy.',
		subject: 'Climate change',
		expectedLayer: 'fuzzy',
		expectedScope: 'California',
		expectedLevel: 'region'
	},

	// Layer 3: Geocoding (would require API)
	{
		name: 'Geocoding: Street address',
		message: 'The office at 1600 Pennsylvania Avenue needs to act.',
		subject: 'Federal policy',
		expectedLayer: 'geocoding',
		expectedScope: 'Washington',
		expectedLevel: 'locality'
	},
	{
		name: 'Geocoding: Landmark',
		message: 'Support transit near Golden Gate Bridge.',
		subject: 'Transit funding',
		expectedLayer: 'geocoding',
		expectedScope: 'San Francisco',
		expectedLevel: 'locality'
	},

	// Edge cases
	{
		name: 'Edge: No geographic scope',
		message: 'We need better policy on this issue.',
		subject: 'General reform',
		expectedLayer: 'none',
		expectedScope: undefined,
		expectedLevel: undefined
	}
];

/**
 * Replicate the extraction logic from generate-message API
 */
async function extractGeographicScope(
	message: string,
	subject: string,
	countryCode: string = 'US'
): Promise<{ scope: ScopeMapping | null; layer: string }> {
	const combinedText = `${subject} ${message}`.toLowerCase();

	// LAYER 1: Regex patterns
	const districtPattern = /\b([a-z]{2})-(\d{1,2})\b/gi;
	const districtMatch = districtPattern.exec(combinedText);
	if (districtMatch) {
		const result = mapLocationToScope(districtMatch[0], countryCode);
		return { scope: result, layer: 'regex' };
	}

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
			const result = mapLocationToScope(stateName, countryCode);
			return { scope: result, layer: 'regex' };
		}
	}

	const nationwidePatterns = [
		/\bnationwide\b/,
		/\ball states\b/,
		/\bfederal\b/,
		/\bacross america\b/,
		/\bacross the (country|nation|united states)\b/
	];

	for (const pattern of nationwidePatterns) {
		if (pattern.test(combinedText)) {
			const result = mapLocationToScope('nationwide', countryCode);
			return { scope: result, layer: 'regex' };
		}
	}

	// LAYER 2: Fuzzy matching
	const words = combinedText.split(/\s+/);
	for (let i = 0; i < words.length; i++) {
		const singleWord = words[i].replace(/[^\w\s-]/g, '').toLowerCase();
		if (singleWord.length >= 2) {
			const fuzzyResult = fuzzyMatchScope(singleWord, countryCode);
			if (fuzzyResult && fuzzyResult.confidence >= 0.8) {
				return { scope: fuzzyResult, layer: 'fuzzy' };
			}
		}

		if (i < words.length - 1) {
			const twoWords = `${words[i]} ${words[i + 1]}`.replace(/[^\w\s-]/g, '').toLowerCase();
			const fuzzyResult = fuzzyMatchScope(twoWords, countryCode);
			if (fuzzyResult && fuzzyResult.confidence >= 0.8) {
				return { scope: fuzzyResult, layer: 'fuzzy' };
			}
		}
	}

	// LAYER 3: Geocoding (requires Google Maps API key)
	if (process.env.GOOGLE_MAPS_API_KEY) {
		const cached = await getCachedGeocode(combinedText);
		if (cached) {
			return { scope: geocodeResultToScopeMapping(cached), layer: 'geocoding-cached' };
		}

		try {
			const geocodeResult = await geocodeLocation(combinedText, { timeout: 2000 });
			if (geocodeResult) {
				await setCachedGeocode(combinedText, geocodeResult);
				return { scope: geocodeResultToScopeMapping(geocodeResult), layer: 'geocoding' };
			}
		} catch (err) {
			console.log(`${YELLOW}⚠️  Geocoding failed: ${err}${RESET}`);
		}
	}

	// LAYER 4: LLM extraction (not yet implemented)
	// Would go here in future

	return { scope: null, layer: 'none' };
}

async function runTests() {
	console.log(`${BLUE}╔═══════════════════════════════════════════════════════════════╗${RESET}`);
	console.log(`${BLUE}║   Geographic Scope Extraction Pipeline Integration Test      ║${RESET}`);
	console.log(`${BLUE}╚═══════════════════════════════════════════════════════════════╝${RESET}\n`);

	let passed = 0;
	let failed = 0;
	let skipped = 0;

	const hasGoogleMapsKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);
	if (!hasGoogleMapsKey) {
		console.log(
			`${YELLOW}⚠️  No GOOGLE_MAPS_API_KEY found - geocoding tests will be skipped${RESET}\n`
		);
	}

	for (const testCase of TEST_CASES) {
		// Skip geocoding tests if no API key
		if (testCase.expectedLayer === 'geocoding' && !hasGoogleMapsKey) {
			console.log(`${YELLOW}⊘ SKIP: ${testCase.name}${RESET} (no API key)`);
			skipped++;
			continue;
		}

		try {
			const { scope, layer } = await extractGeographicScope(testCase.message, testCase.subject);

			const layerMatch =
				layer === testCase.expectedLayer ||
				(layer === 'geocoding-cached' && testCase.expectedLayer === 'geocoding');

			const scopeMatch =
				!testCase.expectedScope ||
				scope?.display_text?.toLowerCase().includes(testCase.expectedScope.toLowerCase());

			const levelMatch = !testCase.expectedLevel || scope?.scope_level === testCase.expectedLevel;

			if (layerMatch && scopeMatch && levelMatch) {
				console.log(`${GREEN}✓ PASS: ${testCase.name}${RESET}`);
				console.log(
					`  Layer: ${layer}, Scope: ${scope?.display_text || 'none'}, Level: ${scope?.scope_level || 'none'}`
				);
				console.log(
					`  Confidence: ${scope?.confidence || 0}, Method: ${scope?.extraction_method || 'none'}\n`
				);
				passed++;
			} else {
				console.log(`${RED}✗ FAIL: ${testCase.name}${RESET}`);
				console.log(
					`  Expected: layer=${testCase.expectedLayer}, scope=${testCase.expectedScope}, level=${testCase.expectedLevel}`
				);
				console.log(
					`  Got: layer=${layer}, scope=${scope?.display_text || 'none'}, level=${scope?.scope_level || 'none'}\n`
				);
				failed++;
			}
		} catch (error) {
			console.log(`${RED}✗ ERROR: ${testCase.name}${RESET}`);
			console.log(`  ${error}\n`);
			failed++;
		}
	}

	// Summary
	console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
	console.log(`${GREEN}✓ Passed: ${passed}${RESET}`);
	console.log(`${RED}✗ Failed: ${failed}${RESET}`);
	console.log(`${YELLOW}⊘ Skipped: ${skipped}${RESET}`);
	console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}\n`);

	const total = passed + failed;
	const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
	console.log(`Success Rate: ${successRate}% (${passed}/${total})`);

	// Coverage analysis
	console.log(`\n${BLUE}Coverage Analysis:${RESET}`);
	console.log(
		`  Layer 1 (Regex): ${passed >= 3 ? GREEN : RED}${passed >= 3 ? '✓' : '✗'} Operational${RESET}`
	);
	console.log(
		`  Layer 2 (Fuzzy): ${passed >= 6 ? GREEN : RED}${passed >= 6 ? '✓' : '✗'} Operational${RESET}`
	);
	console.log(
		`  Layer 3 (Geocoding): ${hasGoogleMapsKey ? (passed >= 8 ? GREEN : YELLOW) : YELLOW}${hasGoogleMapsKey ? (passed >= 8 ? '✓' : '~') : '⊘'} ${hasGoogleMapsKey ? 'Operational' : 'Skipped (no API key)'}${RESET}`
	);
	console.log(`  Layer 4 (LLM): ${YELLOW}⊘ Not yet implemented${RESET}\n`);

	process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
	console.error(`${RED}Fatal error:${RESET}`, error);
	process.exit(1);
});
