import { redirect } from '@sveltejs/kit';
import { Twitter } from 'arctic';
import { generateState, generateCodeVerifier } from '$lib/core/auth/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();

	// Validate OAuth credentials
	const clientId = process.env.TWITTER_CLIENT_ID;
	const clientSecret = process.env.TWITTER_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error('Missing OAuth credentials for Twitter');
	}

	// Create Twitter OAuth provider with static redirect URI
	const twitter = new Twitter(
		clientId,
		clientSecret,
		`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/twitter/callback`
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

	// Store the return URL if provided
	const returnTo = url.searchParams.get('returnTo');
	if (returnTo) {
		cookies.set('oauth_return_to', returnTo, {
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			httpOnly: true,
			maxAge: 60 * 10, // 10 minutes
			sameSite: 'lax'
		});
	}

	const authorizationURL = await twitter.createAuthorizationURL(state, codeVerifier, [
		'tweet.read',
		'users.read'
	]);

	redirect(302, authorizationURL.toString());
};
