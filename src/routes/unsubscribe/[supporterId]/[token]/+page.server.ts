import { db } from '$lib/core/db';
import { verifyUnsubscribeToken } from '$lib/server/email/unsubscribe';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { supporterId, token } = params;

	// Find the supporter to get their orgId
	const supporter = await db.supporter.findUnique({
		where: { id: supporterId },
		select: { id: true, orgId: true, emailStatus: true }
	});

	if (!supporter) {
		return { status: 'invalid' as const, verified: false };
	}

	// Verify HMAC token
	if (!verifyUnsubscribeToken(supporterId, supporter.orgId, token)) {
		return { status: 'invalid' as const, verified: false };
	}

	// Already unsubscribed?
	if (supporter.emailStatus === 'unsubscribed') {
		return { status: 'already' as const, verified: true };
	}

	// Token is valid — show confirmation form (do NOT mutate on GET)
	return { status: 'confirm' as const, verified: true };
};

export const actions: Actions = {
	default: async ({ params }) => {
		const { supporterId, token } = params;

		const supporter = await db.supporter.findUnique({
			where: { id: supporterId },
			select: { id: true, orgId: true, emailStatus: true }
		});

		if (!supporter) {
			return { done: false, error: 'Invalid unsubscribe link.' };
		}

		if (!verifyUnsubscribeToken(supporterId, supporter.orgId, token)) {
			return { done: false, error: 'Invalid unsubscribe link.' };
		}

		if (supporter.emailStatus === 'unsubscribed') {
			return { done: true };
		}

		await db.supporter.update({
			where: { id: supporterId },
			data: { emailStatus: 'unsubscribed' }
		});

		return { done: true };
	}
};
