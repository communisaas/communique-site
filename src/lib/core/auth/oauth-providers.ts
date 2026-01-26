/** OAUTH PROVIDER CONFIGURATIONS
 *
 * Provider-specific configurations for OAuth callback handling.
 * Each configuration encapsulates the unique aspects of each provider
 * while using the common OAuth callback handler.
 */

import { Google, Facebook, LinkedIn, Discord } from 'arctic';
import { Twitter } from 'arctic';
import type {
	OAuthCallbackConfig,
	OAuthProvider,
	OAuthClient,
	OAuthTokens,
	TokenData,
	UserData
} from './oauth-callback-handler';
import * as crypto from 'crypto';

// =============================================================================
// TIMEOUT AND RETRY UTILITIES
// =============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Execute fetch with timeout
 */
async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			const timeoutError = new Error(`OAuth request timeout after ${timeout}ms: ${url}`);
			console.error('[OAuth] Timeout:', timeoutError.message);
			throw timeoutError;
		}
		throw error;
	}
}

/**
 * Execute fetch with retry logic for transient failures
 */
async function fetchWithRetry(
	url: string,
	options: RequestInit = {},
	timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await fetchWithTimeout(url, options, timeout);

			// Don't retry on client errors (4xx except 429)
			if (response.status >= 400 && response.status < 500 && response.status !== 429) {
				return response;
			}

			// Retry on server errors (5xx) or rate limiting (429)
			if (response.status === 429 || response.status >= 500) {
				if (attempt < MAX_RETRIES - 1) {
					const delay = RETRY_DELAY * Math.pow(2, attempt);
					console.warn(
						`[OAuth] Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
			}

			return response;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on timeout if it's the last attempt
			if (attempt === MAX_RETRIES - 1) {
				console.error(`[OAuth] Request failed after ${MAX_RETRIES} attempts:`, lastError.message);
				throw lastError;
			}

			// Exponential backoff for retries
			const delay = RETRY_DELAY * Math.pow(2, attempt);
			console.warn(
				`[OAuth] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES}): ${lastError.message}`
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError || new Error('OAuth request failed after retries');
}

// =============================================================================
// TYPE GUARDS FOR OAUTH PROVIDER RESPONSES
// =============================================================================

// Google OAuth response type guard
function isGoogleUser(
	user: unknown
): user is { id: string; email: string; name: string; picture?: string } {
	return (
		typeof user === 'object' &&
		user !== null &&
		'id' in user &&
		typeof (user as Record<string, unknown>).id === 'string' &&
		'email' in user &&
		typeof (user as Record<string, unknown>).email === 'string' &&
		'name' in user &&
		typeof (user as Record<string, unknown>).name === 'string'
	);
}

// Facebook OAuth response type guard
function isFacebookUser(user: unknown): user is {
	id: string;
	email: string;
	name: string;
	picture?: { data?: { url?: string } };
} {
	return (
		typeof user === 'object' &&
		user !== null &&
		'id' in user &&
		typeof (user as Record<string, unknown>).id === 'string' &&
		'email' in user &&
		typeof (user as Record<string, unknown>).email === 'string' &&
		'name' in user &&
		typeof (user as Record<string, unknown>).name === 'string'
	);
}

// LinkedIn OAuth response type guard
function isLinkedInUser(user: unknown): user is {
	sub: string;
	email: string;
	name: string;
	picture?: string;
} {
	return (
		typeof user === 'object' &&
		user !== null &&
		'sub' in user &&
		typeof (user as Record<string, unknown>).sub === 'string' &&
		'email' in user &&
		typeof (user as Record<string, unknown>).email === 'string' &&
		'name' in user &&
		typeof (user as Record<string, unknown>).name === 'string'
	);
}

// Twitter OAuth response type guard
function isTwitterUser(user: unknown): user is {
	data: {
		id: string;
		username: string;
		name: string;
		email?: string;
		profile_image_url?: string;
	};
} {
	return (
		typeof user === 'object' &&
		user !== null &&
		'data' in user &&
		typeof (user as Record<string, unknown>).data === 'object' &&
		(user as Record<string, unknown>).data !== null &&
		'id' in ((user as Record<string, unknown>).data as Record<string, unknown>) &&
		typeof ((user as Record<string, unknown>).data as Record<string, unknown>).id === 'string' &&
		'username' in ((user as Record<string, unknown>).data as Record<string, unknown>) &&
		typeof ((user as Record<string, unknown>).data as Record<string, unknown>).username ===
			'string' &&
		'name' in ((user as Record<string, unknown>).data as Record<string, unknown>) &&
		typeof ((user as Record<string, unknown>).data as Record<string, unknown>).name === 'string'
	);
}

// Discord OAuth response type guard
function isDiscordUser(user: unknown): user is {
	id: string;
	email: string;
	username: string;
	global_name?: string;
	discriminator?: string;
	avatar?: string;
} {
	return (
		typeof user === 'object' &&
		user !== null &&
		'id' in user &&
		typeof (user as Record<string, unknown>).id === 'string' &&
		'email' in user &&
		typeof (user as Record<string, unknown>).email === 'string' &&
		'username' in user &&
		typeof (user as Record<string, unknown>).username === 'string'
	);
}

// =============================================================================
// CREDENTIAL VALIDATION HELPER
// =============================================================================

function getRequiredEnv(name: string, provider: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing OAuth credentials for ${provider}: ${name} is not set`);
	}
	return value;
}

