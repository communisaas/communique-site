import { redirect } from '@sveltejs/kit';
import { Facebook } from 'arctic';
import { generateState, validateReturnTo } from '$lib/core/auth/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();

	// Validate OAuth credentials
	const clientId = process.env.FACEBOOK_CLIENT_ID;
	const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error('Missing OAuth credentials for Facebook');
	}

	// Create Facebook OAuth provider with static redirect URI
	const facebook = new Facebook(
		clientId,
		clientSecret,
		`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/facebook/callback`
	);

	// Store state in cookies for verification
	cookies.set('oauth_state', state, {
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

	const authorizationURL = await facebook.createAuthorizationURL(state, [
		'email',
		'public_profile'
	]);

	redirect(302, authorizationURL.toString());
};
