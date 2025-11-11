# Database Clearing with Tests

## Behavior

The database is cleared every time the test suite runs. This is **intentional and correct** for test isolation.

## Why Tests Clear the Database

The test setup file (`tests/setup/api-test-setup.ts`) contains a `beforeEach` hook that calls `clearTestDatabase()` before every test:

```typescript
beforeEach(async () => {
  await clearTestDatabase();
});
```

This is **required for reliable testing**:
- ✅ Each test starts with a clean slate
- ✅ Tests don't interfere with each other
- ✅ Results are predictable and repeatable
- ✅ Tests can run in any order

## Solution: Just Reseed After Testing

### Quick Fix: Run Tests with Auto-Reseed

Use the convenience script that runs tests and automatically reseeds:

```bash
npm run test:reseed
```

This runs:
1. `npm run test:run` - Runs all tests (clears database)
2. `npm run db:seed` - Reseeds with fresh data

### Manual Reseed

If you run tests manually, reseed afterward:

```bash
npm test
npm run db:seed
```

### Alternative: Separate Test Database (Optional)

For production/CI, you may want a separate test database to avoid clearing dev data.

Add to `.env`:
```bash
TEST_DATABASE_URL="postgresql://test:test@localhost:5432/test_db"
```

Then update `tests/setup/api-test-setup.ts`:
```typescript
const testDb = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  log: ['error']
});
```

## When Database Gets Cleared

- **Before each test** in `beforeEach` hooks
- **Never during `npm run dev`** (only when running tests)

## Best Practice

**After running tests, reseed the database:**

```bash
npm run test:reseed  # Runs tests + auto-reseed
```

or

```bash
npm test && npm run db:seed  # Manual approach
```

## Related Files

- `tests/setup/api-test-setup.ts` - Test database configuration
- `scripts/seed-database.ts` - Database seeding script
- `package.json` - Added `test:reseed` convenience script
