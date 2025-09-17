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
			template: templateData,
			checkGrammar,
			checkPolicy
		});

		// Store verification result if templateId provided
		if (templateId) {
			await db.templateVerification.upsert({
				where: { template_id: templateId },
				update: {
					corrected_subject: result.corrections?.subject,
					corrected_body: result.corrections?.body,
					severity_level: result.severityLevel,
					moderation_status: result.approved ? 'approved' : 'pending',
					agent_votes: { verification: result } as any,
					consensus_score: result.confidence,
					reviewed_at: new Date()
				},
				create: {
					template_id: templateId,
					corrected_subject: result.corrections?.subject,
					corrected_body: result.corrections?.body,
					severity_level: result.severityLevel,
					moderation_status: result.approved ? 'approved' : 'pending',
					agent_votes: { verification: result } as any,
					consensus_score: result.confidence
				}
			});
		}

		return json({
			success: true,
			...result
		});
	} catch (_error) {
		console.error('Error:' , _error);
		return json({ error: 'Verification failed', details: _error instanceof Error ? _error.message : 'Unknown error' }, { status: 500 });
	}
};
