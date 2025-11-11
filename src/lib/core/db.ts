import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// === CONNECTION POOLING CONFIGURATION ===
// Development: Higher connection limit for HMR (SvelteKit hot reload creates multiple clients)
// Production: Conservative limit to avoid overwhelming Supabase connection pool
const isDevelopment = env.NODE_ENV !== 'production';
const connectionLimit = isDevelopment ? 20 : 10; // Increased for dev HMR stability
const poolTimeout = 30; // Increased from 20s to handle slower queries
const connectTimeout = 20; // Increased from 15s for Supabase latency

// Enhance DATABASE_URL with connection pooling parameters for Supabase stability
const databaseUrl = env.DATABASE_URL.includes('?')
	? `${env.DATABASE_URL}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=${connectTimeout}`
	: `${env.DATABASE_URL}?connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=${connectTimeout}`;

export const db: PrismaClient =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: isDevelopment ? ['error', 'warn'] : ['error'], // Reduced query logging noise in dev
		datasources: {
			db: {
				url: databaseUrl
			}
		}
	});

// Export prisma as alias for backwards compatibility
export const prisma = db;

// === DEVELOPMENT HMR CLEANUP ===
// Properly disconnect old Prisma clients on HMR to prevent connection pool exhaustion
if (isDevelopment) {
	globalForPrisma.prisma = db;

	// Gracefully cleanup on process termination
	if (typeof window === 'undefined') {
		// Server-side only: cleanup on exit
		const cleanup = async () => {
			await db.$disconnect();
		};

		process.on('beforeExit', cleanup);
		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
	}
}
