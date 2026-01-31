# Firecrawl Decision-Maker Provider

**Status:** ✅ Implemented
**Version:** 1.0.0
**Last Updated:** 2026-01-31

## Overview

The `FirecrawlDecisionMakerProvider` extends Communique's decision-maker resolution beyond government to include corporations, nonprofits, educational institutions, healthcare organizations, labor unions, and media organizations.

It uses [Firecrawl's Agent API](https://www.firecrawl.dev/agent) for autonomous website navigation and structured data extraction—no URLs required, just objectives.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RESOLVE REQUEST                            │
│  targetType: 'corporate', targetEntity: 'Amazon'                │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MongoDB Cache Check                           │
│  Look for cached organization profile                           │
└─────────────────────────────────────────────────────────────────┘
                            ▼
                  ┌─────────┴─────────┐
                  │                   │
            Cache Hit            Cache Miss
                  │                   │
                  ▼                   ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │  Return Cached       │  │  Firecrawl Agent     │
    │  Leadership (7d TTL) │  │  Discovery           │
    └──────────────────────┘  └──────────────────────┘
                                        ▼
                              ┌──────────────────────┐
                              │  Cache to MongoDB    │
                              │  TTL: 30 days        │
                              └──────────────────────┘
                                        ▼
                              ┌──────────────────────┐
                              │  Filter by Relevance │
                              │  (Gemini Analysis)   │
                              └──────────────────────┘
                                        ▼
                              ┌──────────────────────┐
                              │  ProcessedDecision   │
                              │  Maker Results       │
                              └──────────────────────┘
```

## Supported Target Types

- `corporate` - Companies and corporations
- `nonprofit` - NGOs, foundations, advocacy groups
- `education` - Universities, school districts, colleges
- `healthcare` - Hospitals, health systems, insurers
- `labor` - Labor unions and worker organizations
- `media` - News organizations and media companies

## Implementation Files

### 1. `firecrawl-client.ts`
**Purpose:** Firecrawl API client wrapper

**Key Functions:**
- `discoverOrganization()` - Autonomous organization research
- `buildDiscoveryObjective()` - Constructs Firecrawl Agent prompt
- `agent()` - Calls Firecrawl Agent API

**Type Exports:**
- `FirecrawlOrganizationProfile` - Complete org profile
- `FirecrawlLeader` - Leadership member with contact info
- `FirecrawlPolicyPosition` - Public policy stances

### 2. `firecrawl-provider.ts`
**Purpose:** Main provider implementation

**Key Functions:**
- `resolve()` - Main decision-maker resolution pipeline
- `filterByRelevance()` - AI-powered leadership filtering
- `cacheOrganization()` - MongoDB caching
- `transformToProcessedDecisionMakers()` - Output normalization

**Resolution Pipeline:**
1. Check MongoDB cache (7-day freshness)
2. Discover via Firecrawl Agent (if cache miss)
3. Cache organization profile (30-day TTL)
4. Filter leaders by relevance to issue
5. Return ProcessedDecisionMaker[] results

## MongoDB Integration

### Organizations Collection

```typescript
interface OrganizationDocument {
  _id: ObjectId;
  name: string;
  normalizedName: string;
  website: string;
  about?: string;
  industry?: string;
  headquarters?: { city, state, country };

  // Leadership (refreshes more frequently)
  leadership: LeaderDocument[];

  // Policy positions
  policyPositions: PolicyPositionDocument[];

  // Contact info
  contacts: {
    general?: string;
    press?: string;
    stakeholder?: string;
    phone?: string;
  };

  // Metadata
  source: 'firecrawl' | 'manual' | 'import';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date; // TTL: 30 days
}
```

### Cache Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Organization profile | 30 days | Org structure changes slowly |
| Leadership data | 7 days | People change roles more frequently |
| Decision-maker lookups | 7 days | Issue relevance may shift |

**Staleness Detection:**
- Cache older than 7 days triggers refresh
- Allows for background updates without blocking users

## Firecrawl Agent API Usage

### Discovery Objective Template

```
Research {organizationName} with focus on: {topics}

## Organization Overview
- Official name and common aliases
- Mission statement or company description
- Industry/sector classification
- Headquarters location
- Employee count

## Leadership Team
Find executives, board members, and department heads with authority over {topics}.

For EACH leader:
- Full name
- Official title
- Email address (search: contact pages, team pages, press sections)
- LinkedIn profile URL
- Department/responsibilities

### Email Discovery Strategy
Search these locations:
1. Contact/About pages and footer
2. Leadership/Team/Executive pages
3. Press/Media contact sections
4. Investor relations pages
5. Staff directory
6. Individual bio pages

Email pattern detection:
- john.doe@company.com → firstname.lastname@domain
- jdoe@company.com → firstinitiallastname@domain

Mark as "verified" (found directly) or "inferred" (pattern-based).

## Policy Positions
Public statements on: {topics}

## Contact Information
- General email, press email, phone
```

### API Request

```typescript
const response = await fetch('https://api.firecrawl.dev/v1/agent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: objective,
    url: startUrl, // Optional
    limit: 5, // Max pages to crawl
    pageOptions: {
      onlyMainContent: true
    }
  })
});
```

## Relevance Filtering

Two-stage filtering to identify decision-makers with authority:

### Stage 1: Heuristic Filter
Quick title-based matching:
- C-suite executives (CEO, CFO, COO, CTO)
- Board members and directors
- Department heads matching topic keywords

### Stage 2: AI Analysis (Gemini)
Semantic authority analysis:
- Direct role alignment (e.g., "VP Sustainability" for environmental issues)
- C-suite broad authority
- Department heads whose teams would implement changes
- Board oversight responsibilities

**Prompt:**
```
Identify which leaders have DIRECT or INDIRECT decision-making
authority over: {subjectLine}

