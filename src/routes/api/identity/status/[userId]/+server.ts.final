import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verificationSessions } from '$lib/core/server/verification-sessions';

export const GET: RequestHandler = async ({ params }) => {
	const { userId } = params;

	if (!userId) {
		return json({ error: 'Missing user ID' }, { status: 400 });
	}

	// Check session status
	const session = verificationSessions.get(userId);

	if (!session) {
		return json({ error: 'Session not found' }, { status: 404 });
	}

	// Return current verification status
	const response = {
		verified: session.status === 'verified',
		failed: session.status === 'failed',
		pending: session.status === 'pending',
		credentialSubject: session.credentialSubject || null,
		sessionAge: Math.floor((Date.now() - session.createdAt.getTime()) / 1000)
	};

	// Log status check for debugging (without sensitive data)
	console.log('Self.xyz status check:', {
		userId: userId.substring(0, 8) + '...',
		status: session.status,
		sessionAge: response.sessionAge,
		hasCredentials: !!session.credentialSubject
	});

	return json(response);
};
