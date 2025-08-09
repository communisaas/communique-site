import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Ensure Prisma has DATABASE_URL available (map from SUPABASE_DATABASE_URL if needed)
if (!env.DATABASE_URL && env.SUPABASE_DATABASE_URL) {
  // @ts-ignore - set at process level for Prisma
  process.env.DATABASE_URL = env.SUPABASE_DATABASE_URL;
}

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db; 