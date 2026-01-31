import { redirect } from '@sveltejs/kit';
import { CoinbaseOAuth } from '$lib/core/auth/coinbase-oauth';
import { generateState, generateCodeVerifier, validateReturnTo } from '$lib/core/auth/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();

	// Validate OAuth credentials
	const clientId = process.env.COINBASE_CLIENT_ID;
	const clientSecret = process.env.COINBASE_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error('Missing OAuth credentials for Coinbase');
	}

	const redirectUri = `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/coinbase/callback`;

	// Create Coinbase OAuth provider with static redirect URI
	const coinbase = new CoinbaseOAuth(
		clientId,
		clientSecret,
		redirectUri
	);

	// Store state and code verifier in cookies for verification
	cookies.set('oauth_state', state, {
		path: '/',
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		sameSite: 'lax'
	});

	cookies.set('oauth_code_verifier', codeVerifier, {
		path: '/',
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		sameSite: 'lax'
	});

	// Store the return URL if provided (BA-004: validate to prevent open redirect)
	const returnTo = validateReturnTo(url.searchParams.get('returnTo'));
	if (returnTo !== '/') {
		cookies.set('oauth_return_to', returnTo, {
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			httpOnly: true,
			maxAge: 60 * 10, // 10 minutes
			sameSite: 'lax'
		});
	}

	const { url: authorizationURL } = await coinbase.createAuthorizationURL(state, codeVerifier, [
		'wallet:user:read',
		'wallet:user:email',
		'offline_access'
	]);

	redirect(302, authorizationURL.toString());
};
