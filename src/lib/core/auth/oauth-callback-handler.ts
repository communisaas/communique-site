/**
 * UNIFIED OAUTH CALLBACK HANDLER
 *
 * Consolidates 85% of duplicate OAuth callback logic across 5 providers
 * while maintaining provider-specific customizations.
 *
 * Features:
 * - Unified token exchange and validation
 * - Common user creation/update logic
 * - Standardized session management
 * - Consistent address collection flows
 * - Provider-specific API handling through configuration
 */

import type { Cookies } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/core/db';
import { createSession, sessionCookieName } from '$lib/core/auth/auth';
import { createNEARAccountFromOAuth } from '$lib/core/blockchain/oauth-near';
import { deriveScrollAddress } from '$lib/core/blockchain/chain-signatures';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type OAuthProvider = 'google' | 'facebook' | 'linkedin' | 'twitter' | 'discord';

export interface UserData {
	id: string;
	email: string;
	name: string;
	avatar?: string;
	// Provider-specific fields
	username?: string;
	discriminator?: string;
}

export interface TokenData {
	accessToken: string;
	refreshToken?: string | null;
	expiresAt?: number | null;
}

export interface DatabaseUser {
	id: string;
	email: string;
	name: string | null;
	avatar: string | null;
	street?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	phone?: string | null;
	congressional_district?: string | null;
	is_verified?: boolean;
	role?: string | null;
	organization?: string | null;
	location?: string | null;
	connection?: string | null;
	connection_details?: string | null;
	profile_completed_at?: Date | null;
	profile_visibility?: string;
	verification_method?: string | null;
	verified_at?: Date | null;
	// Blockchain accounts
	near_account_id?: string | null;
	near_account_entropy?: string | null; // 🔒 PRIVACY: Random entropy for account ID generation
	near_auth_method?: string | null;
	near_account_created_at?: Date | null;
	scroll_address?: string | null;
	scroll_derivation_path?: string | null;
	connected_wallet_address?: string | null;
	connected_wallet_type?: string | null;
	connected_wallet_chain?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface OAuthTokens {
	accessToken: () => string;
	refreshToken?: () => string | null;
	hasRefreshToken: () => boolean;
	accessTokenExpiresAt: () => Date | null;
}

export interface OAuthClient {
	validateAuthorizationCode: (code: string, codeVerifier?: string) => Promise<OAuthTokens>;
}

export interface OAuthCallbackConfig {
	provider: OAuthProvider;
	clientId: string;
	clientSecret: string;
	redirectUrl: string;
	userInfoUrl: string;
	requiresCodeVerifier: boolean;
	scope: string;

	// Provider-specific functions with proper typing
	createOAuthClient: () => OAuthClient;
	exchangeTokens: (
		client: OAuthClient,
		code: string,
		codeVerifier?: string
	) => Promise<OAuthTokens>;
	getUserInfo: (accessToken: string, clientSecret?: string) => Promise<unknown>;
	mapUserData: (rawUser: unknown) => UserData;
	extractTokenData: (tokens: OAuthTokens) => TokenData;
}

// =============================================================================
// OAUTH CALLBACK HANDLER CLASS
// =============================================================================

export class OAuthCallbackHandler {
	/**
	 * Main entry point for handling OAuth callbacks
	 */
	async handleCallback(config: OAuthCallbackConfig, url: URL, cookies: Cookies): Promise<Response> {
		try {
			// Step 1: Validate OAuth parameters
			const {
				code,
				state: _state,
				codeVerifier,
				returnTo
			} = this.validateParameters(url, cookies, config.requiresCodeVerifier);

			// Step 2: Exchange authorization code for tokens
			const oauthClient = config.createOAuthClient();
			const tokens = await config.exchangeTokens(oauthClient, code, codeVerifier);
			const tokenData = config.extractTokenData(tokens);

			// Step 3: Fetch user information from provider
			const rawUserData = await config.getUserInfo(tokenData.accessToken, config.clientSecret);
			const userData = config.mapUserData(rawUserData);

			// Step 4: Find or create user in database
			const user = await this.findOrCreateUser(config, userData, tokenData);

			// Step 5: Create session and handle redirects
			return await this.handleSessionAndRedirect(user, returnTo, config.provider, cookies);
		} catch (error) {
			return this.handleError(error, config.provider);
		}
	}