Topics: {topics}

Leaders:
1. Jane Smith - CEO
2. John Doe - VP of Public Policy
3. ...

Return JSON with reasoning for each relevant leader.
```

## Error Handling

### Graceful Degradation

| Error Scenario | Response |
|----------------|----------|
| No API key | Clear error: "Firecrawl API not configured" |
| Rate limit exceeded | User-friendly: "Rate limit exceeded. Try again in a few minutes." |
| Discovery failure | Return empty results with explanation |
| Cache failure | Continue without caching (don't fail resolution) |
| Relevance filter error | Fallback to heuristic filter |

### User Feedback

Streaming callbacks provide progress updates:
- "Checking cache for {organization}..."
- "Researching {organization} website for leadership..."
- "Filtering {N} leaders to those with authority..."
- "Found {N} decision-makers with verified contact info"

## Cost Analysis

### Firecrawl Pricing

| Plan | Credits | Cost | Org Profiles |
|------|---------|------|--------------|
| Free | 500/month | $0 | ~30-50 |
| Standard | 100,000/month | $83 | ~6,000 |

**Credits per Operation:**
- Organization discovery: ~15 credits
- Average cost per org: $0.01-$0.02

**Monthly Projection (1K templates, 30% organizational targets):**
- 300 org discoveries × 15 credits = 4,500 credits
- Cost: ~$4-5/month (well within Standard plan)

### MongoDB Atlas

Already provisioned, no additional cost for this feature.

## Usage Example

```typescript
import { FirecrawlDecisionMakerProvider } from '$lib/core/agents/providers';

const provider = new FirecrawlDecisionMakerProvider();

const result = await provider.resolve({
  targetType: 'corporate',
  targetEntity: 'Amazon',
  targetUrl: 'https://www.amazon.com', // Optional
  subjectLine: 'Improve warehouse working conditions',
  coreMessage: 'We urge Amazon to adopt safer labor practices...',
  topics: ['labor', 'worker-rights', 'safety'],
  streaming: {
    onPhase: (phase, message) => console.log(`[${phase}] ${message}`),
    onThought: (thought, phase) => console.log(`  ${thought}`)
  }
});

