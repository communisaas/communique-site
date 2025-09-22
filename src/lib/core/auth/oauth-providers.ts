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
// GOOGLE CONFIGURATION
// =============================================================================

export const googleConfig: OAuthCallbackConfig = {
	provider: 'google',
	clientId: process.env.GOOGLE_CLIENT_ID!,
	clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
	redirectUrl: `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/google/callback`,
	userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
	requiresCodeVerifier: true,
	scope: 'profile email',

	createOAuthClient: (): OAuthClient => {
		return new Google(
			process.env.GOOGLE_CLIENT_ID!,
			process.env.GOOGLE_CLIENT_SECRET!,
			`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/google/callback`
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
		const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
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

	extractTokenData: (tokens: OAuthTokens): TokenData => ({
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
		expiresAt: tokens.accessTokenExpiresAt()
			? Math.floor(tokens.accessTokenExpiresAt()!.getTime() / 1000)
			: null
	})
};

// =============================================================================
// FACEBOOK CONFIGURATION
// =============================================================================

export const facebookConfig: OAuthCallbackConfig = {
	provider: 'facebook',
	clientId: process.env.FACEBOOK_CLIENT_ID!,
	clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
	redirectUrl: `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/facebook/callback`,
	userInfoUrl: 'https://graph.facebook.com/me',
	requiresCodeVerifier: false,
	scope: 'email public_profile',

	createOAuthClient: (): OAuthClient => {
		return new Facebook(
			process.env.FACEBOOK_CLIENT_ID!,
			process.env.FACEBOOK_CLIENT_SECRET!,
			`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/facebook/callback`
		) as unknown as OAuthClient;
	},

	exchangeTokens: async (client: OAuthClient, code: string): Promise<OAuthTokens> => {
		return await client.validateAuthorizationCode(code);
	},

	getUserInfo: async (accessToken: string, clientSecret?: string): Promise<unknown> => {
		// Facebook requires appsecret_proof for enhanced security
		const appsecretProof = crypto
			.createHmac('sha256', clientSecret!)
			.update(accessToken)
			.digest('hex');

		const response = await fetch(
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

	extractTokenData: (tokens: OAuthTokens): TokenData => ({
		accessToken: tokens.accessToken(),
		refreshToken: null,
		expiresAt: tokens.accessTokenExpiresAt()
			? Math.floor(tokens.accessTokenExpiresAt()!.getTime() / 1000)
			: null
	})
};

// =============================================================================
// LINKEDIN CONFIGURATION
// =============================================================================

export const linkedinConfig: OAuthCallbackConfig = {
	provider: 'linkedin',
	clientId: process.env.LINKEDIN_CLIENT_ID!,
	clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
	redirectUrl: `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/linkedin/callback`,
	userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
	requiresCodeVerifier: true,
	scope: 'openid profile email',

	createOAuthClient: (): OAuthClient => {
		return new LinkedIn(
			process.env.LINKEDIN_CLIENT_ID!,
			process.env.LINKEDIN_CLIENT_SECRET!,
			`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/linkedin/callback`
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
		const response = await fetch('https://api.linkedin.com/v2/userinfo', {
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

	extractTokenData: (tokens: OAuthTokens): TokenData => ({
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
		expiresAt: tokens.accessTokenExpiresAt()
			? Math.floor(tokens.accessTokenExpiresAt()!.getTime() / 1000)
			: null
	})
};

// =============================================================================
// TWITTER CONFIGURATION
// =============================================================================

export const twitterConfig: OAuthCallbackConfig = {
	provider: 'twitter',
	clientId: process.env.TWITTER_CLIENT_ID!,
	clientSecret: process.env.TWITTER_CLIENT_SECRET!,
	redirectUrl: `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/twitter/callback`,
	userInfoUrl: 'https://api.twitter.com/2/users/me',
	requiresCodeVerifier: true,
	scope: 'users.read tweet.read offline.access',

	createOAuthClient: (): OAuthClient => {
		return new Twitter(
			process.env.TWITTER_CLIENT_ID!,
			process.env.TWITTER_CLIENT_SECRET!,
			`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/twitter/callback`
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
		const response = await fetch(
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

	extractTokenData: (tokens: OAuthTokens): TokenData => ({
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
		expiresAt: tokens.accessTokenExpiresAt()
			? Math.floor(tokens.accessTokenExpiresAt()!.getTime() / 1000)
			: null
	})
};

// =============================================================================
// DISCORD CONFIGURATION
// =============================================================================

export const discordConfig: OAuthCallbackConfig = {
	provider: 'discord',
	clientId: process.env.DISCORD_CLIENT_ID!,
	clientSecret: process.env.DISCORD_CLIENT_SECRET!,
	redirectUrl: `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/discord/callback`,
	userInfoUrl: 'https://discord.com/api/users/@me',
	requiresCodeVerifier: true,
	scope: 'identify email',

	createOAuthClient: (): OAuthClient => {
		return new Discord(
			process.env.DISCORD_CLIENT_ID!,
			process.env.DISCORD_CLIENT_SECRET!,
			`${process.env.OAUTH_REDIRECT_BASE_URL}/auth/discord/callback`
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
		const response = await fetch('https://discord.com/api/users/@me', {
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

	extractTokenData: (tokens: OAuthTokens): TokenData => ({
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken?.() || null : null,
		expiresAt: tokens.accessTokenExpiresAt()
			? Math.floor(tokens.accessTokenExpiresAt()!.getTime() / 1000)
			: null
	})
};

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
