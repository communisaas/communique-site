import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { templateCorrector } from '$lib/services/template-correction';
import { moderationConsensus } from '$lib/agents/moderation-consensus';
import { reputationCalculator } from '$lib/services/reputation-calculator';
import type { RequestHandler } from './$types';

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
		if (!payload.verificationId && !payload.templateId) {
			return json({ error: 'Missing verificationId or templateId' }, { status: 400 });
		}

		// Get or create verification record
		let verificationId = payload.verificationId;

		if (!verificationId && payload.templateId) {
			// Create verification if it doesn't exist
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

			// Create verification record
			const verification = await db.templateVerification.create({
				data: {
					template_id: template.id,
					user_id: template.userId || '',
					country_code: 'US',
					moderation_status: 'pending'
				}
			});

			verificationId = verification.id;
		}

		// Execute moderation pipeline
		const result = await executeModerationPipeline(verificationId);

		return json({
			success: true,
			verificationId,
			result
		});
	} catch (error) {
		console.error('Webhook processing error:', error);
		return json(
			{
				error: 'Failed to process moderation webhook',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * Execute the complete moderation pipeline
 */
async function executeModerationPipeline(verificationId: string) {
	const stages = {
		correction: null as any,
		moderation: null as any,
		reputation: null as any
	};

	try {
		// Stage 1: Auto-correction
		console.log(`[Moderation] Stage 1: Auto-correction for ${verificationId}`);
		const correctionResult = await templateCorrector.processVerification(verificationId);
		stages.correction = correctionResult;

		// If severity is low and corrections applied, we're done
		if (correctionResult.severity <= 6 && !correctionResult.proceed) {
			console.log(`[Moderation] Template auto-corrected and approved`);

			// Apply small reputation boost for clean submission
			await reputationCalculator.applyVerificationResult(verificationId);
			stages.reputation = { applied: true, reason: 'auto-approved after correction' };

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
			const consensusResult = await moderationConsensus.evaluateTemplate(verificationId);
			stages.moderation = consensusResult;

			// Stage 3: Apply reputation changes
			console.log(`[Moderation] Stage 3: Applying reputation changes`);
			const reputationUpdate = await reputationCalculator.applyVerificationResult(verificationId);
			stages.reputation = reputationUpdate;

			return {
				status: consensusResult.approved ? 'approved' : 'rejected',
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
	} catch (error) {
		console.error('Pipeline execution error:', error);

		// Update verification status to indicate error
		await db.templateVerification.update({
			where: { id: verificationId },
			data: {
				moderation_status: 'pending',
				correction_log: {
					error: error instanceof Error ? error.message : 'Unknown error',
					timestamp: new Date().toISOString()
				}
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
