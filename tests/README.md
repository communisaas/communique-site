# Test Suite Documentation

## Overview

This test suite uses a modern, integration-first approach focused on realistic user workflows with smart mocks and type-safe fixtures.

**Status**: 170/194 tests passing (87.6% pass rate)
**Coverage**: 70%+ across all metrics (lines, functions, branches, statements)
**Strategy**: Integration-first with selective unit testing

## 🚨 Critical Testing Requirements

### Address Verification & Saving Flow

**MUST READ**: `docs/testing/address-flow-testing-strategy.md`

This flow is mission-critical. We previously shipped 5 data integrity bugs because tests checked wrong field names. Tests MUST verify:

- ✅ Exact field names (snake_case: `bioguide_id`, not `bioguideId`)
- ✅ All required fields present (`office_code`, `state`, `congressional_district`)
- ✅ Data pipeline contracts (verify → save → database)
- ✅ Representative storage with real bioguide IDs (not temp fallbacks)

**Pre-commit**: These tests MUST pass before any address-related changes:
```bash
npm run test:integration -- address-verification-api
npm run test:integration -- address-save-api
```

---

## Quick Start

### Running Tests

```bash
# All tests
npm run test                    # Run all tests (watch mode)
npm run test:run                # Run without watch mode

# Specific test types
npm run test:unit               # Unit tests only
npm run test:integration        # Integration tests only
npm run test:e2e                # End-to-end browser tests

# With coverage
npm run test:coverage           # Generate coverage report
npm run test:coverage -- --watch  # Live coverage monitoring

# Feature flag testing
npm run test:production         # Production features only
npm run test:beta               # Include beta features
ENABLE_RESEARCH=true npm run test:run  # Include research features

# Debugging
npm run test -- --reporter=verbose
npm run test -- --grep="pattern"
npm run test -- filename.test.ts
DEBUG_TESTS=true npm run test
```

---

## Architecture

### Directory Structure

```
tests/
├── fixtures/           # Type-safe data factories
├── mocks/              # Smart, auto-syncing mocks
├── integration/        # Full-flow tests (primary focus)
├── unit/              # Critical unit tests only
├── e2e/               # End-to-end browser tests
└── config/            # Test configuration & setup
```

### Key Components

#### 1. Type-Safe Fixtures (`fixtures/factories.ts`)

Factory pattern for creating consistent test data:

```typescript
// Basic usage
const user = userFactory.build();

// With overrides
const caUser = userFactory.build({
  overrides: { state: 'CA', city: 'San Francisco' }
});

// Predefined scenarios
const climateTemplate = testScenarios.climateTemplate();
const routingEmail = testScenarios.routingEmail();
```

#### 2. Mock Registry (`mocks/registry.ts`)

Provides consistent database mock interfaces:

**Note**: Currently unused in tests due to vi.hoisted circular dependency issues. Each test file uses vi.hoisted patterns for isolation.

#### 3. Integration-First Strategy

Tests focus on full user flows rather than isolated units:

- Congressional delivery pipeline
- Legislative abstraction layer
- Template personalization
- Authentication flows

---

## Writing Tests

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { userFactory, templateFactory, testScenarios } from '../fixtures/factories';
import mockRegistry from '../mocks/registry';

describe('Feature Integration', () => {
  it('should handle user flow end-to-end', async () => {
    // Setup: Create test data
    const user = testScenarios.californiaUser();
    const template = testScenarios.climateTemplate();

    // Setup: Configure mocks
    const mocks = mockRegistry.setupMocks();
    const dbMock = mocks['$lib/server/db'].db;

    dbMock.user.findUnique.mockResolvedValue(user);

    // Execute & Verify
    // ... test implementation
  });
});
```

### Mock Management

#### Automatic Configuration

Mocks are automatically configured based on feature flags:

- Production features (ON): Always mocked
- Beta features (BETA): Mocked when `ENABLE_BETA=true`
- Research features (RESEARCH): Excluded unless `ENABLE_RESEARCH=true`

#### Custom Mock Setup

```typescript
import mockRegistry from '../mocks/registry';

// Setup standard mocks
const mocks = mockRegistry.setupMocks();
const dbMock = mocks.db;
const authMock = mocks.auth;

