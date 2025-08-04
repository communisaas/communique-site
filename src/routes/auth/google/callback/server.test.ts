import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server.ts';

// Mock dependencies
vi.mock('arctic', () => ({
  Google: vi.fn().mockImplementation(() => ({
    validateAuthorizationCode: vi.fn().mockResolvedValue({
      accessToken: () => 'mock_access_token',
      hasRefreshToken: () => true,
      refreshToken: () => 'mock_refresh_token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600000) // 1 hour from now
    })
  }))
}));

vi.mock('$lib/server/db', () => ({
  db: {
    account: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}));

vi.mock('$lib/server/auth', () => ({
  createSession: vi.fn().mockResolvedValue({ id: 'mock_session_id' }),
  sessionCookieName: 'session_id'
}));

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  error: vi.fn(),
  redirect: vi.fn()
}));

// Mock crypto for account ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]))
  },
  writable: true
});

// Mock fetch for Google user info
global.fetch = vi.fn();

describe('Google OAuth Callback (/auth/google/callback)', () => {
  let mockCookies: any;
  let mockUrl: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock cookies
    mockCookies = {
      get: vi.fn(),
      delete: vi.fn(),
      set: vi.fn()
    };
    
    // Setup mock URL with valid OAuth parameters
    mockUrl = {
      searchParams: {
        get: vi.fn().mockImplementation((key: string) => {
          switch (key) {
            case 'code': return 'mock_auth_code';
            case 'state': return 'mock_state';
            default: return null;
          }
        })
      }
    };
    
    // Setup environment variables
    process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
    process.env.OAUTH_REDIRECT_BASE_URL = 'https://test.com';
    process.env.NODE_ENV = 'test';
    
    // Setup default cookie values
    mockCookies.get.mockImplementation((key: string) => {
      switch (key) {
        case 'oauth_state': return 'mock_state';
        case 'oauth_code_verifier': return 'mock_code_verifier';
        case 'oauth_return_to': return '/dashboard';
        default: return null;
      }
    });
    
    // Setup default Google user response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'google_user_123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      })
    });
  });

  describe('Parameter Validation', () => {
    it('returns error when code is missing', async () => {
      mockUrl.searchParams.get.mockImplementation((key: string) => {
        if (key === 'code') return null;
        if (key === 'state') return 'mock_state';
        return null;
      });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { error } = await import('@sveltejs/kit');
      expect(error).toHaveBeenCalledWith(400, 'Missing required OAuth parameters');
    });

    it('returns error when state is missing', async () => {
      mockUrl.searchParams.get.mockImplementation((key: string) => {
        if (key === 'code') return 'mock_code';
        if (key === 'state') return null;
        return null;
      });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { error } = await import('@sveltejs/kit');
      expect(error).toHaveBeenCalledWith(400, 'Missing required OAuth parameters');
    });

    it('returns error when stored state is missing', async () => {
      mockCookies.get.mockImplementation((key: string) => {
        if (key === 'oauth_state') return null;
        if (key === 'oauth_code_verifier') return 'mock_code_verifier';
        return null;
      });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { error } = await import('@sveltejs/kit');
      expect(error).toHaveBeenCalledWith(400, 'Missing required OAuth parameters');
    });

    it('returns error when state does not match', async () => {
      mockUrl.searchParams.get.mockImplementation((key: string) => {
        if (key === 'code') return 'mock_code';
        if (key === 'state') return 'different_state';
        return null;
      });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { error } = await import('@sveltejs/kit');
      expect(error).toHaveBeenCalledWith(400, 'Invalid OAuth state');
    });
  });

  describe('Cookie Cleanup', () => {
    it('deletes OAuth cookies after processing', async () => {
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(mockCookies.delete).toHaveBeenCalledWith('oauth_state', { path: '/' });
      expect(mockCookies.delete).toHaveBeenCalledWith('oauth_code_verifier', { path: '/' });
      expect(mockCookies.delete).toHaveBeenCalledWith('oauth_return_to', { path: '/' });
    });
  });

  describe('Token Exchange', () => {
    it('exchanges authorization code for tokens', async () => {
      const { Google } = await import('arctic');
      const mockGoogleInstance = {
        validateAuthorizationCode: vi.fn().mockResolvedValue({
          accessToken: () => 'mock_access_token',
          hasRefreshToken: () => true,
          refreshToken: () => 'mock_refresh_token',
          accessTokenExpiresAt: () => new Date()
        })
      };
      (Google as any).mockImplementation(() => mockGoogleInstance);
      
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(mockGoogleInstance.validateAuthorizationCode).toHaveBeenCalledWith('mock_auth_code', 'mock_code_verifier');
    });

    it('handles token exchange errors', async () => {
      const { Google } = await import('arctic');
      const mockGoogleInstance = {
        validateAuthorizationCode: vi.fn().mockRejectedValue(new Error('Token exchange failed'))
      };
      (Google as any).mockImplementation(() => mockGoogleInstance);
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { error } = await import('@sveltejs/kit');
      expect(error).toHaveBeenCalledWith(500, 'Authentication failed: Token exchange failed');
    });
  });

  describe('User Information Fetching', () => {
    it('fetches user info from Google API', async () => {
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(global.fetch).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: 'Bearer mock_access_token'
        }
      });
    });

    it('handles Google API errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401
      });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { error } = await import('@sveltejs/kit');
      expect(error).toHaveBeenCalledWith(500, 'Failed to fetch user information from Google');
    });
  });

  describe('User Account Creation', () => {
    it('creates new user when none exists', async () => {
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(db.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          avatar: 'https://example.com/avatar.jpg'
        }
      });
    });

    it('links Google account to existing user by email', async () => {
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue({ id: 'existing_user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(db.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'existing_user_123',
          provider: 'google',
          provider_account_id: 'google_user_123'
        })
      });
    });

    it('updates existing Google account tokens', async () => {
      const existingAccount = {
        id: 'account_123',
        user: { id: 'user_123', email: 'test@example.com' }
      };
      
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(existingAccount);
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(db.account.update).toHaveBeenCalledWith({
        where: { id: 'account_123' },
        data: expect.objectContaining({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token'
        })
      });
    });
  });

  describe('Session Management', () => {
    it('creates session for authenticated user', async () => {
      const { db } = await import('$lib/server/db');
      const { createSession } = await import('$lib/server/auth');
      
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(createSession).toHaveBeenCalledWith('user_123', false);
    });

    it('creates extended session for social funnel users', async () => {
      mockCookies.get.mockImplementation((key: string) => {
        if (key === 'oauth_return_to') return '/template-modal/test-slug';
        if (key === 'oauth_state') return 'mock_state';
        if (key === 'oauth_code_verifier') return 'mock_code_verifier';
        return null;
      });
      
      const { db } = await import('$lib/server/db');
      const { createSession } = await import('$lib/server/auth');
      
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(createSession).toHaveBeenCalledWith('user_123', true);
    });

    it('sets session cookie with correct expiry', async () => {
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      expect(mockCookies.set).toHaveBeenCalledWith('session_id', 'mock_session_id', {
        path: '/',
        secure: false, // NODE_ENV is 'test'
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days for regular users
        sameSite: 'lax'
      });
    });
  });

  describe('Redirect Logic', () => {
    it('redirects to dashboard by default', async () => {
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ 
        id: 'user_123', 
        email: 'test@example.com',
        street: '123 Main St',
        city: 'Test City',
        state: 'CA',
        zip: '12345'
      });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { redirect } = await import('@sveltejs/kit');
      expect(redirect).toHaveBeenCalledWith(302, '/dashboard');
    });

    it('redirects to address collection when user lacks address', async () => {
      mockCookies.get.mockImplementation((key: string) => {
        if (key === 'oauth_return_to') return '/template-modal/test-slug';
        if (key === 'oauth_state') return 'mock_state';
        if (key === 'oauth_code_verifier') return 'mock_code_verifier';
        return null;
      });
      
      const { db } = await import('$lib/server/db');
      db.account.findUnique.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ 
        id: 'user_123', 
        email: 'test@example.com'
        // No address fields
      });
      
      const request = { url: mockUrl, cookies: mockCookies };
      
      await GET(request as any);
      
      const { redirect } = await import('@sveltejs/kit');
      expect(redirect).toHaveBeenCalledWith(302, '/onboarding/address?returnTo=%2Ftemplate-modal%2Ftest-slug');
    });
  });
});