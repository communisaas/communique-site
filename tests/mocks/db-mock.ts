/**
 * Mock for $lib/core/db
 *
 * Provides a working PrismaClient for tests without loading @prisma/adapter-pg
 * (which triggers the pg → pg-pool CJS/ESM interop crash in vitest).
 *
 * Uses datasourceUrl instead of the pg driver adapter, matching the pattern
 * in api-test-setup.ts.
 */
import { PrismaClient } from '@prisma/client';

const testDb = new PrismaClient({
	datasourceUrl: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
	log: ['error']
});

// Match all exports from src/lib/core/db.ts
export const db: PrismaClient = testDb;
export const prisma: PrismaClient = testDb;

export function createRequestClient(_connectionString: string): PrismaClient {
	return testDb;
}

export function runWithDb<T>(_client: PrismaClient, fn: () => T): T {
	return fn();
}

export function getRequestClient(): PrismaClient {
	return testDb;
}
