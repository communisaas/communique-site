# MongoDB Quick Start Guide

## Recommended Usage

For most application code, use the **Service Layer**:

```typescript
import MongoDBService from '$lib/server/mongodb';

// Or import specific services
import {
  OrganizationService,
  IntelligenceService,
  DecisionMakerCacheService
} from '$lib/server/mongodb';
```

## Common Operations

### 1. Cache Organization Profile

```typescript
import { OrganizationService } from '$lib/server/mongodb';

// After gathering org data
const orgId = await OrganizationService.cacheOrganizationProfile({
  name: 'ACME Corporation',
  website: 'https://acme.com',
  about: 'Leading tech company...',
  industry: 'Technology',
  leadership: [
    {
      name: 'Jane Doe',
      title: 'CEO',
      email: 'jane@acme.com',
      isVerified: true
    }
  ],
  cacheDays: 30 // Cache for 30 days
});
```

### 2. Find Organization

```typescript
import { OrganizationService } from '$lib/server/mongodb';

// By name
const org = await OrganizationService.findOrganization('ACME Corp');

// By website (automatically detected)
const org2 = await OrganizationService.findOrganization('https://acme.com');
```

### 3. Store Intelligence (News Article)

```typescript
import { IntelligenceService } from '$lib/server/mongodb';

const itemId = await IntelligenceService.storeIntelligence({
  category: 'news',
  title: 'New Healthcare Bill Introduced',
  source: 'Political News Daily',
  sourceUrl: 'https://news.example.com/article/123',
  publishedAt: new Date(),
  snippet: 'Summary of the article...',
  topics: ['healthcare', 'legislation'],
  entities: ['Senator Smith', 'Health Committee'],
  relevanceScore: 0.85,
  sentiment: 'neutral',
  retentionDays: 90
});
```

### 4. Get Relevant Intelligence

```typescript
import { IntelligenceService } from '$lib/server/mongodb';

// Get news about healthcare
const intelligence = await IntelligenceService.getRelevantIntelligence({
  topics: ['healthcare', 'insurance'],
  categories: ['news', 'legislative'],
  minRelevanceScore: 0.7,
  limit: 10
});

console.log(`Found ${intelligence.length} relevant items`);
```

### 5. Cache Decision Makers (with Auto-Lookup)

```typescript
import { DecisionMakerCacheService } from '$lib/server/mongodb';

// Check cache and fetch if needed
const result = await DecisionMakerCacheService.getDecisionMakers({
  targetType: 'legislative',
  targetEntity: 'US Senate',
  topics: ['healthcare'],
  provider: 'gemini',
  cacheDays: 7,

  // Fetch function called on cache miss
  fetchFn: async () => {
    // Call your API to get decision makers
    const response = await fetch('...');
    return response.json();
  }
});

if (result.cached) {
  console.log('Cache hit!');
} else {
  console.log('Cache miss - fetched and cached');
}

console.log(`Found ${result.decisionMakers.length} decision makers`);
```

### 6. Health Check

```typescript
import MongoDBService from '$lib/server/mongodb';

const health = await MongoDBService.healthCheck();

if (health.connected) {
  console.log(`Connected to ${health.database}`);
  console.log(`Collections: ${health.collections}`);
}
```

### 7. Get Statistics

```typescript
import MongoDBService from '$lib/server/mongodb';

const stats = await MongoDBService.getStatistics();

console.log(`Organizations: ${stats.organizations}`);
console.log(`Intelligence items: ${stats.intelligence}`);
console.log(`Cache entries: ${stats.cacheEntries}`);
console.log('Cache metrics:', stats.cacheMetrics);
```

## Full Workflow Example

