import { db } from '$lib/core/db';
import { verifyUnsubscribeToken } from '$lib/server/email/unsubscribe';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { supporterId, token } = params;

	// Find the supporter to get their orgId
	const supporter = await db.supporter.findUnique({
		where: { id: supporterId },
		select: { id: true, orgId: true, email: true, emailStatus: true }
	});

	if (!supporter) {
		return { status: 'invalid' as const, message: 'Invalid unsubscribe link.' };
	}

	// Verify HMAC token
	if (!verifyUnsubscribeToken(supporterId, supporter.orgId, token)) {
		return { status: 'invalid' as const, message: 'Invalid unsubscribe link.' };
	}

	// Already unsubscribed? Show confirmation without re-updating
	if (supporter.emailStatus === 'unsubscribed') {
		return { status: 'already' as const, message: 'You are already unsubscribed.' };
	}

	// Unsubscribe
	await db.supporter.update({
		where: { id: supporterId },
		data: { emailStatus: 'unsubscribed' }
	});

	return { status: 'success' as const, message: 'You have been unsubscribed.' };
};
