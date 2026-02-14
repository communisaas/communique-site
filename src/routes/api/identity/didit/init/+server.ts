/**
 * Didit.me Verification Initialization Endpoint
 *
 * Creates a new verification session with Didit.me and returns the URL
 * for the user to complete identity verification.
 *
 * API Documentation: https://docs.didit.me/reference/create-session-verification-sessions
 *
 * Flow:
 * 1. Client calls this endpoint with userId and templateSlug
 * 2. Server creates session with Didit.me API (POST /v2/session/)
 * 3. Returns verification URL for user redirect
 * 4. User completes verification on Didit.me
 * 5. Didit.me sends webhook to /api/identity/didit/webhook with results
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVerificationSession } from '$lib/core/identity/didit-client';
import { createVerificationSession as createDbSession } from '$lib/core/server/verification-sessions';

export const POST: RequestHandler = async ({ locals, request, url }) => {
	// Authentication check
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Use authenticated user's ID
	const userId = locals.user.id;

	try {
		const { templateSlug } = await request.json();

		// Construct webhook callback URL
		const protocol = url.protocol === 'http:' && url.hostname === 'localhost' ? 'http:' : 'https:';
		const callbackUrl = `${protocol}//${url.host}/api/identity/didit/webhook`;

		console.log('[Didit.me] Creating verification session:', {
			userId,
			callbackUrl,
			templateSlug
		});

		// Create verification session using SDK
		const sessionResponse = await createVerificationSession(
			{
				userId,
				templateSlug
			},
			callbackUrl
		);

		console.log('[Didit.me] Session created successfully:', {
			sessionId: sessionResponse.sessionId,
			status: sessionResponse.status
		});

		// BR6-004: Store VerificationSession binding for webhook userId validation.
		// The Didit session_id is stored as `challenge` so the webhook can cross-reference
		// vendor_data userId against the userId that initiated the session.
		await createDbSession({
			userId,
			method: 'didit',
			challenge: sessionResponse.sessionId,
		});

		// Return verification URL and session details to client
		return json({
			success: true,
			verificationUrl: sessionResponse.sessionUrl,
			sessionId: sessionResponse.sessionId,
			sessionToken: sessionResponse.sessionToken,
			status: sessionResponse.status
		});
	} catch (err) {
		console.error('[Didit.me] Initialization error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to initialize Didit verification');
	}
};
