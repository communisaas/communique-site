import { redirect } from '@sveltejs/kit';
import { linkedin, generateState } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();
	
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
	
	const authorizationURL = await linkedin.createAuthorizationURL(state, ['profile', 'email']);
	
	redirect(302, authorizationURL.toString());
};