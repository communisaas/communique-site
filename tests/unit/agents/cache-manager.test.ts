/**
 * Cache Manager Unit Tests
 *
 * Tests for Gemini context caching functionality:
 * - Content hashing
 * - Cache creation and retrieval
 * - TTL management
 * - Cost savings calculations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	hashContent,
	getOrCreateCache,
	invalidateCache,
	clearAllCaches,
	getCacheStats,
	estimateTokenSavings,
	stopCleanup,
	type CacheableContent
} from '$lib/core/agents/cache-manager';

// Mock the Gemini client
vi.mock('$lib/core/agents/gemini-client', () => ({
	getGeminiClient: vi.fn(() => ({
		caches: {
			create: vi.fn(async ({ config }) => ({
				name: `cachedContents/mock-${Date.now()}`,
				model: 'gemini-3-flash-preview',
				createTime: new Date().toISOString(),
				updateTime: new Date().toISOString(),
				ttl: config.ttl
			}))
		}
	}))
}));

describe('Cache Manager', () => {
	beforeEach(() => {
		clearAllCaches();
	});

	afterEach(() => {
		clearAllCaches();
		stopCleanup();
	});

	describe('hashContent', () => {
		it('should generate consistent hash for same content', () => {
			const content: CacheableContent = {
				systemInstruction: 'You are an expert analyst.',
				responseSchema: { type: 'object', properties: { result: { type: 'string' } } }
			};

			const hash1 = hashContent(content);
			const hash2 = hashContent(content);

			expect(hash1).toBe(hash2);
			expect(hash1).toHaveLength(64); // SHA-256 hex length
		});

		it('should generate different hashes for different content', () => {
			const content1: CacheableContent = {
				systemInstruction: 'You are an expert analyst.'
			};

			const content2: CacheableContent = {
				systemInstruction: 'You are a different analyst.'
			};

			const hash1 = hashContent(content1);
			const hash2 = hashContent(content2);

			expect(hash1).not.toBe(hash2);
		});

		it('should include schema in hash', () => {
			const withSchema: CacheableContent = {
				systemInstruction: 'Test',
				responseSchema: { type: 'object' }
			};

			const withoutSchema: CacheableContent = {
				systemInstruction: 'Test'
			};

			const hash1 = hashContent(withSchema);
			const hash2 = hashContent(withoutSchema);

			expect(hash1).not.toBe(hash2);
		});

		it('should handle schema with same properties in different order', () => {
			const schema1 = { a: 1, b: 2, c: 3 };
			const schema2 = { c: 3, a: 1, b: 2 };

			const content1: CacheableContent = { responseSchema: schema1 };
			const content2: CacheableContent = { responseSchema: schema2 };

			const hash1 = hashContent(content1);
			const hash2 = hashContent(content2);

			// Hashes should be the same because we sort keys
			expect(hash1).toBe(hash2);
		});
	});

	describe('getOrCreateCache', () => {
		it('should create cache on first call', async () => {
			const content: CacheableContent = {
				systemInstruction: 'Test prompt',
				displayName: 'test-cache'
			};

			const cacheName = await getOrCreateCache(content, 'gemini-3-flash-preview', 'long');

			expect(cacheName).toMatch(/^cachedContents\/mock-/);

			const stats = getCacheStats();
			expect(stats.totalCaches).toBe(1);
			expect(stats.validCaches).toBe(1);
		});

		it('should reuse cache on subsequent calls with same content', async () => {
			const content: CacheableContent = {
				systemInstruction: 'Test prompt',
				displayName: 'test-cache'
			};

			const cacheName1 = await getOrCreateCache(content, 'gemini-3-flash-preview', 'long');
			const cacheName2 = await getOrCreateCache(content, 'gemini-3-flash-preview', 'long');

			expect(cacheName1).toBe(cacheName2);

			const stats = getCacheStats();
			expect(stats.totalCaches).toBe(1); // Only one cache created
		});

		it('should create different caches for different content', async () => {
			const content1: CacheableContent = {
				systemInstruction: 'Prompt 1',
				displayName: 'cache-1'
			};

			const content2: CacheableContent = {
				systemInstruction: 'Prompt 2',
				displayName: 'cache-2'
			};

			const cacheName1 = await getOrCreateCache(content1, 'gemini-3-flash-preview', 'long');
			const cacheName2 = await getOrCreateCache(content2, 'gemini-3-flash-preview', 'long');

			expect(cacheName1).not.toBe(cacheName2);

			const stats = getCacheStats();
			expect(stats.totalCaches).toBe(2);
		});

		it('should handle cache with both system instruction and schema', async () => {
			const content: CacheableContent = {
				systemInstruction: 'Test prompt',
				responseSchema: { type: 'object', properties: { result: { type: 'string' } } },
				displayName: 'complex-cache'
			};

			const cacheName = await getOrCreateCache(content, 'gemini-3-flash-preview', 'medium');

			expect(cacheName).toMatch(/^cachedContents\/mock-/);
		});
	});

	describe('invalidateCache', () => {
		it('should remove cache from registry', async () => {
			const content: CacheableContent = {
				systemInstruction: 'Test prompt',
				displayName: 'test-cache'
			};

			await getOrCreateCache(content, 'gemini-3-flash-preview', 'long');

			let stats = getCacheStats();
			expect(stats.totalCaches).toBe(1);

			invalidateCache(content);

			stats = getCacheStats();
			expect(stats.totalCaches).toBe(0);
		});

		it('should not throw on invalidating non-existent cache', () => {
			const content: CacheableContent = {
				systemInstruction: 'Non-existent',
				displayName: 'non-existent'
			};

			expect(() => invalidateCache(content)).not.toThrow();
		});
	});

	describe('clearAllCaches', () => {
		it('should clear all caches from registry', async () => {
			const content1: CacheableContent = { systemInstruction: 'Prompt 1' };
			const content2: CacheableContent = { systemInstruction: 'Prompt 2' };

			await getOrCreateCache(content1, 'gemini-3-flash-preview', 'long');
			await getOrCreateCache(content2, 'gemini-3-flash-preview', 'long');

			let stats = getCacheStats();
			expect(stats.totalCaches).toBe(2);

			clearAllCaches();

			stats = getCacheStats();
			expect(stats.totalCaches).toBe(0);
		});
	});

	describe('getCacheStats', () => {
		it('should return correct statistics', async () => {
			const content1: CacheableContent = {
				systemInstruction: 'Prompt 1',
				displayName: 'cache-1'
			};
			const content2: CacheableContent = {
				systemInstruction: 'Prompt 2',
				displayName: 'cache-2'
			};

			await getOrCreateCache(content1, 'gemini-3-flash-preview', 'long');
			await getOrCreateCache(content2, 'gemini-3-flash-preview', 'medium');

			const stats = getCacheStats();

			expect(stats.totalCaches).toBe(2);
			expect(stats.validCaches).toBe(2);
			expect(stats.expiredCaches).toBe(0);
			expect(stats.cacheDetails).toHaveLength(2);

			// Check cache details
			const cache1 = stats.cacheDetails.find((c) => c.displayName === 'cache-1');
			const cache2 = stats.cacheDetails.find((c) => c.displayName === 'cache-2');

			expect(cache1).toBeDefined();
			expect(cache2).toBeDefined();
			expect(cache1?.isExpired).toBe(false);
			expect(cache2?.isExpired).toBe(false);
		});

		it('should return empty stats when no caches exist', () => {
			const stats = getCacheStats();

			expect(stats.totalCaches).toBe(0);
			expect(stats.validCaches).toBe(0);
			expect(stats.expiredCaches).toBe(0);
			expect(stats.cacheDetails).toHaveLength(0);
		});
	});

	describe('estimateTokenSavings', () => {
		it('should calculate correct savings for 2 requests (break-even)', () => {
			const savings = estimateTokenSavings(1000, 2);

			expect(savings.withoutCaching).toBe(2000); // 1000 * 2
			expect(savings.withCaching).toBe(1100); // 1000 * (1 + 0.1 * 1)
			expect(savings.tokensSaved).toBe(900); // 2000 - 1100
			expect(savings.percentSaved).toBeCloseTo(45, 1); // 900/2000 = 45%
			expect(savings.costEffectiveAfter).toBe(2);
		});

		it('should calculate correct savings for 10 requests', () => {
			const savings = estimateTokenSavings(1000, 10);

			expect(savings.withoutCaching).toBe(10000); // 1000 * 10
			expect(savings.withCaching).toBe(1900); // 1000 * (1 + 0.1 * 9)
			expect(savings.tokensSaved).toBe(8100); // 10000 - 1900
			expect(savings.percentSaved).toBeCloseTo(81, 1); // 8100/10000 = 81%
		});

		it('should calculate correct savings for 100 requests', () => {
			const savings = estimateTokenSavings(800, 100);

			expect(savings.withoutCaching).toBe(80000); // 800 * 100
			expect(savings.withCaching).toBe(8720); // 800 * (1 + 0.1 * 99)
			expect(savings.tokensSaved).toBe(71280); // 80000 - 8720
			expect(savings.percentSaved).toBeCloseTo(89.1, 1); // 71280/80000 = 89.1%
		});

		it('should handle single request (no savings)', () => {
			const savings = estimateTokenSavings(1000, 1);

			expect(savings.withoutCaching).toBe(1000);
			expect(savings.withCaching).toBe(1000); // 1000 * (1 + 0.1 * 0)
			expect(savings.tokensSaved).toBe(0);
			expect(savings.percentSaved).toBe(0);
		});

		it('should handle zero requests', () => {
			const savings = estimateTokenSavings(1000, 0);

			expect(savings.withoutCaching).toBe(0);
			expect(savings.withCaching).toBe(0);
			expect(savings.tokensSaved).toBe(0);
			expect(savings.percentSaved).toBe(0);
		});

		it('should calculate realistic savings for role discovery prompt', () => {
			// Role discovery prompt is approximately 800 tokens
			// Typical campaign might use it 100 times
			const rolePromptTokens = 800;
			const campaignRequests = 100;

			const savings = estimateTokenSavings(rolePromptTokens, campaignRequests);

			// Without caching: 800 * 100 = 80,000 tokens
			expect(savings.withoutCaching).toBe(80000);

			// With caching: 800 * (1 + 0.1 * 99) = 8,720 tokens
			expect(savings.withCaching).toBe(8720);

			// Tokens saved: 80,000 - 8,720 = 71,280 tokens
			expect(savings.tokensSaved).toBe(71280);

			// Percent saved: 71,280 / 80,000 = 89.1%
			expect(savings.percentSaved).toBeCloseTo(89.1, 1);
		});

		it('should calculate realistic savings for person lookup prompt', () => {
			// Person lookup prompt is approximately 1200 tokens
			// Typical campaign might use it 100 times
			const personPromptTokens = 1200;
			const campaignRequests = 100;

			const savings = estimateTokenSavings(personPromptTokens, campaignRequests);

			// Without caching: 1200 * 100 = 120,000 tokens
			expect(savings.withoutCaching).toBe(120000);

			// With caching: 1200 * (1 + 0.1 * 99) = 13,080 tokens
			expect(savings.withCaching).toBe(13080);

			// Tokens saved: 120,000 - 13,080 = 106,920 tokens
			expect(savings.tokensSaved).toBe(106920);

			// Percent saved: 106,920 / 120,000 = 89.1%
			expect(savings.percentSaved).toBeCloseTo(89.1, 1);
		});
	});
});
