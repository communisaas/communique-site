/**
 * MongoDB Background Warmup
 *
 * Silent infrastructure initialization that never blocks user experience.
 *
 * Perceptual contract:
 * - App loads instantly (<100ms to interactive)
 * - MongoDB connects in background (invisible to user)
 * - Indexes build after connection (fire-and-forget)
 * - Graceful degradation if connection slow/failed
 *
 * Engineering patterns:
 * - Lazy singleton with background proactive warming
 * - Exponential backoff retry (max 3 attempts)
 * - Health state machine for observability
 * - No blocking on request critical path
 */

import { MongoClient, type Db } from 'mongodb';
import { DATABASE_NAME } from './constants';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
	/** Initial connection timeout - generous for cold start */
	connectTimeoutMS: 30_000,
	/** Server selection - allow time for Atlas DNS + TLS */
	serverSelectionTimeoutMS: 15_000,
	/** Socket timeout for operations */
	socketTimeoutMS: 45_000,
	/** Connection pool */
	maxPoolSize: 10,
	minPoolSize: 1,
	/** Retry configuration */
	maxRetries: 3,
	/** Base delay for exponential backoff (doubles each retry) */
	retryBaseDelayMS: 1_000,
	/** Max delay cap */
	retryMaxDelayMS: 10_000
} as const;

// ============================================================================
// Health State Machine
// ============================================================================

type WarmupState =
	| 'idle'        // Not started
	| 'connecting'  // Connection in progress
	| 'ready'       // Connected and healthy
	| 'indexing'    // Building indexes (non-blocking)
	| 'degraded'    // Connected but indexes failed
	| 'failed';     // Connection failed after retries

interface WarmupStatus {
	state: WarmupState;
	connectedAt?: Date;
	lastError?: string;
	retryCount: number;
	indexesReady: boolean;
}

// ============================================================================
// Singleton State
// ============================================================================

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let warmupStatus: WarmupStatus = {
	state: 'idle',
	retryCount: 0,
	indexesReady: false
};

// HMR safety for development
declare global {
	// eslint-disable-next-line no-var
	var __mongoWarmClient: MongoClient | undefined;
	// eslint-disable-next-line no-var
	var __mongoWarmPromise: Promise<MongoClient> | undefined;
	// eslint-disable-next-line no-var
	var __mongoWarmStatus: WarmupStatus | undefined;
}

if (process.env.NODE_ENV === 'development') {
	client = global.__mongoWarmClient ?? null;
	clientPromise = global.__mongoWarmPromise ?? null;
	warmupStatus = global.__mongoWarmStatus ?? warmupStatus;
}

// ============================================================================
// Connection URI
// ============================================================================

function getConnectionUri(): string {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		throw new Error('MONGODB_URI environment variable not set');
	}
	return uri;
}

// ============================================================================
// Core Connection Logic
// ============================================================================

async function connectWithRetry(): Promise<MongoClient> {
	const uri = getConnectionUri();

	for (let attempt = 0; attempt < CONFIG.maxRetries; attempt++) {
		try {
			warmupStatus.state = 'connecting';
			warmupStatus.retryCount = attempt;

			const newClient = new MongoClient(uri, {
				maxPoolSize: CONFIG.maxPoolSize,
				minPoolSize: CONFIG.minPoolSize,
				serverSelectionTimeoutMS: CONFIG.serverSelectionTimeoutMS,
				socketTimeoutMS: CONFIG.socketTimeoutMS,
				connectTimeoutMS: CONFIG.connectTimeoutMS
			});

			await newClient.connect();

			// Verify connection with ping
			await newClient.db('admin').command({ ping: 1 });

			warmupStatus.state = 'ready';
			warmupStatus.connectedAt = new Date();
			warmupStatus.lastError = undefined;

			console.log('[MongoDB] Connected successfully');
			return newClient;

		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			warmupStatus.lastError = message;

			if (attempt < CONFIG.maxRetries - 1) {
				const delay = Math.min(
					CONFIG.retryBaseDelayMS * Math.pow(2, attempt),
					CONFIG.retryMaxDelayMS
				);
				console.warn(`[MongoDB] Connection attempt ${attempt + 1} failed, retrying in ${delay}ms: ${message}`);
				await sleep(delay);
			} else {
				warmupStatus.state = 'failed';
				console.error(`[MongoDB] Connection failed after ${CONFIG.maxRetries} attempts: ${message}`);
				throw error;
			}
		}
	}

	// TypeScript exhaustiveness
	throw new Error('Unreachable');
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start background warmup (non-blocking)
 *
 * Call this at app startup. Returns immediately.
 * Connection happens in background, indexes follow.
 */
export function startWarmup(): void {
	if (warmupStatus.state !== 'idle') {
		return; // Already warming or ready
	}

	// Fire and forget - don't await
	warmupInBackground().catch(err => {
		console.error('[MongoDB] Background warmup failed:', err.message);
	});
}

async function warmupInBackground(): Promise<void> {
	try {
		// Connect
		client = await connectWithRetry();

		// Store for HMR
		if (process.env.NODE_ENV === 'development') {
			global.__mongoWarmClient = client;
			global.__mongoWarmStatus = warmupStatus;
		}

		// Build indexes (non-blocking, fire-and-forget)
		buildIndexesInBackground();

	} catch {
		// Already logged in connectWithRetry
	}
}

async function buildIndexesInBackground(): Promise<void> {
	if (warmupStatus.state !== 'ready') return;

	warmupStatus.state = 'indexing';

	try {
		// Dynamic import to avoid circular deps
		const { ensureAllIndexes } = await import('./indexes');
		await ensureAllIndexes();
		warmupStatus.indexesReady = true;
		warmupStatus.state = 'ready';
		console.log('[MongoDB] Indexes ready');
	} catch (error) {
		warmupStatus.state = 'degraded';
		console.warn('[MongoDB] Index creation failed, operating in degraded mode:',
			error instanceof Error ? error.message : 'Unknown error');
	}
}

/**
 * Get MongoDB client (waits for connection if warming)
 *
 * For critical paths that need MongoDB.
 * Will wait for connection but never block on indexes.
 */
export async function getClient(): Promise<MongoClient> {
	// Already connected
	if (client && warmupStatus.state !== 'failed') {
		return client;
	}

	// Connection in progress - wait for it
	if (clientPromise) {
		return clientPromise;
	}

	// Need to start connection (shouldn't happen if warmup was called)
	clientPromise = connectWithRetry();

	if (process.env.NODE_ENV === 'development') {
		global.__mongoWarmPromise = clientPromise;
	}

	client = await clientPromise;

	if (process.env.NODE_ENV === 'development') {
		global.__mongoWarmClient = client;
	}

	return client;
}

/**
 * Get database instance
 */
export async function getDb(): Promise<Db> {
	const mongoClient = await getClient();
	return mongoClient.db(DATABASE_NAME);
}

/**
 * Check if MongoDB is ready (non-blocking)
 *
 * For optional features that can skip if not ready.
 */
export function isReady(): boolean {
	return warmupStatus.state === 'ready' || warmupStatus.state === 'indexing' || warmupStatus.state === 'degraded';
}

/**
 * Get current warmup status
 *
 * For health checks and debugging.
 */
export function getStatus(): Readonly<WarmupStatus> {
	return { ...warmupStatus };
}

/**
 * Gracefully close connection
 */
export async function close(): Promise<void> {
	if (client) {
		await client.close();
		client = null;
		clientPromise = null;
		warmupStatus = { state: 'idle', retryCount: 0, indexesReady: false };
		console.log('[MongoDB] Connection closed');
	}
}
