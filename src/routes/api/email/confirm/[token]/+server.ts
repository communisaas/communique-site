/**
 * Email Delivery Confirmation Endpoint (Wave 15e)
 *
 * GET /api/email/confirm/:token
 * User clicks this link after sending their email to confirm delivery.
 * Updates Submission.delivery_status to 'user_confirmed'.
 *
 * Token is HMAC-based (opaque) — does not leak submission ID.
 * Single-use: second click returns already_confirmed.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateConfirmationToken } from '$lib/core/email/delivery-confirmation';
import { prisma } from '$lib/core/db';

export const GET: RequestHandler = async ({ params }) => {
	const token = params.token;

	if (!token) {
		throw error(400, 'Missing confirmation token');
	}

	// Validate HMAC token and extract template/submission ID
	const id = validateConfirmationToken(token);
	if (!id) {
		throw error(400, 'Invalid or expired confirmation token');
	}

	// Find submission by template_id (token encodes template ID, not submission ID)
	// Wave 15R fix: Narrow search to submissions created within the last 7 days
	// to prevent confirming stale submissions from a recycled token
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const submission = await prisma.submission.findFirst({
		where: {
			template_id: id,
			delivery_status: { in: ['pending', 'delivered'] },
			created_at: { gte: sevenDaysAgo }
		},
		orderBy: { created_at: 'desc' }
	});

	if (!submission) {
		// Could be already confirmed or not found
		return json({
			confirmed: false,
			message: 'No pending submission found for this confirmation'
		});
	}

	if (submission.delivery_status === 'user_confirmed') {
		return json({
			confirmed: true,
			already_confirmed: true,
			message: 'Delivery was already confirmed'
		});
	}

	// Update delivery status
	await prisma.submission.update({
		where: { id: submission.id },
		data: {
			delivery_status: 'user_confirmed',
			delivered_at: new Date()
		}
	});

	return json({
		confirmed: true,
		message: 'Thank you! Your email delivery has been confirmed.'
	});
};
