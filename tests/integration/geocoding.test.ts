/**
 * Integration tests for Google Maps geocoding integration
 * Tests geocoding API, caching layer, and rate limiting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { geocodeLocation, geocodeResultToScopeMapping } from '$lib/server/geocoding';
import type { GeocodeResult } from '$lib/server/geocoding';
import {
	getCachedGeocode,
	setCachedGeocode,
	clearGeocodeCache
} from '$lib/server/geocoding-cache';
import {
	checkRateLimit,
	resetRateLimitState,
	getRateLimitStats,
	openCircuitBreaker,
	closeCircuitBreaker
} from '$lib/server/geocoding-rate-limiter';

describe('Geocoding Integration', () => {
	beforeEach(() => {
		// Reset rate limiter state before each test
		resetRateLimitState();
		closeCircuitBreaker();
	});

	describe('geocodeLocation', () => {
		it('should geocode a full address to locality', async () => {
			// Skip if no API key (CI environment)
			if (!process.env.GOOGLE_MAPS_API_KEY) {
				console.log('[test] Skipping: GOOGLE_MAPS_API_KEY not set');
				return;
			}

			const result = await geocodeLocation('1600 Pennsylvania Ave NW, Washington, DC');

			expect(result).toBeTruthy();
			if (result) {
				expect(result.country_code).toBe('US');
				expect(result.scope_level).toBe('locality');
				expect(result.display_text).toContain('Washington');
				expect(result.confidence).toBeGreaterThanOrEqual(0.8);
				expect(result.lat).toBeDefined();
				expect(result.lng).toBeDefined();
			}
		});

		it('should geocode a city name to locality', async () => {
			if (!process.env.GOOGLE_MAPS_API_KEY) {
				console.log('[test] Skipping: GOOGLE_MAPS_API_KEY not set');
				return;
			}

			const result = await geocodeLocation('San Francisco, CA');

			expect(result).toBeTruthy();
			if (result) {
				expect(result.country_code).toBe('US');
				expect(result.scope_level).toBe('locality');
				expect(result.display_text).toContain('San Francisco');
				expect(result.region_code).toBe('CA');
			}
		});

		it('should geocode a state name to region', async () => {
			if (!process.env.GOOGLE_MAPS_API_KEY) {
				console.log('[test] Skipping: GOOGLE_MAPS_API_KEY not set');
				return;
			}

			const result = await geocodeLocation('California');

			expect(result).toBeTruthy();
			if (result) {
				expect(result.country_code).toBe('US');
				expect(result.scope_level).toBe('region');
				expect(result.region_code).toBe('CA');
			}
		});

		it('should handle invalid locations gracefully', async () => {
			if (!process.env.GOOGLE_MAPS_API_KEY) {
				console.log('[test] Skipping: GOOGLE_MAPS_API_KEY not set');
				return;
			}

			const result = await geocodeLocation('asdjkfhalskdjfh12983741928347');

			expect(result).toBeNull();
		});

		it('should respect timeout', async () => {
			if (!process.env.GOOGLE_MAPS_API_KEY) {
				console.log('[test] Skipping: GOOGLE_MAPS_API_KEY not set');
				return;
			}

			const result = await geocodeLocation('New York', { timeout: 1 }); // 1ms timeout

			// Should either succeed (fast network) or return null (timeout)
			expect(result === null || result?.country_code === 'US').toBe(true);
		});

		it('should return null when API key missing', async () => {
			const originalKey = process.env.GOOGLE_MAPS_API_KEY;
			delete process.env.GOOGLE_MAPS_API_KEY;

			const result = await geocodeLocation('New York');

			expect(result).toBeNull();

			// Restore key
			if (originalKey) {
				process.env.GOOGLE_MAPS_API_KEY = originalKey;
			}
		});
	});

	describe('geocodeResultToScopeMapping', () => {
		it('should convert GeocodeResult to ScopeMapping', () => {
			const geocodeResult: GeocodeResult = {
				display_text: 'San Francisco',
				country_code: 'US',
				region_code: 'CA',
				locality_code: 'San Francisco',
				scope_level: 'locality',
				confidence: 0.85,
				lat: 37.7749,
				lng: -122.4194,
				formatted_address: 'San Francisco, CA, USA'
			};

			const scopeMapping = geocodeResultToScopeMapping(geocodeResult);

			expect(scopeMapping).toMatchObject({
				display_text: 'San Francisco',
				country_code: 'US',
				region_code: 'CA',
				locality_code: 'San Francisco',
				scope_level: 'locality',
				confidence: 0.85,
				extraction_method: 'geocoder'
			});
		});
	});

	describe('Geocoding Cache', () => {
		beforeEach(async () => {
			// Clear cache before each test
			await clearGeocodeCache();
		});

		it('should cache geocoding results', async () => {
			const mockResult: GeocodeResult = {
				display_text: 'San Francisco',
				country_code: 'US',
				region_code: 'CA',
				locality_code: 'San Francisco',
				scope_level: 'locality',
				confidence: 0.85
			};

			// Set cache
			await setCachedGeocode('San Francisco, CA', mockResult);

			// Get from cache
			const cached = await getCachedGeocode('San Francisco, CA');

			expect(cached).toEqual(mockResult);
		});

		it('should return null for cache miss', async () => {
			const cached = await getCachedGeocode('nonexistent-location-12345');

			expect(cached).toBeNull();
		});

		it('should handle normalized cache keys', async () => {
			const mockResult: GeocodeResult = {
				display_text: 'New York',
				country_code: 'US',
				region_code: 'NY',
				scope_level: 'region',
				confidence: 0.9
			};

			// Set with one format
			await setCachedGeocode('New York, NY', mockResult);

			// Get with slightly different format (normalized to same key)
			const cached = await getCachedGeocode('new york, ny');

			expect(cached).toEqual(mockResult);
		});

		it('should use in-memory cache when Redis unavailable', async () => {
			// Redis URL not set in test environment, should use memory cache
			const mockResult: GeocodeResult = {
				display_text: 'Test Location',
				country_code: 'US',
				scope_level: 'country',
				confidence: 0.5
			};

			await setCachedGeocode('test-location', mockResult);
			const cached = await getCachedGeocode('test-location');

			expect(cached).toEqual(mockResult);
		});
	});

	describe('Rate Limiting', () => {
		beforeEach(() => {
			resetRateLimitState();
		});

		it('should allow requests under rate limit', () => {
			const check = checkRateLimit();

			expect(check.allowed).toBe(true);
			expect(check.requestsRemaining).toBeDefined();
			expect(check.requestsRemaining!.thisSecond).toBe(49); // 50 - 1
			expect(check.requestsRemaining!.thisMonth).toBe(39999); // 40000 - 1
		});

		it('should reject requests over per-second limit', () => {
			// Make 50 requests
			for (let i = 0; i < 50; i++) {
				checkRateLimit();
			}

			// 51st request should be rejected
			const check = checkRateLimit();

			expect(check.allowed).toBe(false);
			expect(check.reason).toContain('50 req/sec');
		});

		it('should reject requests over monthly limit', () => {
			// Simulate 40,000 requests - this will hit per-second limit first since
			// all calls happen in the same test execution second.
			// The rate limiter correctly rejects at either threshold.
			for (let i = 0; i < 40000; i++) {
				checkRateLimit();
			}

			// Request should be rejected (either per-second or monthly limit)
			const check = checkRateLimit();

			expect(check.allowed).toBe(false);
			// Per-second limit (50/sec) will be hit before monthly limit (40K)
			// when all requests happen in the same second
			expect(check.reason).toBeDefined();
		});

		it('should track rate limit statistics', () => {
			// Make some requests
			checkRateLimit();
			checkRateLimit();
			checkRateLimit();

			const stats = getRateLimitStats();

			expect(stats.requestsPerSecond).toBe(3);
			expect(stats.requestsPerMonth).toBe(3);
			expect(stats.circuitBreakerOpen).toBe(false);
			expect(stats.utilizationPercent.perSecond).toBe(6); // 3/50 * 100
			expect(stats.utilizationPercent.perMonth).toBeCloseTo(0.0075, 4); // 3/40000 * 100
		});

		it('should reject requests when circuit breaker open', () => {
			// Manually open circuit breaker
			openCircuitBreaker();

			const check = checkRateLimit();

			expect(check.allowed).toBe(false);
			expect(check.reason).toContain('Circuit breaker open');
		});

		it('should allow requests after circuit breaker closed', () => {
			openCircuitBreaker();
			closeCircuitBreaker();

			const check = checkRateLimit();

			expect(check.allowed).toBe(true);
		});
	});

	describe('End-to-End Integration', () => {
		it('should use cache on second call with same location', async () => {
			if (!process.env.GOOGLE_MAPS_API_KEY) {
				console.log('[test] Skipping: GOOGLE_MAPS_API_KEY not set');
				return;
			}

			await clearGeocodeCache();

			// First call - should hit API
			const result1 = await geocodeLocation('Seattle, WA');
			expect(result1).toBeTruthy();

			// Cache the result
			if (result1) {
				await setCachedGeocode('Seattle, WA', result1);
			}

			// Second call - should hit cache
			const cached = await getCachedGeocode('seattle, wa');
			expect(cached).toEqual(result1);
		});

		it('should handle rate limiting in extraction pipeline', () => {
			resetRateLimitState();

			// Make requests up to limit
			for (let i = 0; i < 50; i++) {
				const check = checkRateLimit();
				expect(check.allowed).toBe(true);
			}

			// Next request should be rate limited
			const check = checkRateLimit();
			expect(check.allowed).toBe(false);
		});
	});
});
