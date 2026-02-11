import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SuggestionCache } from '$lib/services/ai/suggestion-cache';

interface TestSuggestion {
	title: string;
	description: string;
}

describe('SuggestionCache', () => {
	let cache: SuggestionCache<TestSuggestion>;

	beforeEach(() => {
		cache = new SuggestionCache<TestSuggestion>(5 as any, 1000 as any); // Small cache, 1s duration for testing
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should store and retrieve suggestions', () => {
		const suggestion: TestSuggestion = { title: 'Test', description: 'Description' };
		cache.set('key1', suggestion);

		const retrieved = cache.get('key1');
		expect(retrieved).toEqual(suggestion);
	});

	it('should return null for non-existent keys', () => {
		expect(cache.get('nonexistent')).toBeNull();
	});

	it('should expire old entries', () => {
		const suggestion: TestSuggestion = { title: 'Test', description: 'Description' };
		cache.set('key1', suggestion);

		// Fast-forward past cache duration
		vi.advanceTimersByTime(1100);

		expect(cache.get('key1')).toBeNull();
	});

	it('should evict oldest entry when at capacity', () => {
		// Fill cache to capacity
		for (let i = 0; i < 5; i++) {
			cache.set(`key${i}`, { title: `Test ${i}`, description: `Desc ${i}` });
		}

		// Add one more (should evict key0)
		cache.set('key5', { title: 'Test 5', description: 'Desc 5' });

		expect(cache.get('key0')).toBeNull();
		expect(cache.get('key5')).not.toBeNull();
	});

	it('should implement LRU behavior', () => {
		// Fill cache
		for (let i = 0; i < 5; i++) {
			cache.set(`key${i}`, { title: `Test ${i}`, description: `Desc ${i}` });
		}

		// Access key0 (moves it to end)
		cache.get('key0');

		// Add new entry (should evict key1, not key0)
		cache.set('key5', { title: 'Test 5', description: 'Desc 5' });

		expect(cache.get('key0')).not.toBeNull();
		expect(cache.get('key1')).toBeNull();
	});

	it('should clear all entries', () => {
		cache.set('key1', { title: 'Test 1', description: 'Desc 1' });
		cache.set('key2', { title: 'Test 2', description: 'Desc 2' });

		cache.clear();

		expect(cache.get('key1')).toBeNull();
		expect(cache.get('key2')).toBeNull();
	});
});
