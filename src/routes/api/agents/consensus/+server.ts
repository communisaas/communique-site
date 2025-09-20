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

		// Use templateId directly since verification is now part of the template
		let verfId = verificationId || templateId;
		if (templateId && !verificationId) {
			const { db } = await import('$lib/core/db');
			const template = await db.template.findUnique({
				where: { id: templateId },
				select: { 
					id: true,
					userId: true,
					verification_status: true,
					country_code: true,
					severity_level: true
				}
			});

			if (!template) {
				return json({ error: 'Template not found' }, { status: 404 });
			}

			if (!template.userId) {
				return json({ error: 'Template missing user' }, { status: 400 });
			}

			// Initialize verification fields if not set
			if (!template.verification_status) {
				await db.template.update({
					where: { id: templateId },
					data: {
						verification_status: 'pending',
						country_code: template.country_code || 'US',
						severity_level: template.severity_level || 7
					}
				});
			}

			verfId = templateId; // Use templateId directly
		}

		// Run consensus evaluation
		const result = await moderationConsensus.evaluateTemplate(verfId);

		return json({
			success: true,
			...result
		});
	} catch (_error) {
		console.error('Consensus evaluation error:', _error);
		return json(
			{
				error: 'Consensus evaluation failed',
				details: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
