# Bootstrap Strategy: Zero-Budget Launch

**Reality Check**: No budget, need to launch with real users
**Goal**: Maximum security with $0/month operational cost
**Timeline**: Launch ASAP, upgrade as revenue permits

---

## 🚨 Critical Security vs Budget Trade-offs

### What We CANNOT Compromise (Security First)

1. ✅ **No hot wallet** - Already fixed (Week 1)
2. ✅ **Privacy-safe account IDs** - Already fixed (Week 1)
3. ✅ **Client-side signing** - Already fixed (Week 1)
4. ✅ **Social recovery** - Already implemented (Week 1)

**Status**: All Week 1 critical security fixes are $0 cost. We're good here.

### What We CAN Defer (Infrastructure)

1. ⏳ **IPFS migration** - Can stay on Supabase initially
2. ⏳ **RPC failover** - Can use free tier with degraded reliability
3. ⏳ **Lit Protocol encryption** - Can use simpler client-side encryption

---

## 💰 Zero-Budget Stack

### Storage: Supabase Free Tier (Current)

**Keep Using Supabase Initially**:
- ✅ **Free**: 500MB database, 1GB file storage, 2GB bandwidth
- ✅ **Already integrated**: No migration work needed
- ✅ **PostgreSQL**: Battle-tested, reliable
- ✅ **Row-level security**: Built-in access control
- ✅ **Realtime**: WebSocket support included
- ✅ **Auth**: OAuth providers included

**Limits**:
- 500MB database (plenty for metadata)
- 50K monthly active users (more than enough for launch)
- Paused after 1 week of inactivity (not an issue with active users)

**Migration Path**:
```
Phase 1 (Launch): Supabase only
Phase 2 (Revenue): Add IPFS for new data
Phase 3 (Scale): Migrate historical data to IPFS
```

**Why This Works**:
- Metadata is small (~10KB per action)
- 500MB = 50,000 actions before hitting limit
- By then, you'll have revenue or grants

### RPC: Free Tier Only (Degraded Reliability)

**Option A: Single Free RPC (RISKY)**

Use NEAR's public RPC until deprecation:
- ✅ **Free**: $0/month
- ❌ **Deprecated June 2025**: Rate limits incoming
- ❌ **No failover**: Single point of failure
- ❌ **Rate limited**: Throttling likely

**Downtime Risk Analysis**:
- Probability: ~5-10% uptime loss
- User impact: "Service temporarily unavailable"
- Reputation damage: Medium (users expect beta issues)
- Revenue loss: $0 (no revenue yet)

**Option B: Multiple Free RPCs (BETTER)**

Stack 3 free providers with manual failover:
- ✅ **Free**: $0/month
- ✅ **Redundancy**: Better than single RPC
- ⚠️ **Rate limits**: All have restrictions
- ⚠️ **Manual failover**: More implementation work

**Free RPC Providers**:
1. NEAR public RPC (near.org) - Being deprecated
2. AllNodes free tier (if available)
3. Public community RPCs (12 available as of Oct 2025)

**Implementation**:
```typescript
// Simple free RPC rotation
const FREE_RPCS = [
  'https://rpc.mainnet.near.org',
  'https://near.publicnode.com',
  'https://rpc.ankr.com/near'
];

let currentRpcIndex = 0;

async function makeRpcCall(method, params) {
  for (let attempt = 0; attempt < FREE_RPCS.length; attempt++) {
    try {
      const rpc = FREE_RPCS[currentRpcIndex];
      const result = await fetch(rpc, { method, params });
      return result;
    } catch (error) {
      // Try next RPC
      currentRpcIndex = (currentRpcIndex + 1) % FREE_RPCS.length;
      if (attempt === FREE_RPCS.length - 1) throw error;
    }
  }
}
```

**Recommendation**: Use Option B (multiple free RPCs with rotation)
- Cost: $0
- Reliability: 80-90% uptime (vs 70-80% single RPC)
- Implementation: 1-2 days extra work
- Worth it: YES (prevents embarrassing downtime during demo/launch)

### Encryption: Client-Side AES-256 (Free)

**Instead of Lit Protocol, use browser crypto API**:

```typescript
// Free encryption in browser
async function encryptMetadata(data: object, userPasskey: string) {
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);

  // Derive key from user's passkey
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userPasskey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('communique-salt'), // Use per-user salt in production
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(dataStr)
  );

  // Return encrypted data + IV
  return {
    encrypted: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv)
  };
}
```

**Pros**:
- ✅ **Free**: Built into browsers, $0 cost
- ✅ **No dependencies**: Native Web Crypto API
- ✅ **Secure**: AES-256-GCM is industry standard
- ✅ **Private**: User's passkey never leaves device

**Cons**:
- ❌ **No access control**: Can't share encrypted data easily
- ❌ **Key management**: User must remember passkey derivation
- ❌ **No threshold crypto**: Single point of key compromise

**When to Upgrade to Lit Protocol**:
- When you have revenue ($10-50/month budget)
- When you need granular access control
- When you want time-locked or token-gated decryption

---

## 📊 Free Tier Limits Analysis

### Supabase Free Tier Constraints

**Database**:
- 500MB storage
- ~50,000 civic actions (10KB each)
- At 100 actions/day: 500 days runway

**File Storage**:
- 1GB included
- For user uploads (future feature)

**Bandwidth**:
- 2GB/month egress
- ~200,000 page loads/month
- Plenty for early launch

**Compute**:
- Paused after 1 week inactivity
- Resumes on first request (cold start)
- Not an issue with active users

**When You'll Hit Limits**:
- ~6-12 months at modest growth
- By then, $25/month Pro tier justified
- Or migrate to IPFS (cheaper long-term)

### Free RPC Rate Limits

**NEAR Public RPC** (pre-deprecation):
- ~10-50 requests/second (unofficial)
- Throttled during high load
- No SLA or guarantees

**Post-June 2025 Deprecation**:
- Increasingly restricted rate limits
- Eventually unusable for production
- Timeline: 6-12 months of degradation

**Community Free RPCs**:
- Vary widely (1-100 req/sec)
- Can disappear without notice
- Best effort only

**Realistic Limits**:
- Single user: 10-20 RPC calls per session
- 100 concurrent users: 1,000-2,000 calls/min
- Free tier: Probably sufficient for 100-500 users
- Beyond that: Rate limiting likely

---

## 🎯 Bootstrap Launch Strategy

### Phase 0: Pre-Launch (Current)

**Stack**:
- Supabase free tier
- Single NEAR RPC (public)
- No encryption (or simple client-side)

**Users**: Internal testing only
**Duration**: Until ready for real users

### Phase 1: Stealth Launch (0-100 users)

**Immediate Upgrades** (before real users):
- ✅ Implement multiple free RPC rotation
- ✅ Add client-side encryption for sensitive fields
- ✅ Set up monitoring/alerts for RPC failures

**Stack**:
- Supabase free tier (500MB plenty)
- 3 free RPCs with rotation
- Client-side AES-256 encryption

**Cost**: $0/month
**Risk Level**: 🟡 Medium (acceptable for beta)
**Duration**: 1-3 months

**Success Criteria**:
- < 5% downtime due to RPC issues
- No privacy breaches
- User feedback positive

### Phase 2: Public Beta (100-1,000 users)

**When to Upgrade**:
- Signs of consistent usage
- User complaints about reliability
- Approaching Supabase 500MB limit
- Revenue or grant funding secured

**Upgrade Path**:
1. **First $50/month**: Add QuickNode RPC ($49)
   - Eliminates most downtime
   - Professional SLA
   - Worth it once users depend on service

2. **First $100/month**: Add Supabase Pro ($25) + QuickNode
   - 8GB database (16x free tier)
   - No pause after inactivity
   - Daily backups

3. **First $200/month**: Add IPFS migration
   - Lighthouse one-time payment
   - Start migrating to perpetual storage
   - Keep Supabase for hot data

### Phase 3: Revenue-Funded (1,000+ users)

**Full Stack**:
- Lighthouse IPFS (one-time $200)
- QuickNode + Infura RPC ($49/month)
- Lit Protocol encryption ($10-50/month)
- Supabase Pro ($25/month)

**Cost**: ~$100/month operational
**Revenue Required**: 100 users × $2/month = $200/month
**Margin**: $100/month for growth

---

