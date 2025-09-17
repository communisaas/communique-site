/**
 * Verification Agent API Endpoint
 *
 * Provides template verification and correction services
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VerificationAgent } from '$lib/agents';
import { db } from '$lib/core/db';

const verificationAgent = new VerificationAgent();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { templateId, template, checkGrammar = true, checkPolicy = true } = body;

		// If templateId provided, fetch from database
		let templateData = template;
		if (templateId && !template) {
			templateData = await db.template.findUnique({
				where: { id: templateId }
			});

			if (!templateData) {
				return json({ error: 'Template not found' }, { status: 404 });
			}
		}

		if (!templateData) {
			return json({ error: 'Template or templateId required' }, { status: 400 });
		}

		// Process through verification agent
		const result = await verificationAgent.makeDecision({
			templateId: templateData.id,
			actionType: 'verify',
			parameters: {
				template: templateData,
				checkGrammar,
				checkPolicy
			}
		});

		// Store verification result if templateId provided
		if (templateId) {
			await db.templateVerification.upsert({
				where: { template_id: templateId },
				update: {
					correction_log: (result.decision as any)?.corrections || {},
					severity_level: (result.decision as any)?.severityLevel || 1,
					moderation_status: result.approved ? 'approved' : 'pending',
					agent_votes: { verification: result } as any,
					consensus_score: result.confidence || 0.5,
					reviewed_at: new Date()
				},
				create: {
					template_id: templateId,
					user_id: 'system', // Default user for automated verification
					correction_log: (result.decision as any)?.corrections || {},
					original_content: { subject: templateData.subject, body: templateData.message_body },
					severity_level: (result.decision as any)?.severityLevel || 1,
					moderation_status: result.approved ? 'approved' : 'pending',
					agent_votes: { verification: result } as any,
					consensus_score: result.confidence || 0.5
				}
			});
		}

		return json({
			success: true,
			...result
		});
	} catch (_error) {
		console.error('Error:', _error);
		return json(
			{
				error: 'Verification failed',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