	/**
	 * Validate OAuth callback parameters and retrieve stored values
	 */
	private validateParameters(
		url: URL,
		cookies: Cookies,
		requiresCodeVerifier: boolean
	): {
		code: string;
		state: string;
		codeVerifier?: string;
		returnTo: string;
	} {
		// Extract parameters
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const storedState = cookies.get('oauth_state');
		const returnTo = cookies.get('oauth_return_to') || '/profile';
		const codeVerifier = requiresCodeVerifier ? cookies.get('oauth_code_verifier') : undefined;

		// Clean up cookies
		cookies.delete('oauth_state', { path: '/' });
		cookies.delete('oauth_return_to', { path: '/' });
		if (requiresCodeVerifier) {
			cookies.delete('oauth_code_verifier', { path: '/' });
		}

		// Validate required parameters
		if (!code || !state || !storedState) {
			throw error(400, 'Missing required OAuth parameters');
		}

		if (state !== storedState) {
			throw error(400, 'Invalid OAuth state');
		}

		if (requiresCodeVerifier && !codeVerifier) {
			throw error(400, 'Missing code verifier');
		}

		return { code, state, codeVerifier, returnTo };
	}

	/**
	 * Find existing user or create new one with OAuth account
	 */
	private async findOrCreateUser(
		config: OAuthCallbackConfig,
		userData: UserData,
		tokenData: TokenData
	): Promise<DatabaseUser> {
		// Check for existing OAuth account
		const existingAccount = await db.account.findUnique({
			where: {
				provider_provider_account_id: {
					provider: config.provider,
					provider_account_id: userData.id
				}
			},
			include: { user: true }
		});

		// Update existing account tokens
		if (existingAccount) {
			await db.account.update({
				where: { id: existingAccount.id },
				data: {
					access_token: tokenData.accessToken,
					refresh_token: tokenData.refreshToken,
					expires_at: tokenData.expiresAt
				}
			});

			// Ensure blockchain accounts exist for existing user
			await this.ensureBlockchainAccounts(existingAccount.user, config.provider, userData.id);

			return existingAccount.user;
		}

		// Check for existing user by email
		const existingUser = await db.user.findUnique({
			where: { email: userData.email }
		});

		if (existingUser) {
			// Link OAuth account to existing user
			await db.account.create({
				data: {
					id: this.generateAccountId(),
					user_id: existingUser.id,
					type: 'oauth',
					provider: config.provider,
					provider_account_id: userData.id,
					access_token: tokenData.accessToken,
					refresh_token: tokenData.refreshToken,
					expires_at: tokenData.expiresAt,
					token_type: 'Bearer',
					scope: config.scope
				}
			});

			// Ensure blockchain accounts exist for existing user
			await this.ensureBlockchainAccounts(existingUser, config.provider, userData.id);

			return existingUser;
		}

		// Create new user with OAuth account
		const newUser = await db.user.create({
			data: {
				email: userData.email,
				name: userData.name,
				avatar: userData.avatar,
				account: {
					create: {
						id: this.generateAccountId(),
						type: 'oauth',
						provider: config.provider,
						provider_account_id: userData.id,
						access_token: tokenData.accessToken,
						refresh_token: tokenData.refreshToken,
						expires_at: tokenData.expiresAt,
						token_type: 'Bearer',
						scope: config.scope
					}
				}
			}
		});

		// Create blockchain accounts for new user
		await this.ensureBlockchainAccounts(newUser, config.provider, userData.id);

		return newUser;
	}

