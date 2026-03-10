import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateEmbedding } from '$lib/core/search/gemini-embeddings';

/**
 * Generate embedding for a search query.
 *
 * POST { text: string }
 * Returns { embedding: number[] }
 *
 * Requires authentication to prevent quota abuse —
 * each call invokes Google Gemini API using server-side credentials.
 *
 * Uses RETRIEVAL_QUERY task type (asymmetric to RETRIEVAL_DOCUMENT
 * used for template embeddings at creation time).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth gate — prevent unauthenticated Gemini quota drain
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

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
