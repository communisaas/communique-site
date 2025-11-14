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
// Dynamic imports to avoid SSR issues with browser-only crypto in @voter-protocol/client
// import { createNEARAccountFromOAuth } from '$lib/core/blockchain/oauth-near';
// import { deriveScrollAddress } from '$lib/core/blockchain/chain-signatures';

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
	// Location data (for client-side inference)
	location?: string; // e.g., "Austin, TX" or "Texas"
	locale?: string; // e.g., "en-US"
	timezone?: string; // e.g., "America/Chicago"
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

			// Validate user data before database operations
			if (!userData.id || !userData.email) {
				throw new Error('Invalid user data from provider');
			}

			// Step 4: Find or create user in database
			const user = await this.findOrCreateUser(config, userData, tokenData);

			// Step 4.5: Store OAuth location data for client-side inference
			// Note: This is stored in a client-accessible cookie for browser-side location inference
			// Server NEVER stores location data - only passes it to client via cookie
			if (userData.location || userData.locale || userData.timezone) {
				this.storeOAuthLocationCookie(
					cookies,
					config.provider,
					userData.location,
					userData.locale,
					userData.timezone
				);
			}

			// Step 5: Create session and handle redirects
			return await this.handleSessionAndRedirect(user, returnTo, config.provider, cookies);
		} catch (err) {
			return this.handleError(err, config.provider);
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

			// TODO: Re-enable blockchain account creation when SSR-safe
			// await this.ensureBlockchainAccounts(existingAccount.user, config.provider, userData.id);

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

			// TODO: Re-enable blockchain account creation when SSR-safe
			// await this.ensureBlockchainAccounts(existingUser, config.provider, userData.id);

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

		// TODO: Re-enable blockchain account creation when SSR-safe
		// await this.ensureBlockchainAccounts(newUser, config.provider, userData.id);

		return newUser;
	}

	/**
	 * Ensure user has NEAR account and Scroll address
	 * Creates blockchain accounts if they don't exist yet
	 *
	 * TODO: Re-enable when SSR-safe
	 * Problem: Dynamic imports of @voter-protocol/client trigger SSR errors
	 * Solution: Move blockchain account creation to client-side background job
	 */
	private async ensureBlockchainAccounts(
		_user: DatabaseUser,
		_provider: OAuthProvider,
		_oauthUserId: string
	): Promise<void> {
		// Temporarily disabled due to SSR issues with @voter-protocol/client
		// See: oauth-callback-handler.ts lines 240, 268, 296 for commented call sites
		return;

		/* ORIGINAL IMPLEMENTATION (disabled):
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
				// Dynamic import to avoid SSR issues
				const { createNEARAccountFromOAuth } = await import('$lib/core/blockchain/oauth-near');
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
				// Dynamic import to avoid SSR issues
				const { deriveScrollAddress } = await import('$lib/core/blockchain/chain-signatures');
				const scrollAddress = await deriveScrollAddress(updatedUser.near_account_id);
				console.log(`[Blockchain] Derived Scroll address: ${scrollAddress}`);
			}

			console.log(`[Blockchain] Successfully created blockchain accounts for user ${user.id}`);
		} catch (err) {
			// Log error but don't block OAuth flow
			// Users can still use the platform without blockchain features
			console.error('[Blockchain] Failed to create blockchain accounts:', {
				userId: user.id,
				provider,
				error: err instanceof Error ? err.message : 'Unknown error',
				stack: err instanceof Error ? err.stack : undefined
			});
		}
		*/
	}

	/**
	 * Create session and redirect back to origin
	 *
	 * DESIGN PRINCIPLE: OAuth callback does ONE thing - authenticate.
	 * Address collection happens contextually in the template flow, not as a wall.
	 *
	 * From docs/design/friction.md:
	 * "One-click democracy: From link to sent message in seconds."
	 *
	 * From docs/strategy/coordination.md:
	 * "The address wall SCATTERS our users. It breaks coordination momentum."
	 */
	private async handleSessionAndRedirect(
		user: DatabaseUser,
		returnTo: string,
		provider: string,
		cookies: Cookies
	): Promise<Response> {
		// Determine session type based on funnel
		const isFromSocialFunnel =
			returnTo.includes('template-modal') ||
			returnTo.includes('auth=required') ||
			returnTo.includes('/s/'); // Template pages

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

		// Store OAuth completion signal for client-side detection
		// This lets the template page know OAuth just completed → open modal immediately
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

		// SIMPLE: Just redirect back to where they came from
		// The template page will handle:
		// - Opening the modal
		// - Collecting address IF needed (congressional templates only)
		// - All other template-specific logic
		//
		// NO MORE FORCED REDIRECTS TO /onboarding/address
		// NO MORE ADDRESS WALLS
		// LET THEM SEND THE FUCKING MESSAGE
		return redirect(302, returnTo);
	}

	/**
	 * Handle errors consistently across all providers
	 *
	 * IMPORTANT: This method THROWS errors for test compatibility.
	 * SvelteKit's error() function creates an HttpError that must be thrown,
	 * and redirect() creates a redirect Response that must be thrown.
	 */
	private handleError(err: unknown, provider: string): never {
		// Don't log SvelteKit redirects as errors - just re-throw
		if (err instanceof Response && err.status >= 300 && err.status < 400) {
			throw err;
		}

		if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
			const status = err.status as number;
			if (status >= 300 && status < 400) {
				throw err;
			}
		}

		// If this is already an HttpError with a specific status (like 400 validation errors),
		// preserve the original error instead of wrapping it in a 500
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			const status = err.status as number;
			// Re-throw 4xx client errors (validation, auth failures, etc.) as-is
			if (status >= 400 && status < 500) {
				throw err;
			}
		}

		// Log detailed error information
		console.error(`${provider.toUpperCase()} OAuth error:`, {
			error: err,
			message: err instanceof Error ? err.message : 'Unknown error',
			stack: err instanceof Error ? err.stack : undefined,
			env: {
				hasClientId: !!process.env[`${provider.toUpperCase()}_CLIENT_ID`],
				hasClientSecret: !!process.env[`${provider.toUpperCase()}_CLIENT_SECRET`],
				oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE_URL,
				nodeEnv: process.env.NODE_ENV
			}
		});

		// Throw appropriate error
		const errorMessage =
			process.env.NODE_ENV === 'production'
				? 'Authentication failed'
				: `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`;

		throw error(500, errorMessage);
	}

	/**
	 * Generate unique account ID
	 */
	private generateAccountId(): string {
		const bytes = crypto.getRandomValues(new Uint8Array(20));
		return Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Store OAuth location data in client-accessible cookie
	 * This enables browser-side location inference WITHOUT server-side tracking
	 */
	private storeOAuthLocationCookie(
		cookies: Cookies,
		provider: OAuthProvider,
		location?: string,
		locale?: string,
		timezone?: string
	): void {
		try {
			const locationData = {
				provider,
				location: location || null,
				locale: locale || null,
				timezone: timezone || null,
				timestamp: Date.now()
			};

			// Store in client-accessible cookie (expires in 7 days)
			// Client will read this cookie and add OAuth location signal to IndexedDB
			cookies.set('oauth_location', JSON.stringify(locationData), {
				path: '/',
				secure: false, // Allow client-side access
				httpOnly: false, // Allow client-side access
				maxAge: 7 * 24 * 60 * 60, // 7 days
				sameSite: 'lax'
			});

			console.log('[OAuth Location] Stored location cookie for client-side inference:', {
				provider,
				hasLocation: !!location,
				hasLocale: !!locale,
				hasTimezone: !!timezone
			});
		} catch (error) {
			// Log error but don't block OAuth flow
			console.error('[OAuth Location] Failed to store location cookie:', error);
		}
	}
}

// =============================================================================
// EXPORT SINGLETON INSTANCE
// =============================================================================

export const oauthCallbackHandler = new OAuthCallbackHandler();
