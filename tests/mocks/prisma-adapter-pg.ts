/**
 * Mock for @prisma/adapter-pg
 *
 * Prevents the pg → pg-pool CJS/ESM interop crash in vitest.
 * Tests use their own PrismaClient (from api-test-setup.ts) with datasourceUrl
 * which doesn't require the pg adapter.
 */
export class PrismaPg {
	constructor(_options?: unknown) {
		// No-op: tests don't use the pg adapter
	}
}
