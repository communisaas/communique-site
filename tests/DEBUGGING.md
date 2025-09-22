# Test Debugging Guide

This guide provides comprehensive troubleshooting information for common test failures and debugging techniques.

## Current Test Health

**Status**: 170/194 tests passing (87.6% pass rate)  
**Last Updated**: September 2024

## Common Failure Patterns

### 1. OAuth Flow Failures

#### Symptoms

```
Error: Invalid authorization code
GOOGLE OAuth error: { error: Error: Invalid authorization code }
```

#### Root Causes

- Missing OAuth environment variables
- Mock misalignment with Arctic OAuth library
- Session creation failure patterns
- CSRF/PKCE validation issues

#### Solutions

```typescript
// Ensure environment setup in tests/config/setup.ts
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.OAUTH_REDIRECT_BASE_URL = 'http://localhost:5173';

// Proper OAuth mock setup
const mockOAuthClient = vi.hoisted(() => ({
	validateAuthorizationCode: vi.fn().mockResolvedValue({
		accessToken: () => 'mock-access-token',
		refreshToken: () => 'mock-refresh-token',
		hasRefreshToken: () => true,
		accessTokenExpiresAt: () => new Date(Date.now() + 3600000)
	})
}));
```

#### Debugging Commands

```bash
# Run OAuth tests with verbose output
npm run test -- oauth-flow.test.ts --reporter=verbose

# Check environment variables
npm run test -- --grep="OAuth.*environment"
```

### 2. Database Mock Misalignment

#### Symptoms

```
TypeError: Cannot read properties of undefined (reading 'mockResolvedValue')
Error: db.user.findUnique is not a function
```

#### Root Causes

- Mock registry not properly initialized
- Prisma schema changes not reflected in mocks
- Test cleanup not resetting mock state

#### Solutions

```typescript
// Use centralized mock registry
import mockRegistry from '../mocks/registry';

beforeEach(() => {
	const mocks = mockRegistry.setupMocks();
	const dbMock = mocks.db;

	// Ensure all expected methods exist
	dbMock.user.findUnique.mockResolvedValue(testUser);
	dbMock.template.create.mockResolvedValue(testTemplate);
});

// Reset between tests
afterEach(() => {
	mockRegistry.reset();
	vi.clearAllMocks();
});
```

### 3. Analytics localStorage Errors

#### Symptoms

```
Cannot read properties of undefined (reading 'getItem')
localStorage is not defined in jsdom environment
```

#### Root Causes

- jsdom environment doesn't provide localStorage by default
- Browser utilities trying to access window/localStorage in test environment
- Missing browser environment mocks

#### Solutions

```typescript
// Mock localStorage in test setup
beforeEach(() => {
	const localStorageMock = {
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn()
	};
	Object.defineProperty(window, 'localStorage', {
		value: localStorageMock
	});
});

// Alternative: Use happy-dom instead of jsdom
// In vitest.config.ts:
test: {
	environment: 'happy-dom'; // Better browser compatibility
}
```

### 4. Agent Integration Response Mismatches

#### Symptoms

```
expected { agentId: 'impact-agent-v1', ... } to match object { ... }
Agent decision response format mismatch
```

#### Root Causes

- Mock responses don't match actual agent API contract
- Schema evolution without mock updates
- Context data validation changes

#### Solutions

```typescript
// Align mock responses with actual agent responses
const mockAgentResponse = {
	agentId: 'impact-agent-v1',
	decision: 'approve',
	confidence: 0.85,
	reasoning: 'Content meets policy guidelines',
	metadata: {
		timestamp: new Date().toISOString(),
		version: '1.0.0'
	}
};

// Use factory patterns for consistent responses
export const agentResponseFactory = {
	build: (overrides = {}) => ({
		...mockAgentResponse,
		...overrides
	})
};
```

### 5. Session Management Failures

#### Symptoms

```
Error: Session not found
Session creation failure in auth tests
```

#### Root Causes

- Auth service mock not returning proper session format
- Session expiry logic not aligned with implementation
- Cookie handling in test environment

#### Solutions

```typescript
// Proper session mock setup
const mockAuth = {
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
};
```

## Debugging Techniques

### 1. Isolate Failing Tests

```bash
# Run single test file
npm run test -- oauth-flow.test.ts

# Run specific test case
npm run test -- --grep="should handle invalid authorization code"

# Run with detailed output
npm run test -- oauth-flow.test.ts --reporter=verbose
```

### 2. Enable Debug Logging

```typescript
// Add debug logging to tests
import { vi } from 'vitest';

beforeEach(() => {
	// Log mock calls
	vi.spyOn(console, 'log').mockImplementation((...args) => {
		if (process.env.DEBUG_TESTS) {
			console.log('[TEST DEBUG]', ...args);
		}
	});
});
```

