/**
 * FACEBOOK OAUTH CLIENT WITH PKCE
 *
 * Custom OAuth2 client for Facebook authentication with PKCE (Proof Key for Code Exchange) support.
 *
 * SECURITY RATIONALE (MEDIUM-001):
 * PKCE prevents authorization code interception attacks where:
 * 1. Attacker intercepts the authorization code (via malicious app, network MITM, etc.)
 * 2. Attacker attempts to exchange code for tokens before legitimate client
 * 3. Without PKCE: attacker succeeds, gains access to user's account
 * 4. With PKCE: token exchange fails because attacker lacks code_verifier
 *
 * The arctic library's Facebook class does not support PKCE, so we implement
 * the OAuth2 flow manually with PKCE support.
 *
 * Features:
 * - PKCE (S256 code challenge) per RFC 7636 for enhanced security
 * - Standard OAuth2 authorization code flow
 * - Compatible with oauth-callback-handler.ts token interface
 *
 * Documentation:
 * - Facebook PKCE: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 * - RFC 7636: https://tools.ietf.org/html/rfc7636
 */

import type { OAuthTokens } from './oauth-callback-handler';

// Facebook OAuth endpoints (using latest stable API version)
const AUTHORIZATION_ENDPOINT = 'https://www.facebook.com/v19.0/dialog/oauth';
const TOKEN_ENDPOINT = 'https://graph.facebook.com/v19.0/oauth/access_token';

export class FacebookOAuth {
	private clientId: string;
	private clientSecret: string;
	private redirectUri: string;

	constructor(clientId: string, clientSecret: string, redirectUri: string) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.redirectUri = redirectUri;
	}

	/**
	 * Create authorization URL with PKCE
	 *
	 * Generates the Facebook OAuth authorization URL with code_challenge
	 * for PKCE flow. The code_challenge is derived from the code_verifier
	 * using SHA-256 and base64url encoding.
	 *
	 * @param state - Random state parameter to prevent CSRF
	 * @param codeVerifier - PKCE code verifier (43-128 chars, stored in cookie)
	 * @param scopes - Array of Facebook OAuth scopes to request
	 * @returns Authorization URL with PKCE parameters
	 */
	async createAuthorizationURL(
		state: string,
		codeVerifier: string,
		scopes: string[]
	): Promise<URL> {
		// Generate PKCE code challenge from verifier
		const codeChallenge = await this.generateCodeChallenge(codeVerifier);

		const url = new URL(AUTHORIZATION_ENDPOINT);
		url.searchParams.set('client_id', this.clientId);
		url.searchParams.set('redirect_uri', this.redirectUri);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('state', state);
		url.searchParams.set('scope', scopes.join(' '));

		// PKCE parameters - mandatory for security
		url.searchParams.set('code_challenge', codeChallenge);
		url.searchParams.set('code_challenge_method', 'S256');

		return url;
	}

	/**
	 * Exchange authorization code for access token with PKCE verification
	 *
	 * Sends the authorization code and code_verifier to Facebook's token endpoint.
	 * Facebook verifies that SHA256(code_verifier) matches the code_challenge
	 * sent during authorization. This prevents code interception attacks.
	 *
	 * @param code - Authorization code from callback
	 * @param codeVerifier - Original PKCE code verifier from cookie
	 * @returns Tokens in Arctic-compatible format
	 * @throws Error if code_verifier is missing or token exchange fails
	 */
	async validateAuthorizationCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
		// PKCE is mandatory - reject requests without code_verifier
		if (!codeVerifier) {
			throw new Error(
				'PKCE code_verifier is required for Facebook OAuth. ' +
					'This is a security requirement to prevent authorization code interception attacks.'
			);
		}

		const response = await fetch(TOKEN_ENDPOINT, {
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

			// Parse Facebook error response for better error messages
			try {
				const errorJson = JSON.parse(errorText);
				const fbError = errorJson.error;
				if (fbError) {
					// Check for PKCE-specific errors
					if (
						fbError.message?.includes('code_verifier') ||
						fbError.message?.includes('code_challenge')
					) {
						throw new Error(
							`PKCE verification failed: ${fbError.message}. ` +
								'This may indicate a code interception attempt or session mismatch.'
						);
					}
					throw new Error(
						`Facebook token exchange failed: ${fbError.message} (${fbError.code})`
					);
				}
			} catch (parseError) {
				// If we can't parse the error, throw the raw response
				if (parseError instanceof Error && parseError.message.includes('PKCE')) {
					throw parseError;
				}
			}

			throw new Error(`Facebook token exchange failed: ${response.status} ${errorText}`);
		}

		const tokens = await response.json();

		// Validate required token fields
		if (!tokens.access_token) {
			throw new Error('Facebook token response missing access_token');
		}

		return this.createTokensObject(tokens);
	}

	/**
	 * Create Arctic-compatible tokens object
	 *
	 * Wraps Facebook token response in the same interface as Arctic providers
	 * for consistency with oauth-callback-handler.ts
	 */
	private createTokensObject(tokens: {
		access_token: string;
		expires_in?: number;
		token_type?: string;
	}): OAuthTokens {
		// Facebook access tokens expire (typically 60 days for long-lived tokens)
		const expiresAt = tokens.expires_in
			? new Date(Date.now() + tokens.expires_in * 1000)
			: null;

		return {
			accessToken: () => tokens.access_token,
			// Facebook doesn't provide refresh tokens in standard OAuth flow
			refreshToken: () => null,
			hasRefreshToken: () => false,
			accessTokenExpiresAt: () => expiresAt
		};
	}

	/**
	 * Generate PKCE code challenge from verifier
	 *
	 * Implements RFC 7636 Section 4.2:
	 * code_challenge = BASE64URL(SHA256(code_verifier))
	 *
	 * The code verifier must be a cryptographically random string of 43-128 characters
	 * from the set [A-Za-z0-9-._~].
	 *
	 * @param codeVerifier - The random code verifier string
	 * @returns Base64URL-encoded SHA-256 hash
	 */
	private async generateCodeChallenge(codeVerifier: string): Promise<string> {
		// Convert string to ArrayBuffer
		const encoder = new TextEncoder();
		const data = encoder.encode(codeVerifier);

		// Hash with SHA-256
		const hash = await crypto.subtle.digest('SHA-256', data);

		// Convert to base64url (RFC 4648 Section 5)
		// Base64url uses - instead of +, _ instead of /, and omits padding =
		const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
	}
}
