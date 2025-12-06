import { AI_SUGGESTION_TIMING } from '$lib/constants/ai-timing';

interface CachedSuggestion<T> {
	suggestion: T;
	timestamp: number;
}

/**
 * LRU cache for AI suggestions
 */
export class SuggestionCache<T> {
	private cache = new Map<string, CachedSuggestion<T>>();
	private readonly maxSize: number;
	private readonly cacheDuration: number;

	constructor(
		maxSize = AI_SUGGESTION_TIMING.MAX_CACHE_SIZE,
		cacheDuration = AI_SUGGESTION_TIMING.CACHE_DURATION
	) {
		this.maxSize = maxSize;
		this.cacheDuration = cacheDuration;
	}

	get(key: string): T | null {
		const cached = this.cache.get(key);

		// Check if expired
		if (!cached || Date.now() - cached.timestamp > this.cacheDuration) {
			this.cache.delete(key);
			return null;
		}

		// Move to end (LRU)
		this.cache.delete(key);
		this.cache.set(key, cached);

		return cached.suggestion;
	}

	set(key: string, suggestion: T): void {
		// Evict oldest if at capacity
		if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey) this.cache.delete(firstKey);
		}

		this.cache.set(key, {
			suggestion,
			timestamp: Date.now()
		});
	}

	clear(): void {
		this.cache.clear();
	}
}
