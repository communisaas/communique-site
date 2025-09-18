/**
 * Verification Agent API Endpoint
 *
 * Provides template verification and correction services
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VerificationAgent } from '$lib/agents';
import { db } from '$lib/core/db';
import { extractVerificationDecision } from '$lib/agents/type-guards';

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
			const verificationDecision = extractVerificationDecision(result.decision);
			const isApproved = result.confidence > 0.7; // Determine approval based on confidence threshold
			
			await db.templateVerification.upsert({
				where: { template_id: templateId },
				update: {
					correction_log: JSON.parse(JSON.stringify(verificationDecision.corrections)),
					severity_level: verificationDecision.severityLevel,
					moderation_status: isApproved ? 'approved' : 'pending',
					agent_votes: JSON.parse(JSON.stringify({ verification: result })),
					consensus_score: result.confidence || 0.5,
					reviewed_at: new Date()
				},
				create: {
					template_id: templateId,
					user_id: 'system', // Default user for automated verification
					correction_log: JSON.parse(JSON.stringify(verificationDecision.corrections)),
					original_content: JSON.parse(JSON.stringify({ subject: templateData.subject, body: templateData.message_body })),
					severity_level: verificationDecision.severityLevel,
					moderation_status: isApproved ? 'approved' : 'pending',
					agent_votes: JSON.parse(JSON.stringify({ verification: result })),
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