// Result:
{
  decisionMakers: [
    {
      name: "Beth Galetti",
      title: "SVP, People Experience and Technology",
      organization: "Amazon",
      email: "bgaletti@amazon.com",
      reasoning: "Oversees HR and employee relations",
      source: "https://amazon.com/leadership",
      provenance: "Found via Firecrawl autonomous research...",
      confidence: 0.9,
      powerLevel: "secondary"
    },
    // ... more decision-makers
  ],
  provider: "firecrawl",
  cacheHit: false,
  latencyMs: 45000,
  researchSummary: "Discovered 3 relevant decision-makers at Amazon..."
}
```

## Router Integration

The provider is automatically registered with the `DecisionMakerRouter`:

```typescript
// In providers/index.ts
export function initializeProviders(): void {
  const geminiProvider = new GeminiDecisionMakerProvider();
  decisionMakerRouter.register(geminiProvider, 10);

  const firecrawlProvider = new FirecrawlDecisionMakerProvider();
  decisionMakerRouter.register(firecrawlProvider, 10); // ✅
}
```

**Routing Logic:**
- `targetType: 'congress'` → Gemini (Google Search grounding)
- `targetType: 'corporate'` → Firecrawl (autonomous web crawling)
- Fallback: Router tries next available provider on failure

## Limitations

### What Firecrawl CAN'T Do

❌ **LinkedIn/Twitter** - Blocked by these platforms
❌ **Paywalled content** - Can't access subscription-only pages
❌ **Dynamic JavaScript** - Limited support for heavy client-side rendering
❌ **Login-required pages** - No authentication support

### Mitigation Strategies

- **LinkedIn:** Extract names from org website, provide LinkedIn search guidance
- **Paywalled:** Focus on freely accessible org pages
- **JavaScript:** Firecrawl has decent JS support, but complex SPAs may fail
- **Gated content:** Return partial results, suggest manual research

## Testing Checklist

- [ ] Test with public company (e.g., Amazon, Google)
- [ ] Test with nonprofit (e.g., ACLU, EFF)
- [ ] Test with university (e.g., Stanford, MIT)
- [ ] Test cache hit (second lookup of same org)
- [ ] Test relevance filtering (broad topic vs. specific)
- [ ] Test error handling (no API key)
- [ ] Test fallback (Firecrawl fails, router tries Gemini)
- [ ] Verify MongoDB caching (check database after discovery)
- [ ] Test streaming callbacks (progress updates work)
- [ ] Validate ProcessedDecisionMaker output structure

## Environment Setup

Add to `.env`:
```bash
FIRECRAWL_API_KEY=fc-your-api-key-here
```

Get API key from: https://www.firecrawl.dev/

## Future Enhancements

### Phase 2 (Planned)

1. **Vector Search for Org Similarity**
   - Find orgs with similar policy positions
   - Cluster by industry/topic

2. **Embedding Generation**
   - Store Voyage AI embeddings for org profiles
   - Enable semantic org search

3. **LinkedIn Enrichment**
   - After Firecrawl discovery, optionally enrich with LinkedIn data
   - Requires separate LinkedIn API integration

4. **Email Verification**
   - SMTP validation for discovered emails
   - Confidence scoring based on deliverability

5. **Org Relationship Mapping**
   - Parent/subsidiary tracking
   - Board member overlap detection

## Troubleshooting

### "No API key provided" Error

**Problem:** `FIRECRAWL_API_KEY` not set in environment

**Solution:**
```bash
# Add to .env
FIRECRAWL_API_KEY=fc-xxxxx
```

### Empty Leadership Results

**Problem:** Firecrawl found org but no leaders

**Possible causes:**
- Organization has no public leadership pages
- Website is heavily JavaScript-dependent
- Leadership info is behind login

**Solution:**
- Check `orgProfile` in result for partial data
- Suggest manual research to user
- Consider fallback to Gemini for web search

### Cache Always Missing

**Problem:** Every lookup triggers Firecrawl (expensive)

**Diagnostics:**
```typescript
// Check MongoDB connection
const health = await MongoDBService.healthCheck();
console.log(health); // { connected: true, ... }

// Check cached orgs
const stats = await MongoDBService.getStatistics();
console.log(stats.organizations); // Should increment after discoveries
```

### High Latency (>60s)

**Problem:** Firecrawl Agent is slow

**Causes:**
- Complex website with many pages
- Slow server response
- Firecrawl API congestion

**Optimizations:**
- Reduce `maxPages` in discovery (default: 5)
- Provide `startUrl` to avoid search phase
- Implement timeout with fallback

## References

- [Firecrawl Documentation](https://docs.firecrawl.dev/)
- [Firecrawl Agent API](https://www.firecrawl.dev/agent)
- [MongoDB Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/)
- [Implementation Plan](../../../../docs/FIRECRAWL_MONGODB_IMPLEMENTATION_PLAN.md)
- [Provider Architecture](./ARCHITECTURE.md)

---

**Maintained by:** Communique Engineering Team
**Questions?** See `providers/README.md` or ask in #engineering
