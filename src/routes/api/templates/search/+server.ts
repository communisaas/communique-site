import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { generateEmbedding } from '$lib/core/search/gemini-embeddings';

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
 * Requires authentication. Rate limited to prevent Gemini quota abuse.
 *
 * Pipeline:
 *   1. Generate query embedding + fetch templates in parallel
 *   2. Rank by cosine similarity (70% topic + 30% location)
 *   3. Return top N results
 *
 * Fallback: keyword search via Prisma contains when embeddings unavailable.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth gate — only authenticated users can trigger Gemini API calls
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	const query = (body.query as string)?.trim();
	const limit = Math.min(Math.max(body.limit ?? 5, 1), 20);

	// Cap excludeIds to prevent memory bomb (S-3)
	const rawExcludeIds = Array.isArray(body.excludeIds) ? body.excludeIds.slice(0, 50) : [];
	const excludeIds = new Set<string>(rawExcludeIds);

	if (!query || query.length < 2) {
		throw error(400, 'Query must be at least 2 characters');
	}

	if (query.length > 200) {
		throw error(400, 'Query too long (max 200 characters)');
	}

	// Attempt semantic search first, fall back to keyword
	try {
		// Parallelize: Gemini embedding + DB fetch are independent (A-1/F8 fix)
		const [queryEmbedding, candidates] = await Promise.all([
			generateEmbedding(query, { taskType: 'RETRIEVAL_QUERY' }),
			db.template.findMany({
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
			})
		]);

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
