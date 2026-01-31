# Firecrawl Provider Deployment Checklist

**Implementation Date:** 2026-01-31
**Target Deployment:** TBD
**Engineer:** Distinguished Backend Engineer

---

## Pre-Deployment Tasks

### 1. Dependencies

- [ ] **Install Firecrawl SDK**
  ```bash
  npm install @mendable/firecrawl-js
  ```

- [ ] **Verify package.json updated**
  ```json
  "dependencies": {
    "@mendable/firecrawl-js": "^1.0.0"
  }
  ```

- [ ] **Run npm install to update lock file**
  ```bash
  npm install
  ```

### 2. Environment Configuration

#### Development

- [ ] **Add FIRECRAWL_API_KEY to `.env`**
  ```bash
  FIRECRAWL_API_KEY=fc-dev-key-here
  ```

- [ ] **Test API key validity**
  ```bash
  curl -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
       https://api.firecrawl.dev/v1/account
  ```

#### Staging

- [ ] **Set FIRECRAWL_API_KEY in staging environment**
- [ ] **Verify MongoDB connection in staging**
- [ ] **Test with real organization discovery**

#### Production

- [ ] **Set FIRECRAWL_API_KEY in production environment**
- [ ] **Confirm MongoDB Atlas connection string**
- [ ] **Enable production error logging**

### 3. Testing

#### Unit Tests

- [ ] **Run unit test suite**
  ```bash
  npm run test -- firecrawl-provider.test.ts
  ```

- [ ] **Verify all tests pass**
  ```
  Expected: 15 passed
  ```

#### Integration Tests (Requires API Key)

- [ ] **Set FIRECRAWL_API_KEY**
  ```bash
  export FIRECRAWL_API_KEY=fc-your-key
  ```

- [ ] **Run integration tests**
  ```bash
  npm run test -- firecrawl-provider.test.ts
  ```

- [ ] **Test cache hit/miss behavior**
  - First call: `cacheHit: false`
  - Second call: `cacheHit: true`

#### Manual Testing

- [ ] **Test corporate target**
  - Organization: Patagonia
  - Expected: CEO, environmental officers

- [ ] **Test nonprofit target**
  - Organization: Electronic Frontier Foundation
  - Expected: Executive Director, policy leads

- [ ] **Test education target**
  - Organization: Stanford University
  - Expected: President, relevant deans

- [ ] **Test with streaming callbacks**
  - Verify progress updates appear
  - Check thought stream for research insights

- [ ] **Test error scenarios**
  - Missing target entity
  - Invalid organization name
  - Network timeout (use mock)

### 4. Code Review

- [ ] **Review firecrawl-client.ts**
  - Type safety ✓
  - Error handling ✓
  - API client patterns ✓

- [ ] **Review firecrawl-provider.ts**
  - Provider interface compliance ✓
  - MongoDB integration ✓
  - Relevance filtering logic ✓

- [ ] **Review test coverage**
  - Unit tests: ~80% ✓
  - Edge cases covered ✓
  - Mock patterns correct ✓

- [ ] **Review documentation**
  - FIRECRAWL_PROVIDER.md complete ✓
  - QUICK_START.md clear ✓
  - Code comments sufficient ✓

### 5. Performance Validation

- [ ] **Measure cache hit latency**
  - Target: <100ms
  - Actual: _____ ms

- [ ] **Measure discovery latency**
  - Target: <60s
  - Actual: _____ s

- [ ] **Measure relevance filter latency**
  - Target: <5s
  - Actual: _____ s

- [ ] **Test with concurrent requests**
  - 5 simultaneous discoveries
  - No rate limit errors
  - MongoDB handles load

### 6. MongoDB Verification

- [ ] **Verify organizations collection exists**
  ```javascript
  db.organizations.countDocuments()
  ```

- [ ] **Verify TTL index configured**
  ```javascript
  db.organizations.getIndexes()
  // Should include: { "expiresAt": 1 }
  ```

