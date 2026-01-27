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
import { dev } from '$app/environment';
import { db } from '$lib/core/db';
import { createSession, sessionCookieName } from '$lib/core/auth/auth';
import { validateReturnTo } from '$lib/core/auth/oauth';

/**
 * BLOCKCHAIN ACCOUNT CREATION DEFERRED TO CLIENT
 *
 * Previously, OAuth callback handler attempted to create NEAR/Scroll accounts
 * server-side, which caused SSR build failures due to browser-only dependencies:
 * - @near-js/keystores-browser (IndexedDB)
 * - @near-js/biometric-ed25519 (WebAuthn)
 * - idb (IndexedDB wrapper)
 *
 * NEW ARCHITECTURE:
 * 1. OAuth callback completes authentication (server-side)
 * 2. Sets oauth_blockchain_pending cookie for client detection
 * 3. Client-side component (BlockchainInit.svelte) handles account creation
 * 4. Uses dynamic imports + browser guards for SSR safety
 *
 * See: /src/lib/core/blockchain/use-blockchain.ts
 * See: /src/lib/components/blockchain/BlockchainInit.svelte
 */

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
	// Email verification status (ISSUE-002: Sybil resistance)
	// Twitter accounts without verified email get synthetic emails like username@twitter.local
	// These accounts receive lower trust_score to prevent Sybil attacks
	emailVerified?: boolean; // undefined = true (default), false = synthetic email
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
	// NOTE: PII fields (street, city, state, zip, phone, congressional_district) removed
	// per CYPHERPUNK-ARCHITECTURE.md - address data is encrypted in EncryptedDeliveryData
	is_verified?: boolean;
	role?: string | null;
	organization?: string | null;
	location?: string | null;
	connection?: string | null;
	// NOTE: connection_details field removed - does not exist in schema
	profile_completed_at?: Date | null;
	profile_visibility?: string;
	verification_method?: string | null;
	verified_at?: Date | null;
	// Blockchain accounts
	near_account_id?: string | null;
	near_account_entropy?: string | null; // PRIVACY: Random entropy for account ID generation
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
	 *
	 * ISSUE-002: Sybil Resistance for Unverified Emails
	 * Twitter accounts without verified email get synthetic emails (username@twitter.local)
	 * These accounts receive lower trust_score to prevent Sybil attacks:
	 * - Verified email: trust_score = 100 (socially vouched)
	 * - Unverified/synthetic email: trust_score = 50 (location-hinted tier)
	 */
	private async findOrCreateUser(
		config: OAuthCallbackConfig,
		userData: UserData,
		tokenData: TokenData
	): Promise<DatabaseUser> {
		// ISSUE-002: Determine email verification status
		// Default to true for backwards compatibility (most providers verify email)
		const emailVerified = userData.emailVerified !== false;

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

		// Update existing account tokens and email verification status
		if (existingAccount) {
			await db.account.update({
				where: { id: existingAccount.id },
				data: {
					access_token: tokenData.accessToken,
					refresh_token: tokenData.refreshToken,
					expires_at: tokenData.expiresAt,
					// ISSUE-002: Update email_verified status on each login
					// (in case user verified their email since last login)
					email_verified: emailVerified
				}
			});

			// Blockchain account creation deferred to client-side
			// See BlockchainInit.svelte component for actual account creation

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
					scope: config.scope,
					// ISSUE-002: Track email verification status for Sybil resistance
					email_verified: emailVerified
				}
			});

			// Blockchain account creation deferred to client-side
			// See BlockchainInit.svelte component for actual account creation

			return existingUser;
		}

		// ISSUE-002: Apply lower trust_score for accounts with unverified/synthetic email
		// This creates a Sybil-resistant trust tier:
		// - trust_score 100: Verified email (socially vouched tier)
		// - trust_score 50: Unverified/synthetic email (location-hinted tier)
		// Users can still use basic functionality but are restricted from sensitive operations
		const baseTrustScore = emailVerified ? 100 : 50;
		const baseReputationTier = emailVerified ? 'verified' : 'novice';

		// Create new user with OAuth account
		const newUser = await db.user.create({
			data: {
				email: userData.email,
				name: userData.name,
				avatar: userData.avatar,
				// ISSUE-002: Apply trust_score based on email verification
				trust_score: baseTrustScore,
				reputation_tier: baseReputationTier,
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
						scope: config.scope,
						// ISSUE-002: Track email verification status for Sybil resistance
						email_verified: emailVerified
					}
				}
			}
		});

		// Log Sybil resistance action for audit
		if (!emailVerified) {
			console.log('[OAuth Sybil Resistance] New user created with unverified email:', {
				provider: config.provider,
				userId: newUser.id,
				email: userData.email,
				trust_score: baseTrustScore,
				reputation_tier: baseReputationTier
			});
		}

		// Blockchain account creation deferred to client-side
		// See BlockchainInit.svelte component for actual account creation

		return newUser;
	}

	/**
	 * DEPRECATED: Blockchain account creation moved to client-side
	 *
	 * Previously this method attempted to create NEAR/Scroll accounts server-side,
	 * but it caused SSR build failures due to browser-only dependencies.
	 *
	 * NEW APPROACH: Client-side initialization via BlockchainInit.svelte
	 * - Uses dynamic imports with browser guards
	 * - Triggers after OAuth callback completes
	 * - Zero server-side blockchain code execution
	 *
	 * See: /src/lib/core/blockchain/use-blockchain.ts
	 * See: /src/lib/components/blockchain/BlockchainInit.svelte
	 */
	private async ensureBlockchainAccounts(
		_user: DatabaseUser,
		_provider: OAuthProvider,
		_oauthUserId: string
	): Promise<void> {
		// This method is deprecated and no longer used
		// Blockchain account creation happens client-side via BlockchainInit.svelte
		console.log('[Blockchain] Account creation deferred to client-side component');
		return;
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
		// BA-013: httpOnly intentionally false — this cookie is read by client-side JS:
		//   - src/routes/s/[slug]/+page.svelte (reads via document.cookie to detect OAuth return)
		//   - src/routes/onboarding/profile/+page.svelte (reads/writes via document.cookie)
		// Contains only non-sensitive flow-control data (provider name, returnTo path, timestamp).
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
				secure: !dev, // Secure in production
				httpOnly: false, // Client JS reads this — see BA-013 comment above
				maxAge: 60 * 5, // 5 minutes
				sameSite: 'lax'
			}
		);

		// Store blockchain initialization signal for server-side detection
		// BA-013: Fixed httpOnly to true — no client-side JS reads this cookie.
		// The referenced BlockchainInit.svelte component does not exist; this cookie
		// is only set server-side and can be read server-side via hooks or load functions.
		// Contains userId which should not be exposed to document.cookie (XSS risk).
		cookies.set(
			'oauth_blockchain_pending',
			JSON.stringify({
				userId: user.id,
				provider,
				needsInit: !user.near_account_id || !user.scroll_address,
				timestamp: Date.now()
			}),
			{
				path: '/',
				secure: !dev, // Secure in production
				httpOnly: true, // BA-013: No client JS reads this; contains userId
				maxAge: 60 * 15, // 15 minutes
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
		//
		// BA-004: Validate returnTo at the redirect point (defense in depth)
		// This is the critical enforcement point — even if a malicious value
		// was stored in the cookie, it gets sanitized before redirect.
		const safeReturnTo = validateReturnTo(returnTo);
		return redirect(302, safeReturnTo);
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
				secure: !dev, // Secure in production
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
