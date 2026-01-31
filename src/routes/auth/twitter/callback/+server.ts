/**
 * Twitter/X OAuth Callback — DISABLED
 *
 * Twitter/X authentication is disabled due to LOW Sybil resistance.
 * See: /auth/twitter/+server.ts for details.
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
