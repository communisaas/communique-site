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

const mocks = mockRegistry.setupMocks();
const dbMock = mocks['$lib/server/db'].db;

// Customize mock behavior
dbMock.user.findUnique.mockResolvedValue(customUser);
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

## Coverage Goals

- Integration tests: 80%+ feature coverage
- Unit tests: Critical business logic only
- E2E tests: Core user journeys

## Recent Optimizations (December 2024)

The test suite was recently consolidated to eliminate redundancy and improve maintainability:

### Before Consolidation: 22 files, 8,445 lines

### After Consolidation: 12 files, 5,145 lines (39% reduction)

**Consolidation Strategy:**

- **Recipient Email Extraction**: Combined 6 separate test files into `recipient-email-extraction.test.ts`
- **Analytics Testing**: Merged performance tests into `analytics-api.test.ts`
- **Slug Validation**: Integrated slug checking tests into `template-api.test.ts`
- **Security Testing**: Wove auth security tests into `oauth-flow.test.ts` and `user-api.test.ts`

**Benefits:**

- ✅ 39% reduction in test file count and lines of code
- ✅ Eliminated duplicate mocking patterns
- ✅ Faster test execution due to reduced redundancy
- ✅ Easier maintenance with consolidated test concerns
- ✅ Maintained 100% critical test coverage

### Current Test File Structure

```
tests/
├── unit/
│   ├── address-lookup.test.ts          # Address geocoding utilities
│   └── cwc-client.test.ts               # Congressional Web Contact client
├── integration/
│   ├── analytics-api.test.ts            # Analytics + Performance + Error handling
│   ├── analytics-funnel.test.ts         # User journey analytics
│   ├── congressional-delivery-flow.test.ts    # Full congressional delivery
│   ├── congressional-delivery-pipeline.test.ts # Pipeline integration
│   ├── legislative-abstraction.test.ts  # Legislative adapter registry
│   ├── oauth-flow.test.ts               # OAuth + Security + Session management
│   ├── recipient-email-extraction.test.ts # Email extraction + Parsing + Validation
│   ├── template-api.test.ts             # Template CRUD + Slug checking + Frontend integration
│   ├── template-personalization.test.ts # Template variable resolution
│   └── user-api.test.ts                 # User management + Security + Permissions
└── e2e/ (browser tests)
```

## Maintenance

- Mocks auto-sync with implementation changes
- Factories provide consistent test data
- Feature flags control test scope automatically
- Consolidated tests reduce maintenance overhead by 39%
