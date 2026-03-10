import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateEmbedding } from '$lib/core/search/gemini-embeddings';

/**
 * Generate embedding for a search query.
 *
 * POST { text: string }
 * Returns { embedding: number[] }
 *
 * Uses RETRIEVAL_QUERY task type (optimized for search queries,
 * asymmetric to RETRIEVAL_DOCUMENT used for template embeddings).
 *
 * This endpoint completes the client-side semantic search pipeline
 * in $lib/core/search/ — EmbeddingSearch calls this to embed queries
 * before computing cosine similarity against cached template embeddings.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const text = (body.text as string)?.trim();

	if (!text || text.length < 2) {
		throw error(400, 'Text must be at least 2 characters');
	}

	if (text.length > 8000) {
		throw error(400, 'Text too long (max 8000 characters)');
	}

	const embedding = await generateEmbedding(text, {
		taskType: 'RETRIEVAL_QUERY'
	});

	return json({ embedding });
};