## ⚖️ RPC Failover: Is It Worth It?

### Case Against (Skip for Now)

**Arguments**:
- 💰 **Cost**: $50/month is significant with $0 budget
- 🎯 **Priority**: Security > uptime for MVP
- 📈 **Growth**: Users tolerate beta issues
- ⏰ **Time**: Implementation takes 3-5 days

**Downtime Cost Analysis**:
- Current users: 0 (no revenue)
- User frustration: Low (expect beta bugs)
- Alternative: Show "maintenance" message
- Workaround: Users retry in 5 minutes

**Verdict**: Can defer if truly $0 budget

### Case For (Implement Even Free Version)

**Arguments**:
- 🚨 **June 2025**: NEAR deprecation coming soon
- 💪 **Reliability**: First impression matters
- 🔧 **Simple**: Free RPC rotation costs $0
- 📊 **Data**: Need RPC for ALL blockchain operations

**Downtime Impact**:
- Cannot read NEAR account state
- Cannot verify blockchain actions
- Cannot display user reputation
- Entire blockchain feature broken

**Verdict**: At minimum, implement free RPC rotation (Option B)

### My Recommendation: Free RPC Rotation

**Implement This** (cost: $0, time: 1-2 days):

```typescript
// src/lib/core/blockchain/rpc-failover.ts
const FREE_RPC_ENDPOINTS = [
  { url: 'https://rpc.mainnet.near.org', priority: 1 },
  { url: 'https://near.publicnode.com', priority: 2 },
  { url: 'https://rpc.ankr.com/near', priority: 3 }
];

class FreeRpcFailover {
  private currentIndex = 0;
  private failureCount = new Map<string, number>();

  async call(method: string, params: any) {
    const maxAttempts = FREE_RPC_ENDPOINTS.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const endpoint = FREE_RPC_ENDPOINTS[this.currentIndex];

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Success - reset failure count
        this.failureCount.set(endpoint.url, 0);
        return data.result;

      } catch (error) {
        // Log failure
        const failures = (this.failureCount.get(endpoint.url) || 0) + 1;
        this.failureCount.set(endpoint.url, failures);

        console.warn(`[RPC] ${endpoint.url} failed (${failures}x):`, error);

        // Try next endpoint
        this.currentIndex = (this.currentIndex + 1) % FREE_RPC_ENDPOINTS.length;

        if (attempt === maxAttempts - 1) {
          throw new Error('All RPC endpoints failed');
        }
      }
    }
  }
}

export const rpc = new FreeRpcFailover();
```

**Why This Works**:
- 3x redundancy with $0 cost
- Automatic rotation on failure
- 2 minutes of implementation
- Works until you can afford paid tier

**When to Upgrade to Paid**:
- Consistent rate limiting
- User complaints about speed
- Revenue reaches $50/month
- Post-June 2025 deprecation

---

## 🎬 Launch Checklist: Free Tier Edition

### Pre-Launch (Week 1 - Already Done ✅)

- ✅ Hot wallet eliminated
- ✅ Privacy-safe account IDs
- ✅ Passkey authentication
- ✅ Social recovery implemented

### Launch Prep (Week 2 - Do Before Real Users)

- [ ] **Implement free RPC rotation** (1-2 days)
  - 3 endpoints configured
  - Automatic failover logic
  - Error logging/monitoring

- [ ] **Add client-side encryption** (2-3 days)
  - Encrypt sensitive fields before Supabase
  - Use Web Crypto API (AES-256-GCM)
  - Key derived from user passkey

- [ ] **Set up monitoring** (1 day)
  - RPC failure alerts (email/Discord)
  - Supabase storage usage tracking
  - Error rate monitoring

- [ ] **Document limitations** (1 day)
  - "Beta" disclaimer in UI
  - Expected uptime: 90-95%
  - Feedback mechanism for issues

**Total Time**: 5-7 days
**Total Cost**: $0

### Post-Launch (As Revenue Allows)

**First $50/month revenue**:
- [ ] Upgrade to QuickNode RPC ($49/month)
- Impact: 99.9% uptime, professional SLA

**First $100/month revenue**:
- [ ] Add Supabase Pro ($25/month)
- [ ] Keep QuickNode
- Impact: 8GB storage, no pauses

