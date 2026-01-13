/**
 * Unit tests for analytics snapshot materialization
 */

import { describe, it, expect } from 'vitest';
import { generateNoiseSeed, seededLaplace } from '$lib/core/analytics/snapshot';
import { PRIVACY } from '$lib/types/analytics';

describe('Analytics Snapshot', () => {
	describe('generateNoiseSeed', () => {
		it('should generate deterministic seed with date prefix', () => {
			const date = new Date('2025-01-12T00:00:00.000Z');
			const seed = generateNoiseSeed(date);

			// Seed should start with date
			expect(seed).toMatch(/^2025-01-12:/);

			// Seed should have hexadecimal random component
			const parts = seed.split(':');
			expect(parts).toHaveLength(2);
			expect(parts[1]).toMatch(/^[0-9a-f]+$/);
			expect(parts[1].length).toBeGreaterThan(0);
		});

		it('should generate different seeds for different dates', () => {
			const date1 = new Date('2025-01-12T00:00:00.000Z');
			const date2 = new Date('2025-01-13T00:00:00.000Z');

			const seed1 = generateNoiseSeed(date1);
			const seed2 = generateNoiseSeed(date2);

			expect(seed1).not.toBe(seed2);
		});
	});

	describe('seededLaplace', () => {
		it('should produce reproducible noise for same seed and index', () => {
			const seed = 'test-seed-123';
			const index = 0;
			const epsilon = PRIVACY.SERVER_EPSILON;

			const noise1 = seededLaplace(seed, index, epsilon);
			const noise2 = seededLaplace(seed, index, epsilon);

			expect(noise1).toBe(noise2);
		});

		it('should produce different noise for different indexes', () => {
			const seed = 'test-seed-123';
			const epsilon = PRIVACY.SERVER_EPSILON;

			const noise0 = seededLaplace(seed, 0, epsilon);
			const noise1 = seededLaplace(seed, 1, epsilon);
			const noise2 = seededLaplace(seed, 2, epsilon);

			expect(noise0).not.toBe(noise1);
			expect(noise1).not.toBe(noise2);
			expect(noise0).not.toBe(noise2);
		});

		it('should produce different noise for different seeds', () => {
			const index = 0;
			const epsilon = PRIVACY.SERVER_EPSILON;

			const noise1 = seededLaplace('seed-1', index, epsilon);
			const noise2 = seededLaplace('seed-2', index, epsilon);

			expect(noise1).not.toBe(noise2);
		});

		it('should produce noise with reasonable distribution', () => {
			const seed = 'test-seed-distribution';
			const epsilon = PRIVACY.SERVER_EPSILON;
			const sampleSize = 1000;

			// Generate samples
			const samples = Array.from({ length: sampleSize }, (_, i) =>
				seededLaplace(seed, i, epsilon)
			);

			// Calculate mean and standard deviation
			const mean = samples.reduce((a, b) => a + b, 0) / sampleSize;
			const variance =
				samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / sampleSize;
			const stdDev = Math.sqrt(variance);

			// Laplace distribution with scale = 1/ε should have:
			// - Mean ≈ 0
			// - Standard deviation ≈ √2 * scale = √2 / ε
			const expectedScale = PRIVACY.SENSITIVITY / epsilon;
			const expectedStdDev = Math.sqrt(2) * expectedScale;

			// Allow 20% tolerance due to finite sample size
			expect(Math.abs(mean)).toBeLessThan(0.3);
			expect(stdDev).toBeGreaterThan(expectedStdDev * 0.8);
			expect(stdDev).toBeLessThan(expectedStdDev * 1.2);
		});

		it('should handle edge cases without errors', () => {
			const seed = 'edge-case-seed';
			const epsilon = PRIVACY.SERVER_EPSILON;

			// Should not throw
			expect(() => seededLaplace(seed, 0, epsilon)).not.toThrow();
			expect(() => seededLaplace(seed, -1, epsilon)).not.toThrow();
			expect(() => seededLaplace(seed, 999999, epsilon)).not.toThrow();
		});

		it('should produce less noise for higher epsilon', () => {
			const seed = 'epsilon-test-seed';
			const index = 0;
			const sampleSize = 100;

			// Generate samples with different epsilon values
			const lowEpsilon = 0.5;
			const highEpsilon = 2.0;

			const samplesLow = Array.from({ length: sampleSize }, (_, i) =>
				Math.abs(seededLaplace(seed, i, lowEpsilon))
			);
			const samplesHigh = Array.from({ length: sampleSize }, (_, i) =>
				Math.abs(seededLaplace(seed, i + sampleSize, highEpsilon))
			);

			const meanAbsLow = samplesLow.reduce((a, b) => a + b, 0) / sampleSize;
			const meanAbsHigh = samplesHigh.reduce((a, b) => a + b, 0) / sampleSize;

			// Lower epsilon (more privacy) should have larger noise
			expect(meanAbsLow).toBeGreaterThan(meanAbsHigh);
		});
	});
});
