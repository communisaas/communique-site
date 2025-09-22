# Test Suite Documentation

## Overview

This test suite uses a modern, low-code approach focused on integration testing with smart mocks and type-safe fixtures.

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

#### 1. Smart Mock Registry (`mocks/registry.ts`)

- Auto-configures mocks based on feature flags
- Provides consistent interfaces across tests
- Syncs with actual implementation patterns

#### 2. Type-Safe Fixtures (`fixtures/factories.ts`)

- Factory pattern for creating test data
- Supports overrides and inheritance
- Includes common test scenarios

#### 3. Integration-First Strategy

Tests focus on full user flows rather than isolated units:

- Congressional delivery pipeline
- Legislative abstraction layer
- Template personalization
- Authentication flows

## Running Tests

### All Tests

```bash
npm run test           # Run all tests (unit, integration, e2e)
npm run test:run       # Run without watch mode
```

### Specific Test Types

```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests only
npm run test:coverage    # With coverage report
```

### Feature Flag Testing

```bash
npm run test:production  # Production features only
npm run test:beta        # Include beta features
ENABLE_RESEARCH=true npm run test:run  # Include research features
```

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

### Using Factories

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

## Mock Management

### Automatic Configuration

Mocks are automatically configured based on feature flags:

- Production features (ON): Always mocked
- Beta features (BETA): Mocked when `ENABLE_BETA=true`
- Research features (RESEARCH): Excluded unless `ENABLE_RESEARCH=true`

### Custom Mock Setup

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

## Best Practices

### 1. Integration Over Unit

Focus on testing user flows and feature interactions rather than isolated functions.

### 2. Use Factories

Always use factories for test data to ensure consistency and easy maintenance.

### 3. Feature Flag Aware

Write tests that respect feature flags and don't test experimental code in CI.

### 4. Minimal Mocking

Mock only external dependencies (APIs, databases). Use real implementations for internal logic.

### 5. Descriptive Tests

Test names should describe user scenarios, not implementation details.

## Coverage Goals & Thresholds

### Current Thresholds (vitest.config.ts)

- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

### Coverage Strategy

- **Integration tests**: 80%+ feature coverage with realistic workflows
- **Unit tests**: Critical business logic and edge cases only
- **E2E tests**: Core user journeys and critical paths
- **Mock coverage**: External dependencies fully mocked

### Exclusions from Coverage

- Experimental code (`src/lib/experimental/**`)
- Feature flags (`src/lib/features/**`)
- Test files and configuration
- Build artifacts and dependencies

## Current Test Status (September 2024)

**Test Results:** 170/194 passing (87.6% pass rate)

### Failing Test Categories

1. **OAuth Flow Issues** (13 failures)
   - Error handling edge cases need proper mock alignment
   - Session management tests require environment setup
   - CSRF/PKCE validation needs implementation updates

2. **Critical Edge Cases** (8 failures)
   - Analytics localStorage mocking in jsdom environment
   - Agent decision context validation
   - Database transaction error handling
   - Template analysis API validation

3. **VOTER Certification** (1 failure)
   - Data consistency validation when VOTER service unavailable

4. **Agent Integration** (2 failures)
   - Response format alignment between mocks and implementation
   - Context data validation in decision flows

### Recent Improvements & Fixes Applied

#### Phase 1: OAuth Environment Setup

- ✅ Added comprehensive OAuth environment variables in `tests/config/setup.ts`
- ✅ Standardized test environment configuration
- ✅ Fixed OAuth provider initialization issues

#### Phase 2: Database Mock Alignment

- ✅ Enhanced mock registry with consistent database interfaces
- ✅ Aligned mock return types with Prisma schema
- ✅ Improved mock-reality synchronization patterns

#### Phase 3: Response Format Standardization

- ✅ Standardized API response formats across tests
- ✅ Improved error handling mock patterns
- ✅ Enhanced test data factories with realistic scenarios

### Coverage Analysis Results

- **Global Coverage**: >70% across all thresholds (lines, functions, branches, statements)
- **Integration Tests**: High feature coverage with realistic workflows
- **Unit Tests**: Focused on critical business logic
- **Mock Coverage**: Comprehensive mocking of external dependencies

