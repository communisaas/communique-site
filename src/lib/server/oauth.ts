import { Google, Twitter, Apple, Facebook, LinkedIn, Discord } from 'arctic';

// OAuth Provider Configuration
export const google = new Google(
	process.env.GOOGLE_CLIENT_ID!,
	process.env.GOOGLE_CLIENT_SECRET!,
	`${process.env.ORIGIN}/auth/google/callback`
);

export const twitter = new Twitter(
	process.env.TWITTER_CLIENT_ID!,
	process.env.TWITTER_CLIENT_SECRET!,
	`${process.env.ORIGIN}/auth/twitter/callback`
);

export const apple = new Apple(
	process.env.APPLE_CLIENT_ID!,
	process.env.APPLE_TEAM_ID!,
	process.env.APPLE_KEY_ID!,
	process.env.APPLE_PRIVATE_KEY!,
	`${process.env.ORIGIN}/auth/apple/callback`
);

export const facebook = new Facebook(
	process.env.FACEBOOK_CLIENT_ID!,
	process.env.FACEBOOK_CLIENT_SECRET!,
	`${process.env.ORIGIN}/auth/facebook/callback`
);

export const linkedin = new LinkedIn(
	process.env.LINKEDIN_CLIENT_ID!,
	process.env.LINKEDIN_CLIENT_SECRET!,
	`${process.env.ORIGIN}/auth/linkedin/callback`
);

export const discord = new Discord(
	process.env.DISCORD_CLIENT_ID!,
	process.env.DISCORD_CLIENT_SECRET!,
	`${process.env.ORIGIN}/auth/discord/callback`
);

// OAuth Provider Types
export type OAuthProvider = 'google' | 'twitter' | 'apple' | 'facebook' | 'linkedin' | 'discord';

export const providers: Record<OAuthProvider, any> = {
	google,
	twitter,
	apple,
	facebook,
	linkedin,
	discord
};

// Helper function to get provider instance
export function getProvider(provider: OAuthProvider) {
	return providers[provider];
}

// OAuth state management
export function generateState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateCodeVerifier(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
} 