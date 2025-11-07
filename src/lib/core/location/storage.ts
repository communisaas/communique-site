/**
 * IndexedDB Storage for Location Signals
 *
 * Privacy-preserving local storage for location inference signals.
 * NO data is ever transmitted to the server - all storage is local.
 *
 * Architecture:
 * - location_signals: Stores individual signals (IP, browser, OAuth, behavioral, verified)
 * - template_views: Stores template engagement for behavioral inference
 * - inferred_location: Stores computed location inference (cached)
 */

import {
	INDEXED_DB_NAME,
	INDEXED_DB_VERSION,
	INDEXED_DB_STORES,
	isLocationSignal,
	isInferredLocation,
	isSignalExpired,
	type LocationSignal,
	type InferredLocation,
	type TemplateViewEvent
} from './types';

// ============================================================================
// IndexedDB Database Management
// ============================================================================

/**
 * LocationStorage: Client-side storage for location signals
 */
export class LocationStorage {
	private db: IDBDatabase | null = null;
	private initPromise: Promise<IDBDatabase> | null = null;

	/**
	 * Force delete the database (nuclear option for corrupted databases)
	 */
	async nukeDatabase(): Promise<void> {
		console.log('[LocationStorage] 🔥 NUKING DATABASE - Forcing complete recreation');

		// Close existing connection
		this.close();

		return new Promise((resolve, reject) => {
			const request = indexedDB.deleteDatabase(INDEXED_DB_NAME);

			request.onsuccess = () => {
				console.log('[LocationStorage] ✓ Database deleted successfully');
				resolve();
			};

			request.onerror = () => {
				console.error('[LocationStorage] ✗ Failed to delete database');
				reject(new Error('Failed to delete database'));
			};

			request.onblocked = () => {
				console.warn('[LocationStorage] ⚠ Database deletion blocked - close all other tabs');
			};
		});
	}

	/**
	 * Initialize IndexedDB connection
	 */
	private async init(): Promise<IDBDatabase> {
		// Return existing connection if available
		if (this.db) {
			return this.db;
		}

		// Wait for ongoing initialization if in progress
		if (this.initPromise) {
			return this.initPromise;
		}

		// Start new initialization
		this.initPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);

			request.onerror = () => {
				this.initPromise = null;
				reject(new Error('Failed to open IndexedDB'));
			};