### Test Consolidation (December 2024)

The test suite was consolidated to eliminate redundancy:

**Before:** 22 files, 8,445 lines  
**After:** 16 files, ~6,000 lines (25% reduction)

**Consolidation Strategy:**

- Combined related test suites to reduce duplication
- Merged mock patterns into unified registry
- Integrated edge case testing into feature tests
- Maintained comprehensive coverage while reducing complexity

### Current Test File Structure

```
tests/
├── unit/
│   ├── address-lookup.test.ts          # Address geocoding utilities
│   └── cwc-client.test.ts               # Congressional Web Contact client
├── integration/
│   ├── analytics-api.test.ts            # Analytics + Performance + Error handling
│   ├── analytics-funnel.test.ts         # User journey analytics
│   ├── agent-integration.test.ts        # Agent decision flows
│   ├── certification-flow.test.ts       # VOTER certification workflows
│   ├── congressional-delivery.test.ts   # Full congressional delivery
│   ├── critical-edge-cases.test.ts      # Edge cases and error conditions
│   ├── legislative-abstraction.test.ts  # Legislative adapter registry
│   ├── oauth-flow.test.ts               # OAuth + Security + Session management
│   ├── recipient-email-extraction.test.ts # Email extraction + Parsing + Validation
│   ├── template-api.test.ts             # Template CRUD + Slug checking
│   ├── template-personalization.test.ts # Template variable resolution
│   ├── user-api.test.ts                 # User management + Security + Permissions
│   ├── voter-certification.test.ts      # VOTER Protocol integration
│   └── voter-proxy.test.ts              # VOTER service proxy
└── e2e/ (browser tests)
```

## Test Debugging & Troubleshooting

### Common Issues & Solutions

#### 1. OAuth Test Failures

**Problem**: Tests fail with "Invalid authorization code" or missing OAuth environment  
**Solution**: Ensure all OAuth environment variables are set in `tests/config/setup.ts`

#### 2. Database Mock Misalignment

**Problem**: Tests fail with undefined database methods  
**Solution**: Check mock registry alignment with actual Prisma schema

#### 3. Analytics localStorage Errors

**Problem**: "Cannot read properties of undefined (reading 'getItem')"  
**Solution**: Mock localStorage in jsdom environment or use happy-dom

#### 4. Agent Integration Failures

**Problem**: Response format mismatches between mocks and implementation  
**Solution**: Align mock responses with actual agent API contract

#### 5. Session Management Issues

**Problem**: Session creation/validation failures in tests  
**Solution**: Ensure auth service mocks return properly formatted session objects

### Debug Commands

```bash
# Run specific failing test with verbose output
npm run test -- oauth-flow.test.ts --reporter=verbose

# Run tests with coverage to identify gaps
npm run test:coverage

# Run only integration tests
npm run test:integration

# Debug specific test pattern
npm run test -- --grep="OAuth.*error"
```

### Performance Optimization

#### Vitest Configuration Optimizations

- **Pool strategy**: `forks` with `singleFork: true` for better test isolation
- **Environment**: `jsdom` for browser-like testing
- **Coverage provider**: `istanbul` for comprehensive reporting

#### Mock Registry Best Practices

- Use centralized mock registry for consistency
- Align mock interfaces with actual implementations
- Reset mocks between tests to prevent interference
- Provide realistic default return values

## Maintenance & Best Practices

### Mock-Reality Synchronization

- **Automatic alignment**: Mock registry interfaces match Prisma schema
- **Realistic defaults**: Factory data reflects production patterns
- **Consistent patterns**: Standardized mock setup across all tests

### Test Data Management

- **Factories**: Type-safe data creation with realistic defaults
- **Scenarios**: Pre-configured test cases for common workflows
- **Overrides**: Easy customization for specific test needs

### Environment Management

- **Feature flags**: Automatic test scope control
- **OAuth setup**: Comprehensive provider configuration
- **Database mocks**: Isolated test data without real DB dependencies

### Continuous Improvement

- Regular review of failing test patterns
- Mock alignment validation with implementation changes
- Coverage threshold adjustments based on project maturity
- Performance monitoring and optimization
