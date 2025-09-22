# CI/CD Test Environment Setup Guide

This guide covers setting up and maintaining a robust test environment for CI/CD pipelines.

## OAuth Test Environment Setup

### Local Development

For local testing, OAuth credentials are automatically set to safe defaults in `tests/config/setup.ts`:

```bash
# These are set automatically for local testing
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
FACEBOOK_CLIENT_ID=test-facebook-client-id
FACEBOOK_CLIENT_SECRET=test-facebook-client-secret
# ... etc for all providers
```

### CI/CD Environment

#### GitHub Actions Secrets

Set these secrets in your repository settings (Settings > Secrets and Variables > Actions):

**Required for all tests:**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test
```

**OAuth testing (recommended for comprehensive coverage):**

```bash
# Google OAuth (for testing OAuth flows)
GOOGLE_CLIENT_ID=your-test-google-client-id
GOOGLE_CLIENT_SECRET=your-test-google-client-secret

# Facebook OAuth
FACEBOOK_CLIENT_ID=your-test-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-test-facebook-client-secret

# Discord OAuth
DISCORD_CLIENT_ID=your-test-discord-client-id
DISCORD_CLIENT_SECRET=your-test-discord-client-secret

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-test-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-test-linkedin-client-secret

# Twitter OAuth
TWITTER_CLIENT_ID=your-test-twitter-client-id
TWITTER_CLIENT_SECRET=your-test-twitter-client-secret
```

**Optional configuration:**

```bash
OAUTH_REDIRECT_BASE_URL=http://localhost:5173  # Default for testing
ENABLE_BETA=false                              # Feature flag for beta features
ENABLE_RESEARCH=false                          # Feature flag for research features
```

#### Setting Up Test OAuth Applications

To get real OAuth credentials for testing:

1. **Google Console** (console.developers.google.com):
   - Create a test project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add `http://localhost:5173/auth/callback/google` to authorized redirect URIs

2. **Facebook Developers** (developers.facebook.com):
   - Create test app
   - Add Facebook Login product
   - Configure redirect URI: `http://localhost:5173/auth/callback/facebook`

3. **Discord Developer Portal** (discord.com/developers):
   - Create test application
   - Note client ID and secret
   - Add redirect: `http://localhost:5173/auth/callback/discord`

4. **LinkedIn Developer Portal** (developer.linkedin.com):
   - Create test app
   - Configure OAuth redirect URI

5. **Twitter Developer Portal** (developer.twitter.com):
   - Create test app with OAuth 2.0 enabled
   - Set callback URL

## CI Configuration

### GitHub Actions Workflow

The `.github/workflows/ci.yml` provides a comprehensive CI setup:

```yaml
# Key features:
- PostgreSQL service for database tests
- Node.js matrix testing (currently Node 20)
- Environment validation
- Separate unit, integration, and E2E test phases
- Coverage reporting
- Build verification
- Test health monitoring
```

### Environment Validation

Tests automatically validate the environment on startup:

- **Required variables**: Checked for presence
- **OAuth consistency**: Validates client ID/secret pairs
- **Database connectivity**: Validates connection string format
- **Feature flags**: Logs enabled features

### Test Timeouts

CI environments use longer timeouts:

- **Local**: 10 seconds per test
- **CI**: 15 seconds per test
- **Integration tests**: Up to 8 minutes total
- **E2E tests**: Up to 10 minutes total

## Database Setup for CI

### PostgreSQL Service

The CI workflow includes a PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

### Database Migration in CI

Tests automatically handle database setup:

1. `npm run db:generate` - Generate Prisma client
2. Tests use mock data and transactions
3. No need for manual migrations in test environment

## Test Stability Features

### Environment Drift Detection

The system monitors for environment changes during test execution:

- Tracks required environment variables
- Detects OAuth configuration changes
- Warns about test pollution
- Resets environment after each test

### Mock-Reality Drift Detection

Automated monitoring for when mocks become outdated:

- **Database schema changes**: Detects new Prisma models
- **API endpoint changes**: Scans for new routes without tests
- **Service integration changes**: Monitors OAuth provider changes
- **Generates reports**: Saves drift reports in `coverage/` directory

### Test Health Monitoring

Comprehensive test execution monitoring:

- **Performance tracking**: Identifies slow tests
- **Failure pattern analysis**: Groups related failures
- **Memory leak detection**: Monitors heap usage
- **Maintenance recommendations**: Actionable improvement suggestions

## Artifact Management

### Coverage Reports

