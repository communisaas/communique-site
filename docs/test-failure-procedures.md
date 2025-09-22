# Test Failure Procedures and Production Guidelines

This document outlines procedures for handling test failures in CI/CD environments and production deployments.

## Immediate Response Procedures

### Critical Test Failures (Production Blocking)

When tests fail on the main branch or during deployment:

#### 1. **Immediate Assessment** (0-5 minutes)

```bash
# Quick failure analysis
npm run test:run 2>&1 | grep -E "(FAIL|ERROR|✗)" | head -20

# Check failure patterns
grep -r "OAuth\|Database\|Timeout" test-output.log

# Environment validation
node -e "console.log('Node:', process.version, 'Env:', process.env.NODE_ENV)"
```

**Decision Matrix:**

- **OAuth failures only** → Non-blocking, proceed with deployment review
- **Database/Core API failures** → **BLOCKING**, halt deployment
- **E2E failures only** → Review required, possible proceed
- **Environment setup failures** → **BLOCKING**, infrastructure issue

#### 2. **Immediate Actions** (5-15 minutes)

**For blocking failures:**

1. **Revert deployment** if already in progress
2. **Create incident ticket** with failure logs
3. **Notify team** via configured alerts
4. **Isolate the issue** - reproduce locally

**For non-blocking failures:**

1. **Create tracking issue** with test failure details
2. **Schedule fix** within current sprint
3. **Monitor** for escalation

#### 3. **Root Cause Analysis** (15-60 minutes)

Use automated failure analysis:

```bash
# Generate comprehensive failure report
npm run test:coverage
cat coverage/test-health-report.json | jq '.failurePatterns'

# Check mock drift
cat coverage/mock-drift-report.json | jq '.driftsDetected'

# Review environment consistency
npm run test:production  # Test with production feature flags
```

## Failure Category Response Procedures

### OAuth Authentication Failures

**Common Patterns:**

- `Invalid authorization code`
- `Failed to fetch user info`
- `OAuth provider unavailable`

**Response Procedure:**

1. **Check OAuth Configuration:**

   ```bash
   # Verify OAuth environment setup
   npm run test:unit tests/unit/oauth-config.test.ts

   # Check provider-specific issues
   curl -f https://accounts.google.com/.well-known/openid_configuration
   ```

2. **Fallback Strategy:**
   - OAuth failures are **non-blocking** for core functionality
   - Users can still use the app without OAuth (email authentication)
   - Monitor OAuth provider status pages

3. **Fix Priority:** Medium (fix within 48 hours)

4. **Escalation Criteria:**
   - All OAuth providers failing simultaneously
   - OAuth failures affecting >50% of user logins

### Database/Core API Failures

**Common Patterns:**

- Connection timeouts
- Schema mismatches
- Transaction deadlocks
- Prisma client errors

**Response Procedure:**

1. **Immediate Database Health Check:**

   ```bash
   # Database connectivity
   npm run db:status

   # Schema validation
   npm run db:validate

   # Check for pending migrations
   npm run db:migrate status
   ```

2. **Core API Validation:**

   ```bash
   # Test core endpoints
   npm run test:integration tests/integration/user-api.test.ts
   npm run test:integration tests/integration/template-api.test.ts
   ```

3. **Blocking Criteria:**
   - User creation/authentication fails
   - Template CRUD operations fail
   - Congressional delivery pipeline fails

4. **Fix Priority:** **Critical** (fix within 2 hours)

### Environment/Infrastructure Failures

**Common Patterns:**

- Missing environment variables
- Service unavailability
- Memory/resource constraints
- Network connectivity issues

**Response Procedure:**

1. **Infrastructure Health Check:**

   ```bash
   # System resources
   free -h
   df -h

   # Network connectivity
   ping -c 3 8.8.8.8

   # Service availability
   systemctl status postgresql
   systemctl status nginx
   ```

2. **Environment Validation:**

   ```bash
   # Check all required variables
   npm run env:validate

   # Verify external service connectivity
   npm run health:check
   ```

3. **Escalation:** Infrastructure team immediately

### Performance/Timeout Failures

**Common Patterns:**

- Test timeouts
- Slow database queries
- Memory leaks
- Resource exhaustion

**Response Procedure:**

1. **Performance Analysis:**

   ```bash
   # Identify slow tests
   npm run test:coverage | grep -E "slow|timeout"

   # Memory usage analysis
   cat coverage/test-health-report.json | jq '.memoryLeaks'
   ```

2. **Optimization Actions:**
   - Increase CI timeouts temporarily
   - Optimize slow test queries
   - Review test parallelization
   - Check for resource leaks

3. **Fix Priority:** Medium (optimize within 1 week)

## Production Deployment Procedures

### Pre-Deployment Checklist

**Required Test Gates:**

```bash
# 1. Core functionality tests
npm run test:production
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ Core tests failed - BLOCKING deployment"
  exit 1
fi

# 2. Integration test suite
npm run test:integration
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "⚠️  Integration tests failed - Review required"
  # Continue but flag for review
fi

# 3. Build verification
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "❌ Build failed - BLOCKING deployment"
  exit 1
fi

# 4. Security check
npm audit --audit-level=high
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "⚠️  Security vulnerabilities detected - Review required"
fi
```

### Deployment Decision Matrix

| Test Status                         | Deployment Action              | Review Required |
| ----------------------------------- | ------------------------------ | --------------- |
| All tests pass                      | ✅ **PROCEED**                 | No              |
| Core tests pass, integration issues | ⚠️ **PROCEED WITH CAUTION**    | Yes             |
| Core tests pass, E2E issues         | ⚠️ **PROCEED WITH MONITORING** | Yes             |
| Core tests fail                     | ❌ **BLOCK**                   | Yes             |
| Build fails                         | ❌ **BLOCK**                   | Yes             |
| Security issues (high/critical)     | ❌ **BLOCK**                   | Yes             |

