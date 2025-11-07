/**
 * Search Result Caching with IndexedDB
 *
 * Caches:
 * 1. Search results (query → ranked templates)
 * 2. Query embeddings (text → embedding vector)
 * 3. Template embeddings (template_id → embedding vectors)
 *
 * Benefits:
 * - Instant repeat searches (no API call needed)
 * - Reduced OpenAI API costs
 * - Offline search capability
 *
 * Expiration:
 * - Search results: 1 hour (templates may be updated)
 * - Query embeddings: 24 hours (queries don't change meaning frequently)
 * - Template embeddings: 7 days (templates rarely change)
 */

import type { CachedSearchResult, CachedEmbedding, RankedTemplate } from './types';

export class SearchCache {
	private dbName = 'communique-search-cache';
	private dbVersion = 1;
	private db: IDBDatabase | null = null;

	// Store names
	private readonly SEARCH_RESULTS_STORE = 'search_results';
	private readonly QUERY_EMBEDDINGS_STORE = 'query_embeddings';
	private readonly TEMPLATE_EMBEDDINGS_STORE = 'template_embeddings';

	// Expiration times (milliseconds)
	private readonly SEARCH_RESULTS_TTL = 60 * 60 * 1000; // 1 hour
	private readonly QUERY_EMBEDDINGS_TTL = 24 * 60 * 60 * 1000; // 24 hours
	private readonly TEMPLATE_EMBEDDINGS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

