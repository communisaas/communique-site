import { redirect } from '@sveltejs/kit';
import { LinkedIn } from 'arctic';
import { generateState } from '$lib/core/auth/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();
	
	// Create LinkedIn OAuth provider with static redirect URL
	const linkedin = new LinkedIn(
		process.env.LINKEDIN_CLIENT_ID!,
		process.env.LINKEDIN_CLIENT_SECRET!,
		`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/linkedin/callback`
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
	
	const authorizationURL = await linkedin.createAuthorizationURL(state, ['openid', 'profile', 'email']);
	
	redirect(302, authorizationURL.toString());
};