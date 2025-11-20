/**
 * Standalone fuzzy matcher verification script
 * Run with: npx tsx scripts/test-fuzzy-matcher.ts
 */

import { fuzzyMatchScope, getFuzzyMatcherStats } from '../src/lib/utils/fuzzy-scope-matcher';
import { levenshteinDistance } from '../src/lib/utils/levenshtein';
import { getFuzzyPatternStats } from '../src/lib/utils/fuzzy-scope-patterns';

// Color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

interface TestResult {
	name: string;
	passed: boolean;
	message?: string;
	duration?: number;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void | boolean): void {
	const start = performance.now();
	try {
		const result = fn();
		const duration = performance.now() - start;

		if (result === false) {
			results.push({ name, passed: false, duration, message: 'Assertion failed' });
		} else {
			results.push({ name, passed: true, duration });
		}
	} catch (error) {
		const duration = performance.now() - start;
		results.push({
			name,
			passed: false,
			duration,
			message: error instanceof Error ? error.message : String(error)
		});
	}
}

function assert(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(message);
	}
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
	if (actual !== expected) {
		throw new Error(
			message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
		);
	}
}

function assertNotNull<T>(value: T | null, message?: string): asserts value is T {
	if (value === null) {
		throw new Error(message || 'Expected non-null value');
	}
}

console.log(`${BLUE}=== Fuzzy Geographic Scope Matcher Test Suite ===${RESET}\n`);

// ============================================================================
// Levenshtein Distance Tests
// ============================================================================

console.log('Testing Levenshtein Distance...');

test('Levenshtein: identical strings', () => {
	assertEquals(levenshteinDistance('california', 'california'), 0);
});

test('Levenshtein: empty strings', () => {
	assertEquals(levenshteinDistance('', ''), 0);
	assertEquals(levenshteinDistance('', 'test'), 4);
	assertEquals(levenshteinDistance('test', ''), 4);
});

test('Levenshtein: substitution', () => {
	assertEquals(levenshteinDistance('california', 'californa'), 1);
	assertEquals(levenshteinDistance('florida', 'florda'), 1);
});

test('Levenshtein: insertion', () => {
	assertEquals(levenshteinDistance('ny', 'nyc'), 1);
	assertEquals(levenshteinDistance('phily', 'philly'), 1);
});

test('Levenshtein: deletion', () => {
	assertEquals(levenshteinDistance('nyc', 'ny'), 1);
});

// ============================================================================
// Fuzzy Pattern Matching - Exact Matches
// ============================================================================

console.log('Testing Fuzzy Pattern Matching - Exact Matches...');

