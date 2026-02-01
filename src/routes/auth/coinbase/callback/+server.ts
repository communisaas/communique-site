import { error } from '@sveltejs/kit';
import { oauthCallbackHandler } from '$lib/core/auth/oauth-callback-handler';
import { getCoinbaseConfig } from '$lib/core/auth/oauth-providers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const config = getCoinbaseConfig();
	if (!config) {
		throw error(503, 'Coinbase authentication is not currently available');
	}
	return oauthCallbackHandler.handleCallback(config, url, cookies);
};
