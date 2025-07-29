import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This would be shared state in production (Redis/DB)
// For demo, we'll simulate the verification results
const verificationSessions = new Map();

export const GET: RequestHandler = async ({ params }) => {
	const { userId } = params;

	if (!userId) {
		return json(
			{ error: 'Missing user ID' },
			{ status: 400 }
		);
	}

	// Check session status
	const session = verificationSessions.get(userId);
	
	if (!session) {
		return json(
			{ error: 'Session not found' },
			{ status: 404 }
		);
	}

	// For demo purposes, simulate verification completion after 10 seconds
	const timeSinceCreation = Date.now() - session.createdAt.getTime();
	
	if (timeSinceCreation > 10000 && session.status === 'pending') {
		// Simulate successful verification with mock passport data
		session.status = 'verified';
		session.credentialSubject = {
			nationality: 'USA',
			issuing_state: 'USA',
			name: ['John', 'Doe'],
			date_of_birth: '15-03-90',
			older_than: '18',
			passport_no_ofac: true,
			name_and_dob_ofac: true,
			name_and_yob_ofac: true
		};
	}

	return json({
		verified: session.status === 'verified',
		failed: session.status === 'failed',
		pending: session.status === 'pending',
		credentialSubject: session.credentialSubject
	});
};