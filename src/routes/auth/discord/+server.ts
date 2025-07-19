import { redirect } from '@sveltejs/kit';
import { Discord } from 'arctic';
import { generateState, generateCodeVerifier } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	
	// Create Discord OAuth provider with static redirect URL
	const discord = new Discord(
		process.env.DISCORD_CLIENT_ID!,
		process.env.DISCORD_CLIENT_SECRET!,
		`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/discord/callback`
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
	
	const authorizationURL = await discord.createAuthorizationURL(state, codeVerifier, ['identify', 'email']);
	
	redirect(302, authorizationURL.toString());
};