# OAuth Environment Setup for Testing

This guide provides comprehensive instructions for setting up OAuth testing environments and resolving common OAuth-related test failures.

## Overview

The test suite requires OAuth environment variables to properly test authentication flows. These variables are automatically configured in `tests/config/setup.ts` for test isolation.

## Required Environment Variables

### Core OAuth Configuration

```bash
# Base configuration
OAUTH_REDIRECT_BASE_URL=http://localhost:5173
NODE_ENV=test

# Database (for OAuth account linking)
DATABASE_URL=postgresql://test:test@localhost:5432/test
```

### Provider-Specific Variables

#### Google OAuth
```bash
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
```

#### Facebook OAuth
```bash
FACEBOOK_CLIENT_ID=test-facebook-client-id
FACEBOOK_CLIENT_SECRET=test-facebook-client-secret
```

#### Discord OAuth
```bash
DISCORD_CLIENT_ID=test-discord-client-id
DISCORD_CLIENT_SECRET=test-discord-client-secret
```

#### LinkedIn OAuth
```bash
LINKEDIN_CLIENT_ID=test-linkedin-client-id
LINKEDIN_CLIENT_SECRET=test-linkedin-client-secret
```

#### Twitter/X OAuth
```bash
TWITTER_CLIENT_ID=test-twitter-client-id
TWITTER_CLIENT_SECRET=test-twitter-client-secret
```

## Test Configuration

### Automatic Setup (`tests/config/setup.ts`)

The test environment automatically configures OAuth variables:

```typescript
beforeEach(() => {
  // OAuth environment variables for tests
  process.env.OAUTH_REDIRECT_BASE_URL = 'http://localhost:5173';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  process.env.FACEBOOK_CLIENT_ID = 'test-facebook-client-id';
  process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-client-secret';
  process.env.DISCORD_CLIENT_ID = 'test-discord-client-id';
  process.env.DISCORD_CLIENT_SECRET = 'test-discord-client-secret';
  process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-client-id';
  process.env.LINKEDIN_CLIENT_SECRET = 'test-linkedin-client-secret';
  process.env.TWITTER_CLIENT_ID = 'test-twitter-client-id';
  process.env.TWITTER_CLIENT_SECRET = 'test-twitter-client-secret';
});
```

### Manual Environment File (Optional)

For local development testing, create `.env.test`:

```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/test
OAUTH_REDIRECT_BASE_URL=http://localhost:5173

# OAuth Test Credentials
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
FACEBOOK_CLIENT_ID=test-facebook-client-id
FACEBOOK_CLIENT_SECRET=test-facebook-client-secret
DISCORD_CLIENT_ID=test-discord-client-id
DISCORD_CLIENT_SECRET=test-discord-client-secret
LINKEDIN_CLIENT_ID=test-linkedin-client-id
LINKEDIN_CLIENT_SECRET=test-linkedin-client-secret
TWITTER_CLIENT_ID=test-twitter-client-id
TWITTER_CLIENT_SECRET=test-twitter-client-secret
```

## OAuth Mock Patterns

### Basic OAuth Client Mock

```typescript
// Mock Arctic OAuth client
const mockOAuthClient = vi.hoisted(() => ({
  validateAuthorizationCode: vi.fn().mockResolvedValue({
    accessToken: () => 'mock-access-token',
    refreshToken: () => 'mock-refresh-token',
    hasRefreshToken: () => true,
    accessTokenExpiresAt: () => new Date(Date.now() + 3600000)
  })
}));

vi.mock('arctic', () => ({
  Google: vi.fn(() => mockOAuthClient),
  Facebook: vi.fn(() => mockOAuthClient),
  Discord: vi.fn(() => mockOAuthClient),
  LinkedIn: vi.fn(() => mockOAuthClient),
  Twitter: vi.fn(() => mockOAuthClient)
}));
```

### User Info Fetch Mock

```typescript
// Mock user info API responses
global.fetch = vi.fn().mockImplementation((url) => {
  if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 'google-user-123',
        email: 'test@gmail.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      })
    });
  }
  
  if (url.includes('graph.facebook.com/me')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 'facebook-user-123',
        email: 'test@facebook.com',
        name: 'Test User'
      })
    });
  }
  
  // Default response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
});
```

### Session Management Mock

```typescript
// Mock auth service for session creation
const mockAuth = vi.hoisted(() => ({
  createSession: vi.fn().mockResolvedValue({
    id: 'session-123',
    user_id: 'user-123',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(),
    updated_at: new Date()
  }),
  validateSession: vi.fn().mockResolvedValue(true),
  deleteSession: vi.fn().mockResolvedValue(true),
  sessionCookieName: 'auth_session'
}));

vi.mock('$lib/core/auth', () => ({
  auth: mockAuth
}));
```

## Common OAuth Test Patterns

### 1. Successful OAuth Flow

