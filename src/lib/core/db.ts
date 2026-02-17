import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { dev } from '$app/environment';

// AsyncLocalStorage scopes the PrismaClient to each request.
// This is critical on CF Workers where module-level variables persist
// across requests within the same isolate — storing a PrismaClient in
// module scope causes "Cannot perform I/O on behalf of a different request"
// errors and unresolvable Promises (the root cause of Worker 1101 hangs).
const requestDb = new AsyncLocalStorage<PrismaClient>();

// Dev-only: global singleton to avoid HMR connection exhaustion.
// In production on Workers, this is NEVER used.
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

/**
 * Create a PrismaClient for the current request.
 *
 * On Cloudflare Workers (production):
 *   - Called per-request from hooks.server.ts with Hyperdrive's connectionString
 *   - Returns a FRESH client every time (required by Workers I/O isolation)
 *   - maxUses:1 prevents internal pg.Pool from reusing stale connections
 *   - Hyperdrive handles real connection pooling at the network layer
 *
 * In development:
 *   - Reuses a global singleton to avoid HMR connection exhaustion
 */
export function createRequestClient(connectionString: string): PrismaClient {
	if (dev) {
		if (!globalForPrisma.prisma) {
			// In dev, reuse a global Pool to avoid HMR connection exhaustion
			const adapter = new PrismaPg({ connectionString });
			globalForPrisma.prisma = new PrismaClient({
				adapter,
				log: ['error', 'warn']
			});
		}
		return globalForPrisma.prisma;
	}

	// Production: fresh client per request. This is fast because:
	// 1. PrismaClient with driver adapter is pure JS (no Rust engine)
	// 2. PrismaPg connects to local Hyperdrive proxy (~0ms), not the DB
	// 3. max:1 prevents internal Pool from opening multiple connections
	//    (Hyperdrive handles real pooling at the network layer)
	const adapter = new PrismaPg({ connectionString, max: 1 });
	return new PrismaClient({ adapter, log: ['error'] });
}

/**
 * Run a callback with a request-scoped PrismaClient.
 * Called from hooks.server.ts to wrap the entire request lifecycle.
 */
export function runWithDb<T>(client: PrismaClient, fn: () => T): T {
	return requestDb.run(client, fn);
}

function getInstance(): PrismaClient {
	const client = requestDb.getStore();
	if (client) return client;

	// Fallback for dev: create singleton from DATABASE_URL
	if (dev) {
		const connectionString = process.env.DATABASE_URL || '';
		if (!globalForPrisma.prisma) {
			const adapter = new PrismaPg({ connectionString });
			globalForPrisma.prisma = new PrismaClient({
				adapter,
				log: ['error', 'warn']
			});
		}
		return globalForPrisma.prisma;
	}

	throw new Error(
		'No request-scoped PrismaClient found. ' +
			'Ensure runWithDb() is called in hooks.server.ts before any DB access.'
	);
}

/**
 * Return the concrete PrismaClient for the current request.
 *
 * Use this when you need to capture the client reference for use
 * OUTSIDE the ALS scope (e.g., in platform.context.waitUntil callbacks
 * where the ALS store may no longer be available).
 */
export function getRequestClient(): PrismaClient {
	return getInstance();
}

// Proxy so existing `db.user.findMany()` imports keep working.
// In production, reads from AsyncLocalStorage (per-request).
// In dev, falls back to global singleton.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
	get(_target, prop) {
		return (getInstance() as Record<string | symbol, unknown>)[prop];
	}
});

// Export prisma as alias for backwards compatibility
export const prisma = db;
