import { describe, it, expect } from 'vitest';
import { calculateSimilarity } from '$lib/utils/similarity';

describe('calculateSimilarity', () => {
	it('should return 0 for identical strings', () => {
		expect(calculateSimilarity('hello', 'hello')).toBe(0);
	});

	it('should return 1 for completely different strings', () => {
		const similarity = calculateSimilarity('abc', 'xyz');
		expect(similarity).toBe(1);
	});

	it('should handle case insensitivity', () => {
		expect(calculateSimilarity('Hello', 'hello')).toBe(0);
	});

	it('should calculate partial similarity correctly', () => {
		const similarity = calculateSimilarity('hello', 'hallo');
		expect(similarity).toBeGreaterThan(0);
		expect(similarity).toBeLessThan(1);
	});

	it('should handle empty strings', () => {
		expect(calculateSimilarity('', '')).toBe(0);
	});

	it('should detect 20% change threshold', () => {
		// "The rent is too high" → "The rent keeps going up"
		const original = 'The rent is too high';
		const modified = 'The rent keeps going up';
		const similarity = calculateSimilarity(original, modified);

		// Should be different enough to trigger regeneration (> 0.2 difference)
		expect(similarity).toBeGreaterThan(0.2);
	});

	it('should not trigger on minor changes', () => {
		// Minor typo correction
		const original = 'The rent is too high';
		const modified = 'The rent is too high.';
		const similarity = calculateSimilarity(original, modified);

		// Should be similar enough to not trigger regeneration (< 0.2 difference)
		expect(similarity).toBeLessThan(0.2);
	});
});