// =============================================================================
// GOOGLE CONFIGURATION
// =============================================================================

function createGoogleConfig(): OAuthCallbackConfig {
	const clientId = getRequiredEnv('GOOGLE_CLIENT_ID', 'Google');
	const clientSecret = getRequiredEnv('GOOGLE_CLIENT_SECRET', 'Google');
	const redirectUrl = `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/google/callback`;

	return {
		provider: 'google',
		clientId,
		clientSecret,
		redirectUrl,
		userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
		requiresCodeVerifier: true,
		scope: 'profile email',

		createOAuthClient: (): OAuthClient => {
			return new Google(
				clientId,
				clientSecret,
				redirectUrl
			) as unknown as OAuthClient;
		},

		exchangeTokens: async (
			client: OAuthClient,
			code: string,
			codeVerifier?: string
		): Promise<OAuthTokens> => {
			return await client.validateAuthorizationCode(code, codeVerifier);
		},

		getUserInfo: async (accessToken: string): Promise<unknown> => {
			const response = await fetchWithRetry('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch user info: ${response.statusText}`);
			}

			return await response.json();
		},

		mapUserData: (rawUser: unknown): UserData => {
			if (!isGoogleUser(rawUser)) {
				throw new Error('Invalid Google user data format');
			}
			return {
				id: rawUser.id,
				email: rawUser.email,
				name: rawUser.name,
				avatar: rawUser.picture
			};
		},

		extractTokenData: (tokens: OAuthTokens): TokenData => {
			const expiresAtDate = tokens.accessTokenExpiresAt();
			return {
				accessToken: tokens.accessToken(),
				refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
				expiresAt: expiresAtDate ? Math.floor(expiresAtDate.getTime() / 1000) : null
			};
		}
	};
}

export const googleConfig: OAuthCallbackConfig = createGoogleConfig();

// =============================================================================
// FACEBOOK CONFIGURATION
// =============================================================================

