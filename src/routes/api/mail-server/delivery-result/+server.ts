/**
 * Mail Server API: Delivery Result Notification
 * Internal endpoint for mail server to report delivery results
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/core/db';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	// Authenticate the mail server
	const authHeader = request.headers.get('authorization');
	if (!authHeader || authHeader !== `Bearer ${env.COMMUNIQUE_API_KEY}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { templateId, userId, deliveryMethod, success, submissionId, error, metadata } = body;

		// Validate required fields
		if (!templateId || !userId || deliveryMethod === undefined || success === undefined) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Create delivery log entry using template_campaign
		await db.template_campaign.create({
			data: {
				id: submissionId || `${templateId}_${userId}_${Date.now()}`,
				template_id: templateId,
				user_id: userId,
				delivery_type: deliveryMethod,
				status: success ? 'delivered' : 'failed',
				sent_at: new Date(),
				delivered_at: success ? new Date() : null,
				error_message: error,
				metadata: metadata || {}
			}
		});

		// Update template send count and last sent tracking
		if (success && templateId) {
			await db.template.update({
				where: { id: templateId },
				data: {
					send_count: {
						increment: 1
					},
					last_sent_at: new Date()
				}
			});
		}

		// If this was a certified delivery failure, we might want to notify the user
		if (!success && deliveryMethod === 'certified' && error) {
			// TODO: Send notification email to user about failed delivery
			console.error('Error:', error);
		}

		return json({ success: true, message: 'Delivery result recorded' });
	} catch (_error) {
		console.error('Error:', _error);
		return json({ error: 'Failed to record delivery result' }, { status: 500 });
	}
};
