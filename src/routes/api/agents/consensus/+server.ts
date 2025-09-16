/**
 * Multi-Agent Consensus API Endpoint
 *
 * Handles consensus evaluation for high-severity templates
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moderationConsensus } from '$lib/agents';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { verificationId, templateId } = body;

		if (!verificationId && !templateId) {
			return json({ error: 'verificationId or templateId required' }, { status: 400 });
		}

		// If templateId provided, find or create verification
		let verfId = verificationId;
		if (templateId && !verificationId) {
			const { db } = await import('$lib/core/db');
			const verification = await db.templateVerification.findUnique({
				where: { template_id: templateId }
			});

			if (!verification) {
				// Create verification record
				const created = await db.templateVerification.create({
					data: {
						template_id: templateId,
						severity_level: 7, // Default for consensus review
						moderation_status: 'pending'
					}
				});
				verfId = created.id;
			} else {
				verfId = verification.id;
			}
		}

		// Run consensus evaluation
		const result = await moderationConsensus.evaluateTemplate(verfId);

		return json({
			success: true,
			...result
		});
	} catch (error) {
		console.error('Consensus evaluation error:', error);
		return json({ error: 'Consensus evaluation failed', details: error.message }, { status: 500 });
	}
};
