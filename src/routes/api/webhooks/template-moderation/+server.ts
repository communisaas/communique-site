import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { moderationConsensus } from '$lib/agents/moderation-consensus';
import { reputationCalculator } from '$lib/services/reputation-calculator';
import type { RequestHandler } from './$types';
import type { ConsensusResult } from '$lib/agents/content/consensus-coordinator';

/**
 * N8N Webhook Handler for Template Moderation Pipeline
 *
 * Orchestrates the complete moderation flow:
 * 1. Auto-correction for minor issues
 * 2. Multi-agent consensus for severe violations
 * 3. Reputation updates based on outcomes
 */

// Simple auth check for webhook (should be more secure in production)
function verifyWebhookAuth(request: Request): boolean {
	const authHeader = request.headers.get('x-webhook-secret');
	const expectedSecret = process.env.N8N_WEBHOOK_SECRET || 'demo-secret';
	return authHeader === expectedSecret;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Verify webhook authentication
		if (!verifyWebhookAuth(request)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Parse webhook payload
		const payload = await request.json();

		// Validate required fields
		if (!payload.templateId) {
			return json({ error: 'Missing templateId' }, { status: 400 });
		}

		// Get template with consolidated verification fields
		const template = await db.template.findUnique({
			where: { id: payload.templateId },
			include: { user: true }
		});

		if (!template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		// Check if congressional template
		if (template.deliveryMethod !== 'certified') {
			return json({
				message: 'Template is not for congressional delivery, skipping moderation',
				templateId: template.id
			});
		}

		// Initialize verification fields if not set
		if (!template.verification_status) {
			await db.template.update({
				where: { id: template.id },
				data: {
					verification_status: 'pending',
					country_code: 'US',
					quality_score: 0,
					reputation_applied: false
				}
			});
		}

		// Execute moderation pipeline
		const result = await executeModerationPipeline(payload.templateId);

		return json({
			success: true,
			templateId: payload.templateId,
			result
		});
	} catch (error) {
		console.error('Error occurred');
		return json(
			{
				error: 'Failed to process moderation webhook',
				details: 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * Execute the complete moderation pipeline using multi-agent consensus
 */
async function executeModerationPipeline(templateId: string): Promise<{
	status: string;
	result: ConsensusResult | null;
	message: string;
}> {
	try {
		// Get template for initial checks
		const template = await db.template.findUnique({
			where: { id: templateId },
			include: { user: true }
		});

		if (!template) {
			throw new Error(`Template ${templateId} not found`);
		}

		// Use multi-agent consensus for all moderation
		console.log(`[Moderation] Starting multi-agent consensus for template ${templateId}`);
		const consensusResult = await moderationConsensus.evaluateTemplate(
			templateId,
			'direct-delivery' // Use voter-protocol when ready
		);

		// Apply reputation changes based on result
		if (template.userId) {
			console.log(`[Moderation] Applying reputation changes`);
			await reputationCalculator.applyTemplateResult(templateId);
		}

		// Return result
		const status = consensusResult.approved ? 'approved' : 'rejected';
		const message = consensusResult.approved
			? `Template approved by ${consensusResult.consensusType} consensus`
			: `Template rejected (severity: ${consensusResult.severity})`;

		return {
			status,
			result: consensusResult,
			message
		};
	} catch (error) {
		console.error('Moderation pipeline error:', error);

		// Update template status to indicate error
		await db.template.update({
			where: { id: templateId },
			data: {
				verification_status: 'pending',
				correction_log: {
					error: error instanceof Error ? error.message : 'Unknown error',
					timestamp: new Date().toISOString()
				} as any
			}
		});

		throw error;
	}
}

/**
 * GET endpoint for checking webhook health
 */
export const GET: RequestHandler = async () => {
	return json({
		status: 'healthy',
		service: 'template-moderation-webhook',
		timestamp: new Date().toISOString(),
		config: {
			openai: !!process.env.OPENAI_API_KEY,
			gemini: !!process.env.GEMINI_API_KEY,
			n8n_secret: !!process.env.N8N_WEBHOOK_SECRET
		}
	});
};