- [ ] **Test cache insertion**
  ```javascript
  // After first discovery
  db.organizations.findOne({ normalizedName: "patagonia" })
  // Should return document with leadership array
  ```

- [ ] **Verify TTL expiration works**
  - Manually set `expiresAt` to past date
  - Wait 60 seconds (TTL runs every 60s)
  - Verify document deleted

---

## Deployment Tasks

### 1. Code Deployment

- [ ] **Merge to main branch**
  ```bash
  git checkout main
  git merge firecrawl-provider-implementation
  ```

- [ ] **Tag release**
  ```bash
  git tag -a v1.x.x-firecrawl -m "Add Firecrawl decision-maker provider"
  git push --tags
  ```

### 2. Environment Deployment

#### Staging

- [ ] **Deploy to staging environment**
- [ ] **Verify service starts without errors**
- [ ] **Check logs for provider initialization**
  ```
  Expected log: "[providers] Registered: Gemini (government), Firecrawl (organizations)"
  ```

- [ ] **Test end-to-end flow in staging**
  - Create template with corporate target
  - Verify decision-makers discovered
  - Check MongoDB for cached data

#### Production

- [ ] **Deploy to production environment**
- [ ] **Monitor deployment logs**
- [ ] **Verify zero errors on startup**
- [ ] **Smoke test with known organization**

### 3. Monitoring Setup

- [ ] **Set up Firecrawl credit usage alerts**
  - Dashboard: https://dashboard.firecrawl.dev/
  - Alert threshold: 80% of monthly credits

- [ ] **Configure error tracking**
  - Track: "Firecrawl API error"
  - Alert on: >10 errors/hour

- [ ] **Set up cache metrics**
  - Track: Cache hit rate
  - Alert if: <50% hit rate after 24h

- [ ] **Monitor resolution latency**
  - Track: Average discovery time
  - Alert if: >90s average

---

## Post-Deployment Validation

### Day 1 (Immediate)

- [ ] **Verify first production discovery works**
  - Organization: (choose well-known org)
  - Result: Decision-makers found
  - Cache: Document in MongoDB

- [ ] **Check error logs**
  - Expected: Zero Firecrawl errors
  - Actual: _____

- [ ] **Verify MongoDB writes**
  ```javascript
  db.organizations.find({ source: 'firecrawl' }).count()
  // Should be > 0 after first discovery
  ```

### Week 1

- [ ] **Review Firecrawl credit usage**
  - Expected: <500 credits for free tier
  - Actual: _____ credits

- [ ] **Calculate cache hit rate**
  ```javascript
  // Query application logs
  grep "cacheHit: true" logs | wc -l
  grep "cacheHit: false" logs | wc -l
  ```
  - Target: >30% hit rate
  - Actual: _____ %

- [ ] **Review discovery success rate**
  - Target: >90% successful
  - Actual: _____ %

- [ ] **Check average latency**
  - Cache hits: _____ ms (target: <100ms)
  - Discoveries: _____ s (target: <60s)

### Month 1

- [ ] **Analyze cost vs. projections**
  - Projected: $5/month
  - Actual: $_____

- [ ] **Review cache staleness**
  - Orgs refreshed: _____ (should be low)
  - Cache hits: _____ (should be high)

- [ ] **User feedback collection**
  - Decision-maker accuracy: ___/10
  - Contact info quality: ___/10
  - Resolution speed: ___/10

- [ ] **Identify problem organizations**
  - List orgs with failed discoveries
  - Document reasons (paywall, no leadership page, etc.)
  - Consider manual curation for popular orgs

---

## Rollback Plan

### If Critical Issues Arise