**First $200/month revenue**:
- [ ] One-time Lighthouse payment ($200)
- [ ] Start IPFS migration
- [ ] Add Lit Protocol ($10/month)
- Impact: Perpetual storage, advanced encryption

---

## 📈 Growth Projections

### Database Storage Runway

**Supabase Free Tier**: 500MB

```
Actions per day × Average size × Days until full
100 actions/day × 10KB × X days = 500MB
X = 500MB ÷ (100 × 10KB) = 500 days

At 100 actions/day: 500 days (16 months)
At 200 actions/day: 250 days (8 months)
At 500 actions/day: 100 days (3 months)
```

**When to Upgrade**:
- ~400MB used (80% capacity)
- Or 100+ daily active users
- Whichever comes first

### RPC Call Budget

**Free Tier Limits**: ~10-50 req/sec per endpoint

```
Users × Calls per session ÷ Session duration
100 users × 20 calls ÷ 300 sec = 6.67 req/sec ✅
500 users × 20 calls ÷ 300 sec = 33.3 req/sec ✅
1000 users × 20 calls ÷ 300 sec = 66.7 req/sec ⚠️
```

**When to Upgrade**:
- Consistent rate limiting errors
- > 500 concurrent users
- Post-June 2025 deprecation

---

## 💡 Creative Zero-Budget Alternatives

### Grants & Sponsorships

**NEAR Foundation Grants**:
- Ecosystem projects eligible
- $5K-50K range typical
- Apply at: near.org/grants

**Civic Tech Grants**:
- Democracy Fund
- Knight Foundation
- Open Society Foundations

**Infrastructure Credits**:
- QuickNode startup credits (request via sales)
- AWS Activate credits ($5K-100K)
- Google Cloud credits ($300 free trial)

### Revenue Before Scale

**Freemium Model**:
- Free for individual users
- $10/month for organizations
- $50/month for campaigns

**Donation Model**:
- "Support Communique" button
- Transparency in costs
- Pay-what-you-can

**Sponsorship Model**:
- Civic organizations sponsor platform
- $100-500/month sponsorship tiers
- Logo placement, recognition

---

## 🎯 Final Recommendation: Free Tier Strategy

### What to Launch With (All Free)

1. ✅ **Supabase free tier** - Keep for now
   - Migrate to IPFS later when funded
   - 500MB is 6-16 months runway

2. ✅ **Free RPC rotation** - Implement this week
   - 3 free endpoints
   - Automatic failover
   - 90-95% uptime acceptable for beta

3. ✅ **Client-side encryption** - Add before real users
   - Web Crypto API (free)
   - Good enough until Lit Protocol
   - Upgrade when revenue allows

4. ✅ **Monitoring & alerts** - Essential
   - Discord webhook for failures
   - Track Supabase storage usage
   - User feedback mechanism

**Total Cost**: $0/month
**Acceptable for**: Beta launch, 0-500 users
**Duration**: 3-6 months until revenue

### When to Invest Real Money

**$50/month threshold** (minimum viable):
- QuickNode RPC ($49/month)
- Worth it at: 100+ active users OR post-June 2025

**$100/month threshold** (comfortable):
- QuickNode ($49) + Supabase Pro ($25)
- Worth it at: 500+ active users OR 400MB storage used

**$200/month threshold** (professional):
- Full stack (IPFS + paid RPC + encryption)
- Worth it at: 1,000+ users OR grant/revenue secured

### The Harsh Truth

**You can launch with $0 budget**, but:
- Accept 90-95% uptime (not 99.9%)
- Accept slower response times
- Accept manual failover sometimes
- Accept simpler encryption

**But you CANNOT compromise**:
- ✅ No hot wallet (already fixed)
- ✅ Privacy-safe IDs (already fixed)
- ✅ Client-side signing (already fixed)
- ✅ Social recovery (already done)

**All critical security is free.** Infrastructure costs money.

Launch now, upgrade later. Users understand beta issues. Revenue solves infrastructure.

---

**Budget Reality**: $0 now → $50 at 100 users → $200 at 1K users
**Security**: Already production-ready (Week 1 complete)
**Recommendation**: Launch with free tier, implement RPC rotation, add client encryption, upgrade as revenue permits