function createFacebookConfig(): OAuthCallbackConfig {
	const clientId = getRequiredEnv('FACEBOOK_CLIENT_ID', 'Facebook');
	const clientSecret = getRequiredEnv('FACEBOOK_CLIENT_SECRET', 'Facebook');
	const redirectUrl = `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/facebook/callback`;

	return {
		provider: 'facebook',
		clientId,
		clientSecret,
		redirectUrl,
		userInfoUrl: 'https://graph.facebook.com/me',
		requiresCodeVerifier: false,
		scope: 'email public_profile',

		createOAuthClient: (): OAuthClient => {
			return new Facebook(
				clientId,
				clientSecret,
				redirectUrl
			) as unknown as OAuthClient;
		},

		exchangeTokens: async (client: OAuthClient, code: string): Promise<OAuthTokens> => {
			return await client.validateAuthorizationCode(code);
		},

		getUserInfo: async (accessToken: string, clientSecret?: string): Promise<unknown> => {
			// Facebook requires appsecret_proof for enhanced security
			if (!clientSecret) {
				throw new Error('Facebook OAuth requires client secret for appsecret_proof');
			}
			const appsecretProof = crypto
				.createHmac('sha256', clientSecret)
				.update(accessToken)
				.digest('hex');

			const response = await fetchWithRetry(
				`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch user info: ${response.statusText}`);
			}

			return await response.json();
		},

		mapUserData: (rawUser: unknown): UserData => {
			if (!isFacebookUser(rawUser)) {
				throw new Error('Invalid Facebook user data format');
			}
			return {
				id: rawUser.id,
				email: rawUser.email,
				name: rawUser.name,
				avatar: rawUser.picture?.data?.url
			};
		},

		extractTokenData: (tokens: OAuthTokens): TokenData => {
			const expiresAtDate = tokens.accessTokenExpiresAt();
			return {
				accessToken: tokens.accessToken(),
				refreshToken: null,
				expiresAt: expiresAtDate ? Math.floor(expiresAtDate.getTime() / 1000) : null
			};
		}
	};
}

export const facebookConfig: OAuthCallbackConfig = createFacebookConfig();

// =============================================================================
// LINKEDIN CONFIGURATION
// =============================================================================

function createLinkedInConfig(): OAuthCallbackConfig {
	const clientId = getRequiredEnv('LINKEDIN_CLIENT_ID', 'LinkedIn');
	const clientSecret = getRequiredEnv('LINKEDIN_CLIENT_SECRET', 'LinkedIn');
	const redirectUrl = `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/linkedin/callback`;

	return {
		provider: 'linkedin',
		clientId,
		clientSecret,
		redirectUrl,
		userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
		requiresCodeVerifier: true,
		scope: 'openid profile email',

		createOAuthClient: (): OAuthClient => {
			return new LinkedIn(
				clientId,
				clientSecret,
				redirectUrl
			) as unknown as OAuthClient;
		},

		exchangeTokens: async (
			client: OAuthClient,
			code: string,
			codeVerifier?: string
		): Promise<OAuthTokens> => {
			return await client.validateAuthorizationCode(code, codeVerifier);
		},

		getUserInfo: async (accessToken: string): Promise<unknown> => {
			const response = await fetchWithRetry('https://api.linkedin.com/v2/userinfo', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'X-RestLi-Protocol-Version': '2.0.0'
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch user info: ${response.statusText}`);
			}

			return await response.json();
		},

		mapUserData: (rawUser: unknown): UserData => {
			if (!isLinkedInUser(rawUser)) {
				throw new Error('Invalid LinkedIn user data format');
			}
			return {
				id: rawUser.sub, // LinkedIn uses 'sub' as the user ID
				email: rawUser.email,
				name: rawUser.name,
				avatar: rawUser.picture
			};
		},

		extractTokenData: (tokens: OAuthTokens): TokenData => {
			const expiresAtDate = tokens.accessTokenExpiresAt();
			return {
				accessToken: tokens.accessToken(),
				refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
				expiresAt: expiresAtDate ? Math.floor(expiresAtDate.getTime() / 1000) : null
			};
		}
	};
}

export const linkedinConfig: OAuthCallbackConfig = createLinkedInConfig();

// =============================================================================
// TWITTER CONFIGURATION
// =============================================================================

function createTwitterConfig(): OAuthCallbackConfig {
	const clientId = getRequiredEnv('TWITTER_CLIENT_ID', 'Twitter');
	const clientSecret = getRequiredEnv('TWITTER_CLIENT_SECRET', 'Twitter');
	const redirectUrl = `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/twitter/callback`;

	return {
		provider: 'twitter',
		clientId,
		clientSecret,
		redirectUrl,
		userInfoUrl: 'https://api.twitter.com/2/users/me',
		requiresCodeVerifier: true,
		scope: 'users.read tweet.read offline.access',

		createOAuthClient: (): OAuthClient => {
			return new Twitter(
				clientId,
				clientSecret,
				redirectUrl
			) as unknown as OAuthClient;
		},

		exchangeTokens: async (
			client: OAuthClient,
			code: string,
			codeVerifier?: string
		): Promise<OAuthTokens> => {
			return await client.validateAuthorizationCode(code, codeVerifier);
		},

		getUserInfo: async (accessToken: string): Promise<unknown> => {
			const response = await fetchWithRetry(
				'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
				{
					headers: {
						Authorization: `Bearer ${accessToken}`
					}
				}
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch user info: ${response.statusText}`);
			}

			return await response.json();
		},

		mapUserData: (rawUser: unknown): UserData => {
			if (!isTwitterUser(rawUser)) {
				throw new Error('Invalid Twitter user data format');
			}
			return {
				id: rawUser.data.id,
				// Twitter doesn't always provide email, generate placeholder
				email: rawUser.data.email || `${rawUser.data.username}@twitter.local`,
				name: rawUser.data.name,
				avatar: rawUser.data.profile_image_url,
				username: rawUser.data.username
			};
		},

		extractTokenData: (tokens: OAuthTokens): TokenData => {
			const expiresAtDate = tokens.accessTokenExpiresAt();
			return {
				accessToken: tokens.accessToken(),
				refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
				expiresAt: expiresAtDate ? Math.floor(expiresAtDate.getTime() / 1000) : null
			};
		}
	};
}