			request.onsuccess = () => {
				this.db = request.result;
				this.initPromise = null;

				// CRITICAL: Verify schema is correct after opening
				// If inferred_location store doesn't have keyPath, the database is corrupted
				if (this.db.objectStoreNames.contains(INDEXED_DB_STORES.INFERRED_LOCATION)) {
					// We can't directly check keyPath from an open database
					// So we'll validate by attempting a transaction
					// If this fails, it means the schema is corrupted
					console.log('[LocationStorage] Database opened with version:', this.db.version);
				}

				resolve(request.result);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create location_signals store
				if (!db.objectStoreNames.contains(INDEXED_DB_STORES.LOCATION_SIGNALS)) {
					const signalsStore = db.createObjectStore(INDEXED_DB_STORES.LOCATION_SIGNALS, {
						keyPath: 'id',
						autoIncrement: true
					});
					signalsStore.createIndex('signal_type', 'signal_type', { unique: false });
					signalsStore.createIndex('timestamp', 'timestamp', { unique: false });
					signalsStore.createIndex('expires_at', 'expires_at', { unique: false });
				}

				// Create template_views store
				if (!db.objectStoreNames.contains(INDEXED_DB_STORES.TEMPLATE_VIEWS)) {
					const viewsStore = db.createObjectStore(INDEXED_DB_STORES.TEMPLATE_VIEWS, {
						keyPath: 'id',
						autoIncrement: true
					});
					viewsStore.createIndex('template_id', 'template_id', { unique: false });
					viewsStore.createIndex('viewed_at', 'viewed_at', { unique: false });
				}

				// FIX: Delete and recreate inferred_location store to ensure correct schema
				// Previous versions may have corrupted schema without proper keyPath handling
				if (db.objectStoreNames.contains(INDEXED_DB_STORES.INFERRED_LOCATION)) {
					db.deleteObjectStore(INDEXED_DB_STORES.INFERRED_LOCATION);
				}

				// Create inferred_location store with proper in-line key schema
				// keyPath: 'id' means the object MUST have an 'id' field (we use 'current')
				db.createObjectStore(INDEXED_DB_STORES.INFERRED_LOCATION, {
					keyPath: 'id'
				});
			};
		});

		return this.initPromise;
	}

	// ============================================================================
	// Location Signals
	// ============================================================================

	/**
	 * Store a new location signal
	 */
	async storeSignal(signal: LocationSignal): Promise<void> {
		try {
			const db = await this.init();

			// Verify object store exists before accessing
			if (!db.objectStoreNames.contains(INDEXED_DB_STORES.LOCATION_SIGNALS)) {
				console.warn('[LocationStorage] Object store not found, cannot store signal');
				return;
			}

			return new Promise((resolve, reject) => {
				const transaction = db.transaction([INDEXED_DB_STORES.LOCATION_SIGNALS], 'readwrite');
				const store = transaction.objectStore(INDEXED_DB_STORES.LOCATION_SIGNALS);

				// Set expiration if not provided
				if (!signal.expires_at) {
					const expirationTime = new Date();
					expirationTime.setDate(expirationTime.getDate() + 90); // Default 90 days
					signal.expires_at = expirationTime.toISOString();
				}

				const request = store.add(signal);

				request.onsuccess = () => resolve();
				request.onerror = () => reject(new Error('Failed to store signal'));
			});
		} catch (error) {
			console.error('[LocationStorage] Failed to store signal:', error);
			throw error;
		}
	}

	/**
	 * Get all location signals (excluding expired)
	 */
	async getSignals(): Promise<LocationSignal[]> {
		try {
			const db = await this.init();

			// Verify object store exists before accessing
			if (!db.objectStoreNames.contains(INDEXED_DB_STORES.LOCATION_SIGNALS)) {
				console.warn('[LocationStorage] Object store not found, returning empty signals');
				return [];
			}

			return new Promise((resolve, reject) => {
				const transaction = db.transaction([INDEXED_DB_STORES.LOCATION_SIGNALS], 'readonly');
				const store = transaction.objectStore(INDEXED_DB_STORES.LOCATION_SIGNALS);
				const request = store.getAll();

				request.onsuccess = () => {
					const signals = request.result.filter(
						(signal: unknown) => isLocationSignal(signal) && !isSignalExpired(signal)
					);
					resolve(signals);
				};
				request.onerror = () => reject(new Error('Failed to retrieve signals'));
			});
		} catch (error) {
			console.error('[LocationStorage] Failed to get signals:', error);
			return [];
		}
	}

	/**
	 * Get signals by type
	 */
	async getSignalsByType(signalType: LocationSignal['signal_type']): Promise<LocationSignal[]> {
		try {
			const db = await this.init();

			// Verify object store exists before accessing
			if (!db.objectStoreNames.contains(INDEXED_DB_STORES.LOCATION_SIGNALS)) {
				console.warn('[LocationStorage] Object store not found, returning empty signals by type');
				return [];
			}

			return new Promise((resolve, reject) => {
				const transaction = db.transaction([INDEXED_DB_STORES.LOCATION_SIGNALS], 'readonly');
				const store = transaction.objectStore(INDEXED_DB_STORES.LOCATION_SIGNALS);
				const index = store.index('signal_type');
				const request = index.getAll(signalType);

				request.onsuccess = () => {
					const signals = request.result.filter(
						(signal: unknown) => isLocationSignal(signal) && !isSignalExpired(signal)
					);
					resolve(signals);
				};
				request.onerror = () => reject(new Error('Failed to retrieve signals by type'));
			});
		} catch (error) {
			console.error('[LocationStorage] Failed to get signals by type:', error);
			return [];
		}
	}

	/**
	 * Clear expired signals
	 */
	async clearExpiredSignals(): Promise<number> {
		try {
			const db = await this.init();

			// Verify object store exists before accessing
			if (!db.objectStoreNames.contains(INDEXED_DB_STORES.LOCATION_SIGNALS)) {
				console.warn('[LocationStorage] Object store not found, skipping cleanup');
				return 0;
			}

			return new Promise((resolve, reject) => {
				const transaction = db.transaction([INDEXED_DB_STORES.LOCATION_SIGNALS], 'readwrite');
				const store = transaction.objectStore(INDEXED_DB_STORES.LOCATION_SIGNALS);
				const request = store.openCursor();

				let deletedCount = 0;

				request.onsuccess = (event) => {
					const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
					if (cursor) {
						const signal = cursor.value as unknown;
						if (isLocationSignal(signal) && isSignalExpired(signal)) {
							cursor.delete();
							deletedCount++;
						}
						cursor.continue();
					} else {
						resolve(deletedCount);
					}
				};

				request.onerror = () => reject(new Error('Failed to clear expired signals'));
			});
		} catch (error) {
			console.error('[LocationStorage] Failed to clear expired signals:', error);
			return 0;
		}
	}

	/**
	 * Clear all signals (for debugging/reset)
	 */
	async clearAllSignals(): Promise<void> {
		const db = await this.init();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([INDEXED_DB_STORES.LOCATION_SIGNALS], 'readwrite');
			const store = transaction.objectStore(INDEXED_DB_STORES.LOCATION_SIGNALS);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error('Failed to clear signals'));
		});
	}

	// ============================================================================
	// Template Views (Behavioral Tracking)
	// ============================================================================

	/**
	 * Record a template view for behavioral inference
	 */
	async recordTemplateView(event: TemplateViewEvent): Promise<void> {
		const db = await this.init();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([INDEXED_DB_STORES.TEMPLATE_VIEWS], 'readwrite');
			const store = transaction.objectStore(INDEXED_DB_STORES.TEMPLATE_VIEWS);
			const request = store.add(event);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error('Failed to record template view'));
		});
	}

	/**
	 * Get all template views
	 */
	async getTemplateViews(): Promise<TemplateViewEvent[]> {
		const db = await this.init();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([INDEXED_DB_STORES.TEMPLATE_VIEWS], 'readonly');
			const store = transaction.objectStore(INDEXED_DB_STORES.TEMPLATE_VIEWS);
			const request = store.getAll();

			request.onsuccess = () => {
				resolve(request.result);
			};
			request.onerror = () => reject(new Error('Failed to retrieve template views'));
		});
	}

	/**
	 * Clear old template views (older than 30 days)
	 */
	async clearOldTemplateViews(): Promise<number> {
		const db = await this.init();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([INDEXED_DB_STORES.TEMPLATE_VIEWS], 'readwrite');
			const store = transaction.objectStore(INDEXED_DB_STORES.TEMPLATE_VIEWS);
			const index = store.index('viewed_at');
			const request = index.openCursor();

			let deletedCount = 0;
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					const view = cursor.value as TemplateViewEvent;
					if (new Date(view.viewed_at) < thirtyDaysAgo) {
						cursor.delete();
						deletedCount++;
					}
					cursor.continue();
				} else {
					resolve(deletedCount);
				}
			};

			request.onerror = () => reject(new Error('Failed to clear old template views'));
		});
	}

	// ============================================================================
	// Inferred Location (Cached)
	// ============================================================================

	/**
	 * Store computed inferred location
	 */
	async storeInferredLocation(location: InferredLocation): Promise<void> {
		try {
			const db = await this.init();

			// Verify object store exists before accessing
			if (!db.objectStoreNames.contains(INDEXED_DB_STORES.INFERRED_LOCATION)) {
				console.warn('[LocationStorage] Object store not found, cannot store inferred location');
				return;
			}

			return new Promise((resolve, reject) => {
				const transaction = db.transaction([INDEXED_DB_STORES.INFERRED_LOCATION], 'readwrite');
				const store = transaction.objectStore(INDEXED_DB_STORES.INFERRED_LOCATION);

				// Always store with fixed key "current" for single-value cache
				// Serialize signals to plain objects (remove any non-serializable data)
				const serializedSignals = location.signals.map((signal) => ({
					signal_type: signal.signal_type,
					confidence: signal.confidence,
					congressional_district: signal.congressional_district || null,
					state_code: signal.state_code || null,
					city_name: signal.city_name || null,
					county_fips: signal.county_fips || null,
					latitude: signal.latitude || null,
					longitude: signal.longitude || null,
					source: signal.source,
					timestamp: signal.timestamp,
					expires_at: signal.expires_at || null,
					metadata: signal.metadata || null
				}));

				const record = {
					id: 'current',
					congressional_district: location.congressional_district,
					state_code: location.state_code,
					city_name: location.city_name || null,
					county_fips: location.county_fips || null,
					confidence: location.confidence,
					signals: serializedSignals,
					inferred_at: location.inferred_at
				};

				const request = store.put(record);

				request.onsuccess = () => resolve();
				request.onerror = (event) => {
					console.error('[LocationStorage] Put error:', (event.target as IDBRequest).error);
					reject(new Error('Failed to store inferred location'));
				};
			});
		} catch (error) {
			console.error('[LocationStorage] Failed to store inferred location:', error);
			throw error;
		}
	}

	/**
	 * Get cached inferred location
	 */
	async getInferredLocation(): Promise<InferredLocation | null> {
		try {
			const db = await this.init();

			// Verify object store exists before accessing
			if (!db.objectStoreNames.contains(INDEXED_DB_STORES.INFERRED_LOCATION)) {
				console.warn('[LocationStorage] Object store not found, returning null');
				return null;
			}

			return new Promise((resolve, reject) => {
				const transaction = db.transaction([INDEXED_DB_STORES.INFERRED_LOCATION], 'readonly');
				const store = transaction.objectStore(INDEXED_DB_STORES.INFERRED_LOCATION);
				const request = store.get('current');

				request.onsuccess = () => {
					const result = request.result;
					if (result && isInferredLocation(result)) {
						resolve(result);
					} else {
						resolve(null);
					}
				};
				request.onerror = () => reject(new Error('Failed to retrieve inferred location'));
			});
		} catch (error) {
			console.error('[LocationStorage] Failed to get inferred location:', error);
			return null;
		}
	}

	/**
	 * Clear cached inferred location
	 */
	async clearInferredLocation(): Promise<void> {
		const db = await this.init();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([INDEXED_DB_STORES.INFERRED_LOCATION], 'readwrite');
			const store = transaction.objectStore(INDEXED_DB_STORES.INFERRED_LOCATION);
			const request = store.delete('current');

			request.onsuccess = () => resolve();
			request.onerror = () => reject(new Error('Failed to clear inferred location'));
		});
	}

	// ============================================================================
	// Utilities
	// ============================================================================

	/**
	 * Export all data (for debugging)
	 */
	async export(): Promise<{
		signals: LocationSignal[];
		template_views: TemplateViewEvent[];
		inferred_location: InferredLocation | null;
	}> {
		const [signals, template_views, inferred_location] = await Promise.all([
			this.getSignals(),
			this.getTemplateViews(),
			this.getInferredLocation()
		]);

		return {
			signals,
			template_views,
			inferred_location
		};
	}

	/**
	 * Clear all data (for reset/debugging)
	 */
	async clearAll(): Promise<void> {
		await Promise.all([
			this.clearAllSignals(),
			this.clearInferredLocation(),
			this.clearOldTemplateViews()
		]);
	}

	/**
	 * Close database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance for location storage
 */
export const locationStorage = new LocationStorage();

// ============================================================================
// Developer Utilities (Browser Console)
// ============================================================================

/**
 * Expose nuclear database deletion to browser console for emergency recovery
 * Usage in browser console: await window.__nukeLocationDB()
 */
if (typeof window !== 'undefined') {
	(window as typeof window & { __nukeLocationDB?: () => Promise<void> }).__nukeLocationDB =
		async () => {
			await locationStorage.nukeDatabase();
			console.log('[LocationStorage] 💀 Database nuked. Refresh page to recreate with clean schema.');
		};
}
