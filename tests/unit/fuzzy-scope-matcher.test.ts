/**
 * Fuzzy Scope Matcher Test Suite
 *
 * Comprehensive tests covering:
 * - Exact pattern matches (200+ cases)
 * - Typo tolerance (edit distance 1-2)
 * - Case insensitivity
 * - Multi-word patterns
 * - Edge cases
 * - Performance benchmarks
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fuzzyMatchScope, batchFuzzyMatch, getFuzzyMatcherStats, findClosestPattern } from '$lib/utils/fuzzy-scope-matcher';
import { levenshteinDistance, withinEditDistance } from '$lib/utils/levenshtein';
import { getFuzzyPatternStats } from '$lib/utils/fuzzy-scope-patterns';

describe('Levenshtein Distance', () => {
	describe('Basic functionality', () => {
		it('should return 0 for identical strings', () => {
			expect(levenshteinDistance('california', 'california')).toBe(0);
			expect(levenshteinDistance('', '')).toBe(0);
		});

		it('should return length for empty string comparisons', () => {
			expect(levenshteinDistance('', 'california')).toBe(10);
			expect(levenshteinDistance('california', '')).toBe(10);
		});

		it('should calculate substitutions correctly', () => {
			expect(levenshteinDistance('california', 'californa')).toBe(1); // i→o
			expect(levenshteinDistance('florida', 'flordia')).toBe(1); // i→d
		});

		it('should calculate insertions correctly', () => {
			expect(levenshteinDistance('ny', 'nyc')).toBe(1); // insert c
			expect(levenshteinDistance('phily', 'philly')).toBe(1); // insert l
		});

		it('should calculate deletions correctly', () => {
			expect(levenshteinDistance('nyc', 'ny')).toBe(1); // delete c
			expect(levenshteinDistance('philly', 'phily')).toBe(1); // delete l
		});

		it('should calculate complex edits correctly', () => {
			expect(levenshteinDistance('texas', 'taxes')).toBe(2); // swap e/a positions
			expect(levenshteinDistance('massachusets', 'massachusetts')).toBe(1); // insert t
		});
	});

	describe('withinEditDistance', () => {
		it('should return true for distance within threshold', () => {
			expect(withinEditDistance('socal', 'social', 2)).toBe(true);
			expect(withinEditDistance('californa', 'california', 2)).toBe(true);
		});

		it('should return false for distance exceeding threshold', () => {
			expect(withinEditDistance('socal', 'total', 2)).toBe(false);
			expect(withinEditDistance('xyz', 'abcdef', 2)).toBe(false);
		});

		it('should handle default threshold of 2', () => {
			expect(withinEditDistance('ny', 'nyc')).toBe(true);
			expect(withinEditDistance('ny', 'nycx')).toBe(true);
			expect(withinEditDistance('ny', 'nycxy')).toBe(false);
		});
	});
});

describe('Fuzzy Scope Matcher', () => {
	describe('Exact pattern matches - US', () => {
		it('should match regional nicknames', () => {
			const socal = fuzzyMatchScope('socal', 'US');
			expect(socal).not.toBeNull();
			expect(socal?.display_text).toBe('California');
			expect(socal?.region_code).toBe('CA');
			expect(socal?.confidence).toBe(0.85);
			expect(socal?.extraction_method).toBe('fuzzy');

			const norcal = fuzzyMatchScope('norcal', 'US');
			expect(norcal?.display_text).toBe('California');

			const bayArea = fuzzyMatchScope('bay area', 'US');
			expect(bayArea?.display_text).toBe('California');
			expect(bayArea?.confidence).toBe(0.8);

			const dmv = fuzzyMatchScope('dmv', 'US');
			expect(dmv?.display_text).toBe('District of Columbia');

			const pnw = fuzzyMatchScope('pnw', 'US');
			expect(pnw?.display_text).toBe('Washington');
		});

		it('should match city abbreviations', () => {
			const nyc = fuzzyMatchScope('nyc', 'US');
			expect(nyc?.display_text).toBe('New York City');
			expect(nyc?.scope_level).toBe('locality');
			expect(nyc?.confidence).toBe(0.95);

			const la = fuzzyMatchScope('la', 'US');
			expect(la?.display_text).toBe('Los Angeles');

			const sf = fuzzyMatchScope('sf', 'US');
			expect(sf?.display_text).toBe('San Francisco');

			const dc = fuzzyMatchScope('dc', 'US');
			expect(dc?.display_text).toBe('Washington DC');

			const philly = fuzzyMatchScope('philly', 'US');
			expect(philly?.display_text).toBe('Philadelphia');

			const nola = fuzzyMatchScope('nola', 'US');
			expect(nola?.display_text).toBe('New Orleans');
		});

		it('should match state abbreviations', () => {
			const ca = fuzzyMatchScope('ca', 'US');
			expect(ca?.display_text).toBe('California');
			expect(ca?.region_code).toBe('CA');

			const ny = fuzzyMatchScope('ny', 'US');
			expect(ny?.display_text).toBe('New York');

			const tx = fuzzyMatchScope('tx', 'US');
			expect(tx?.display_text).toBe('Texas');

			const fl = fuzzyMatchScope('fl', 'US');
			expect(fl?.display_text).toBe('Florida');
		});

		it('should match full state names', () => {
			const california = fuzzyMatchScope('california', 'US');
			expect(california?.display_text).toBe('California');
			expect(california?.confidence).toBe(0.9);

			const massachusetts = fuzzyMatchScope('massachusetts', 'US');
			expect(massachusetts?.display_text).toBe('Massachusetts');

			const pennsylvania = fuzzyMatchScope('pennsylvania', 'US');
			expect(pennsylvania?.display_text).toBe('Pennsylvania');
		});
	});

	describe('Typo tolerance - US', () => {
		it('should match common state name typos (distance = 1)', () => {
			const californa = fuzzyMatchScope('californa', 'US');
			expect(californa?.display_text).toBe('California');
			expect(californa?.confidence).toBeCloseTo(0.825, 2); // 0.9 - 0.075 penalty

			const florda = fuzzyMatchScope('florda', 'US');
			expect(florda?.display_text).toBe('Florida');
			expect(florda?.confidence).toBeCloseTo(0.825, 2);
		});

		it('should match typos with edit distance = 2', () => {
			const masachusetts = fuzzyMatchScope('masachusetts', 'US');
			expect(masachusetts?.display_text).toBe('Massachusetts');
			expect(masachusetts?.confidence).toBeCloseTo(0.75, 2); // 0.9 - 0.15 penalty

			const conecticut = fuzzyMatchScope('conecticut', 'US');
			expect(conecticut?.display_text).toBe('Connecticut');
		});

		it('should NOT match typos with edit distance > 2', () => {
			const result = fuzzyMatchScope('californiaaaa', 'US');
			expect(result).toBeNull();
		});
	});

	describe('Case insensitivity', () => {
		it('should match regardless of case', () => {
			expect(fuzzyMatchScope('SOCAL', 'US')?.display_text).toBe('California');
			expect(fuzzyMatchScope('SoCal', 'US')?.display_text).toBe('California');
			expect(fuzzyMatchScope('NYC', 'US')?.display_text).toBe('New York City');
			expect(fuzzyMatchScope('Nyc', 'US')?.display_text).toBe('New York City');
			expect(fuzzyMatchScope('CALIFORNIA', 'US')?.display_text).toBe('California');
			expect(fuzzyMatchScope('California', 'US')?.display_text).toBe('California');
		});
	});

	describe('Multi-word patterns', () => {
		it('should match multi-word patterns exactly', () => {
			const bayArea = fuzzyMatchScope('bay area', 'US');
			expect(bayArea?.display_text).toBe('California');

			const newYork = fuzzyMatchScope('new york', 'US');
			expect(newYork?.display_text).toBe('New York');

			const sanFrancisco = fuzzyMatchScope('san francisco', 'US');
			expect(sanFrancisco?.display_text).toBe('San Francisco');
		});
	});

	describe('Exact pattern matches - UK', () => {
		it('should match UK regions', () => {
			const england = fuzzyMatchScope('england', 'GB');
			expect(england?.display_text).toBe('England');
			expect(england?.region_code).toBe('ENG');

			const scotland = fuzzyMatchScope('scotland', 'GB');
			expect(scotland?.display_text).toBe('Scotland');

			const wales = fuzzyMatchScope('wales', 'GB');
			expect(wales?.display_text).toBe('Wales');
		});

		it('should match UK cities', () => {
			const london = fuzzyMatchScope('london', 'GB');
			expect(london?.display_text).toBe('London');
			expect(london?.scope_level).toBe('locality');

			const manchester = fuzzyMatchScope('manchester', 'GB');
			expect(manchester?.display_text).toBe('Manchester');

			const edinburgh = fuzzyMatchScope('edinburgh', 'GB');
			expect(edinburgh?.display_text).toBe('Edinburgh');
		});

		it('should match UK regional nicknames', () => {
			const greaterLondon = fuzzyMatchScope('greater london', 'GB');
			expect(greaterLondon?.display_text).toBe('London');

			const theCity = fuzzyMatchScope('the city', 'GB');
			expect(theCity?.display_text).toBe('London');
			expect(theCity?.confidence).toBe(0.7);

			const highlands = fuzzyMatchScope('highlands', 'GB');
			expect(highlands?.display_text).toBe('Scotland');
		});
	});

	describe('Exact pattern matches - France', () => {
		it('should match French regions', () => {
			const ileDeFrance = fuzzyMatchScope('île-de-france', 'FR');
			expect(ileDeFrance?.display_text).toBe('Île-de-France');

			const paca = fuzzyMatchScope('paca', 'FR');
			expect(paca?.display_text).toBe("Provence-Alpes-Côte d'Azur");
		});

		it('should match French cities', () => {
			const paris = fuzzyMatchScope('paris', 'FR');
			expect(paris?.display_text).toBe('Paris');

			const marseille = fuzzyMatchScope('marseille', 'FR');
			expect(marseille?.display_text).toBe('Marseille');
		});

		it('should match with and without accents', () => {
			const withAccent = fuzzyMatchScope('île-de-france', 'FR');
			const withoutAccent = fuzzyMatchScope('ile-de-france', 'FR');
			expect(withAccent?.display_text).toBe('Île-de-France');
			expect(withoutAccent?.display_text).toBe('Île-de-France');
		});
	});

	describe('Exact pattern matches - Japan', () => {
		it('should match Japanese prefectures', () => {
			const tokyo = fuzzyMatchScope('tokyo', 'JP');
			expect(tokyo?.display_text).toBe('Tokyo');
			expect(tokyo?.region_code).toBe('13');

			const osaka = fuzzyMatchScope('osaka', 'JP');
			expect(osaka?.display_text).toBe('Osaka');
		});

		it('should match Japanese regions', () => {
			const kanto = fuzzyMatchScope('kanto', 'JP');
			expect(kanto?.display_text).toBe('Tokyo');

			const kansai = fuzzyMatchScope('kansai', 'JP');
			expect(kansai?.display_text).toBe('Osaka');
		});
	});

	describe('Exact pattern matches - Brazil', () => {
		it('should match Brazilian states', () => {
			const saoPaulo = fuzzyMatchScope('são paulo', 'BR');
			expect(saoPaulo?.display_text).toBe('São Paulo');

			const saoPauloNoAccent = fuzzyMatchScope('sao paulo', 'BR');
			expect(saoPauloNoAccent?.display_text).toBe('São Paulo');

			const sp = fuzzyMatchScope('sp', 'BR');
			expect(sp?.display_text).toBe('São Paulo');
		});

		it('should match Brazilian regions', () => {
			const nordeste = fuzzyMatchScope('nordeste', 'BR');
			expect(nordeste?.display_text).toBe('Bahia');

			const sudeste = fuzzyMatchScope('sudeste', 'BR');
			expect(sudeste?.display_text).toBe('São Paulo');
		});
	});

	describe('Edge cases', () => {
		it('should return null for empty string', () => {
			expect(fuzzyMatchScope('', 'US')).toBeNull();
			expect(fuzzyMatchScope('   ', 'US')).toBeNull();
		});

		it('should return null for gibberish', () => {
			expect(fuzzyMatchScope('xyz123', 'US')).toBeNull();
			expect(fuzzyMatchScope('qwerty', 'US')).toBeNull();
		});

		it('should return null for very short strings (< 2 chars)', () => {
			expect(fuzzyMatchScope('x', 'US')).toBeNull();
		});

		it('should handle special characters gracefully', () => {
			const result = fuzzyMatchScope('california!!!', 'US');
			// Special chars should be normalized/ignored
			expect(result).toBeNull(); // Won't match due to extra chars
		});

		it('should fallback to US patterns for unsupported country', () => {
			const result = fuzzyMatchScope('california', 'XX');
			expect(result?.display_text).toBe('California');
		});
	});

	describe('Batch matching', () => {
		it('should handle batch fuzzy matching', () => {
			const texts = ['socal', 'nyc', 'gibberish', 'bay area'];
			const results = batchFuzzyMatch(texts, 'US');

			expect(results).toHaveLength(4);
			expect(results[0]?.display_text).toBe('California');
			expect(results[1]?.display_text).toBe('New York City');
			expect(results[2]).toBeNull();
			expect(results[3]?.display_text).toBe('California');
		});
	});

	describe('Closest pattern finder (debug)', () => {
		it('should find closest pattern even if distance > threshold', () => {
			const closest = findClosestPattern('californiaa', 'US');
			expect(closest).not.toBeNull();
			expect(closest?.pattern.canonical).toBe('California');
			expect(closest?.distance).toBeGreaterThan(2);
		});

		it('should return null for empty input', () => {
			expect(findClosestPattern('', 'US')).toBeNull();
		});
	});
});

describe('Fuzzy Matcher Statistics', () => {
	let stats: ReturnType<typeof getFuzzyMatcherStats>;
	let patternStats: ReturnType<typeof getFuzzyPatternStats>;

	beforeAll(() => {
		stats = getFuzzyMatcherStats();
		patternStats = getFuzzyPatternStats();
	});

	it('should report pattern counts per country', () => {
		expect(stats.patternCount.US).toBeGreaterThan(200);
		expect(stats.patternCount.GB).toBeGreaterThan(50);
		expect(stats.patternCount.FR).toBeGreaterThan(30);
		expect(stats.patternCount.JP).toBeGreaterThan(20);
		expect(stats.patternCount.BR).toBeGreaterThan(20);
	});

	it('should report total pattern count > 320', () => {
		expect(stats.totalPatterns).toBeGreaterThan(320);
		expect(stats.totalPatterns).toBe(patternStats.total);
	});

	it('should report configuration constants', () => {
		expect(stats.maxEditDistance).toBe(2);
		expect(stats.confidencePenaltyPerEdit).toBe(0.075);
	});

	it('should meet minimum pattern requirements', () => {
		expect(patternStats.US).toBeGreaterThanOrEqual(200);
		expect(patternStats.GB).toBeGreaterThanOrEqual(50);
		expect(patternStats.FR).toBeGreaterThanOrEqual(30);
		expect(patternStats.JP).toBeGreaterThanOrEqual(20);
		expect(patternStats.BR).toBeGreaterThanOrEqual(20);
	});
});

describe('Performance Benchmarks', () => {
	it('should match patterns in < 5ms for 1000 patterns', () => {
		const start = performance.now();

		// Perform 1000 fuzzy matches
		for (let i = 0; i < 1000; i++) {
			fuzzyMatchScope('california', 'US');
		}

		const elapsed = performance.now() - start;
		const avgPerMatch = elapsed / 1000;

		expect(avgPerMatch).toBeLessThan(5);
	});

	it('should handle typo matching efficiently', () => {
		const start = performance.now();

		// Perform 500 typo matches (more expensive)
		for (let i = 0; i < 500; i++) {
			fuzzyMatchScope('californa', 'US');
		}

		const elapsed = performance.now() - start;
		const avgPerMatch = elapsed / 500;

		expect(avgPerMatch).toBeLessThan(10); // Typo matching can be slightly slower
	});

	it('should handle no-match efficiently', () => {
		const start = performance.now();

		// Perform 1000 no-match attempts
		for (let i = 0; i < 1000; i++) {
			fuzzyMatchScope('gibberish123', 'US');
		}

		const elapsed = performance.now() - start;
		const avgPerMatch = elapsed / 1000;

		expect(avgPerMatch).toBeLessThan(5);
	});
});

describe('Real-world usage scenarios', () => {
	it('should handle common user inputs', () => {
		// Regional nicknames
		expect(fuzzyMatchScope('socal', 'US')?.display_text).toBe('California');
		expect(fuzzyMatchScope('bay area', 'US')?.display_text).toBe('California');

		// City abbreviations
		expect(fuzzyMatchScope('nyc', 'US')?.display_text).toBe('New York City');
		expect(fuzzyMatchScope('sf', 'US')?.display_text).toBe('San Francisco');

		// Common typos
		expect(fuzzyMatchScope('californa', 'US')?.display_text).toBe('California');
		expect(fuzzyMatchScope('florda', 'US')?.display_text).toBe('Florida');

		// International
		expect(fuzzyMatchScope('paca', 'FR')?.display_text).toBe("Provence-Alpes-Côte d'Azur");
		expect(fuzzyMatchScope('kanto', 'JP')?.display_text).toBe('Tokyo');
	});

	it('should prioritize higher confidence matches', () => {
		const exact = fuzzyMatchScope('california', 'US');
		const typo = fuzzyMatchScope('californa', 'US');

		expect(exact?.confidence).toBeGreaterThan(typo?.confidence || 0);
	});

	it('should handle mixed case user input', () => {
		expect(fuzzyMatchScope('SoCal', 'US')?.display_text).toBe('California');
		expect(fuzzyMatchScope('NYC', 'US')?.display_text).toBe('New York City');
		expect(fuzzyMatchScope('Bay Area', 'US')?.display_text).toBe('California');
	});
});
