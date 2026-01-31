/**
 * Discord OAuth Callback — DISABLED
 *
 * Discord authentication is disabled due to LOW Sybil resistance.
 * See: /auth/discord/+server.ts for details.
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
