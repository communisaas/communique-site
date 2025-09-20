import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { templateCorrector, type TemplateModerationResult } from '$lib/services/template-correction';
import { moderationConsensus } from '$lib/agents/moderation-consensus';
import { reputationCalculator } from '$lib/services/reputation-calculator';
import type { RequestHandler } from './$types';
import type { Prisma } from '@prisma/client';

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
	} catch (_error) {
		console.error('Error:', _error);
		return json(
			{
				error: 'Failed to process moderation webhook',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * Execute the complete moderation pipeline
 */
async function executeModerationPipeline(templateId: string) {
	const stages = {
		correction: null as any,
		moderation: null as any,
		reputation: null as any
	};

	try {
		// Get template for processing
		const template = await db.template.findUnique({
			where: { id: templateId },
			include: { user: true }
		});

		if (!template) {
			throw new Error(`Template ${templateId} not found`);
		}

		// Stage 1: Auto-correction
		console.log(`[Moderation] Stage 1: Auto-correction for template ${templateId}`);
		const correctionResult = await templateCorrector.processTemplate(templateId);
		stages.correction = correctionResult;

		// If severity is low and corrections applied, we're done
		if (correctionResult.severity <= 6 && !correctionResult.proceed) {
			console.log(`[Moderation] Template auto-corrected and approved`);

			// Update template status to approved
			await db.template.update({
				where: { id: templateId },
				data: {
					verification_status: 'approved',
					reviewed_at: new Date()
				}
			});

			// Apply small reputation boost for clean submission
			if (template.userId) {
				await reputationCalculator.applyTemplateResult(templateId);
				stages.reputation = { applied: true, reason: 'auto-approved after correction' };
			}

			return {
				status: 'approved',
				stages,
				message: 'Template auto-corrected and approved'
			};
		}

		// Stage 2: Multi-agent moderation for high severity
		if (correctionResult.severity >= 7) {
			console.log(
				`[Moderation] Stage 2: Multi-agent consensus for severity ${correctionResult.severity}`
			);
			const consensusResult = await moderationConsensus.evaluateTemplate(templateId);
			stages.moderation = consensusResult;

			// Update template with consensus results
			const finalStatus = consensusResult.approved ? 'approved' : 'rejected';
			await db.template.update({
				where: { id: templateId },
				data: {
					verification_status: finalStatus,
					agent_votes: consensusResult.agentVotes as unknown as Prisma.JsonObject,
					consensus_score: consensusResult.score,
					reviewed_at: new Date()
				}
			});

			// Stage 3: Apply reputation changes
			console.log(`[Moderation] Stage 3: Applying reputation changes`);
			if (template.userId) {
				const reputationUpdate = await reputationCalculator.applyTemplateResult(templateId);
				stages.reputation = reputationUpdate;
			}

			return {
				status: finalStatus,
				stages,
				message: consensusResult.approved
					? 'Template approved by agent consensus'
					: `Template rejected (severity ${correctionResult.severity})`
			};
		}

		// Shouldn't reach here, but handle edge case
		return {
			status: 'pending',
			stages,
			message: 'Moderation incomplete - manual review required'
		};
	} catch (_error) {
		console.error('Error:', _error);

		// Update template status to indicate error
		await db.template.update({
			where: { id: templateId },
			data: {
				verification_status: 'pending',
				correction_log: {
					error: _error instanceof Error ? _error.message : 'Unknown error',
					timestamp: new Date().toISOString()
				}
			}
		});

		throw _error;
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
