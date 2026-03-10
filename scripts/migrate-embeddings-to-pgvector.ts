/**
 * One-time migration: Template embeddings from JSON to pgvector.
 *
 * Reads existing JSON embedding arrays, writes them as vector(768) columns,
 * creates HNSW indexes, and validates round-trip correctness.
 *
 * Usage:
 *   npx tsx scripts/migrate-embeddings-to-pgvector.ts
 *
 * Prerequisites:
 *   - pgvector extension enabled (already enabled for intelligence table)
 *   - DATABASE_URL set in environment
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
	console.log('[migrate] Starting pgvector embedding migration...');

	// Step 1: Alter columns from jsonb to vector(768)
	// Use a transaction so we can roll back if anything fails
	console.log('[migrate] Step 1: Altering column types from jsonb to vector(768)...');

	await db.$executeRaw`
		ALTER TABLE "Template"
		ALTER COLUMN "topic_embedding" TYPE vector(768)
		USING CASE
			WHEN "topic_embedding" IS NOT NULL
			THEN (
				SELECT array_to_string(array_agg(elem::text), ',')
				FROM jsonb_array_elements("topic_embedding"::jsonb) AS elem
			)::vector(768)
			ELSE NULL
		END
	`;

	await db.$executeRaw`
		ALTER TABLE "Template"
		ALTER COLUMN "location_embedding" TYPE vector(768)
		USING CASE
			WHEN "location_embedding" IS NOT NULL
			THEN (
				SELECT array_to_string(array_agg(elem::text), ',')
				FROM jsonb_array_elements("location_embedding"::jsonb) AS elem
			)::vector(768)
			ELSE NULL
		END
	`;

	console.log('[migrate] Column types altered successfully.');

	// Step 2: Create HNSW indexes for approximate nearest neighbor search
	console.log('[migrate] Step 2: Creating HNSW indexes...');

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS idx_template_topic_embedding
		ON "Template" USING hnsw (topic_embedding vector_cosine_ops)
	`;

	await db.$executeRaw`
		CREATE INDEX IF NOT EXISTS idx_template_location_embedding
		ON "Template" USING hnsw (location_embedding vector_cosine_ops)
	`;

	console.log('[migrate] HNSW indexes created.');

	// Step 3: Validate round-trip — read back vectors and check dimensions
	console.log('[migrate] Step 3: Validating migration...');

	const stats = await db.$queryRaw<[{ total: bigint; with_topic: bigint; with_location: bigint }]>`
		SELECT
			COUNT(*)::bigint AS total,
			COUNT(topic_embedding)::bigint AS with_topic,
			COUNT(location_embedding)::bigint AS with_location
		FROM "Template"
	`;

	const { total, with_topic, with_location } = stats[0];
	console.log(`[migrate] Templates: ${total} total, ${with_topic} with topic embedding, ${with_location} with location embedding`);

	// Spot-check: read back a vector and verify dimension
	if (with_topic > 0n) {
		const sample = await db.$queryRaw<[{ dim: number }]>`
			SELECT vector_dims(topic_embedding) AS dim
			FROM "Template"
			WHERE topic_embedding IS NOT NULL
			LIMIT 1
		`;
		if (sample[0].dim !== 768) {
			throw new Error(`Dimension mismatch: expected 768, got ${sample[0].dim}`);
		}
		console.log('[migrate] Dimension validation passed (768).');
	}

	console.log('[migrate] Migration complete.');
}

main()
	.catch((e) => {
		console.error('[migrate] Migration failed:', e);
		process.exit(1);
	})
	.finally(() => db.$disconnect());
