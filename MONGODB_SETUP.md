# MongoDB Atlas Setup Guide

## Current Status

The MongoDB integration layer has been implemented but requires Atlas configuration to be operational.

## What's Been Implemented

✅ **MongoDB Client** (`src/lib/server/mongodb.ts`)
- Connection pooling with singleton pattern
- HMR-safe development mode
- Graceful error handling

✅ **Schema Definitions** (`src/lib/server/mongodb/schema.ts`)
- OrganizationDocument - Cached org profiles
- IntelligenceItemDocument - News and legislative intel
- DecisionMakerCacheDocument - Decision maker lookups

✅ **Collection Accessors** (`src/lib/server/mongodb/collections.ts`)
- Type-safe collection access
- Automatic database connection

✅ **Index Management** (`src/lib/server/mongodb/indexes.ts`)
- TTL indexes for automatic expiration
- Text search indexes
- Compound indexes for performance
- Vector search index configuration

✅ **Query Builders** (`src/lib/server/mongodb/queries.ts`)
- Type-safe query functions
- Upsert operations
- Cache management
- Pagination helpers

✅ **Utilities** (`src/lib/server/mongodb/utils.ts`)
- Query hash generation
- Name normalization
- TTL helpers
- NoSQL injection protection

## What Needs to Be Done

### 1. MongoDB Atlas Configuration

#### A. Update Network Access
1. Log into [MongoDB Atlas](https://cloud.mongodb.com/)
2. Navigate to Network Access
3. Add current IP address or whitelist `0.0.0.0/0` (for development)
4. For production, whitelist only necessary IPs

#### B. Verify Database User
1. Navigate to Database Access
2. Create or verify user `communique` with appropriate credentials
3. Grant `readWrite` permissions on `communique` database
4. Store credentials securely in environment variables

#### C. Set Connection String
Set the `MONGODB_URI` environment variable with your connection string:
- Development: Add to `.env` file (not committed to git)
- Production: Set via Fly.io secrets or your hosting provider
- Or set `MONGODB_URI` environment variable

### 2. Create Vector Search Indexes

Once connected, create vector search indexes via Atlas UI:

#### Organizations Vector Index
1. Navigate to Atlas Search
2. Create new index: `vector_search_organizations`
3. Use JSON configuration:

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

#### Intelligence Vector Index
1. Create new index: `vector_search_intelligence`
2. Use JSON configuration:

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

### 3. Initialize Indexes

Once network access is configured, run:

```bash
npx tsx scripts/init-mongodb.ts
```

This will:
- Test the connection
- Create all necessary indexes
- Display collection statistics

### 4. Test the Integration

Run a simple test:

```typescript
import { testMongoConnection, getDatabase } from '$lib/server/mongodb';

const connected = await testMongoConnection();
if (connected) {
  const db = await getDatabase();
  console.log('Connected to database:', db.databaseName);
}
```

## Using the MongoDB Layer

### Basic Usage

```typescript
// Import from the main export
import {
  findOrganizationByName,
  upsertOrganization,
  queryIntelligence,
  createTTL
} from '$lib/server/mongodb';

// Find an organization
const org = await findOrganizationByName('ACME Corp');

// Cache a new organization
await upsertOrganization({
  name: 'New Org',
  normalizedName: 'new org',
  website: 'https://neworg.com',
  // ... other fields
  expiresAt: createTTL(30) // Expire in 30 days
});

// Query intelligence
const intel = await queryIntelligence({
  topics: ['healthcare'],
  category: 'news',
  limit: 10
});
```

### Integration Points

The MongoDB layer should be integrated at these points:

1. **Firecrawl Integration** - Cache organization profiles
2. **News API Integration** - Store intelligence items
3. **Decision Maker Lookup** - Cache search results
4. **Message Composition** - Retrieve context and suggestions

## File Structure

```
src/lib/server/
├── mongodb.ts                  # Client singleton
└── mongodb/
    ├── index.ts               # Main exports
    ├── schema.ts              # TypeScript interfaces
    ├── collections.ts         # Collection accessors
    ├── indexes.ts             # Index management
    ├── queries.ts             # Query builders
    ├── utils.ts               # Helper functions
    ├── examples.ts            # Usage examples
    └── README.md              # Detailed documentation

scripts/
└── init-mongodb.ts            # Initialization script
```

## Environment Variables

```bash
# Optional - defaults to hardcoded connection string
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=App
```

## Security Notes

⚠️ **Important**: The connection string with credentials is currently hardcoded for development. For production:

1. Move credentials to environment variables
2. Use MongoDB Atlas with proper network restrictions
3. Rotate credentials regularly
4. Enable audit logging in Atlas
5. Use VPC peering or private endpoints for production

## Next Steps

1. Configure MongoDB Atlas network access
2. Run initialization script
3. Create vector search indexes
4. Integrate with Firecrawl provider
5. Implement Voyage AI embedding generation
6. Test full workflow

## Support

For MongoDB-specific issues:
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Node.js Driver Docs](https://mongodb.github.io/node-mongodb-native/)

For integration questions, refer to:
- `src/lib/server/mongodb/README.md` - Detailed API docs
- `src/lib/server/mongodb/examples.ts` - Usage examples