- **Location**: `coverage/` directory
- **Formats**: HTML, JSON, LCOV
- **Upload**: Automatic upload to Codecov
- **Retention**: 30 days for CI artifacts

### Test Reports

- **Health reports**: JSON format in `coverage/test-health-report.json`
- **Drift reports**: JSON format in `coverage/mock-drift-report.json`
- **Summary**: Human-readable markdown in `coverage/test-health-summary.md`

### Playwright Artifacts

- **Screenshots**: Captured on E2E test failures
- **Videos**: Available in headed mode
- **Reports**: HTML report with test traces
- **Retention**: 30 days

## Troubleshooting

### Common CI Issues

1. **OAuth Test Failures**:

   ```bash
   # Check if OAuth credentials are set
   echo "OAuth setup: $HAS_OAUTH_SETUP"

   # Verify environment variables are available
   env | grep -E "(GOOGLE|FACEBOOK|DISCORD)" | head -5
   ```

2. **Database Connection Issues**:

   ```bash
   # Verify PostgreSQL service is healthy
   pg_isready -h localhost -p 5432

   # Check database URL format
   echo $DATABASE_URL
   ```

3. **Timeout Issues**:

   ```bash
   # Increase CI timeout in package.json
   "test:integration": "VITEST_TIMEOUT=20000 vitest tests/integration"

   # Or in vitest config
   testTimeout: process.env.CI ? 20000 : 10000
   ```

4. **Memory Issues**:
   ```bash
   # Check memory usage in CI
   node --max-old-space-size=4096 npm run test
   ```

### Test Environment Debug

Enable debug logging:

```bash
# Local debugging
DEBUG=test:* npm run test

# CI debugging - add to workflow
- name: Debug test environment
  run: |
    echo "Node version: $(node --version)"
    echo "Memory: $(node -e 'console.log(process.memoryUsage())')"
    env | grep -E "(DATABASE|OAUTH|ENABLE)" | sort
```

## Maintenance Procedures

### Weekly Tasks

1. **Run mock drift detection**:

   ```bash
   npm run test:coverage
   # Check coverage/mock-drift-report.json
   ```

2. **Review test health report**:
   ```bash
   # Check coverage/test-health-summary.md
   # Address any high-frequency failure patterns
   ```

### Monthly Tasks

1. **Update OAuth test applications**:
   - Rotate test OAuth secrets
   - Verify redirect URIs still work
   - Check for deprecated OAuth flows

2. **Review CI performance**:
   - Analyze test execution times
   - Optimize slow test suites
   - Update CI timeout configurations

3. **Dependencies audit**:
   ```bash
   npm audit
   npm run check
   ```

### Quarterly Tasks

1. **CI infrastructure review**:
   - Update GitHub Actions versions
   - Review PostgreSQL version
   - Check Node.js LTS updates

2. **Test coverage analysis**:
   - Review coverage thresholds
   - Identify untested critical paths
   - Plan integration test improvements

## Security Considerations

### OAuth Credentials

- Use **test-only** OAuth applications
- Never use production OAuth secrets in CI
- Rotate test secrets quarterly
- Limit OAuth app permissions to minimum required

### Environment Variables

- Use GitHub Secrets for sensitive data
- Never log secret values in CI output
- Validate environment in test setup
- Use safe defaults for local development

### Database Security

- Use isolated test database
- No persistent data in CI database
- Reset database state between test runs
- Use connection pooling limits

## Performance Optimization

### Test Execution

- **Parallel execution**: Tests run in parallel by default
- **Test isolation**: Single fork mode for better isolation
- **Mock optimization**: Minimal external service calls
- **Timeout tuning**: Appropriate timeouts for CI vs local

### CI Pipeline

- **Caching**: npm dependencies cached
- **Artifact compression**: Coverage reports compressed
- **Parallel jobs**: Unit, integration, E2E run in sequence for resource efficiency
- **Early termination**: Fail fast on critical errors

## Future Improvements

### Planned Enhancements

1. **Automated mock updates**: AI-assisted mock synchronization
2. **Test flakiness detection**: Statistical analysis of test reliability
3. **Performance regression detection**: Automated benchmarking
4. **Cross-browser E2E testing**: Multiple browser coverage
5. **Visual regression testing**: Screenshot comparison testing

### Monitoring Integration

1. **Health dashboards**: Real-time test health visualization
2. **Alerting**: Automated notifications for test failures
3. **Trend analysis**: Long-term test performance tracking
4. **Capacity planning**: Resource usage optimization

This setup provides a robust, maintainable, and scalable test environment suitable for both development and production use.
