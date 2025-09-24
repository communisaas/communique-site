import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const db: PrismaClient =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: env.NODE_ENV === 'development' ? ['query'] : ['error']
	});

// Export prisma as alias for backwards compatibility
export const prisma = db;

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