### Post-Deployment Monitoring

**Automated Health Checks:**

```bash
# Health endpoint monitoring
curl -f https://your-app.com/health || echo "Health check failed"

# Core API functionality
curl -f https://your-app.com/api/health || echo "API health failed"

# Database connectivity
curl -f https://your-app.com/api/db/health || echo "Database health failed"
```

**Monitoring Setup:**

1. **Real-time alerts** for:
   - HTTP 5xx errors
   - Database connection failures
   - Authentication failures >10%
   - Response time >2s on core endpoints

2. **Dashboard metrics:**
   - Request success rate
   - Average response time
   - Active user sessions
   - Error rate by endpoint

## Escalation Procedures

### Severity Levels

**Critical (P0) - Immediate Response Required**

- Complete service outage
- Data loss/corruption
- Security breach
- Core functionality unavailable

**High (P1) - Response within 2 hours**

- Major feature unavailable
- Authentication system down
- Database performance issues
- Significant user impact

**Medium (P2) - Response within 24 hours**

- Minor feature issues
- Non-critical OAuth failures
- Performance degradation
- Limited user impact

**Low (P3) - Response within 1 week**

- Cosmetic issues
- Enhancement requests
- Non-user-facing problems
- Documentation updates

### Contact Procedures

**Critical Issues (P0/P1):**

1. **Immediate notification** to on-call engineer
2. **Create incident** in tracking system
3. **Start incident bridge** for coordination
4. **Notify stakeholders** within 30 minutes

**Standard Issues (P2/P3):**

1. **Create ticket** in tracking system
2. **Assign to appropriate team**
3. **Set priority and timeline**
4. **Update stakeholders** weekly

## Recovery Procedures

### Rollback Strategies

**1. Immediate Rollback (< 5 minutes)**

```bash
# Git-based rollback
git revert HEAD --no-edit
git push origin main

# Container rollback (if using containers)
docker pull previous-image-tag
docker restart app-container
```

**2. Database Rollback (if needed)**

```bash
# Prisma migration rollback
npm run db:migrate reset --force
npm run db:migrate deploy --from-migration previous-migration
```

**3. Feature Flag Rollback**

```bash
# Disable problematic features
export ENABLE_BETA=false
export ENABLE_RESEARCH=false
npm run deploy:hotfix
```

### Data Recovery

**Database Recovery:**

1. **Stop application** to prevent further corruption
2. **Restore from backup** (automated daily backups)
3. **Validate data integrity** after restore
4. **Resume application** with monitoring

**User Data Recovery:**

1. **Identify affected users** from logs
2. **Restore individual user data** if possible
3. **Notify affected users** of resolution
4. **Document incident** for future prevention

## Prevention Measures

### Test Quality Assurance

**1. Comprehensive Test Coverage**

- Maintain >80% integration test coverage
- Critical paths have multiple test scenarios
- Edge cases explicitly tested
- Error conditions properly handled

**2. Test Environment Hardening**

- Production-like CI environment
- Realistic test data volumes
- Network latency simulation
- Resource constraint testing

**3. Automated Quality Gates**

- Code review requirements
- Automated security scanning
- Performance regression detection
- Dependency vulnerability checking

### Monitoring and Alerting

**1. Proactive Monitoring**

- Application performance monitoring (APM)
- Infrastructure monitoring
- User experience monitoring
- Business metric tracking

**2. Alert Configuration**

- Graduated alert severity
- Alert fatigue prevention
- Clear escalation paths
- Automated remediation where possible

### Documentation and Training

**1. Runbook Maintenance**

- Keep procedures up-to-date
- Regular runbook testing
- Clear ownership assignments
- Version control for procedures

**2. Team Training**

- Regular incident response drills
- New team member onboarding
- Cross-team knowledge sharing
- Post-incident learning sessions

## Continuous Improvement

### Post-Incident Review

**Required Actions After Each P0/P1 Incident:**

1. **Root Cause Analysis** (within 72 hours)
   - Timeline of events
   - Contributing factors
   - Detection and response effectiveness
   - Impact assessment

2. **Action Items** (within 1 week)
   - Immediate fixes implemented
   - Process improvements identified
   - Monitoring enhancements
   - Prevention measures

3. **Knowledge Sharing** (within 2 weeks)
   - Incident summary to team
   - Update documentation
   - Training needs identified
   - Runbook updates

### Metrics and KPIs

**Test Reliability Metrics:**

- Test flakiness rate (target: <2%)
- Mean time to detection (MTTD)
- Mean time to resolution (MTTR)
- False positive rate

**Deployment Metrics:**

- Deployment success rate (target: >95%)
- Rollback frequency (target: <5%)
- Time to production (target: <30 min)
- Zero-downtime deployment percentage

**Operational Metrics:**

- Service availability (target: 99.9%)
- Error rate (target: <0.1%)
- Response time p95 (target: <1s)
- User satisfaction score

### Regular Reviews

**Weekly:**

- Test failure trend analysis
- Performance metric review
- Incident follow-up status

**Monthly:**

- Test suite health assessment
- Infrastructure capacity review
- Process effectiveness evaluation

**Quarterly:**

- Comprehensive incident analysis
- Test strategy refinement
- Tool and process upgrades
- Team training planning

This comprehensive approach ensures reliable test execution, effective incident response, and continuous improvement of the development and deployment process.