```typescript
it('should complete OAuth flow successfully', async () => {
  const mocks = mockRegistry.setupMocks();
  
  // Setup user creation
  mocks.db.user.findUnique.mockResolvedValue(null); // No existing user
  mocks.db.user.create.mockResolvedValue(testUser);
  mocks.db.account.create.mockResolvedValue(testAccount);
  
  // Mock OAuth validation
  mockOAuthClient.validateAuthorizationCode.mockResolvedValue({
    accessToken: () => 'access-token',
    refreshToken: () => 'refresh-token',
    hasRefreshToken: () => true,
    accessTokenExpiresAt: () => new Date(Date.now() + 3600000)
  });
  
  // Execute OAuth callback
  const response = await OAuthCallbackHandler({
    url: new URL('http://localhost:5173/auth/google/callback?code=auth-code'),
    provider: 'google',
    authCode: 'auth-code'
  });
  
  expect(response.status).toBe(302); // Redirect
  expect(mocks.db.user.create).toHaveBeenCalled();
  expect(mocks.auth.createSession).toHaveBeenCalled();
});
```

### 2. OAuth Error Handling

```typescript
it('should handle OAuth errors gracefully', async () => {
  // Mock authorization code validation failure
  mockOAuthClient.validateAuthorizationCode.mockRejectedValue(
    new Error('Invalid authorization code')
  );
  
  const response = await OAuthCallbackHandler({
    url: new URL('http://localhost:5173/auth/google/callback?code=invalid-code'),
    provider: 'google',
    authCode: 'invalid-code'
  });
  
  expect(response.status).toBe(400);
  expect(response.body).toContain('OAuth authentication failed');
});
```

### 3. User Info Fetch Failure

```typescript
it('should handle user info fetch failure', async () => {
  // Mock successful token validation but failed user info
  mockOAuthClient.validateAuthorizationCode.mockResolvedValue(mockTokens);
  
  global.fetch = vi.fn().mockRejectedValue(
    new Error('Failed to fetch user info')
  );
  
  const response = await OAuthCallbackHandler({
    url: new URL('http://localhost:5173/auth/google/callback?code=auth-code'),
    provider: 'google',
    authCode: 'auth-code'
  });
  
  expect(response.status).toBe(500);
});
```

## Troubleshooting OAuth Tests

### Problem: Missing Environment Variables

**Error:**
```
OAuth provider configuration missing for google
```

**Solution:**
Ensure all required environment variables are set in `tests/config/setup.ts` or verify your test environment configuration.

### Problem: Invalid OAuth Client Configuration

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'validateAuthorizationCode')
```

**Solution:**
Check that Arctic OAuth clients are properly mocked:

```typescript
vi.mock('arctic', () => ({
  Google: vi.fn(() => mockOAuthClient),
  // ... other providers
}));
```

### Problem: Session Creation Failures

**Error:**
```
Error: Session creation failed
```

**Solution:**
Ensure auth service mock returns properly formatted session objects:

```typescript
mockAuth.createSession.mockResolvedValue({
  id: expect.any(String),
  user_id: expect.any(String),
  expires_at: expect.any(Date),
  created_at: expect.any(Date),
  updated_at: expect.any(Date)
});
```

### Problem: User Info API Mocking

**Error:**
```
Failed to fetch user profile from provider
```

**Solution:**
Mock the user info API endpoints:

```typescript
global.fetch = vi.fn().mockImplementation((url) => {
  // Return appropriate user data based on provider
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(userInfoData)
  });
});
```

## Provider-Specific Notes

### Google OAuth
- Uses `googleapis.com/oauth2/v2/userinfo` for user info
- Requires both access token and user info API mock
- Supports refresh tokens

### Facebook OAuth
- Uses `graph.facebook.com/me` for user info
- Requires email scope for email access
- Different user ID format

### Discord OAuth
- Uses `discord.com/api/users/@me` for user info
- Provides avatar and username
- Guild information available with additional scopes

### LinkedIn OAuth
- Uses LinkedIn v2 API
- Email is separate endpoint from profile
- Professional information available

### Twitter/X OAuth
- Uses Twitter API v2
- Limited user information in basic scope
- Profile image and verification status available

## Best Practices

1. **Use Test Credentials**: Never use real OAuth credentials in tests
2. **Mock External APIs**: Always mock user info fetch requests
3. **Reset State**: Clear mocks between tests to prevent interference
4. **Test Error Cases**: Include negative test cases for OAuth failures
5. **Validate Environment**: Check that all required variables are present
6. **Use Realistic Data**: Mock user data should match actual provider responses

## Environment Verification Script

```typescript
// tests/utils/verify-oauth-env.ts
export function verifyOAuthEnvironment() {
  const required = [
    'OAUTH_REDIRECT_BASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'FACEBOOK_CLIENT_ID',
    'FACEBOOK_CLIENT_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'LINKEDIN_CLIENT_ID',
    'LINKEDIN_CLIENT_SECRET',
    'TWITTER_CLIENT_ID',
    'TWITTER_CLIENT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing OAuth environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}
```

Use in tests:
```typescript
import { verifyOAuthEnvironment } from '../utils/verify-oauth-env';

beforeEach(() => {
  verifyOAuthEnvironment();
});
```