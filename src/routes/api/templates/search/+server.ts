import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { generateEmbedding } from '$lib/core/search/gemini-embeddings';

/**
 * Cosine similarity between two vectors.
 * Returns -1 (opposite) to 1 (identical). Typical text range: 0.3–0.9.
 */
function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0, magA = 0, magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		magA += a[i] * a[i];
		magB += b[i] * b[i];
	}
	magA = Math.sqrt(magA);
	magB = Math.sqrt(magB);
	return magA === 0 || magB === 0 ? 0 : dot / (magA * magB);
}

/**
 * Server-side semantic template search.
 *
 * POST { query, limit?, excludeIds? }
 *
 * Pipeline:
 *   1. Generate query embedding (RETRIEVAL_QUERY task type)
 *   2. Fetch public templates with topic_embedding
 *   3. Rank by cosine similarity (70% topic + 30% location)
 *   4. Return top N results
 *
 * Fallback: if embedding generation fails (no API key, rate limit, etc.),
 * falls back to Prisma case-insensitive `contains` on title + description.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const query = (body.query as string)?.trim();
	const limit = Math.min(Math.max(body.limit ?? 5, 1), 20);
	const excludeIds = new Set<string>(body.excludeIds ?? []);

	if (!query || query.length < 2) {
		throw error(400, 'Query must be at least 2 characters');
	}

	// Attempt semantic search first, fall back to keyword
	try {
		const queryEmbedding = await generateEmbedding(query, {
			taskType: 'RETRIEVAL_QUERY'
		});

		// Fetch public templates that have embeddings
		const candidates = await db.template.findMany({
			where: {
				is_public: true,
				status: 'published',
				topic_embedding: { not: null }
			},
			select: {
				id: true,
				slug: true,
				title: true,
				description: true,
				verified_sends: true,
				unique_districts: true,
				topic_embedding: true,
				location_embedding: true
			}
		});

		// Score and rank
		const scored: Array<{
			id: string;
			slug: string;
			title: string;
			description: string;
			verified_sends: number;
			unique_districts: number;
			similarity: number;
		}> = [];

		for (const t of candidates) {
			if (excludeIds.has(t.id)) continue;

			const topicEmb = t.topic_embedding as number[] | null;
			if (!topicEmb || topicEmb.length === 0) continue;

			const topicSim = cosineSimilarity(queryEmbedding, topicEmb);

			let locationSim = 0;
			const locEmb = t.location_embedding as number[] | null;
			if (locEmb && locEmb.length > 0) {
				locationSim = cosineSimilarity(queryEmbedding, locEmb);
			}

			const similarity = topicSim * 0.7 + locationSim * 0.3;
			if (similarity < 0.35) continue;

			scored.push({
				id: t.id,
				slug: t.slug,
				title: t.title,
				description: t.description ?? '',
				verified_sends: t.verified_sends,
				unique_districts: t.unique_districts,
				similarity
			});
		}

		scored.sort((a, b) => b.similarity - a.similarity);

		return json({
			templates: scored.slice(0, limit),
			method: 'semantic'
		});
	} catch (embeddingError) {
		console.warn('[template-search] Semantic search failed, falling back to keyword:', embeddingError);

		// Fallback: keyword search
		const results = await db.template.findMany({
			where: {
				is_public: true,
				status: 'published',
				id: { notIn: [...excludeIds] },
				OR: [
					{ title: { contains: query, mode: 'insensitive' } },
					{ description: { contains: query, mode: 'insensitive' } }
				]
			},
			orderBy: { verified_sends: 'desc' },
			take: limit,
			select: {
				id: true,
				slug: true,
				title: true,
				description: true,
				verified_sends: true,
				unique_districts: true
			}
		});

		return json({
			templates: results.map(t => ({
				...t,
				description: t.description ?? '',
				similarity: null
			})),
			method: 'keyword'
		});
	}
};