```bash
# Run with debug output
DEBUG_TESTS=true npm run test -- failing-test.test.ts
```

### 3. Mock State Inspection

```typescript
// Inspect mock state during tests
it('should handle user creation', async () => {
	const mocks = mockRegistry.setupMocks();

	// Execute test
	await userCreationLogic();

	// Inspect calls
	console.log('Database calls:', mocks.db.user.create.mock.calls);
	console.log('Auth calls:', mocks.auth.createSession.mock.calls);

	expect(mocks.db.user.create).toHaveBeenCalledWith(
		expect.objectContaining({
			data: expect.any(Object)
		})
	);
});
```

### 4. Environment Variable Debugging

```typescript
// Check environment setup
beforeEach(() => {
	console.log('OAuth Environment Check:', {
		hasClientId: !!process.env.GOOGLE_CLIENT_ID,
		hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
		oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE_URL,
		nodeEnv: process.env.NODE_ENV
	});
});
```

## Performance Debugging

### 1. Identify Slow Tests

```bash
# Run with timing information
npm run test -- --reporter=verbose | grep -E "\d+ms"

# Identify tests taking >1000ms
npm run test -- --reporter=json | jq '.tests[] | select(.duration > 1000)'
```

### 2. Memory Usage Analysis

```bash
# Run with memory monitoring
node --inspect npm run test

# Check for memory leaks
npm run test -- --logHeapUsage
```

### 3. Mock Performance

```typescript
// Monitor mock call frequency
afterEach(() => {
	const mocks = mockRegistry.setupMocks();
	const totalCalls = Object.values(mocks.db).reduce((total, table) => {
		return (
			total +
			Object.values(table).reduce((tableTotal, method) => {
				return tableTotal + (method.mock?.calls?.length || 0);
			}, 0)
		);
	}, 0);

	if (totalCalls > 100) {
		console.warn(`High mock usage: ${totalCalls} calls`);
	}
});
```

## Test Data Debugging

### 1. Factory Data Validation

```typescript
// Validate factory output
import { userFactory } from '../fixtures/factories';

it('should create valid user data', () => {
	const user = userFactory.build();

	// Validate structure
	expect(user).toMatchObject({
		id: expect.any(String),
		name: expect.any(String),
		email: expect.stringMatching(/^.+@.+\..+$/),
		created_at: expect.any(Date)
	});

	console.log('Generated user:', user);
});
```

### 2. Mock Response Validation

```typescript
// Validate mock responses match real API
it('should return properly formatted response', async () => {
	const response = await apiEndpoint();

	// Check response structure
	expect(response).toHaveProperty('data');
	expect(response).toHaveProperty('status');
	expect(response.data).toBeDefined();

	console.log('API Response:', JSON.stringify(response, null, 2));
});
```

## Common Environment Issues

### 1. Node.js Version Compatibility

```bash
# Check Node version
node --version

# Ensure compatibility with vitest
npm ls vitest
```

### 2. Dependency Conflicts

```bash
# Check for conflicting versions
npm ls --depth=0 | grep -E "(vitest|@vitest)"

# Clean install
rm -rf node_modules package-lock.json
npm install
```

### 3. Environment Variable Loading

```typescript
// Debug environment loading
console.log('Environment check:', {
	NODE_ENV: process.env.NODE_ENV,
	DATABASE_URL: process.env.DATABASE_URL?.slice(0, 20) + '...',
	hasOAuthVars: !!process.env.GOOGLE_CLIENT_ID
});
```

## Best Practices for Debugging

1. **Isolate the Problem**: Run single tests to narrow down issues
2. **Check Mock Alignment**: Ensure mocks match implementation contracts
3. **Validate Environment**: Confirm all required environment variables are set
4. **Use Debug Logging**: Add temporary logging to understand test flow
5. **Check Test Order**: Ensure tests don't have interdependencies
6. **Reset State**: Clean up between tests to prevent interference
7. **Monitor Performance**: Watch for tests that become slower over time

## Getting Help

When filing issues or asking for help:

1. Include the full error message and stack trace
2. Provide the specific test command that fails
3. Share relevant environment information
4. Include any custom mock setup or modifications
5. Mention recent changes that might have introduced the issue

## Useful Commands Reference

```bash
# Basic test commands
npm run test                    # Run all tests
npm run test:run               # Run without watch mode
npm run test:coverage          # Generate coverage report
npm run test:integration       # Integration tests only
npm run test:unit             # Unit tests only

# Debugging commands
npm run test -- --reporter=verbose
npm run test -- --grep="pattern"
npm run test -- filename.test.ts
DEBUG_TESTS=true npm run test

# Performance analysis
npm run test -- --logHeapUsage
npm run test -- --reporter=json > test-results.json
```
