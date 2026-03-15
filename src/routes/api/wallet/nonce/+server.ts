/**
 * Wallet Nonce Generation Endpoint
 *
 * Generates a random nonce and human-readable message for EIP-191 personal_sign.
 * The nonce is stored in a short-lived server-side map (5-minute TTL) keyed by
 * nonce value, scoped to the requesting userId. Consumed once by /api/wallet/connect.
 *
 * GET /api/wallet/nonce
 * Requires: authenticated session (locals.user)
 * Returns: { nonce, message, expiresAt }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { nonceStore, cleanupExpiredNonces } from '../_nonce-store';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Housekeeping: purge expired nonces on every request
	cleanupExpiredNonces();

	// Generate 32-byte random nonce as hex
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const nonce = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	const now = Date.now();
	const expiresAt = now + NONCE_TTL_MS;
	const timestamp = new Date(now).toISOString();

	const message = [
		'Commons Wallet Verification',
		'',
		'I am connecting this wallet to my Commons account.',
		'',
		`Nonce: ${nonce}`,
		`Timestamp: ${timestamp}`
	].join('\n');

	// Store nonce for later verification by /api/wallet/connect
	nonceStore.set(nonce, {
		userId: locals.user.id,
		nonce,
		message,
		expiresAt
	});

	return json({
		nonce,
		message,
		expiresAt: new Date(expiresAt).toISOString()
	});
};
