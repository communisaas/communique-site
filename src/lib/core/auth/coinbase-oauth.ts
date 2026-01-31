/**
 * COINBASE OAUTH CLIENT
 *
 * Custom OAuth2 client for Coinbase authentication with PKCE support.
 * Coinbase is not included in Arctic library, so we implement the OAuth2 flow manually.
 *
 * Features:
 * - PKCE (S256 code challenge) for enhanced security
 * - Standard OAuth2 authorization code flow
 * - Token exchange and refresh support
 *
 * Documentation:
 * - Authorization: https://docs.cloud.coinbase.com/sign-in-with-coinbase/docs/api-users
 * - OAuth2 endpoints: https://docs.cloud.coinbase.com/sign-in-with-coinbase/docs/api-authorization
 */

import type { OAuthTokens } from './oauth-callback-handler';

export class CoinbaseOAuth {
	private clientId: string;
	private clientSecret: string;
	private redirectUri: string;

	// Coinbase OAuth endpoints
	private static readonly AUTHORIZATION_ENDPOINT = 'https://login.coinbase.com/oauth2/auth';
	private static readonly TOKEN_ENDPOINT = 'https://login.coinbase.com/oauth2/token';

	constructor(clientId: string, clientSecret: string, redirectUri: string) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.redirectUri = redirectUri;
	}

	/**
	 * Create authorization URL with PKCE
	 */
	async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): Promise<{ url: URL; codeChallenge: string }> {
		const codeChallenge = await this.generateCodeChallenge(codeVerifier);

		const url = new URL(CoinbaseOAuth.AUTHORIZATION_ENDPOINT);
		url.searchParams.set('client_id', this.clientId);
		url.searchParams.set('redirect_uri', this.redirectUri);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('state', state);
		url.searchParams.set('scope', scopes.join(' '));
		url.searchParams.set('code_challenge', codeChallenge);
		url.searchParams.set('code_challenge_method', 'S256');

		return { url, codeChallenge };
	}

	/**
	 * Exchange authorization code for access token
	 *
	 * Implements standard OAuth2 token exchange with PKCE verification.
	 * Returns tokens in Arctic-compatible format for consistency with other providers.
	 */
	async validateAuthorizationCode(
		code: string,
		codeVerifier: string
	): Promise<OAuthTokens> {
		const response = await fetch(CoinbaseOAuth.TOKEN_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: this.clientId,
				client_secret: this.clientSecret,
				code,
				code_verifier: codeVerifier,
				redirect_uri: this.redirectUri
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
		}

		const tokens = await response.json();

		// Validate required token fields
		if (!tokens.access_token) {
			throw new Error('Token response missing access_token');
		}

		return this.createTokensObject(tokens);
	}

	/**
	 * Refresh access token using refresh token
	 */
	async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
		const response = await fetch(CoinbaseOAuth.TOKEN_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json'
			},
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: this.clientId,
				client_secret: this.clientSecret,
				refresh_token: refreshToken
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
		}

		const tokens = await response.json();

		return this.createTokensObject(tokens);
	}

	/**
	 * Create Arctic-compatible tokens object
	 *
	 * Wraps Coinbase token response in the same interface as Arctic providers
	 * for consistency with oauth-callback-handler.ts
	 */
	private createTokensObject(tokens: {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
		token_type?: string;
	}): OAuthTokens {
		const expiresAt = tokens.expires_in
			? new Date(Date.now() + tokens.expires_in * 1000)
			: null;

		return {
			accessToken: () => tokens.access_token,
			refreshToken: () => tokens.refresh_token || null,
			hasRefreshToken: () => !!tokens.refresh_token,
			accessTokenExpiresAt: () => expiresAt
		};
	}

	/**
	 * Generate PKCE code challenge from verifier
	 *
	 * Uses SHA-256 hashing and base64url encoding per RFC 7636.
	 * The code verifier must be a cryptographically random string of 43-128 characters.
	 */
	private async generateCodeChallenge(codeVerifier: string): Promise<string> {
		// Convert string to ArrayBuffer
		const encoder = new TextEncoder();
		const data = encoder.encode(codeVerifier);

		// Hash with SHA-256
		const hash = await crypto.subtle.digest('SHA-256', data);

		// Convert to base64url (RFC 4648 Section 5)
		const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
	}
}
