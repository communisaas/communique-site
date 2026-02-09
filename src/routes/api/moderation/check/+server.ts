/**
 * Moderation Check API Endpoint
 *
 * Exposes the moderation pipeline for testing and validation.
 * This endpoint allows direct testing of content moderation
 * without going through the full template creation flow.
 *
 * POST /api/moderation/check
 * Body: { title: string, message_body: string, category?: string }
 * Returns: ModerationResult
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moderateTemplate } from '$lib/core/server/moderation';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const { title, message_body, category } = body;

		if (typeof title !== 'string' || typeof message_body !== 'string') {
			return json(
				{
					approved: false,
					rejection_reason: 'invalid_input',
					summary: 'title and message_body are required strings'
				},
				{ status: 400 }
			);
		}

		const result = await moderateTemplate({
			title,
			message_body,
			category: category || 'General'
		});

		return json(result, { status: result.approved ? 200 : 400 });
	} catch (error) {
		console.error('[moderation/check] Error:', error);

		return json(
			{
				approved: false,
				rejection_reason: 'moderation_error',
				summary: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
