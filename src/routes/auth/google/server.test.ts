import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server.ts';

// Mock dependencies
vi.mock('arctic', () => ({
  Google: vi.fn().mockImplementation(() => ({
    createAuthorizationURL: vi.fn().mockResolvedValue(new URL('https://accounts.google.com/oauth/authorize?state=mock_state'))
  }))
}));

vi.mock('$lib/server/oauth', () => ({
  generateState: vi.fn().mockReturnValue('mock_state'),
  generateCodeVerifier: vi.fn().mockReturnValue('mock_code_verifier')
}));

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  redirect: vi.fn()
}));

describe('Google OAuth Initiation (/auth/google)', () => {
  let mockCookies: any;
  let mockUrl: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock cookies
    mockCookies = {
      set: vi.fn()
    };
    
    // Setup mock URL
    mockUrl = {
      searchParams: {
        get: vi.fn()
      }
    };
    
    // Setup environment variables
    process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
    process.env.OAUTH_REDIRECT_BASE_URL = 'https://test.com';
    process.env.NODE_ENV = 'test';
  });

  describe('Basic OAuth Flow', () => {
    it('initiates OAuth flow correctly', async () => {
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      
      // Verify state cookie is set
      expect(mockCookies.set).toHaveBeenCalledWith('oauth_state', 'mock_state', {
        path: '/',
        secure: false, // NODE_ENV is 'test'
        httpOnly: true,
        maxAge: 600, // 10 minutes
        sameSite: 'lax'
      });
      
      // Verify code verifier cookie is set
      expect(mockCookies.set).toHaveBeenCalledWith('oauth_code_verifier', 'mock_code_verifier', {
        path: '/',
        secure: false,
        httpOnly: true,
        maxAge: 600,
        sameSite: 'lax'
      });
      
      // Verify redirect to Google
      const { redirect } = await import('@sveltejs/kit');
      expect(redirect).toHaveBeenCalledWith(302, 'https://accounts.google.com/oauth/authorize?state=mock_state');
    });

    it('handles returnTo parameter correctly', async () => {
      mockUrl.searchParams.get.mockReturnValue('/template-modal/test-slug');
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      
      // Verify returnTo cookie is set
      expect(mockCookies.set).toHaveBeenCalledWith('oauth_return_to', '/template-modal/test-slug', {
        path: '/',
        secure: false,
        httpOnly: true,
        maxAge: 600,
        sameSite: 'lax'
      });
    });

    it('uses secure cookies in production', async () => {
      process.env.NODE_ENV = 'production';
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      
      // Verify secure flag is set in production
      expect(mockCookies.set).toHaveBeenCalledWith('oauth_state', 'mock_state', {
        path: '/',
        secure: true, // Should be true in production
        httpOnly: true,
        maxAge: 600,
        sameSite: 'lax'
      });
    });
  });

  describe('Google Provider Configuration', () => {
    it('configures Google provider with correct parameters', async () => {
      const { Google } = await import('arctic');
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      
      // Verify Google provider is instantiated correctly
      expect(Google).toHaveBeenCalledWith(
        'test_client_id',
        'test_client_secret',
        'https://test.com/auth/google/callback'
      );
    });

    it('creates authorization URL with correct scopes', async () => {
      const mockGoogleInstance = {
        createAuthorizationURL: vi.fn().mockResolvedValue(new URL('https://accounts.google.com/oauth/authorize'))
      };
      
      const { Google } = await import('arctic');
      (Google as any).mockImplementation(() => mockGoogleInstance);
      
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      
      // Verify authorization URL is created with correct parameters
      expect(mockGoogleInstance.createAuthorizationURL).toHaveBeenCalledWith(
        'mock_state',
        'mock_code_verifier',
        ['openid', 'profile', 'email']
      );
    });
  });

  describe('Cookie Management', () => {
    it('sets all required cookies', async () => {
      mockUrl.searchParams.get.mockReturnValue('/dashboard');
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      
      // Should set exactly 3 cookies
      expect(mockCookies.set).toHaveBeenCalledTimes(3);
      
      // Verify each cookie
      expect(mockCookies.set).toHaveBeenCalledWith('oauth_state', 'mock_state', expect.any(Object));
      expect(mockCookies.set).toHaveBeenCalledWith('oauth_code_verifier', 'mock_code_verifier', expect.any(Object));
      expect(mockCookies.set).toHaveBeenCalledWith('oauth_return_to', '/dashboard', expect.any(Object));
    });

    it('does not set returnTo cookie when no returnTo parameter', async () => {
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      
      // Should only set 2 cookies (state and code_verifier)
      expect(mockCookies.set).toHaveBeenCalledTimes(2);
      expect(mockCookies.set).not.toHaveBeenCalledWith('oauth_return_to', expect.any(String), expect.any(Object));
    });
  });

  describe('Environment Configuration', () => {
    it('handles missing environment variables gracefully', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      // Should not throw an error (Google constructor will handle undefined values)
      await expect(GET(request as any)).resolves.not.toThrow();
    });
  });

  describe('State Generation', () => {
    it('generates unique state for each request', async () => {
      const { generateState } = await import('$lib/server/oauth');
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      await GET(request as any);
      
      // Verify state generation is called for each request
      expect(generateState).toHaveBeenCalledTimes(2);
    });

    it('generates unique code verifier for each request', async () => {
      const { generateCodeVerifier } = await import('$lib/server/oauth');
      mockUrl.searchParams.get.mockReturnValue(null);
      
      const request = { cookies: mockCookies, url: mockUrl };
      
      await GET(request as any);
      await GET(request as any);
      
      // Verify code verifier generation is called for each request
      expect(generateCodeVerifier).toHaveBeenCalledTimes(2);
    });
  });
});