	/**
	 * Initialize IndexedDB
	 */
	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				reject(new Error('Failed to open IndexedDB'));
			};

			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create search results store
				if (!db.objectStoreNames.contains(this.SEARCH_RESULTS_STORE)) {
					const searchStore = db.createObjectStore(this.SEARCH_RESULTS_STORE, { keyPath: 'query' });
					searchStore.createIndex('expires_at', 'expires_at', { unique: false });
				}

				// Create query embeddings store
				if (!db.objectStoreNames.contains(this.QUERY_EMBEDDINGS_STORE)) {
					const queryStore = db.createObjectStore(this.QUERY_EMBEDDINGS_STORE, { keyPath: 'text' });
					queryStore.createIndex('expires_at', 'expires_at', { unique: false });
				}

				// Create template embeddings store
				if (!db.objectStoreNames.contains(this.TEMPLATE_EMBEDDINGS_STORE)) {
					const templateStore = db.createObjectStore(this.TEMPLATE_EMBEDDINGS_STORE, {
						keyPath: 'text'
					});
					templateStore.createIndex('expires_at', 'expires_at', { unique: false });
				}
			};
		});
	}

	/**
	 * Ensure database is initialized
	 */
	private async ensureDB(): Promise<IDBDatabase> {
		if (!this.db) {
			await this.init();
		}
		if (!this.db) {
			throw new Error('Failed to initialize IndexedDB');
		}
		return this.db;
	}

	/**
	 * Cache search results
	 */
	async cacheResults(query: string, results: RankedTemplate[]): Promise<void> {
		const db = await this.ensureDB();
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + this.SEARCH_RESULTS_TTL).toISOString();

		const cached: CachedSearchResult = {
			query,
			results,
			timestamp: now,
			expires_at: expiresAt
		};

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.SEARCH_RESULTS_STORE], 'readwrite');
			const store = transaction.objectStore(this.SEARCH_RESULTS_STORE);
			const request = store.put(cached);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error('Failed to cache search results'));
		});
	}

	/**
	 * Get cached search results
	 */
	async getCached(query: string): Promise<RankedTemplate[] | null> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.SEARCH_RESULTS_STORE], 'readonly');
			const store = transaction.objectStore(this.SEARCH_RESULTS_STORE);
			const request = store.get(query);

			request.onsuccess = () => {
				const cached = request.result as CachedSearchResult | undefined;

				if (!cached) {
					resolve(null);
					return;
				}

				// Check if expired
				const now = new Date();
				const expiresAt = new Date(cached.expires_at);

				if (now > expiresAt) {
					// Expired - delete and return null
					this.deleteSearchResult(query).catch(console.error);
					resolve(null);
					return;
				}

				resolve(cached.results);
			};

			request.onerror = () => reject(new Error('Failed to get cached search results'));
		});
	}

	/**
	 * Cache query embedding
	 */
	async cacheEmbedding(text: string, embedding: number[]): Promise<void> {
		const db = await this.ensureDB();
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + this.QUERY_EMBEDDINGS_TTL).toISOString();

		const cached: CachedEmbedding = {
			text,
			embedding,
			model: 'text-embedding-3-large',
			timestamp: now,
			expires_at: expiresAt
		};

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.QUERY_EMBEDDINGS_STORE], 'readwrite');
			const store = transaction.objectStore(this.QUERY_EMBEDDINGS_STORE);
			const request = store.put(cached);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error('Failed to cache embedding'));
		});
	}

	/**
	 * Get cached embedding
	 */
	async getCachedEmbedding(text: string): Promise<number[] | null> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.QUERY_EMBEDDINGS_STORE], 'readonly');
			const store = transaction.objectStore(this.QUERY_EMBEDDINGS_STORE);
			const request = store.get(text);

			request.onsuccess = () => {
				const cached = request.result as CachedEmbedding | undefined;

				if (!cached) {
					resolve(null);
					return;
				}

				// Check if expired
				const now = new Date();
				const expiresAt = new Date(cached.expires_at);

				if (now > expiresAt) {
					// Expired - delete and return null
					this.deleteEmbedding(text).catch(console.error);
					resolve(null);
					return;
				}

				resolve(cached.embedding);
			};

			request.onerror = () => reject(new Error('Failed to get cached embedding'));
		});
	}

	/**
	 * Clear expired entries
	 */
	async clearExpired(): Promise<void> {
		const db = await this.ensureDB();
		const now = new Date().toISOString();

		const stores = [
			this.SEARCH_RESULTS_STORE,
			this.QUERY_EMBEDDINGS_STORE,
			this.TEMPLATE_EMBEDDINGS_STORE
		];

		for (const storeName of stores) {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction([storeName], 'readwrite');
				const store = transaction.objectStore(storeName);
				const index = store.index('expires_at');
				const range = IDBKeyRange.upperBound(now);
				const request = index.openCursor(range);

				request.onsuccess = () => {
					const cursor = request.result;
					if (cursor) {
						cursor.delete();
						cursor.continue();
					} else {
						resolve();
					}
				};

				request.onerror = () => reject(new Error(`Failed to clear expired entries from ${storeName}`));
			});
		}
	}

	/**
	 * Clear all caches
	 */
	async clearAll(): Promise<void> {
		const db = await this.ensureDB();

		const stores = [
			this.SEARCH_RESULTS_STORE,
			this.QUERY_EMBEDDINGS_STORE,
			this.TEMPLATE_EMBEDDINGS_STORE
		];

		for (const storeName of stores) {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction([storeName], 'readwrite');
				const store = transaction.objectStore(storeName);
				const request = store.clear();

				request.onsuccess = () => resolve();
				request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
			});
		}
	}

	/**
	 * Delete specific search result
	 */
	private async deleteSearchResult(query: string): Promise<void> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.SEARCH_RESULTS_STORE], 'readwrite');
			const store = transaction.objectStore(this.SEARCH_RESULTS_STORE);
			const request = store.delete(query);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error('Failed to delete search result'));
		});
	}

	/**
	 * Delete specific embedding
	 */
	private async deleteEmbedding(text: string): Promise<void> {
		const db = await this.ensureDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.QUERY_EMBEDDINGS_STORE], 'readwrite');
			const store = transaction.objectStore(this.QUERY_EMBEDDINGS_STORE);
			const request = store.delete(text);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error('Failed to delete embedding'));
		});
	}

	/**
	 * Get cache statistics (for debugging)
	 */
	async getStats(): Promise<{
		searchResults: number;
		queryEmbeddings: number;
		templateEmbeddings: number;
	}> {
		const db = await this.ensureDB();

		const countStore = async (storeName: string): Promise<number> => {
			return new Promise((resolve, reject) => {
				const transaction = db.transaction([storeName], 'readonly');
				const store = transaction.objectStore(storeName);
				const request = store.count();

				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(new Error(`Failed to count ${storeName}`));
			});
		};

		const searchResults = await countStore(this.SEARCH_RESULTS_STORE);
		const queryEmbeddings = await countStore(this.QUERY_EMBEDDINGS_STORE);
		const templateEmbeddings = await countStore(this.TEMPLATE_EMBEDDINGS_STORE);

		return { searchResults, queryEmbeddings, templateEmbeddings };
	}
}

/**
 * Create search cache instance
 */
export function createSearchCache(): SearchCache {
	return new SearchCache();
}
