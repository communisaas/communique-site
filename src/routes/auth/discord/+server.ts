/**
 * Discord OAuth Route — DISABLED
 *
 * Discord authentication is disabled due to LOW Sybil resistance (⭐⭐):
 * - No phone verification required
 * - No identity verification
 * - Trivial to create multiple accounts
 * - Email verification optional
 *
 * See: IMPLEMENTATION-GAP-ANALYSIS.md, AuthButtons.svelte
 * To re-enable: restore original implementation from git history
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(
		{
			error: 'discord_disabled',
			message: 'Discord authentication is disabled due to insufficient Sybil resistance'
		},
		{ status: 403 }
	);
};
