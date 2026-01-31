# MongoDB Integration Layer

This directory contains the MongoDB Atlas integration for Communique, providing caching and vector search capabilities.

## Overview

The MongoDB layer provides:

1. **Organization Profile Caching** - Stores enriched organization profiles from Firecrawl
2. **Intelligence Storage** - News, legislative activity, and other intelligence items
3. **Decision Maker Caching** - Optimized lookups for decision makers
4. **Vector Search** - Semantic search using Voyage AI embeddings (1024 dimensions)

## Architecture

```
mongodb/
├── schema.ts          # TypeScript interfaces for all collections
├── collections.ts     # Type-safe collection accessors
├── indexes.ts         # Index management and TTL setup
└── README.md         # This file

mongodb.ts            # Client singleton with connection pooling
```

## Connection

**Connection String:**
```
mongodb+srv://communique:***REMOVED***@cluster0.udtiui.mongodb.net/?appName=Cluster0
```

**Database:** `communique`

The client uses a singleton pattern with:
- Connection pooling (2-10 connections)
- HMR-safe development mode (preserves connection across Vite reloads)
- Automatic reconnection handling
- Graceful shutdown support

## Collections

### 1. Organizations (`organizations`)

Stores cached organization profiles from Firecrawl with leadership and policy positions.

**Key Fields:**
- `normalizedName` - Lowercase name for matching (unique index)
- `leadership[]` - Array of leaders with verification status
- `policyPositions[]` - Tracked policy stances
- `embedding` - 1024-dim Voyage AI vector for semantic search
- `expiresAt` - TTL for automatic cache expiration

**Indexes:**
- TTL on `expiresAt`
- Unique on `normalizedName`
- Text search on name, about, leadership
- Compound on source and date
- Vector search (configure via Atlas UI)

### 2. Intelligence (`intelligence`)

Stores news articles, legislative activity, and other intelligence items.

**Key Fields:**
- `category` - Type of intelligence (news, legislative, regulatory, etc.)
- `topics[]` - Categorization tags
- `entities[]` - Named entities from NER
- `embedding` - 1024-dim Voyage AI vector
- `relevanceScore` - Importance ranking (0-1)
- `expiresAt` - TTL for automatic cleanup

**Indexes:**
- TTL on `expiresAt`
- Compound on category, relevance, date
- Array indexes on topics and entities
- Text search on title, snippet, source
- Vector search (configure via Atlas UI)

### 3. Decision Maker Cache (`decision_maker_cache`)

Stores cached decision maker lookups for performance.

**Key Fields:**
- `queryHash` - Hash of query params (unique)
- `decisionMakers[]` - Cached results
- `hitCount` - Usage tracking
- `expiresAt` - TTL for cache expiration

**Indexes:**
- TTL on `expiresAt`
- Unique on `queryHash`
- Compound on targetType, targetEntity, topics
- Performance indexes on hitCount and lastHitAt

## Usage

### Basic Connection

```typescript
import { getDatabase, getMongoClient } from '$lib/server/mongodb';

// Get database instance
const db = await getDatabase();

// Get client (for advanced operations)
const client = await getMongoClient();
```

### Collection Access

```typescript
import {
	getOrganizationsCollection,
	getIntelligenceCollection,
	getDecisionMakerCacheCollection
} from '$lib/server/mongodb/collections';

// Type-safe collection access
const orgs = await getOrganizationsCollection();
const org = await orgs.findOne({ normalizedName: 'acme corp' });

const intel = await getIntelligenceCollection();
const items = await intel
	.find({ category: 'legislative' })
	.sort({ publishedAt: -1 })
	.limit(10)
	.toArray();
```

### Index Setup

```typescript
import { ensureAllIndexes } from '$lib/server/mongodb/indexes';

// Call on server startup (e.g., in hooks.server.ts)
await ensureAllIndexes();
```

## Vector Search Setup

Vector search indexes must be created via MongoDB Atlas UI:

### Organizations Vector Index

1. Navigate to Atlas UI → Search → Create Index
2. Choose "JSON Editor"
3. Use index name: `vector_search_organizations`
4. Configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    }
  ]
}
```

### Intelligence Vector Index

1. Create index: `vector_search_intelligence`
2. Configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    }
  ]
}
```

## TTL (Time-To-Live) Indexes

All collections have TTL indexes on the `expiresAt` field. Documents are automatically deleted when:
- `expiresAt` date has passed
- TTL background task runs (every 60 seconds)

**Setting expiration:**

```typescript
const orgs = await getOrganizationsCollection();

// Expire in 7 days
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7);

await orgs.insertOne({
	// ... other fields
	expiresAt
});
```

## Best Practices

### 1. Use TTL for Cache Management

```typescript
// Cache organization for 30 days
const org: OrganizationDocument = {
	// ... fields
	expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
};
```

### 2. Normalize Names for Matching

```typescript
function normalizeName(name: string): string {
	return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

const normalizedName = normalizeName(userInput);
const org = await orgs.findOne({ normalizedName });
```

### 3. Use Projections for Performance

```typescript
// Only fetch needed fields
const org = await orgs.findOne(
	{ normalizedName: 'acme' },
	{ projection: { name: 1, website: 1, leadership: 1 } }
);
```

### 4. Batch Operations

```typescript
// Use bulk operations for efficiency
await orgs.bulkWrite([
	{ insertOne: { document: org1 } },
	{ updateOne: { filter: { _id: id }, update: { $set: { ... } } } }
]);
```

### 5. Handle Errors Gracefully

```typescript
try {
	const result = await orgs.findOne({ ... });
	if (!result) {
		// Handle not found
	}
} catch (error) {
	console.error('MongoDB error:', error);
	// Fallback logic
}
```

## Testing Connection

```typescript
import { testMongoConnection } from '$lib/server/mongodb';

const isConnected = await testMongoConnection();
if (!isConnected) {
	throw new Error('MongoDB connection failed');
}
```

## Environment Variables

Optional environment variable for connection override:

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=App
```

If not set, uses the default Atlas connection string.

## Monitoring

Key metrics to monitor:
- Connection pool utilization
- Query performance (via Atlas Performance Advisor)
- Index usage (via Atlas UI)
- Cache hit rates (via `hitCount` field)
- Storage size and growth rate

## Schema Evolution

When adding new fields:

1. Update interfaces in `schema.ts`
2. Add indexes if needed in `indexes.ts`
3. Consider migration script for existing documents
4. Test with optional fields (use `?:` in TypeScript)

## Production Checklist

- [ ] Vector search indexes created in Atlas UI
- [ ] TTL indexes verified (`ensureAllIndexes()` called)
- [ ] Connection pooling configured appropriately
- [ ] Monitoring alerts set up in Atlas
- [ ] Backup strategy configured
- [ ] Access controls reviewed
- [ ] Network security (IP whitelist) configured