test('US: Regional nickname - SoCal', () => {
	const result = fuzzyMatchScope('socal', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
	assertEquals(result.region_code, 'CA');
	assertEquals(result.confidence, 0.85);
});

test('US: Regional nickname - Bay Area', () => {
	const result = fuzzyMatchScope('bay area', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
});

test('US: City abbreviation - NYC', () => {
	const result = fuzzyMatchScope('nyc', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'New York City');
	assertEquals(result.scope_level, 'locality');
	assertEquals(result.confidence, 0.95);
});

test('US: City abbreviation - LA', () => {
	const result = fuzzyMatchScope('la', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'Los Angeles');
});

test('US: City abbreviation - SF', () => {
	const result = fuzzyMatchScope('sf', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'San Francisco');
});

test('US: City abbreviation - DC', () => {
	const result = fuzzyMatchScope('dc', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'Washington DC');
});

test('US: City abbreviation - Philly', () => {
	const result = fuzzyMatchScope('philly', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'Philadelphia');
});

test('US: State abbreviation - CA', () => {
	const result = fuzzyMatchScope('ca', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
	assertEquals(result.region_code, 'CA');
});

test('US: Full state name - California', () => {
	const result = fuzzyMatchScope('california', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
});

// ============================================================================
// Typo Tolerance
// ============================================================================

console.log('Testing Typo Tolerance...');

test('Typo: californa (distance=1)', () => {
	const result = fuzzyMatchScope('californa', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
	assert(result.confidence < 0.9, 'Confidence should be reduced for typos');
});

test('Typo: florda (distance=1)', () => {
	const result = fuzzyMatchScope('florda', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'Florida');
});

test('Typo: masachusetts (distance=2)', () => {
	const result = fuzzyMatchScope('masachusetts', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'Massachusetts');
});

test('Typo: too many errors (distance>2)', () => {
	const result = fuzzyMatchScope('californiaaaa', 'US');
	assertEquals(result, null);
});

// ============================================================================
// Case Insensitivity
// ============================================================================

console.log('Testing Case Insensitivity...');

test('Case: SOCAL', () => {
	const result = fuzzyMatchScope('SOCAL', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
});

test('Case: NYC', () => {
	const result = fuzzyMatchScope('NYC', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'New York City');
});

test('Case: Bay Area', () => {
	const result = fuzzyMatchScope('Bay Area', 'US');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
});

// ============================================================================
// International Patterns
// ============================================================================

console.log('Testing International Patterns...');

test('UK: London', () => {
	const result = fuzzyMatchScope('london', 'GB');
	assertNotNull(result);
	assertEquals(result.display_text, 'London');
	assertEquals(result.scope_level, 'locality');
});

test('UK: Scotland', () => {
	const result = fuzzyMatchScope('scotland', 'GB');
	assertNotNull(result);
	assertEquals(result.display_text, 'Scotland');
});

test('France: Paris', () => {
	const result = fuzzyMatchScope('paris', 'FR');
	assertNotNull(result);
	assertEquals(result.display_text, 'Paris');
});

test('France: PACA', () => {
	const result = fuzzyMatchScope('paca', 'FR');
	assertNotNull(result);
	assertEquals(result.display_text, "Provence-Alpes-Côte d'Azur");
});

test('Japan: Tokyo', () => {
	const result = fuzzyMatchScope('tokyo', 'JP');
	assertNotNull(result);
	assertEquals(result.display_text, 'Tokyo');
});

test('Brazil: São Paulo', () => {
	const result = fuzzyMatchScope('sao paulo', 'BR');
	assertNotNull(result);
	assertEquals(result.display_text, 'São Paulo');
});

// ============================================================================
// Edge Cases
// ============================================================================

console.log('Testing Edge Cases...');

test('Edge: empty string', () => {
	const result = fuzzyMatchScope('', 'US');
	assertEquals(result, null);
});

test('Edge: whitespace only', () => {
	const result = fuzzyMatchScope('   ', 'US');
	assertEquals(result, null);
});

test('Edge: gibberish', () => {
	const result = fuzzyMatchScope('xyz123', 'US');
	assertEquals(result, null);
});

test('Edge: unsupported country fallback', () => {
	const result = fuzzyMatchScope('california', 'XX');
	assertNotNull(result);
	assertEquals(result.display_text, 'California');
});

// ============================================================================
// Statistics and Configuration
// ============================================================================

console.log('Testing Statistics...');

test('Statistics: pattern counts', () => {
	const stats = getFuzzyMatcherStats();
	assert(stats.patternCount.US > 200, 'US should have > 200 patterns');
	assert(stats.patternCount.GB > 50, 'GB should have > 50 patterns');
	assert(stats.patternCount.FR > 30, 'FR should have > 30 patterns');
	assert(stats.patternCount.JP > 20, 'JP should have > 20 patterns');
	assert(stats.patternCount.BR > 20, 'BR should have > 20 patterns');
	assert(stats.totalPatterns > 320, 'Total should be > 320 patterns');
});

test('Statistics: configuration', () => {
	const stats = getFuzzyMatcherStats();
	assertEquals(stats.maxEditDistance, 2);
	assertEquals(stats.confidencePenaltyPerEdit, 0.075);
});

// ============================================================================
// Performance Benchmarks
// ============================================================================

console.log('Testing Performance...');

test('Performance: 1000 exact matches < 5ms', () => {
	const start = performance.now();
	for (let i = 0; i < 1000; i++) {
		fuzzyMatchScope('california', 'US');
	}
	const elapsed = performance.now() - start;
	const avgPerMatch = elapsed / 1000;
	assert(avgPerMatch < 5, `Average time per match: ${avgPerMatch.toFixed(3)}ms (should be < 5ms)`);
	return true;
});

test('Performance: 500 typo matches < 10ms', () => {
	const start = performance.now();
	for (let i = 0; i < 500; i++) {
		fuzzyMatchScope('californa', 'US');
	}
	const elapsed = performance.now() - start;
	const avgPerMatch = elapsed / 500;
	assert(
		avgPerMatch < 10,
		`Average time per typo match: ${avgPerMatch.toFixed(3)}ms (should be < 10ms)`
	);
	return true;
});

test('Performance: 1000 no-match attempts < 5ms', () => {
	const start = performance.now();
	for (let i = 0; i < 1000; i++) {
		fuzzyMatchScope('gibberish123', 'US');
	}
	const elapsed = performance.now() - start;
	const avgPerMatch = elapsed / 1000;
	assert(
		avgPerMatch < 5,
		`Average time per no-match: ${avgPerMatch.toFixed(3)}ms (should be < 5ms)`
	);
	return true;
});

// ============================================================================
// Report Results
// ============================================================================

console.log(`\n${BLUE}=== Test Results ===${RESET}\n`);

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const total = results.length;

// Show failed tests first
const failedTests = results.filter((r) => !r.passed);
if (failedTests.length > 0) {
	console.log(`${RED}Failed Tests:${RESET}`);
	failedTests.forEach((result) => {
		console.log(
			`  ${RED}✗${RESET} ${result.name} (${result.duration?.toFixed(2)}ms) - ${result.message}`
		);
	});
	console.log('');
}

// Summary
console.log(`${GREEN}Passed: ${passed}/${total}${RESET}`);
console.log(`${RED}Failed: ${failed}/${total}${RESET}`);

if (failed === 0) {
	console.log(`\n${GREEN}✓ All tests passed!${RESET}`);
} else {
	console.log(`\n${RED}✗ ${failed} test(s) failed${RESET}`);
}

// Pattern statistics
console.log(`\n${BLUE}=== Pattern Statistics ===${RESET}\n`);
const patternStats = getFuzzyPatternStats();
console.log(`US patterns:     ${patternStats.US}`);
console.log(`UK patterns:     ${patternStats.GB}`);
console.log(`France patterns: ${patternStats.FR}`);
console.log(`Japan patterns:  ${patternStats.JP}`);
console.log(`Brazil patterns: ${patternStats.BR}`);
console.log(`${GREEN}Total patterns:  ${patternStats.total}${RESET}`);

// Exit with appropriate code
process.exit(failed === 0 ? 0 : 1);
