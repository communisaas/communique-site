# Address Validation Test Suite

## Overview

Comprehensive test coverage for our **real** address validation implementation, ensuring zero mock data in production.

## Test Paradigms

### 🧪 **Unit Tests** (`*.test.ts`)

- **Pure logic testing** - No external dependencies
- **Service layer isolation** - Individual functions/classes
- **Mock external APIs** - Focus on business logic

**Coverage:**

- `zipDistrictLookup.test.ts` - ZIP-to-district mapping logic
- `address-lookup.test.ts` - Congressional representative lookup service

### 🔌 **Integration Tests** (`/api/**/*.test.ts`)

- **API endpoint testing** - Full request/response cycle
- **Real data structures** - Actual API contracts
- **Error handling** - Edge cases and failures

**Coverage:**

- `/api/address/verify` - Census Bureau + district extraction
- `/api/address/lookup` - Representative lookup with fallbacks

### 🌐 **E2E Tests** (`e2e/*.test.ts`)

- **User journey testing** - Complete workflows
- **Browser automation** - Playwright
- **Real API integration** - Live endpoints (when appropriate)

**Coverage:**

- Address collection modal flow
- Verification success/failure paths
- Representative display

## Running Tests

### All Tests

```bash
npm run test
```

### Unit Tests Only

```bash
npm run test:unit
```

### E2E Tests Only

```bash
npm run test:e2e
```

### Watch Mode (Development)

```bash
npm run test:unit -- --watch
```

## Test Data

### Real Test Addresses

- **DC**: `1600 Pennsylvania Avenue NW, Washington, DC 20500`
- **NY**: `350 Fifth Avenue, New York, NY 10118`
- **Invalid**: Designed to trigger error paths

### Mock Responses

- Census Bureau API responses
- Congress.gov API responses
- Realistic error scenarios

## Testing Strategy

### ✅ **What We Test**

1. **Address Validation Logic** - Census API integration
2. **District Extraction** - Congressional district parsing
3. **Representative Lookup** - Congress.gov API calls
4. **Error Handling** - API failures, invalid data
5. **User Workflows** - Modal interactions, form validation

### ❌ **What We Don't Test**

1. **External API reliability** - Not our responsibility
2. **Browser compatibility** - Playwright handles this
3. **Network latency** - Use timeouts appropriately

## CI/CD Integration

Tests run automatically on:

- **Pull Requests** - All tests must pass
- **Pre-commit hooks** - Unit tests for quick feedback
- **Deployment** - E2E tests against staging

## Test Environment

### Environment Variables

```bash
# Test-specific overrides
CWC_API_KEY=test-cwc-key
GOOGLE_CIVIC_API_KEY=test-civic-key
```

### Database

- Uses test database or mocked DB calls
- No real data corruption risk

## Debugging Tests

### Failed Unit Tests

```bash
npm run test:unit -- --reporter=verbose
```

### Failed E2E Tests

```bash
npm run test:e2e -- --debug
```

### Coverage Reports

```bash
npm run test:unit -- --coverage
```

## Real vs Mock Data

### 🟢 **Real Data Usage**

- **Test addresses** - Known valid addresses
- **API response formats** - Actual structure from services
- **Error scenarios** - Real error messages

### 🟡 **Strategic Mocking**

- **API calls** - Prevent hitting rate limits in tests
- **Network failures** - Simulate edge cases
- **Timing** - Consistent test execution

**Our test suite validates the real implementation without relying on theatrical projections.**
