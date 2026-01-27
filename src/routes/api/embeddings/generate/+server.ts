/**
 * Server-Side Embedding Generation API
 *
 * POST /api/embeddings/generate
 *
 * Purpose:
 * - Generate Gemini embeddings for search queries (client-side search)
 * - Generate embeddings for templates (admin/batch operations)
 *
 * Privacy:
 * - Query embeddings: Generated on-demand, NOT stored (privacy-preserving)
 * - Template embeddings: Generated during creation, stored in database
 *
 * Cost:
 * - FREE via Gemini (gemini-embedding-001)
 * - 768 dimensions (matches template embeddings)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	generateEmbedding,
	generateBatchEmbeddings,
	EMBEDDING_CONFIG
} from '$lib/core/search/gemini-embeddings';
import { prisma } from '$lib/core/db';

/**
 * Generate embedding for a single text or batch
 * Uses Gemini (FREE) - 768 dimensions to match template embeddings
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	// Authentication check
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const body = (await request.json()) as { text?: string; texts?: string[]; templateId?: string };

		// Single text embedding (for search queries)
		if (body.text) {
			const embedding = await generateEmbedding(body.text, {
				taskType: 'RETRIEVAL_QUERY' // Optimized for search queries
			});

			return json({
				success: true,
				data: {
					embedding,
					model: EMBEDDING_CONFIG.model,
					dimensions: embedding.length,
					cost_usd: 0 // FREE
				}
			});
		}

		// Batch text embeddings
		if (body.texts && Array.isArray(body.texts)) {
			const embeddings = await generateBatchEmbeddings(body.texts, {
				taskType: 'RETRIEVAL_DOCUMENT'
			});

			return json({
				success: true,
				data: {
					embeddings,
					model: EMBEDDING_CONFIG.model,
					dimensions: EMBEDDING_CONFIG.dimensions,
					cost_usd: 0 // FREE
				}
			});
		}

		// Generate embeddings for a specific template
		if (body.templateId) {
			const template = await prisma.template.findUnique({
				where: { id: body.templateId }
			});

			if (!template) {
				throw error(404, 'Template not found');
			}

			const locationText = `${template.title} ${template.description} ${template.category}`;
			const topicText = `${template.title} ${template.description} ${template.message_body}`;

			const embeddings = await generateBatchEmbeddings([locationText, topicText], {
				taskType: 'RETRIEVAL_DOCUMENT'
			});

			await prisma.template.update({
				where: { id: body.templateId },
				data: {
					location_embedding: embeddings[0],
					topic_embedding: embeddings[1],
					embedding_version: 'v1',
					embeddings_updated_at: new Date()
				}
			});

			return json({
				success: true,
				data: {
					template_id: template.id,
					embeddings_generated: 2,
					cost_usd: 0 // FREE
				}
			});
		}

		throw error(400, 'Missing required parameter: text, texts, or templateId');
	} catch (err) {
		console.error('Embedding generation error:', err);

		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err;
		}

		throw error(500, err instanceof Error ? err.message : 'Failed to generate embedding');
	}
};
