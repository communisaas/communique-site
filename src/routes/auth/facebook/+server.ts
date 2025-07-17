import { redirect } from '@sveltejs/kit';
import { Facebook } from 'arctic';
import { generateState } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();

	// Create Facebook OAuth provider with dynamic origin
	const facebook = new Facebook(
		process.env.FACEBOOK_CLIENT_ID!,
		process.env.FACEBOOK_CLIENT_SECRET!,
		`${url.origin}/auth/facebook/callback`
	);

	// Store state in cookies for verification
	cookies.set('oauth_state', state, {
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

	const authorizationURL = await facebook.createAuthorizationURL(state, ['email', 'public_profile']);

	redirect(302, authorizationURL.toString());
}; 