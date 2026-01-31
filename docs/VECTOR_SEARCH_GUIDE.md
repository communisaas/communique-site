# Vector Search Implementation Guide

> **Implementation Status:** ✅ Complete (2026-01-31)
>
> **Author:** Distinguished Data Engineering Team
>
> **Technologies:** MongoDB Atlas Vector Search + Voyage AI Embeddings

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Usage Examples](#usage-examples)
5. [Cost Analysis](#cost-analysis)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Communique's vector search system enables semantic search across intelligence items (news, legislation) and organization profiles. Unlike traditional keyword search, semantic search understands meaning and context.

### What You Can Do

- **Find similar content**: "Show me news articles similar to this legislative update"
- **Search by meaning**: "renewable energy tax incentives" matches "clean power subsidies"
- **Discover organizations**: "nonprofits advocating for climate action"
- **Cluster similar entities**: Group organizations by policy positions
- **Hybrid search**: Combine semantic and keyword matching for best results

### Key Features

- **1024-dimensional embeddings** via Voyage AI (voyage-3 model)
- **Cosine similarity** search in MongoDB Atlas
- **Pre-filtering** by category, topics, dates, industry
- **Reranking** for improved precision
- **Hybrid search** combining vector + full-text
- **Automatic batching** for efficient bulk operations
- **Cost tracking** and estimation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Query                               │
│                   "climate change policy"                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Voyage AI Embeddings                          │
│               voyage-3 model (1024 dimensions)                   │
│                   Cost: $0.06 per 1M tokens                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ Query Vector [0.123, -0.456, ...]
┌─────────────────────────────────────────────────────────────────┐
│              MongoDB Atlas Vector Search                         │
│                                                                  │
│  ┌──────────────────────┐       ┌──────────────────────┐        │
│  │  Intelligence Index  │       │  Organization Index  │        │
│  │  • 1024 dimensions   │       │  • 1024 dimensions   │        │
│  │  • Cosine similarity │       │  • Cosine similarity │        │
│  │  • Category filter   │       │  • Industry filter   │        │
│  │  • Topic filter      │       │  • Source filter     │        │
│  └──────────────────────┘       └──────────────────────┘        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Vector Search Results                        │
│  Ranked by similarity (0-1 score, higher = more similar)         │
│                                                                  │
│  1. "New climate legislation passes Senate" (0.89)               │
│  2. "Environmental policy update: carbon pricing" (0.85)         │
│  3. "Green energy subsidies expanded" (0.82)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ (Optional)
┌─────────────────────────────────────────────────────────────────┐
│                   Voyage AI Reranking                            │
│        Improves precision using cross-encoder model              │
│                   Cost: $0.05 per 1M tokens                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Final Ranked Results                          │
│              Optimized for relevance and precision               │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/lib/server/
├── embeddings/
│   ├── types.ts                 # TypeScript definitions
│   ├── voyage-client.ts         # Voyage AI API client
│   └── index.ts                 # Public exports
├── mongodb/
│   ├── vector-search.ts         # Vector search queries
│   ├── semantic-service.ts      # High-level service API
│   ├── vector-indexes.json      # Index definitions
│   └── schema.ts                # MongoDB schemas (with embedding fields)
scripts/
├── setup-vector-indexes.ts      # Create indexes via Atlas API
└── generate-embeddings.ts       # Backfill embeddings for existing data
```

---

## Setup Instructions

### 1. Prerequisites

- **MongoDB Atlas M10+ cluster** (vector search not available on free tier)
- **Voyage AI API key** from [dash.voyageai.com](https://dash.voyageai.com/)
- **Atlas Admin API credentials** (for automated setup) or Atlas UI access

### 2. Environment Variables

Add to your `.env`:

```bash
# Voyage AI Embeddings
VOYAGE_API_KEY=your-voyage-api-key-here

# MongoDB Atlas Admin API (optional, for automated setup)
MONGODB_ATLAS_PUBLIC_KEY=your-public-key
MONGODB_ATLAS_PRIVATE_KEY=your-private-key
MONGODB_ATLAS_PROJECT_ID=your-project-id
MONGODB_ATLAS_CLUSTER_NAME=Cluster0
MONGODB_ATLAS_DATABASE=communique
```

### 3. Create Vector Search Indexes

#### Option A: Automated Setup (Recommended)

```bash
# Install dependencies
pnpm install

# Create indexes via Atlas API
pnpm tsx scripts/setup-vector-indexes.ts

# Wait 2-5 minutes for indexes to build
```

#### Option B: Manual Setup via Atlas UI

1. Go to [MongoDB Atlas Console](https://cloud.mongodb.com/)
2. Navigate to: **Database → Search → Create Search Index**
3. Select **JSON Editor**
4. Copy index definitions from `src/lib/server/mongodb/vector-indexes.json`
5. Create three indexes:
   - `intelligence_vector_index` (on `intelligence` collection)
   - `organization_vector_index` (on `organizations` collection)
   - `intelligence_text_index` (for hybrid search)

### 4. Generate Embeddings for Existing Data

If you have existing intelligence items or organizations without embeddings:

```bash
# Estimate cost first (dry run)
pnpm tsx scripts/generate-embeddings.ts --all --dry-run

# Generate embeddings for intelligence items
pnpm tsx scripts/generate-embeddings.ts --collection intelligence

# Generate embeddings for organizations
pnpm tsx scripts/generate-embeddings.ts --collection organizations

# Or both at once
pnpm tsx scripts/generate-embeddings.ts --all
```

### 5. Verify Setup

```typescript
import { SemanticSearchService } from '$lib/server/mongodb/semantic-service';

// Health check
const health = await SemanticSearchService.healthCheck();
console.log(health);
// {
//   voyageAI: true,
//   intelligenceIndex: true,
//   organizationIndex: true
// }
```

---

## Usage Examples

### Intelligence Search

#### Basic Semantic Search

```typescript
import { SemanticIntelligenceService } from '$lib/server/mongodb/semantic-service';

// Search by natural language query
const results = await SemanticIntelligenceService.search(
	'renewable energy legislation',
	{
		categories: ['legislative'],
		limit: 10,
		minScore: 0.7
	}
);

results.forEach((r) => {
	console.log(`${r.document.title} (${r.score.toFixed(2)})`);
});
```

#### Search with Reranking (Best Precision)

```typescript
// First gets 20 candidates via vector search, then reranks top 5
const results = await SemanticIntelligenceService.searchWithReranking(
	'climate change mitigation strategies',
	{
		categories: ['news', 'legislative'],
		limit: 20, // Fetch more candidates
		rerankTopK: 5 // Return top 5 after reranking
	}
);
```

#### Hybrid Search (Best Recall)

```typescript
// Combines vector search + full-text search using RRF
const results = await SemanticIntelligenceService.hybridSearch(
	'H.R. 842 renewable energy tax credits',
	{
		categories: ['legislative'],
		publishedAfter: new Date('2025-01-01'),
		limit: 10
	}
);
```

#### Find Similar Content

```typescript
// Find articles similar to a specific item
const similar = await SemanticIntelligenceService.findSimilar(
	articleId, // ObjectId or string
	{
		limit: 5,
		minScore: 0.8
	}
);
```

#### Search by Embedding

```typescript
import { createEmbedding } from '$lib/server/embeddings';

// Generate embedding from template text
const [templateEmbedding] = await createEmbedding(
	templateTitle + ' ' + templateMessage
);

// Find relevant intelligence
const relevant = await SemanticIntelligenceService.findByEmbedding(
	templateEmbedding,
	{
		categories: ['news'],
		limit: 5,
		minScore: 0.75
	}
);
```

### Organization Search

#### Search by Description

```typescript
import { SemanticOrganizationService } from '$lib/server/mongodb/semantic-service';

const results = await SemanticOrganizationService.search(
	'healthcare nonprofits focused on rural access',
	{
		industry: 'healthcare',
		limit: 5
	}
);
```

#### Find Similar Organizations

```typescript
// Find organizations similar to ACLU
const similar = await SemanticOrganizationService.findSimilar(
	'aclu', // organization _id
	{
		limit: 5,
		sameIndustryOnly: false,
		minScore: 0.8
	}
);
```

#### Find by Policy Position

```typescript
const orgs = await SemanticOrganizationService.findByPolicyPosition(
	'supporting universal healthcare and reducing prescription drug costs',
	{
		limit: 10
	}
);
```

#### Cluster Organizations

```typescript
// Group organizations by semantic similarity
const clusters = await SemanticOrganizationService.clusterBySimilarity({
	industry: 'nonprofit',
	minClusterSize: 3,
	similarityThreshold: 0.8
});

clusters.forEach((cluster) => {
	console.log(`Cluster: ${cluster.representative.name}`);
	console.log(`Members: ${cluster.members.length}`);
});
```

### Direct API Usage

#### Generate Embeddings

```typescript
import { createEmbedding, createBatchEmbeddings } from '$lib/server/embeddings';

// Single embedding
const [embedding] = await createEmbedding('Climate change policy', {
	model: 'voyage-3',
	inputType: 'document'
});

// Batch embeddings (efficient for multiple texts)
const texts = ['Text 1', 'Text 2', 'Text 3'];
const embeddings = await createBatchEmbeddings(texts, {
	model: 'voyage-3',
	batchSize: 64,
	showProgress: true
});
```

#### Rerank Results

```typescript
import { rerankDocuments } from '$lib/server/embeddings';

const documents = [
	'Document about renewable energy',
	'Article on fossil fuels',
	'Climate policy update'
];

const results = await rerankDocuments('clean energy transition', documents, {
	topK: 3,
	returnDocuments: true
});

results.forEach((r) => {
	console.log(`Score: ${r.relevanceScore}, Doc: ${documents[r.index]}`);
});
```

---

## Cost Analysis

### Voyage AI Pricing (as of 2026-01)

| Model         | Price per 1M Tokens | Use Case               |
| ------------- | ------------------- | ---------------------- |
| voyage-3      | $0.06               | Best quality (default) |
| voyage-3-lite | $0.02               | High throughput        |
| rerank-2      | $0.05               | Precision improvement  |

### Estimated Costs

**Scenario 1: 1,000 templates/month**

- Intelligence embeddings: 500 items × 200 tokens = 100K tokens
- Organization embeddings: 100 orgs × 500 tokens = 50K tokens
- Search queries: 2,000 queries × 20 tokens = 40K tokens
- **Total: 190K tokens × $0.06 = $0.011/month**

**Scenario 2: 10,000 templates/month**

- Intelligence: 5,000 items × 200 tokens = 1M tokens = $0.06
- Organizations: 500 orgs × 500 tokens = 250K tokens = $0.015
- Queries: 20,000 × 20 tokens = 400K tokens = $0.024
- Reranking: 5,000 rerankings × 2,000 tokens = 10M tokens = $0.50
- **Total: ~$0.60/month**

### Cost Optimization Tips

1. **Use voyage-3-lite for queries** (3x cheaper, minimal quality loss)
2. **Cache embeddings** (never re-embed same text)
3. **Batch operations** (reduces API overhead)
4. **Pre-filter before search** (reduces candidates examined)
5. **Rerank selectively** (only when precision critical)

```typescript
// Example: Cost-optimized search
const results = await semanticSearchIntelligence(
	query,
	{
		categories: ['legislative'], // Pre-filter
		publishedAfter: new Date('2025-01-01'),
		limit: 10
	},
	{
		numCandidates: 50 // Lower than default 100
	}
);
```

---

## Best Practices

### 1. Choosing Between Search Methods

| Method            | When to Use                              | Pros                         | Cons                    |
| ----------------- | ---------------------------------------- | ---------------------------- | ----------------------- |
| **Semantic**      | Conceptual queries ("climate action")    | Understands meaning          | May miss exact keywords |
| **Hybrid**        | Mixed queries ("H.R. 842 climate")       | Best of both worlds          | Slower, more complex    |
| **With Reranking** | When precision critical                 | Highest accuracy             | More expensive          |
| **By Embedding**  | Already have template/message embedding  | No redundant API calls       | Requires pre-computed   |

### 2. Embedding Generation

```typescript
// ✅ Good: Generate embeddings when saving documents
async function saveIntelligenceItem(item: IntelligenceItem) {
	const textToEmbed = `${item.title}. ${item.snippet}`;
	const [embedding] = await createEmbedding(textToEmbed, {
		inputType: 'document'
	});

	await db.collection('intelligence').insertOne({
		...item,
		embedding,
		embeddingModel: 'voyage-3',
		embeddingGeneratedAt: new Date()
	});
}

// ❌ Bad: Embedding without metadata
await db.collection('intelligence').insertOne({
	...item,
	embedding // No model version or timestamp
});
```

### 3. Query Optimization

```typescript
// ✅ Good: Use filters to reduce search space
const results = await semanticSearchIntelligence(
	query,
	{
		categories: ['legislative'], // Filter first
		publishedAfter: lastWeek,
		minRelevanceScore: 0.5
	},
	{
		numCandidates: 100,
		limit: 10
	}
);

// ❌ Bad: No filtering (searches all documents)
const results = await semanticSearchIntelligence(query, {}, { limit: 10 });
```

### 4. Batch Processing

```typescript
// ✅ Good: Batch embeddings for efficiency
const embeddings = await createBatchEmbeddings(texts, {
	batchSize: 64,
	showProgress: true
});

// ❌ Bad: Sequential API calls
const embeddings = await Promise.all(
	texts.map((text) => createEmbedding(text))
);
```

### 5. Error Handling

```typescript
// ✅ Good: Graceful degradation
try {
	const results = await SemanticIntelligenceService.search(query, filters);
	return results;
} catch (error) {
	console.error('Vector search failed, falling back to text search:', error);
	// Fall back to traditional full-text search
	return await textSearchFallback(query, filters);
}
```

---

## Troubleshooting

### Index Not Found

**Error:** `MongoServerError: Search index not found`

**Solution:**

1. Verify indexes exist in Atlas UI (Database → Search)
2. Wait 2-5 minutes after creation for indexes to build
3. Check index names match exactly:
   - `intelligence_vector_index`
   - `organization_vector_index`

### Dimension Mismatch

**Error:** `Vector dimensions don't match index`

**Solution:**

- Ensure all embeddings use same model (voyage-3 = 1024 dimensions)
- Check `embeddingModel` field in documents
- Regenerate embeddings if model changed

### No Results Returned

**Symptoms:** Search returns empty array even with valid data

**Debug Steps:**

```typescript
// 1. Check if documents have embeddings
const sample = await db.collection('intelligence').findOne({
	embedding: { $exists: true }
});
console.log('Sample embedding length:', sample?.embedding?.length);

// 2. Verify index health
const health = await SemanticSearchService.healthCheck();
console.log(health);

// 3. Lower similarity threshold
const results = await semanticSearchIntelligence(query, filters, {
	minScore: 0.0 // Accept any similarity
});
```

### Voyage AI Rate Limiting

**Error:** `Rate limited after 3 retries`

**Solution:**

1. Reduce batch size: `{ batchSize: 32 }`
2. Add delays between batches
3. Upgrade Voyage AI plan if hitting limits frequently

### High Costs

**Symptoms:** Unexpected Voyage AI charges

**Debug:**

```typescript
import { costTracker } from '$lib/server/embeddings';

// Check current session costs
console.log(costTracker.getStats());
// {
//   totalTokens: 150000,
//   embeddingCalls: 50,
//   rerankCalls: 10,
//   estimatedCost: 0.009
// }

// Reset tracker
costTracker.reset();
```

**Prevention:**

- Check embeddings exist before regenerating
- Use `estimateEmbeddingCost()` before batch operations
- Monitor with `--dry-run` flag in scripts

---

## Additional Resources

- [Voyage AI Documentation](https://docs.voyageai.com/)
- [MongoDB Vector Search Guide](https://www.mongodb.com/docs/atlas/atlas-vector-search/)
- [Implementation Plan](./FIRECRAWL_MONGODB_IMPLEMENTATION_PLAN.md#4-feature-3-semantic-capabilities-mongodb--voyage-ai)

---

## Support

For issues or questions:

1. Check this guide's troubleshooting section
2. Review implementation plan: `docs/FIRECRAWL_MONGODB_IMPLEMENTATION_PLAN.md`
3. Examine example queries: `src/lib/server/mongodb/examples.ts`
4. Test vector search: `pnpm tsx scripts/test-vector-search.ts`
