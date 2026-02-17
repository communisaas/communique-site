import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { processCredentialResponse } from '$lib/core/identity/mdl-verification';

/**
 * mDL Verification Verify Endpoint
 *
 * Receives the credential response from the client, retrieves the
 * ephemeral private key from KV, and processes the response through
 * the privacy boundary function.
 *
 * The ephemeral key is deleted after use (one-time use).
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	// Authentication check
	const session = locals.session;
	if (!session?.userId) {
		throw error(401, 'Authentication required');
	}

	try {
		const body = await request.json();
		const { protocol, data, nonce } = body;

		if (!protocol || !data || !nonce) {
			throw error(400, 'Missing required fields: protocol, data, nonce');
		}

		// Retrieve ephemeral private key from KV (one-time use)
		const kvKey = `mdl-session:${nonce}`;
		let sessionData: string | null = null;

		const kv = platform?.env?.DC_SESSION_KV;
		if (kv) {
			sessionData = await kv.get(kvKey);
			// Delete immediately -- one-time use
			await kv.delete(kvKey);
		} else {
			// Dev fallback: import from start endpoint's in-memory store
			const { devSessionStore } = await import('../start/+server');
			const stored = devSessionStore.get(kvKey);
			if (stored && stored.expires > Date.now()) {
				sessionData = stored.data;
			}
			devSessionStore.delete(kvKey);
		}

		if (!sessionData) {
			throw error(410, 'Verification session expired or already used');
		}

		const { privateKeyJwk, userId: sessionUserId } = JSON.parse(sessionData);

		// Verify the session belongs to this user
		if (sessionUserId !== session.userId) {
			throw error(403, 'Session user mismatch');
		}

		// Import the ephemeral private key
		const ephemeralPrivateKey = await crypto.subtle.importKey(
			'jwk',
			privateKeyJwk,
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			['deriveKey', 'deriveBits']
		);

		// Process through privacy boundary
		const result = await processCredentialResponse(data, protocol, ephemeralPrivateKey, nonce);

		if (!result.success) {
			console.error('[mDL Verify] Verification failed:', result.error, result.message);
			return json({ error: result.error, message: result.message }, { status: 422 });
		}

		// Update user record with mDL verification
		// Use updateMany with lt condition to only upgrade trust_tier, never downgrade
		// CRITICAL: Set document_type='mdl' and identity_commitment so deriveTrustTier()
		// and deriveAuthorityLevel() correctly compute Tier 4 / Level 5 on subsequent sessions
		await prisma.user.updateMany({
			where: { id: session.userId, trust_tier: { lt: 4 } },
			data: {
				verified_at: new Date(),
				address_verification_method: 'mdl',
				address_verified_at: new Date(),
				trust_tier: 4,
				document_type: 'mdl',
				identity_commitment: result.credentialHash
			}
		});

		// Also update verification metadata for users already at tier 4+
		// (they may be re-verifying with mDL after a different method)
		await prisma.user.update({
			where: { id: session.userId },
			data: {
				address_verification_method: 'mdl',
				address_verified_at: new Date(),
				document_type: 'mdl',
				identity_commitment: result.credentialHash
			}
		});

		console.log('[mDL Verify] Success:', {
			userId: session.userId,
			district: result.district,
			state: result.state,
			credentialHash: result.credentialHash.slice(0, 12) + '...'
		});

		return json({
			success: true,
			district: result.district,
			state: result.state,
			credentialHash: result.credentialHash
		});
	} catch (err) {
		console.error('[mDL Verify] Error:', err);

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'mDL verification failed');
	}
};
