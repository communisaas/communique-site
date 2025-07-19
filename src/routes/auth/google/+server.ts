import { redirect } from '@sveltejs/kit';
import { Google } from 'arctic';
import { generateState, generateCodeVerifier } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	
	const redirectUri = `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/google/callback`;
	
	// Create Google OAuth provider with static redirect URI
	const google = new Google(
		process.env.GOOGLE_CLIENT_ID!,
		process.env.GOOGLE_CLIENT_SECRET!,
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
	
	const authorizationURL = await google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
	
	redirect(302, authorizationURL.toString());
}; 