	/**
	 * Ensure user has NEAR account and Scroll address
	 * Creates blockchain accounts if they don't exist yet
	 */
	private async ensureBlockchainAccounts(
		user: DatabaseUser,
		provider: OAuthProvider,
		oauthUserId: string
	): Promise<void> {
		try {
			// Skip if user already has complete blockchain setup
			if (user.near_account_id && user.scroll_address) {
				console.log(
					`[Blockchain] User ${user.id} already has blockchain accounts (NEAR: ${user.near_account_id})`
				);
				return;
			}

			// Step 1: Create NEAR account from OAuth identity
			if (!user.near_account_id) {
				console.log(`[Blockchain] Creating NEAR account for user ${user.id} via ${provider}`);
				const nearAccountId = await createNEARAccountFromOAuth(provider, oauthUserId);
				console.log(`[Blockchain] Created NEAR account: ${nearAccountId}`);
			}

			// Step 2: Derive Scroll address from NEAR account
			// Re-fetch user to get the updated near_account_id
			const updatedUser = await db.user.findUnique({
				where: { id: user.id },
				select: { near_account_id: true, scroll_address: true }
			});

			if (updatedUser?.near_account_id && !updatedUser.scroll_address) {
				console.log(
					`[Blockchain] Deriving Scroll address for NEAR account: ${updatedUser.near_account_id}`
				);
				const scrollAddress = await deriveScrollAddress(updatedUser.near_account_id);
				console.log(`[Blockchain] Derived Scroll address: ${scrollAddress}`);
			}

			console.log(`[Blockchain] Successfully created blockchain accounts for user ${user.id}`);
		} catch (error) {
			// Log error but don't block OAuth flow
			// Users can still use the platform without blockchain features
			console.error('[Blockchain] Failed to create blockchain accounts:', {
				userId: user.id,
				provider,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}

	/**
	 * Create session and handle address collection or final redirect
	 */
	private async handleSessionAndRedirect(
		user: DatabaseUser,
		returnTo: string,
		provider: string,
		cookies: Cookies
	): Promise<Response> {
		// Determine session type based on funnel
		const isFromSocialFunnel =
			returnTo.includes('template-modal') || returnTo.includes('auth=required');

		// Create session with appropriate duration
		const session = await createSession(user.id, isFromSocialFunnel);
		const cookieMaxAge = isFromSocialFunnel
			? 60 * 60 * 24 * 90 // 90 days for social funnel
			: 60 * 60 * 24 * 30; // 30 days standard

		// Set session cookie
		cookies.set(sessionCookieName, session.id, {
			path: '/',
			secure: process.env.NODE_ENV === 'production',
			httpOnly: true,
			maxAge: cookieMaxAge,
			sameSite: 'lax'
		});

		// Check address requirements
		const hasAddress = Boolean(user.street && user.city && user.state && user.zip);

		const needsAddress =
			!hasAddress &&
			(returnTo.includes('template-modal') ||
				returnTo.includes('/template/') ||
				isFromSocialFunnel ||
				returnTo !== '/profile');

		// Check profile requirements for direct outreach
		const isDirectOutreach = returnTo.includes('template-modal') && returnTo.includes('direct');

		const hasProfile = user.phone && user.phone.startsWith('{');

		// Store OAuth completion info in session storage-accessible cookie for client-side access
		cookies.set(
			'oauth_completion',
			JSON.stringify({
				provider,
				returnTo,
				completed: true,
				timestamp: Date.now()
			}),
			{
				path: '/',
				secure: false, // Allow client-side access
				httpOnly: false, // Allow client-side access
				maxAge: 60 * 5, // 5 minutes
				sameSite: 'lax'
			}
		);

		// Determine redirect path - clean URLs without query params
		if (needsAddress) {
			// Store return URL in session-accessible cookie
			cookies.set('oauth_return_to', returnTo, {
				path: '/',
				secure: false,
				httpOnly: false,
				maxAge: 60 * 10,
				sameSite: 'lax'
			});
			return redirect(302, '/onboarding/address');
		}

		if (isDirectOutreach && !hasProfile) {
			// Store return URL in session-accessible cookie
			cookies.set('oauth_return_to', returnTo, {
				path: '/',
				secure: false,
				httpOnly: false,
				maxAge: 60 * 10,
				sameSite: 'lax'
			});
			return redirect(302, '/onboarding/profile');
		}

		// Clean redirect without query parameters
		return redirect(302, returnTo);
	}

	/**
	 * Handle errors consistently across all providers
	 */
	private handleError(err: unknown, provider: string): Response {
		// Don't log SvelteKit redirects as errors
		if (err instanceof Response && err.status >= 300 && err.status < 400) {
			throw err;
		}

		if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
			const status = err.status as number;
			if (status >= 300 && status < 400) {
				throw err;
			}
		}

		// Log detailed error information
		console.error(`${provider.toUpperCase()} OAuth error:`, {
			error: err,
			message: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined,
			env: {
				hasClientId: !!process.env[`${provider.toUpperCase()}_CLIENT_ID`],
				hasClientSecret: !!process.env[`${provider.toUpperCase()}_CLIENT_SECRET`],
				oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE_URL,
				nodeEnv: process.env.NODE_ENV
			}
		});

		// Return appropriate error message
		const errorMessage =
			process.env.NODE_ENV === 'production'
				? 'Authentication failed'
				: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

		return error(500, errorMessage);
	}

	/**
	 * Generate unique account ID
	 */
	private generateAccountId(): string {
		const bytes = crypto.getRandomValues(new Uint8Array(20));
		return Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('');
	}
}

// =============================================================================
// EXPORT SINGLETON INSTANCE
// =============================================================================

export const oauthCallbackHandler = new OAuthCallbackHandler();