export const twitterConfig: OAuthCallbackConfig = createTwitterConfig();

// =============================================================================
// DISCORD CONFIGURATION
// =============================================================================

function createDiscordConfig(): OAuthCallbackConfig {
	const clientId = getRequiredEnv('DISCORD_CLIENT_ID', 'Discord');
	const clientSecret = getRequiredEnv('DISCORD_CLIENT_SECRET', 'Discord');
	const redirectUrl = `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/discord/callback`;

	return {
		provider: 'discord',
		clientId,
		clientSecret,
		redirectUrl,
		userInfoUrl: 'https://discord.com/api/users/@me',
		requiresCodeVerifier: true,
		scope: 'identify email',

		createOAuthClient: (): OAuthClient => {
			return new Discord(
				clientId,
				clientSecret,
				redirectUrl
			) as unknown as OAuthClient;
		},

		exchangeTokens: async (
			client: OAuthClient,
			code: string,
			codeVerifier?: string
		): Promise<OAuthTokens> => {
			return await client.validateAuthorizationCode(code, codeVerifier);
		},

		getUserInfo: async (accessToken: string): Promise<unknown> => {
			const response = await fetchWithRetry('https://discord.com/api/users/@me', {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch user info: ${response.statusText}`);
			}

			return await response.json();
		},

		mapUserData: (rawUser: unknown): UserData => {
			if (!isDiscordUser(rawUser)) {
				throw new Error('Invalid Discord user data format');
			}

			// Discord avatar URL construction
			let avatar: string | undefined;
			if (rawUser.avatar) {
				const format = rawUser.avatar.startsWith('a_') ? 'gif' : 'png';
				avatar = `https://cdn.discordapp.com/avatars/${rawUser.id}/${rawUser.avatar}.${format}`;
			}

			// Discord name handling (global_name > username#discriminator)
			const name =
				rawUser.global_name ||
				(rawUser.discriminator && rawUser.discriminator !== '0'
					? `${rawUser.username}#${rawUser.discriminator}`
					: rawUser.username);

			return {
				id: rawUser.id,
				email: rawUser.email,
				name,
				avatar,
				username: rawUser.username,
				discriminator: rawUser.discriminator
			};
		},

		extractTokenData: (tokens: OAuthTokens): TokenData => {
			const expiresAtDate = tokens.accessTokenExpiresAt();
			return {
				accessToken: tokens.accessToken(),
				refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
				expiresAt: expiresAtDate ? Math.floor(expiresAtDate.getTime() / 1000) : null
			};
		}
	};
}

export const discordConfig: OAuthCallbackConfig = createDiscordConfig();

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================

export const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthCallbackConfig> = {
	google: googleConfig,
	facebook: facebookConfig,
	linkedin: linkedinConfig,
	twitter: twitterConfig,
	discord: discordConfig
} as const;

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(provider: OAuthProvider): OAuthCallbackConfig {
	const config = OAUTH_PROVIDERS[provider];
	if (!config) {
		throw new Error(`Unknown OAuth provider: ${provider}`);
	}
	return config;
}
