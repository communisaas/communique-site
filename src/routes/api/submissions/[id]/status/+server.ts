import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { computePseudonymousId } from '$lib/core/privacy/pseudonymous-id';

/**
 * Submission Status Endpoint
 *
 * Returns the delivery status of a submission.
 * Used by SubmissionStatus.svelte to poll for progress updates.
 *
 * Ownership is verified via pseudonymous_id (HMAC of user ID),
 * since Submission has no direct user_id field by design.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const { id } = params;
	if (!id) {
		throw error(400, 'Submission ID is required');
	}

	const submission = await prisma.submission.findUnique({
		where: { id },
		select: {
			id: true,
			pseudonymous_id: true,
			delivery_status: true,
			delivery_error: true,
			delivered_at: true,
			cwc_submission_id: true
		}
	});

	if (!submission) {
		throw error(404, 'Submission not found');
	}

	// Ownership check: compute pseudonymous ID from current user
	// and verify it matches the submission's pseudonymous_id
	const callerPseudoId = computePseudonymousId(locals.user.id);
	if (submission.pseudonymous_id !== callerPseudoId) {
		return json({ error: 'Access denied' }, { status: 403 });
	}

	// Count deliveries from cwc_submission_id (comma-separated message IDs)
	const deliveryCount = submission.cwc_submission_id
		? submission.cwc_submission_id.split(',').length
		: 0;

	// Sanitize error for client — don't leak internal details
	// (raw delivery_error may contain stack traces, DB info, or internal service names)
	const userError = submission.delivery_error
		? 'Delivery encountered an issue. Please try again or contact support.'
		: null;

	return json({
		status: submission.delivery_status, // 'pending' | 'processing' | 'delivered' | 'partial' | 'failed'
		deliveryCount,
		deliveredAt: submission.delivered_at,
		error: userError
	});
};
