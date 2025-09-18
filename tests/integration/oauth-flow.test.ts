/**
 * OAuth Flow Integration Tests
 *
 * Tests OAuth authentication handler logic for all providers
 * Uses simplified mocks to test business logic, not provider internals
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
	user: {
		findUnique: vi.fn(),
		create: vi.fn(),
		update: vi.fn()
	},
	account: {
		findUnique: vi.fn(),
		create: vi.fn(),
		update: vi.fn()
	},
	user_session: {
		create: vi.fn()
	}
}));

// Mock auth service
const mockAuth = vi.hoisted(() => ({
	createSession: vi.fn().mockResolvedValue({
		id: 'session-123',
		user_id: 'user-123',
		expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
	}),
	sessionCookieName: 'auth_session'
}));

// Simplified OAuth provider mock - just what we need to test our logic
const mockOAuthProvider = vi.hoisted(() => ({
	validateAuthorizationCode: vi.fn(),
	getUserInfo: vi.fn()
}));

// Mock fetch for user info requests
global.fetch = vi.fn();

vi.mock('$lib/core/db', () => ({
	db: mockDb
}));

vi.mock('$lib/core/auth/session', () => mockAuth);

vi.mock('$lib/core/auth/providers', () => ({
	getProvider: vi.fn(() => mockOAuthProvider)
}));

// Import after mocking
import { oauthCallbackHandler } from '$lib/core/auth/oauth-callback-handler';

// Helper to create mock config for testing
function createMockOAuthConfig(provider: string) {
	const mockUrl = new URL(
		`http://localhost:3000/auth/${provider}/callback?code=valid-code&state=valid-state`
	);
	const mockCookies = {
		get: vi.fn().mockReturnValue('verifier'),
		set: vi.fn(),
		delete: vi.fn()
	} as any;

	const mockConfig = {
		provider: provider as any,
		clientId: 'test-client-id',
		clientSecret: 'test-client-secret',
		redirectUrl: `http://localhost:3000/auth/${provider}/callback`,
		userInfoUrl: `https://${provider}.com/api/user`,
		requiresCodeVerifier: true,
		scope: 'email profile',
		createOAuthClient: vi.fn(),
		exchangeTokens: vi.fn().mockResolvedValue(mockOAuthProvider.validateAuthorizationCode()),
		getUserInfo: mockOAuthProvider.getUserInfo,
		mapUserData: (data: any) => data,
		extractTokenData: (tokens: any) => tokens
	};

	return { mockConfig, mockUrl, mockCookies };
}

describe('OAuth Flow Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default successful responses
		mockOAuthProvider.validateAuthorizationCode.mockResolvedValue({
			accessToken: 'mock-access-token',
			refreshToken: 'mock-refresh-token',
			expiresAt: Date.now() + 3600000
		});

		mockOAuthProvider.getUserInfo.mockResolvedValue({
			id: 'oauth-user-123',
			email: 'user@example.com',
			name: 'Test User',
			avatar: 'https://example.com/avatar.jpg'
		});

		mockDb.account.findUnique.mockResolvedValue(null);
		mockDb.user.findUnique.mockResolvedValue(null);
		mockDb.user.create.mockResolvedValue({
			id: 'user-123',
			email: 'user@example.com',
			name: 'Test User'
		});
		mockDb.account.create.mockResolvedValue({
			id: 'account-123',
			user_id: 'user-123',
			provider: 'google'
		});
	});

	describe('OAuth Callback Handler', () => {
		it('should handle new user registration', async () => {
			const config = { 
				provider: 'google', 
				requiresCodeVerifier: true,
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret',
				redirectUrl: 'http://localhost:5173/auth/callback/google',
				userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
				scope: 'email profile',
				createOAuthClient: () => ({} as any),
				exchangeTokens: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
				getUserInfo: vi.fn().mockResolvedValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				mapUserData: vi.fn().mockReturnValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				extractTokenData: vi.fn().mockReturnValue({ accessToken: 'test-token' })
			};
			const url = new URL('https://example.com/callback?code=valid-code&state=valid-state');
			const cookies = {
				get: vi.fn().mockImplementation((key) => {
					if (key === 'oauth_state') return 'valid-state';
					if (key === 'oauth_code_verifier') return 'verifier';
					if (key === 'oauth_return_to') return '/profile';
					return null;
				}),
				set: vi.fn()
			} as any;

			const result = await oauthCallbackHandler.handleCallback(config, url, cookies);

			expect(result.status).toBe(302);
			expect(result.headers.get('location')).toBeTruthy();

			// Verify user creation
			expect(mockDb.user.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					email: 'user@example.com',
					name: 'Test User'
				})
			});

			// Verify account linking
			expect(mockDb.account.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					provider: 'google',
					provider_user_id: 'oauth-user-123'
				})
			});

			// Verify session creation
			expect(mockAuth.createSession).toHaveBeenCalledWith('user-123');
		});

		it('should handle existing user login', async () => {
			// Setup existing user
			const existingUser = {
				id: 'existing-user-456',
				email: 'existing@example.com',
				name: 'Existing User'
			};

			mockDb.account.findUnique.mockResolvedValue({
				id: 'account-456',
				user_id: 'existing-user-456',
				user: existingUser
			});

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('discord');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(true);
			expect((result as any).user).toEqual(existingUser);

			// Should not create new user
			expect(mockDb.user.create).not.toHaveBeenCalled();

			// Should create session for existing user
			expect(mockAuth.createSession).toHaveBeenCalledWith('existing-user-456');
		});

		it('should handle email conflict gracefully', async () => {
			// Existing user with same email but different provider
			mockDb.user.findUnique.mockResolvedValue({
				id: 'existing-user-789',
				email: 'user@example.com',
				name: 'Existing User'
			});

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('facebook');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(true);

			// Should link new provider to existing user
			expect(mockDb.account.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					user_id: 'existing-user-789',
					provider: 'facebook'
				})
			});
		});

		it('should handle invalid authorization code', async () => {
			mockOAuthProvider.validateAuthorizationCode.mockRejectedValue(
				new Error('Invalid authorization code')
			);

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('google');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(false);
			expect((result as any).error).toBe('Invalid authorization code');

			// Should not create user or session
			expect(mockDb.user.create).not.toHaveBeenCalled();
			expect(mockAuth.createSession).not.toHaveBeenCalled();
		});

		it('should handle user info fetch failure', async () => {
			mockOAuthProvider.getUserInfo.mockRejectedValue(new Error('Failed to fetch user info'));

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('google');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(false);
			expect((result as any).error).toContain('Failed to fetch user info');

			// Should not create user
			expect(mockDb.user.create).not.toHaveBeenCalled();
		});

		it('should validate state parameter', async () => {
			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('google');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(false);
			expect((result as any).error).toContain('Invalid state');
		});

		it('should handle database errors gracefully', async () => {
			mockDb.user.create.mockRejectedValue(new Error('Database error'));

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('google');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(false);
			expect((result as any).error).toContain('Database error');

			// Should not create session if user creation fails
			expect(mockAuth.createSession).not.toHaveBeenCalled();
		});
	});

	describe('Provider-Specific Handling', () => {
		it.each([
			['google', { hasRefreshToken: true }],
			['discord', { hasRefreshToken: true }],
			['facebook', { hasRefreshToken: false }]
		])('should handle %s provider specifics', async (provider, config) => {
			const tokens = {
				accessToken: `${provider}-access-token`,
				refreshToken: config.hasRefreshToken ? `${provider}-refresh-token` : null,
				expiresAt: Date.now() + 3600000
			};

			mockOAuthProvider.validateAuthorizationCode.mockResolvedValue(tokens);

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig(provider);
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(true);

			// Verify provider-specific token handling
			if (config.hasRefreshToken) {
				expect(mockDb.account.create).toHaveBeenCalledWith({
					data: expect.objectContaining({
						refresh_token: expect.any(String)
					})
				});
			}
		});
	});

	describe('Session Management', () => {
		it('should create secure session cookies', async () => {
			const mockSetCookie = vi.fn();

			const result = await oauthCallbackHandler.handleCallback(
				{ 
				provider: 'google', 
				requiresCodeVerifier: true,
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret',
				redirectUrl: 'http://localhost:5173/auth/callback/google',
				userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
				scope: 'email profile',
				createOAuthClient: () => ({} as any),
				exchangeTokens: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
				getUserInfo: vi.fn().mockResolvedValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				mapUserData: vi.fn().mockReturnValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				extractTokenData: vi.fn().mockReturnValue({ accessToken: 'test-token' })
			},
				new URL('https://example.com/callback?code=valid-code&state=valid-state'),
				{
					get: vi.fn().mockImplementation((key) => {
						if (key === 'oauth_state') return 'valid-state';
						if (key === 'oauth_code_verifier') return 'verifier';
						if (key === 'oauth_return_to') return '/profile';
						return null;
					}),
					set: vi.fn()
				} as any,
				{ setCookie: mockSetCookie }
			);

			expect((result as any).success).toBe(true);

			// Verify session cookie settings
			expect(mockSetCookie).toHaveBeenCalledWith(
				'auth_session',
				expect.any(String),
				expect.objectContaining({
					httpOnly: true,
					secure: process.env.NODE_ENV === 'production',
					sameSite: 'lax',
					path: '/',
					maxAge: expect.any(Number)
				})
			);
		});

		it('should handle session creation failure', async () => {
			mockAuth.createSession.mockRejectedValue(new Error('Session creation failed'));

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('google');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			expect((result as any).success).toBe(false);
			expect((result as any).error).toContain('Session creation failed');
		});
	});

	describe('Security Checks', () => {
		it('should validate CSRF tokens', async () => {
			const result = await oauthCallbackHandler.handleCallback(
				{ 
				provider: 'google', 
				requiresCodeVerifier: true,
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret',
				redirectUrl: 'http://localhost:5173/auth/callback/google',
				userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
				scope: 'email profile',
				createOAuthClient: () => ({} as any),
				exchangeTokens: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
				getUserInfo: vi.fn().mockResolvedValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				mapUserData: vi.fn().mockReturnValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				extractTokenData: vi.fn().mockReturnValue({ accessToken: 'test-token' })
			},
				new URL('https://example.com/callback?code=valid-code&state=valid-state'),
				{
					get: vi.fn().mockImplementation((key) => {
						if (key === 'oauth_state') return 'valid-state';
						if (key === 'oauth_code_verifier') return 'verifier';
						if (key === 'oauth_return_to') return '/profile';
						return null;
					}),
					set: vi.fn()
				} as any
			);

			expect((result as any).success).toBe(false);
			expect((result as any).error).toContain('state mismatch');
		});

		it('should enforce PKCE for providers that support it', async () => {
			const result = await oauthCallbackHandler.handleCallback(
				{ 
				provider: 'google', 
				requiresCodeVerifier: true,
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret',
				redirectUrl: 'http://localhost:5173/auth/callback/google',
				userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
				scope: 'email profile',
				createOAuthClient: () => ({} as any),
				exchangeTokens: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
				getUserInfo: vi.fn().mockResolvedValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				mapUserData: vi.fn().mockReturnValue({ id: '123', email: 'user@example.com', name: 'Test User' }),
				extractTokenData: vi.fn().mockReturnValue({ accessToken: 'test-token' })
			},
				new URL('https://example.com/callback?code=valid-code&state=valid-state'),
				{
					get: vi.fn().mockImplementation((key) => {
						if (key === 'oauth_state') return 'valid-state';
						if (key === 'oauth_code_verifier') return 'verifier';
						if (key === 'oauth_return_to') return '/profile';
						return null;
					}),
					set: vi.fn()
				} as any
			);

			expect((result as any).success).toBe(false);
			expect((result as any).error).toContain('Missing code verifier');
		});

		it('should sanitize user input data', async () => {
			mockOAuthProvider.getUserInfo.mockResolvedValue({
				id: 'oauth-user-123',
				email: '<script>alert("xss")</script>user@example.com',
				name: '<img src=x onerror=alert("xss")>Test User',
				avatar: 'javascript:alert("xss")'
			});

			const { mockConfig, mockUrl, mockCookies } = createMockOAuthConfig('google');
			const result = await oauthCallbackHandler.handleCallback(mockConfig, mockUrl, mockCookies);

			// Should sanitize malicious input
			expect(mockDb.user.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					email: expect.not.stringContaining('<script>'),
					name: expect.not.stringContaining('<img')
				})
			});
		});
	});
});
