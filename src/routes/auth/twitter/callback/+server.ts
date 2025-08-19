import { error, redirect } from '@sveltejs/kit';
import { Twitter } from 'arctic';
import { db } from '$lib/server/db';
import { createSession, sessionCookieName } from '$lib/server/auth';
import { encodeHexLowerCase } from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('oauth_state');
	const codeVerifier = cookies.get('oauth_code_verifier');
	const returnTo = cookies.get('oauth_return_to') || '/dashboard';
	
	// Create Twitter OAuth provider with static redirect URL
	const twitter = new Twitter(
		process.env.TWITTER_CLIENT_ID!,
		process.env.TWITTER_CLIENT_SECRET!,
		`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/twitter/callback`
	);
	
	// Clear OAuth cookies
	cookies.delete('oauth_state', { path: '/' });
	cookies.delete('oauth_code_verifier', { path: '/' });
	cookies.delete('oauth_return_to', { path: '/' });
	
	if (!code || !state || !storedState || !codeVerifier) {
		return error(400, 'Missing required OAuth parameters');
	}
	
	if (state !== storedState) {
		return error(400, 'Invalid OAuth state');
	}
	
	try {
		// Exchange authorization code for tokens
		const tokens = await twitter.validateAuthorizationCode(code, codeVerifier);
		
		// Fetch user info from Twitter
		const twitterUserResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`
			}
		});
		
		if (!twitterUserResponse.ok) {
			return error(500, 'Failed to fetch user information from Twitter');
		}
		
		const twitterUserData = await twitterUserResponse.json();
		const twitterUser = twitterUserData.data;
		
		// Check if user already exists
		let existingAccount = await db.account.findUnique({
			where: {
				provider_provider_account_id: {
					provider: 'twitter',
					provider_account_id: twitterUser.id
				}
			},
			include: {
				user: true
			}
		});
		
		let user;
		
		if (existingAccount) {
			// Update existing account tokens
			await db.account.update({
				where: { id: existingAccount.id },
				data: {
					access_token: tokens.accessToken(),
					refresh_token: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
					expires_at: tokens.accessTokenExpiresAt() ? Math.floor(tokens.accessTokenExpiresAt().getTime() / 1000) : null,
					updated_at: new Date()
				}
			});
			
			user = existingAccount.user;
		} else {
			// Create new user and account (Twitter doesn't provide email by default)
			const userEmail = `${twitterUser.username}@twitter.communique.local`; // Placeholder email
			
			user = await db.user.create({
				data: {
					email: userEmail,
					name: twitterUser.name,
					avatar: twitterUser.profile_image_url
				}
			});
			
			await db.account.create({
				data: {
					id: generateAccountId(),
					user_id: user.id,
					type: 'oauth',
					provider: 'twitter',
					provider_account_id: twitterUser.id,
					access_token: tokens.accessToken(),
					refresh_token: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
					expires_at: tokens.accessTokenExpiresAt() ? Math.floor(tokens.accessTokenExpiresAt().getTime() / 1000) : null,
					token_type: 'Bearer',
					scope: 'tweet.read users.read',
					created_at: new Date(),
					updated_at: new Date()
				}
			});
		}
		
		// Create extended session for template-action deep-link flows (avoid stateful query params)
		const isFromSocialFunnel = returnTo.includes('template-modal') || returnTo.includes('auth=required');
		const session = await createSession(user.id, isFromSocialFunnel);
		
		// Set session cookie with extended expiry for template-action deep-link flows
		const cookieMaxAge = isFromSocialFunnel ? 60 * 60 * 24 * 90 : 60 * 60 * 24 * 30; // 90 or 30 days
		cookies.set(sessionCookieName, session.id, {
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			httpOnly: true,
			maxAge: cookieMaxAge,
			sameSite: 'lax'
		});
		
		// Check if user needs address collection for congressional templates
		const needsAddressForTemplate = returnTo.includes('template-modal') || isFromSocialFunnel;
		const hasAddress = user.street && user.city && user.state && user.zip;
		
		// Check if this is for a direct outreach template (not congressional)
		const isDirectOutreach = returnTo.includes('template-modal') && !returnTo.includes('congress');
		const hasProfile = user.phone && user.phone.startsWith('{'); // Check if phone contains profile JSON
		
		if (needsAddressForTemplate && !hasAddress && !isDirectOutreach) {
			// Congressional template - redirect to address collection
			const addressCollectionUrl = `/onboarding/address?returnTo=${encodeURIComponent(returnTo)}&provider=twitter`;
			redirect(302, addressCollectionUrl);
		} else if (isDirectOutreach && !hasProfile) {
			// Direct outreach template - redirect to profile completion
			const profileCollectionUrl = `/onboarding/profile?returnTo=${encodeURIComponent(returnTo)}&provider=twitter`;
			redirect(302, profileCollectionUrl);
		} else {
			redirect(302, returnTo.includes('provider=') ? returnTo : `${returnTo}${returnTo.includes('?') ? '&' : '?'}provider=twitter`);
		}
		
	} catch (err) {
		// Don't log SvelteKit redirects as errors - they're thrown by redirect() calls
		if (err instanceof Response && err.status >= 300 && err.status < 400) {
			throw err;
		}
		// Also check for SvelteKit redirect objects (which have status and location properties)
		if (err && typeof err === 'object' && 'status' in err && 'location' in err && err.status >= 300 && err.status < 400) {
			throw err;
		}
		
		console.error('Twitter OAuth error:', {
			error: err,
			message: err instanceof Error ? err.message : 'Unknown error',
			stack: err instanceof Error ? err.stack : undefined,
			env: {
				hasTwitterClientId: !!process.env.TWITTER_CLIENT_ID,
				hasTwitterClientSecret: !!process.env.TWITTER_CLIENT_SECRET,
				oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE_URL,
				nodeEnv: process.env.NODE_ENV
			}
		});
		
		// Return more specific error message in non-production for debugging
		const errorMessage = process.env.NODE_ENV === 'production' 
			? 'Authentication failed' 
			: `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
		
		return error(500, errorMessage);
	}
};

function generateAccountId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(20));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
} 