1. **Disable Firecrawl Provider**
   ```typescript
   // In providers/index.ts
   export function initializeProviders(): void {
     const geminiProvider = new GeminiDecisionMakerProvider();
     decisionMakerRouter.register(geminiProvider, 10);

     // Comment out Firecrawl
     // const firecrawlProvider = new FirecrawlDecisionMakerProvider();
     // decisionMakerRouter.register(firecrawlProvider, 10);
   }
   ```

2. **Redeploy without Firecrawl**
   - Remove from provider initialization
   - Organizational targets will show "No provider available" error
   - Government targets unaffected (use Gemini)

3. **Clean up MongoDB (if needed)**
   ```javascript
   // Only if cache causing issues
   db.organizations.deleteMany({ source: 'firecrawl' })
   ```

### Rollback Triggers

- [ ] **>50 errors/hour** from Firecrawl API
- [ ] **>90s average discovery time** for 24 hours
- [ ] **MongoDB storage issues** (unlikely)
- [ ] **Critical user complaints** about decision-maker quality

---

## Success Criteria

### Technical

- ✅ **Zero deployment errors**
- ✅ **Provider registered and operational**
- ✅ **MongoDB caching working**
- ✅ **Cache hit rate >30% after Week 1**
- ✅ **Average discovery time <60s**

### User Experience

- ✅ **Organizational targets now discoverable**
- ✅ **Decision-makers have contact info**
- ✅ **Relevance filtering accurate (user validation)**
- ✅ **Progress updates clear and helpful**

### Cost

- ✅ **Monthly cost <$10** (first month)
- ✅ **Within projected $5/month** (steady state)
- ✅ **No unexpected charges**

---

## Known Issues & Workarounds

### Issue: LinkedIn/Twitter Blocked

**Problem:** Firecrawl can't access LinkedIn or Twitter

**Workaround:**
- Extract names from organization website
- Provide users with LinkedIn search links
- Future: Add LinkedIn API integration

### Issue: Paywalled Content

**Problem:** Some orgs have leadership behind paywall

**Workaround:**
- Focus on freely accessible pages
- Return partial results
- Suggest manual research

### Issue: Complex JavaScript Sites

**Problem:** Heavy client-side rendering may fail

**Workaround:**
- Firecrawl has decent JS support
- Provide direct URL to leadership page if known
- Manual fallback for problematic sites

---

## Documentation Updates Needed

### User-Facing

- [ ] **Update template creator guide**
  - Add section on organizational targets
  - Explain organization name input
  - Show example discovered leaders

- [ ] **Add "How to find decision-makers" guide**
  - Government vs. organization targets
  - What to do if discovery fails
  - Manual research best practices

### Developer

- [ ] **Update CONTRIBUTING.md**
  - Mention Firecrawl provider
  - Link to FIRECRAWL_PROVIDER.md

- [ ] **Update API documentation**
  - New `targetType` values
  - `targetEntity` parameter
  - Decision-maker response format

---

## Team Communication

- [ ] **Announce deployment in #engineering**
  ```
  🚀 Deployed: Firecrawl decision-maker provider
  - Now supports corporate, nonprofit, education, healthcare, labor, media targets
  - Autonomous web research for org leadership
  - MongoDB caching for performance
  - Docs: src/lib/core/agents/providers/FIRECRAWL_PROVIDER.md
  ```

- [ ] **Notify support team**
  - Explain new organizational target capability
  - Share troubleshooting guide
  - Provide expected latency (30-60s for discoveries)

- [ ] **Update product team**
  - New use cases enabled
  - Cost implications ($5/month)
  - User experience considerations

---

## Sign-Off

- [ ] **Engineering Lead Approval**
  - Code review complete
  - Testing satisfactory
  - Ready for deployment

- [ ] **Product Lead Approval**
  - Feature aligns with roadmap
  - User experience acceptable
  - Documentation sufficient

- [ ] **Operations Approval**
  - Environment configured
  - Monitoring in place
  - Rollback plan clear

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Production Status:** ⬜ Pending | ⬜ Complete | ⬜ Rolled Back

**Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