// Customize database mock behavior
dbMock.user.findUnique.mockResolvedValue(customUser);
dbMock.template.create.mockResolvedValue(newTemplate);

// Customize auth mock behavior
authMock.createSession.mockResolvedValue({
  id: 'session-123',
  user_id: 'user-123',
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
});

// Reset specific mocks during test
vi.clearAllMocks(); // Reset all
mockRegistry.reset(); // Reset registry state
```

---

## OAuth Testing

### Environment Setup

OAuth environment variables are automatically configured in `tests/config/setup.ts`:

```typescript
beforeEach(() => {
  process.env.OAUTH_REDIRECT_BASE_URL = 'http://localhost:5173';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  // ... other providers
});
```

### OAuth Mock Patterns

#### Basic OAuth Client Mock

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
  Discord: vi.fn(() => mockOAuthClient)
}));
```

#### User Info Fetch Mock

```typescript
global.fetch = vi.fn().mockImplementation((url) => {
  if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 'google-user-123',
        email: 'test@gmail.com',
        name: 'Test User'
      })
    });
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
});
```

### Common OAuth Test Patterns

```typescript
// 1. Successful OAuth Flow
it('should complete OAuth flow successfully', async () => {
  const mocks = mockRegistry.setupMocks();

  mocks.db.user.findUnique.mockResolvedValue(null);
  mocks.db.user.create.mockResolvedValue(testUser);

  const response = await OAuthCallbackHandler({
    provider: 'google',
    authCode: 'auth-code'
  });

  expect(response.status).toBe(302);
  expect(mocks.db.user.create).toHaveBeenCalled();
});

// 2. OAuth Error Handling
it('should handle OAuth errors gracefully', async () => {
  mockOAuthClient.validateAuthorizationCode.mockRejectedValue(
    new Error('Invalid authorization code')
  );

  const response = await OAuthCallbackHandler({
    provider: 'google',
    authCode: 'invalid-code'
  });

  expect(response.status).toBe(400);
});
```

---

## Debugging Guide

### Common Failure Patterns

#### 1. OAuth Flow Failures

**Symptoms:**
```
Error: Invalid authorization code
GOOGLE OAuth error: { error: Error: Invalid authorization code }
```

**Solutions:**

```typescript
// Ensure environment setup
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

// Proper OAuth mock setup
const mockOAuthClient = vi.hoisted(() => ({
  validateAuthorizationCode: vi.fn().mockResolvedValue({
    accessToken: () => 'mock-access-token',
    refreshToken: () => 'mock-refresh-token'
  })
}));
```

**Debug Commands:**
```bash
npm run test -- oauth-flow.test.ts --reporter=verbose
```

#### 2. Database Mock Misalignment

**Symptoms:**
```
TypeError: Cannot read properties of undefined (reading 'mockResolvedValue')
Error: db.user.findUnique is not a function
```

**Solutions:**

```typescript
import mockRegistry from '../mocks/registry';

beforeEach(() => {
  const mocks = mockRegistry.setupMocks();
  const dbMock = mocks.db;

  dbMock.user.findUnique.mockResolvedValue(testUser);
  dbMock.template.create.mockResolvedValue(testTemplate);
});

afterEach(() => {
  mockRegistry.reset();
  vi.clearAllMocks();
});
```

#### 3. Analytics localStorage Errors

**Symptoms:**
```
Cannot read properties of undefined (reading 'getItem')
localStorage is not defined in jsdom environment
```

**Solutions:**

```typescript
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
```

### Debugging Techniques

#### 1. Isolate Failing Tests

```bash
# Run single test file
npm run test -- oauth-flow.test.ts

# Run specific test case
npm run test -- --grep="should handle invalid authorization code"

# Run with detailed output
npm run test -- oauth-flow.test.ts --reporter=verbose
```

#### 2. Enable Debug Logging

```typescript
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation((...args) => {
    if (process.env.DEBUG_TESTS) {
      console.log('[TEST DEBUG]', ...args);
    }
  });
});
```

```bash
DEBUG_TESTS=true npm run test -- failing-test.test.ts
```

#### 3. Mock State Inspection

```typescript
it('should handle user creation', async () => {
  const mocks = mockRegistry.setupMocks();

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

#### 4. Performance Debugging

```bash
# Identify slow tests
npm run test -- --reporter=verbose | grep -E "\d+ms"