```typescript
import {
  OrganizationService,
  IntelligenceService,
  DecisionMakerCacheService
} from '$lib/server/mongodb';
import { generateQueryHash } from '$lib/server/mongodb';

async function handleUserMessage(userInput: {
  organization: string;
  topic: string;
}) {
  // 1. Find or cache organization
  let org = await OrganizationService.findOrganization(userInput.organization);

  if (!org) {
    // Fetch organization data and cache
    org = await fetchOrganizationData(userInput.organization);
    await OrganizationService.cacheOrganizationProfile({
      name: org.name,
      website: org.website,
      // ... other fields
    });
  }

  // 2. Get relevant intelligence
  const intelligence = await IntelligenceService.getRelevantIntelligence({
    topics: [userInput.topic],
    categories: ['news', 'legislative'],
    limit: 5
  });

  // 3. Get decision makers
  const { decisionMakers } = await DecisionMakerCacheService.getDecisionMakers({
    targetType: 'corporate',
    targetEntity: org.name,
    topics: [userInput.topic],
    fetchFn: async () => {
      // Fetch from your provider
      return await fetchDecisionMakers(org);
    }
  });

  // 4. Return context for message composition
  return {
    organization: org,
    intelligence,
    decisionMakers,
    suggestions: {
      policyPositions: org.policyPositions,
      recentNews: intelligence.slice(0, 3)
    }
  };
}
```

## Advanced Usage

For more control, use the **Query Layer** directly:

```typescript
import {
  findOrganizationByName,
  queryIntelligence,
  upsertOrganization
} from '$lib/server/mongodb';

// Direct queries
const org = await findOrganizationByName('acme');

const intel = await queryIntelligence({
  category: 'news',
  topics: ['healthcare'],
  startDate: new Date('2026-01-01'),
  minRelevanceScore: 0.8,
  limit: 20
});
```

## Utilities

```typescript
import {
  normalizeName,
  generateQueryHash,
  createTTL,
  isExpired
} from '$lib/server/mongodb';

// Normalize names for consistent matching
const normalized = normalizeName('  ACME  Corporation  '); // => 'acme corporation'

// Generate cache keys
const hash = generateQueryHash({
  type: 'legislative',
  topic: 'healthcare'
}); // => 'a1b2c3...'

// Create expiration dates
const expiresAt = createTTL(7); // Expires in 7 days

// Check if expired
const expired = isExpired(someDate); // => boolean
```

## Error Handling

```typescript
import {
  OrganizationService,
  parseMongoError
} from '$lib/server/mongodb';

try {
  await OrganizationService.cacheOrganizationProfile({ ... });
} catch (error) {
  const message = parseMongoError(error);
  console.error('Failed to cache organization:', message);
  // Show user-friendly error
}
```

## TypeScript Types

```typescript
import type {
  OrganizationDocument,
  IntelligenceItemDocument,
  DecisionMakerDocument,
  IntelligenceCategory,
  TargetType
} from '$lib/server/mongodb';

// Use types for type safety
const org: OrganizationDocument = { ... };
const category: IntelligenceCategory = 'news';
```

## Import Cheat Sheet

```typescript
// ✅ Recommended: Use service layer
import MongoDBService from '$lib/server/mongodb';
import { OrganizationService } from '$lib/server/mongodb';

// ✅ For specific queries
import { queryIntelligence, findOrganizationByName } from '$lib/server/mongodb';

// ✅ For utilities
import { normalizeName, createTTL } from '$lib/server/mongodb';

// ✅ For types
import type { OrganizationDocument } from '$lib/server/mongodb';

// ❌ Avoid: Direct collection access (unless you need it)
import { getOrganizationsCollection } from '$lib/server/mongodb/collections';
```

## Next Steps

1. Configure MongoDB Atlas (see `MONGODB_SETUP.md`)
2. Run `npx tsx scripts/init-mongodb.ts` to initialize
3. Start using the service layer in your code
4. Add Voyage AI embeddings for vector search
5. Create vector search indexes in Atlas UI

## Documentation

- **Detailed API**: `src/lib/server/mongodb/README.md`
- **Setup Guide**: `MONGODB_SETUP.md`
- **Examples**: `src/lib/server/mongodb/examples.ts`
- **Implementation**: `src/lib/server/mongodb/IMPLEMENTATION_SUMMARY.md`
