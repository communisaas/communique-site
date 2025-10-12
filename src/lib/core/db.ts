import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// Enhance DATABASE_URL with connection pooling parameters for Supabase stability
const databaseUrl = env.DATABASE_URL.includes('?') 
	? `${env.DATABASE_URL}&connection_limit=5&pool_timeout=20&connect_timeout=15`
	: `${env.DATABASE_URL}?connection_limit=5&pool_timeout=20&connect_timeout=15`;

export const db: PrismaClient =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: env.NODE_ENV === 'development' ? ['query'] : ['error'],
		datasources: {
			db: {
				url: databaseUrl
			}
		}
	});

// Export prisma as alias for backwards compatibility
export const prisma = db;

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