# Check for memory leaks
npm run test -- --logHeapUsage

# Run with inspector
node --inspect npm run test
```

---

## Coverage Strategy

### Current Coverage

| Metric     | Threshold | Achievement | Status |
| ---------- | --------- | ----------- | ------ |
| Lines      | 70%       | >70%        | ✅ Met |
| Functions  | 70%       | >70%        | ✅ Met |
| Branches   | 70%       | >70%        | ✅ Met |
| Statements | 70%       | >70%        | ✅ Met |

### Integration-First Approach

**Philosophy**: Focus on realistic user workflows rather than isolated unit testing.

**Benefits**:
- Higher confidence in feature functionality
- Reduced test maintenance overhead
- Better detection of integration issues
- More realistic test scenarios

**Coverage Impact**:
- 80%+ feature coverage through integration tests
- Comprehensive workflow validation
- Reduced redundancy between unit and integration tests

### Selective Unit Testing

**Scope**: Critical business logic and edge cases only.

**Target Areas**:
- Complex algorithms (address parsing, template resolution)
- Error handling logic
- Utility functions with multiple branches
- Edge case scenarios

### Coverage Exclusions

**Intentionally Excluded:**

1. **Experimental Code** (`src/lib/experimental/**`)
2. **Feature Flags** (`src/lib/features/**`)
3. **Configuration Files** (build configs, env, types)
4. **Test Infrastructure** (test files, mocks, utilities)
5. **Static Assets** (HTML templates, resources)

### Focused Coverage Areas

**High Priority** (Target: 85%+ coverage):
- Core business logic (`src/lib/core/**`)
- API endpoints (`src/routes/api/**`)
- Data utilities (`src/lib/utils/**`)

**Medium Priority** (Target: 70%+ coverage):
- UI components (`src/lib/components/**`)
- Feature implementations
- Integration adapters

**Low Priority** (Target: 50%+ coverage):
- Experimental features
- Development utilities
- Configuration management

---

## Best Practices

### 1. Quality Over Quantity

- Focus on meaningful test scenarios
- Prioritize integration workflows over isolated units
- Ensure mocks reflect real behavior
- Test error paths and edge cases

### 2. Maintainable Tests

- Use factory patterns for consistent test data
- Centralize mock management
- Document coverage exceptions
- Regular review and cleanup

### 3. Performance-Aware Testing

- Optimize slow tests
- Use appropriate test granularity
- Minimize external dependencies
- Efficient mock strategies

### 4. Realistic Testing

- Test actual user workflows
- Use production-like data
- Validate real error scenarios
- Include performance considerations

### 5. Test Isolation

- Each test should be independent
- Reset mocks between tests
- Clear state after each test
- Avoid test interdependencies

### 6. Error Testing

- Test all error paths
- Validate error messages
- Ensure graceful degradation
- Test recovery mechanisms

---

## Troubleshooting Reference

### Quick Fixes

**Missing Environment Variables:**
```
OAuth provider configuration missing for google
```
→ Check `tests/config/setup.ts` has all OAuth env vars

**Invalid OAuth Client:**
```
TypeError: Cannot read properties of undefined
```
→ Ensure Arctic OAuth clients are properly mocked

**Session Creation Failures:**
```
Error: Session creation failed
```
→ Verify auth service mock returns proper session objects

**User Info API Mocking:**
```
Failed to fetch user profile from provider
```
→ Mock the user info API endpoints with global.fetch

### Useful Commands

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

---

## Getting Help

When filing issues or asking for help:

1. Include the full error message and stack trace
2. Provide the specific test command that fails
3. Share relevant environment information
4. Include any custom mock setup or modifications
5. Mention recent changes that might have introduced the issue

---

## Test Consolidation History

### Before Consolidation

- 22 test files
- 8,445 lines of test code
- Significant duplication

### After Consolidation

- 16 test files
- ~6,000 lines of test code
- 25% reduction in test complexity

### Benefits Achieved

- Maintained comprehensive feature coverage
- Reduced maintenance overhead
- Improved test execution performance
- Better test organization

---

This testing approach prioritizes **realistic scenarios over test coverage numbers**, ensuring that tests provide genuine confidence in the platform's reliability while remaining maintainable and performant.
