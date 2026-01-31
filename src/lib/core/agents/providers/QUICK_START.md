# Firecrawl Provider Quick Start

> **TL;DR:** The Firecrawl provider finds decision-makers at corporations, nonprofits, universities, and other organizations by autonomously researching their websites. No API required for testing—just uses cached demo data.

---

## 5-Minute Setup

### 1. Install Firecrawl SDK

```bash
npm install @mendable/firecrawl-js
```

### 2. Add API Key (Optional for Testing)

```bash
# Add to .env
FIRECRAWL_API_KEY=fc-your-api-key-here
```

**Get API key:** https://www.firecrawl.dev/

**Note:** Tests work without API key using mocks. Only needed for live discovery.

### 3. Test It Works

```bash
npm run test -- firecrawl-provider.test.ts
```

---

## Basic Usage

### Via Router (Recommended)

```typescript
import { decisionMakerRouter } from '$lib/core/agents/providers';

const result = await decisionMakerRouter.resolve({
  targetType: 'corporate',        // Routes to Firecrawl automatically
  targetEntity: 'Amazon',          // Organization name
  subjectLine: 'Warehouse safety',
  coreMessage: 'We urge improved working conditions...',
  topics: ['labor', 'safety']
});

console.log(result.decisionMakers);
// [{ name: "Beth Galetti", title: "SVP, People...", email: "..." }]
```

### Direct Provider

```typescript
import { FirecrawlDecisionMakerProvider } from '$lib/core/agents/providers';

const provider = new FirecrawlDecisionMakerProvider();

const result = await provider.resolve({
  targetType: 'corporate',
  targetEntity: 'Patagonia',
  targetUrl: 'https://www.patagonia.com', // Optional
  subjectLine: 'Environmental commitment',
  topics: ['environment']
});
```

---

## Supported Target Types

| Type | Example Organizations |
|------|----------------------|
| `corporate` | Amazon, Google, ExxonMobil |
| `nonprofit` | ACLU, EFF, Greenpeace |
| `education` | Stanford, MIT, Harvard |
| `healthcare` | Kaiser Permanente, Mayo Clinic |
| `labor` | AFL-CIO, SEIU, UAW |
| `media` | New York Times, Reuters, NPR |

**Government targets** use Gemini provider (automatic).

---

## How It Works

```
1. Check MongoDB Cache (7-day freshness)
   ↓
2. If cache miss → Firecrawl Agent discovers org
   ↓
3. Cache to MongoDB (30-day TTL)
   ↓
4. Filter leadership by relevance (Gemini AI)
   ↓
5. Return ProcessedDecisionMaker[] results
```

**Performance:**
- Cache hit: <100ms
- Discovery: ~30-60s (autonomous web research)

---

## Real-World Example

### Input

```typescript
{
  targetType: 'nonprofit',
  targetEntity: 'Electronic Frontier Foundation',
  subjectLine: 'Digital privacy legislation',
  topics: ['privacy', 'digital-rights']
}
```

### Output

```typescript
{
  decisionMakers: [
    {
      name: "Cindy Cohn",
      title: "Executive Director",
      organization: "Electronic Frontier Foundation",
      email: "cindy@eff.org",
      reasoning: "Executive leadership with authority over policy advocacy",
      source: "https://www.eff.org/about/staff",
      confidence: 0.9,
      powerLevel: "primary",
      isAiResolved: true
    },
    // ... more decision-makers
  ],
  provider: "firecrawl",
  cacheHit: false,
  latencyMs: 42000,
  researchSummary: "Discovered 3 relevant decision-makers at EFF..."
}
```

---

## Streaming Progress Updates

```typescript
const result = await provider.resolve({
  targetType: 'corporate',
  targetEntity: 'Amazon',
  subjectLine: 'Warehouse conditions',
  topics: ['labor'],
  streaming: {
    onPhase: (phase, message) => {
      console.log(`[${phase}] ${message}`);
      // [discover] Researching Amazon website...
      // [lookup] Filtering 12 leaders...
      // [complete] Found 3 decision-makers...
    },
    onThought: (thought, phase) => {
      console.log(`  → ${thought}`);
      // → Beginning autonomous website research...
      // → Found 12 leaders. Analyzing authority...
    }
  }
});
```

