/**
 * Twitter/X OAuth Route — DISABLED
 *
 * Twitter/X authentication is disabled due to LOW Sybil resistance (⭐⭐):
 * - No phone verification required for most accounts
 * - Minimal identity verification
 * - Easy to create multiple accounts
 * - High bot/spam prevalence
 *
 * See: IMPLEMENTATION-GAP-ANALYSIS.md, AuthButtons.svelte
 * To re-enable: restore original implementation from git history
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(
		{
			error: 'twitter_disabled',
			message: 'Twitter/X authentication is disabled due to insufficient Sybil resistance'
		},
		{ status: 403 }
	);
};
