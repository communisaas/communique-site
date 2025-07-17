import { error, redirect } from '@sveltejs/kit';
import { Facebook } from 'arctic';
import { db } from '$lib/server/db';
import { createSession, sessionCookieName } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('oauth_state');
	const returnTo = cookies.get('oauth_return_to') || '/dashboard';

	// Create Facebook OAuth provider with dynamic origin
	const facebook = new Facebook(
		process.env.FACEBOOK_CLIENT_ID!,
		process.env.FACEBOOK_CLIENT_SECRET!,
		`${url.origin}/auth/facebook/callback`
	);

	// Clear OAuth cookies
	cookies.delete('oauth_state', { path: '/' });
	cookies.delete('oauth_return_to', { path: '/' });

	if (!code || !state || !storedState) {
		return error(400, 'Missing required OAuth parameters');
	}

	if (state !== storedState) {
		return error(400, 'Invalid OAuth state');
	}

	try {
		const tokens = await facebook.validateAuthorizationCode(code);

		const facebookUserResponse = await fetch(
			`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokens.accessToken}`
		);

		if (!facebookUserResponse.ok) {
			return error(500, 'Failed to fetch user information from Facebook');
		}

		const facebookUser = await facebookUserResponse.json();

		let existingAccount = await db.account.findUnique({
			where: {
				provider_provider_account_id: {
					provider: 'facebook',
					provider_account_id: facebookUser.id
				}
			},
			include: { user: true }
		});

		let user;

		if (existingAccount) {
			await db.account.update({
				where: { id: existingAccount.id },
				data: {
					access_token: tokens.accessToken,
					updated_at: new Date()
				}
			});
			user = existingAccount.user;
		} else {
			const existingUser = await db.user.findUnique({
				where: { email: facebookUser.email }
			});

			if (existingUser) {
				await db.account.create({
					data: {
						id: generateAccountId(),
						user_id: existingUser.id,
						type: 'oauth',
						provider: 'facebook',
						provider_account_id: facebookUser.id,
						access_token: tokens.accessToken,
						token_type: 'Bearer',
						scope: 'email public_profile'
					}
				});
				user = existingUser;
			} else {
				user = await db.user.create({
					data: {
						email: facebookUser.email,
						name: facebookUser.name,
						avatar: facebookUser.picture?.data?.url
					}
				});

				await db.account.create({
					data: {
						id: generateAccountId(),
						user_id: user.id,
						type: 'oauth',
						provider: 'facebook',
						provider_account_id: facebookUser.id,
						access_token: tokens.accessToken,
						token_type: 'Bearer',
						scope: 'email public_profile'
					}
				});
			}
		}

		// Create extended session for social media funnel users
		const isFromSocialFunnel = returnTo.includes('template-modal') || returnTo.includes('auth=required');
		const session = await createSession(user.id, isFromSocialFunnel);

		// Set session cookie with extended expiry for social funnel users
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
			const addressCollectionUrl = `/onboarding/address?returnTo=${encodeURIComponent(returnTo)}`;
			redirect(302, addressCollectionUrl);
		} else if (isDirectOutreach && !hasProfile) {
			// Direct outreach template - redirect to profile completion
			const profileCollectionUrl = `/onboarding/profile?returnTo=${encodeURIComponent(returnTo)}`;
			redirect(302, profileCollectionUrl);
		} else {
			redirect(302, returnTo);
		}
	} catch (err) {
		console.error('Facebook OAuth callback error:', err);
		return error(500, 'Authentication failed');
	}
};

function generateAccountId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(20));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
} 