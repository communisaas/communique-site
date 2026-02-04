# Decision-Maker Provider Quick Start

> **TL;DR:** The provider system routes decision-maker resolution to specialized providers based on target type. The Gemini provider handles government targets using Google Search grounding for real-time verification.

---

## 5-Minute Setup

### 1. Configure Gemini API

```bash
# Add to .env
GEMINI_API_KEY=your-gemini-api-key-here
```

**Get API key:** https://aistudio.google.com/apikey

### 2. Test It Works

```bash
npm run test -- gemini-provider.test.ts
```

---

## Basic Usage

### Via Router (Recommended)

```typescript
import { decisionMakerRouter } from '$lib/core/agents/providers';

const result = await decisionMakerRouter.resolve({
  targetType: 'local_government',   // Routes to Gemini automatically
  subjectLine: 'Stop the pipeline',
  coreMessage: 'Environmental concerns about the proposed construction...',
  topics: ['environment', 'infrastructure']
});

console.log(result.decisionMakers);
// [{ name: "Jane Smith", title: "Mayor", email: "mayor@cityname.gov", ... }]
```

### Direct Provider

```typescript
import { GeminiDecisionMakerProvider } from '$lib/core/agents/providers';

const provider = new GeminiDecisionMakerProvider();

const result = await provider.resolve({
  targetType: 'congress',
  subjectLine: 'Healthcare reform',
  coreMessage: 'We urge support for affordable healthcare...',
  topics: ['healthcare', 'policy']
});
```

---

## Supported Target Types

### Government (Gemini Provider)

| Type | Description |
|------|-------------|
| `congress` | US Congress members |
| `state_legislature` | State legislators |
| `local_government` | Mayors, city councils, county officials |

### Institutional (Future Providers)

| Type | Example Organizations |
|------|----------------------|
| `corporate` | Amazon, Google, ExxonMobil |
| `nonprofit` | ACLU, EFF, Greenpeace |
| `education` | Stanford, MIT, Harvard |
| `healthcare` | Kaiser Permanente, Mayo Clinic |
| `labor` | AFL-CIO, SEIU, UAW |
| `media` | New York Times, Reuters, NPR |

---

## How It Works

```
1. Router receives resolution request
   ↓
2. Selects provider based on targetType
   ↓
3. Gemini Provider (for government):
   - Phase 1: Discover relevant positions
   - Phase 2: Look up current holders via Google Search
   ↓
4. Return ProcessedDecisionMaker[] results
```

**Performance:**
- Typical resolution: 10-30s (real-time web research)

---

## Real-World Example

### Input

```typescript
{
  targetType: 'local_government',
  subjectLine: 'Stop pipeline construction',
  coreMessage: 'Environmental concerns about infrastructure...',
  topics: ['environment', 'energy'],
  geographicScope: {
    city: 'San Francisco',
    state: 'CA'
  }
}
```

### Output

```typescript
{
  decisionMakers: [
    {
      name: "London Breed",
      title: "Mayor",
      organization: "City of San Francisco",
      email: "mayorlondonbreed@sfgov.org",
      reasoning: "Has executive authority over city infrastructure",
      source: "https://sf.gov/mayor",
      confidence: 0.95,
      powerLevel: "primary",
      isAiResolved: true
    },
    // ... more decision-makers
  ],
  provider: "gemini-search",
  cacheHit: false,
  latencyMs: 12500,
  researchSummary: "Found 3 decision-makers with verified contact info"
}
```

---

## Streaming Progress Updates

```typescript
const result = await decisionMakerRouter.resolve({
  targetType: 'local_government',
  subjectLine: 'Stop pipeline construction',
  topics: ['environment'],
  streaming: {
    onPhase: (phase, message) => {
      console.log(`[${phase}] ${message}`);
      // [discover] Mapping institutional power structure...
      // [lookup] Verifying current holders of 3 positions...
      // [complete] Found 3 decision-makers...
    },
    onThought: (thought, phase) => {
      console.log(`  → ${thought}`);
      // → Analyzing power dynamics in city government...
      // → Found: London Breed verified via sf.gov...
    }
  }
});
```

---

## Common Patterns

### Router Auto-Selection

```typescript
// Router picks provider based on targetType
await decisionMakerRouter.resolve({
  targetType: 'congress',    // → Gemini provider
  // ...
});

await decisionMakerRouter.resolve({
  targetType: 'state_legislature',   // → Gemini provider
  // ...
});
```

### With Geographic Scope

```typescript
const result = await decisionMakerRouter.resolve({
  targetType: 'local_government',
  subjectLine: 'School funding',
  topics: ['education'],
  geographicScope: {
    city: 'Austin',
    state: 'TX',
    displayName: 'Austin, TX'
  }
});
```

---

## Troubleshooting

### "No API key provided" Error

**Problem:** `GEMINI_API_KEY` not set

**Solution:**
```bash
# Add to .env
GEMINI_API_KEY=your-key-here
```

### Empty Results

**Possible Causes:**
- Geographic scope too broad or missing
- Topic mismatch with target type
- Rate limiting from Google Search

**Solution:**
- Provide specific geographic scope
- Ensure topics align with government authority
- Check API quota in Google Cloud Console

### Slow Resolution (>60s)

**Problem:** Gemini lookup taking too long

**Optimizations:**
- Provide more specific geographic scope
- Check Gemini API status
- Verify network connectivity

---

## Testing

### Run Unit Tests

```bash
npm run test -- gemini-provider.test.ts
```

### Run Integration Tests

```bash
export GEMINI_API_KEY=your-key-here
npm run test -- providers/
```

---

## Key Files

| File | Purpose |
|------|---------|
| `types.ts` | Core interfaces and types |
| `router.ts` | Provider routing logic |
| `gemini-provider.ts` | Gemini + Google Search provider |
| `index.ts` | Public API exports |
| `README.md` | Architecture documentation |
| `ARCHITECTURE.md` | Visual architecture guide |

---

## Next Steps

1. **Configure Gemini:** Add API key to `.env`
2. **Test locally:** Run the test suite
3. **Integrate:** Use router in your components
4. **Customize:** Create custom providers for new target types

**Full Documentation:** See `README.md` and `ARCHITECTURE.md`

---

**Questions?** Check the documentation or ask in #engineering
