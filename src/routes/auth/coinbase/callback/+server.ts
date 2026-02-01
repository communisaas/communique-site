import { error } from '@sveltejs/kit';
import { oauthCallbackHandler } from '$lib/core/auth/oauth-callback-handler';
import { getCoinbaseConfig } from '$lib/core/auth/oauth-providers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const coinbaseConfig = getCoinbaseConfig();

	if (!coinbaseConfig) {
		throw error(503, 'Coinbase authentication is temporarily unavailable. Please try another sign-in method.');
	}

	return oauthCallbackHandler.handleCallback(coinbaseConfig, url, cookies);
};
