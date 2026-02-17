/**
 * Passkey Authentication Endpoint (Wave 2A: Graduated Trust)
 *
 * Two-step WebAuthn authentication flow:
 *
 *   Step 1 (POST, action: 'options'):
 *     - Optionally accepts email to scope allowCredentials
 *     - If no email, uses discoverable credentials (usernameless)
 *     - Generates authentication options via @simplewebauthn/server
 *     - Stores challenge in VerificationSession (5-minute TTL)
 *     - Returns options JSON for navigator.credentials.get()
 *
 *   Step 2 (POST, action: 'verify'):
 *     - Receives assertion response from browser
 *     - Looks up user by credential ID in the response
 *     - Verifies assertion against stored public key + challenge
 *     - Creates session and sets auth cookie
 *     - Returns user info
 *
 * Security:
 *   - Challenge tied to session via VerificationSession
 *   - 5-minute challenge expiry prevents replay
 *   - Credential lookup by unique passkey_credential_id
 *   - Session cookie set with httpOnly, secure (in production), sameSite=lax
 *
 * No existing auth session required — this IS the authentication mechanism.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { sessionCookieName } from '$lib/core/auth/auth';
import {
	generatePasskeyAuthOptions,
	verifyPasskeyAuth
} from '$lib/core/identity/passkey-authentication';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();
	const action = body.action;

	if (!action || typeof action !== 'string') {
		throw error(400, 'Missing or invalid "action" field. Expected "options" or "verify".');
	}

	switch (action) {
		case 'options':
			return handleOptions(body.email);

		case 'verify':
			return handleVerification(body.response, body.sessionId, cookies);

		default:
			throw error(400, `Unknown action "${action}". Expected "options" or "verify".`);
	}
};

// ---------------------------------------------------------------------------
// Step 1: Generate authentication options
// ---------------------------------------------------------------------------

async function handleOptions(email?: string): Promise<Response> {
	// Email is required for Phase 1 (usernameless flow deferred to Phase 2)
	if (!email || typeof email !== 'string' || email.length === 0) {
		throw error(400, 'Email is required for passkey authentication');
	}

	try {
		const { options, sessionId } = await generatePasskeyAuthOptions(email);

		return json({
			success: true,
			options,
			sessionId
		});
	} catch (err) {
		console.error('[passkey/authenticate] Options generation failed:', err);

		if (err instanceof Error) {
			if (err.message.includes('User not found')) {
				throw error(404, 'No account found with that email');
			}
			if (err.message.includes('no registered passkey')) {
				throw error(404, 'This account has no registered passkey. Log in with OAuth and register a passkey first.');
			}
			throw error(500, `Failed to generate authentication options: ${err.message}`);
		}
		throw error(500, 'Failed to generate authentication options');
	}
}

// ---------------------------------------------------------------------------
// Step 2: Verify assertion
// ---------------------------------------------------------------------------

async function handleVerification(
	response: AuthenticationResponseJSON | undefined,
	sessionId: string | undefined,
	cookies: Parameters<RequestHandler>[0]['cookies']
): Promise<Response> {
	// Validate required fields
	if (!response) {
		throw error(400, 'Missing "response" field with authentication response');
	}

	if (!response.id || !response.rawId || !response.response || !response.type) {
		throw error(400, 'Invalid authentication response format');
	}

	if (!sessionId || typeof sessionId !== 'string') {
		throw error(400, 'Missing or invalid "sessionId"');
	}

	try {
		const result = await verifyPasskeyAuth(response, sessionId);

		// Set the session cookie (same pattern as OAuth callback handler)
		cookies.set(sessionCookieName, result.session.id, {
			path: '/',
			sameSite: 'lax',
			httpOnly: true,
			expires: result.session.expiresAt,
			secure: !dev
		});

		return json({
			success: true,
			user: {
				id: result.user.id,
				email: result.user.email,
				name: result.user.name,
				trust_tier: result.user.trust_tier
			}
		});
	} catch (err) {
		console.error('[passkey/authenticate] Verification failed:', err);

		if (err instanceof Error) {
			const message = err.message;

			if (message.includes('session not found')) {
				throw error(404, 'Authentication session not found');
			}
			if (message.includes('already used or expired')) {
				throw error(409, 'Authentication session already used');
			}
			if (message.includes('expired')) {
				throw error(410, 'Authentication session expired');
			}
			if (message.includes('No user found')) {
				throw error(404, 'No account found for this passkey. Register a passkey first.');
			}
			if (message.includes('no stored public key')) {
				throw error(500, 'Account passkey data is corrupted');
			}
			if (message.includes('verification failed')) {
				throw error(401, 'Passkey authentication failed');
			}

			throw error(400, message);
		}

		throw error(500, 'Authentication verification failed');
	}
}