---

## Common Patterns

### Check if Provider Can Resolve

```typescript
const provider = new FirecrawlDecisionMakerProvider();

const canHandle = provider.canResolve({
  targetType: 'corporate',
  targetEntity: 'Amazon',
  // ... other fields
});
// true - Firecrawl handles corporate targets
```

### Router Auto-Selection

```typescript
// Router picks provider based on targetType
await decisionMakerRouter.resolve({
  targetType: 'congress',    // → Gemini provider
  // ...
});

await decisionMakerRouter.resolve({
  targetType: 'corporate',   // → Firecrawl provider
  // ...
});
```

### Cache Management

```typescript
import { OrganizationService } from '$lib/server/mongodb/service';

// Find cached org
const cached = await OrganizationService.findOrganization('Amazon');

if (cached) {
  console.log(`Cached org: ${cached.name}`);
  console.log(`Leaders: ${cached.leadership.length}`);
  console.log(`Last updated: ${cached.updatedAt}`);
}
```

---

## Troubleshooting

### "No API key provided" Error

**Problem:** `FIRECRAWL_API_KEY` not set

**Solution:**
```bash
# Add to .env
FIRECRAWL_API_KEY=fc-xxxxx
```

**For Testing:** Tests work without API key (uses mocks).

### Empty Leadership Results

**Problem:** Firecrawl found org but no leaders

**Possible Causes:**
- Organization has no public leadership pages
- Website is heavily JavaScript-dependent
- Leadership behind login/paywall

**Solution:**
- Check `orgProfile` in result for partial data
- Suggest manual research to user
- Consider fallback to Gemini for web search

### Slow Resolution (>60s)

**Problem:** Firecrawl Agent is taking too long

**Optimizations:**
- Provide `targetUrl` to skip search phase
- Check Firecrawl API status dashboard
- Verify network connectivity

---

## Testing

### Run Unit Tests

```bash
npm run test -- firecrawl-provider.test.ts
```

### Run Integration Tests (Requires API Key)

```bash
export FIRECRAWL_API_KEY=fc-your-key-here
npm run test -- firecrawl-provider.test.ts
```

### Manual Test

```bash
node -e "
const { FirecrawlDecisionMakerProvider } = require('./src/lib/core/agents/providers/firecrawl-provider.ts');

const provider = new FirecrawlDecisionMakerProvider();

provider.resolve({
  targetType: 'nonprofit',
  targetEntity: 'Electronic Frontier Foundation',
  subjectLine: 'Digital privacy',
  coreMessage: 'Support privacy legislation',
  topics: ['privacy']
}).then(result => {
  console.log('Decision-makers:', result.decisionMakers.length);
  console.log('Cache hit:', result.cacheHit);
  console.log('Latency:', result.latencyMs + 'ms');
});
"
```

---

## Cost Reference

| Plan | Credits/Month | Cost | Org Profiles |
|------|---------------|------|--------------|
| Free | 500 | $0 | ~30-50 |
| Standard | 100,000 | $83 | ~6,000 |

**Per Discovery:**
- ~15 credits
- ~$0.01-$0.02 per org

**Monthly (1K templates, 30% organizational):**
- ~300 org discoveries
- ~$5/month

---

## Key Files

| File | Purpose |
|------|---------|
| `firecrawl-client.ts` | API client wrapper |
| `firecrawl-provider.ts` | Main provider implementation |
| `FIRECRAWL_PROVIDER.md` | Complete documentation |
| `__tests__/firecrawl-provider.test.ts` | Test suite |
| `.env.example` | Environment config |

---

## Next Steps

1. **Install SDK:** `npm install @mendable/firecrawl-js`
2. **Test locally:** Run test suite
3. **Configure production:** Add API key to `.env`
4. **Deploy:** Standard deployment process

**Full Documentation:** See `FIRECRAWL_PROVIDER.md`

---

**Questions?** Check `FIRECRAWL_PROVIDER.md` or ask in #engineering
