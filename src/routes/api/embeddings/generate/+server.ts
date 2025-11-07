/**
 * Server-Side Embedding Generation API
 *
 * POST /api/embeddings/generate
 *
 * Purpose:
 * - Generate OpenAI embeddings for search queries (client-side search)
 * - Generate embeddings for templates (admin/batch operations)
 *
 * Privacy:
 * - Query embeddings: Generated on-demand, NOT stored (privacy-preserving)
 * - Template embeddings: Generated during creation, stored in database
 *
 * Security:
 * - OpenAI API key stored server-side only (env var)
 * - Rate limiting via DynamoDB (future: implement)
 * - Cost tracking via CostTracking model
 *
 * Cost Optimization:
 * - Client should cache embeddings in IndexedDB
 * - Batch requests for template embeddings
 * - Monitor daily spend via CostTracking
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY } from '$env/static/private';
import { createEmbeddingGenerator } from '$lib/core/search/openai-embeddings';
import { prisma } from '$lib/core/db';

/**
 * Generate embedding for a single text or batch
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse request body
		const body = (await request.json()) as { text?: string; texts?: string[]; templateId?: string };

		// Validate OpenAI API key
		if (!OPENAI_API_KEY) {
			throw error(500, 'OpenAI API key not configured');
		}

		// Create embedding generator
		const generator = createEmbeddingGenerator(OPENAI_API_KEY);

		// Single text embedding (for search queries)
		if (body.text) {
			const embedding = await generator.generateEmbedding(body.text);

			// Track cost (optional)
			await trackCost(body.text.length, generator.estimateCost(body.text.length).cost_usd);

			return json({
				success: true,
				data: {
					embedding,
					model: 'text-embedding-3-large',
					dimensions: embedding.length
				}
			});
		}

		// Batch text embeddings (for template batch processing)
		if (body.texts && Array.isArray(body.texts)) {
			const result = await generator.generateBatchEmbeddings(body.texts);

			// Track cost
			await trackCost(
				body.texts.reduce((sum, text) => sum + text.length, 0),
				result.cost_usd
			);

			return json({
				success: true,
				data: {
					embeddings: result.embeddings,
					model: result.model,
					total_tokens: result.total_tokens,
					cost_usd: result.cost_usd
				}
			});
		}

		// Generate embeddings for a specific template (admin only)
		if (body.templateId) {
			// Fetch template
			const template = await prisma.template.findUnique({
				where: { id: body.templateId }
			});

			if (!template) {
				throw error(404, 'Template not found');
			}

			// Generate location and topic embeddings
			const locationText = `${template.title} ${template.description} ${template.category}`;
			const topicText = `${template.title} ${template.description} ${template.message_body}`;

			const batch = await generator.generateBatchEmbeddings([locationText, topicText]);

			// Update template with embeddings
			await prisma.template.update({
				where: { id: body.templateId },
				data: {
					location_embedding: batch.embeddings[0],
					topic_embedding: batch.embeddings[1],
					embedding_version: 'v1',
					embeddings_updated_at: new Date()
				}
			});

			// Track cost
			await trackCost(locationText.length + topicText.length, batch.cost_usd);

			return json({
				success: true,
				data: {
					template_id: template.id,
					embeddings_generated: 2,
					cost_usd: batch.cost_usd
				}
			});
		}

		throw error(400, 'Missing required parameter: text, texts, or templateId');
	} catch (err) {
		console.error('Embedding generation error:', err);

		// Type guard for error with status
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err; // Re-throw SvelteKit error
		}

		throw error(500, err instanceof Error ? err.message : 'Failed to generate embedding');
	}
};

/**
 * Track embedding generation cost
 */
async function trackCost(textLength: number, costUSD: number): Promise<void> {
	try {
		const today = new Date().toISOString().split('T')[0];

		await prisma.costTracking.upsert({
			where: { date: today },
			update: {
				totalCost: { increment: costUSD },
				requestCount: { increment: 1 }
			},
			create: {
				date: today,
				totalCost: costUSD,
				requestCount: 1
			}
		});

		console.log(
			`[Cost Tracking] Generated embedding for ${textLength} chars, cost: $${costUSD.toFixed(6)}`
		);
	} catch (err) {
		console.error('Failed to track cost:', err);
		// Don't fail the request if cost tracking fails
	}
}
