import { oauthCallbackHandler } from '$lib/core/auth/oauth-callback-handler';
import { facebookConfig } from '$lib/core/auth/oauth-providers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	return oauthCallbackHandler.handleCallback(facebookConfig, url, cookies);
};
