# Vector Search Quick Reference

One-page guide to get started with semantic search in Communique.

## Setup (5 minutes)

```bash
# 1. Add to .env
VOYAGE_API_KEY=your-key-from-https://dash.voyageai.com

# 2. Create vector indexes (requires Atlas M10+)
pnpm tsx scripts/setup-vector-indexes.ts

# 3. Wait 2-5 minutes for indexes to build

# 4. Generate embeddings for existing data
pnpm tsx scripts/generate-embeddings.ts --all

# 5. Test it works
pnpm tsx scripts/test-vector-search.ts
```

---

## Common Patterns

### 1. Search Intelligence Items

```typescript
import { SemanticIntelligenceService } from '$lib/server/mongodb/semantic-service';

const results = await SemanticIntelligenceService.search(
	'renewable energy tax credits',
	{
		categories: ['legislative'],
		publishedAfter: new Date('2025-01-01'),
		limit: 10
	}
);

results.forEach((r) => {
	console.log(`${r.document.title} (${r.score.toFixed(2)})`);
});
```

### 2. Search Organizations

```typescript
import { SemanticOrganizationService } from '$lib/server/mongodb/semantic-service';

const orgs = await SemanticOrganizationService.search(
	'climate advocacy nonprofits',
	{ industry: 'nonprofit', limit: 5 }
);
```

### 3. Find Similar Content

```typescript
// Similar to a specific article
const similar = await SemanticIntelligenceService.findSimilar(articleId, {
	limit: 5
});

// Similar organizations
const similarOrgs = await SemanticOrganizationService.findSimilar(orgId, {
	limit: 5,
	sameIndustryOnly: true
});
```

### 4. Search with Reranking (Best Precision)

```typescript
const results = await SemanticIntelligenceService.searchWithReranking(
	'climate legislation',
	{
		categories: ['legislative'],
		limit: 20, // Get more candidates
		rerankTopK: 5 // Return top 5 after reranking
	}
);
```

### 5. Hybrid Search (Best Recall)

```typescript
// Combines vector + full-text search
const results = await SemanticIntelligenceService.hybridSearch(
	'H.R. 842 renewable energy',
	{
		categories: ['legislative'],
		limit: 10
	}
);
```

### 6. Save Document with Embedding

```typescript
import { createEmbedding } from '$lib/server/embeddings';

async function saveIntelligenceWithEmbedding(item) {
	const [embedding] = await createEmbedding(`${item.title}. ${item.snippet}`, {
		inputType: 'document'
	});

	await db.collection('intelligence').insertOne({
		...item,
		embedding,
		embeddingModel: 'voyage-3',
		embeddingGeneratedAt: new Date()
	});
}
```

---

## When to Use What

| Use Case                            | Method                                          |
| ----------------------------------- | ----------------------------------------------- |
| Conceptual search                   | `SemanticIntelligenceService.search()`          |
| Mixed keywords + concepts           | `SemanticIntelligenceService.hybridSearch()`    |
| Maximum precision needed            | `SemanticIntelligenceService.searchWithReranking()` |
| "Related content" feature           | `findSimilar()`                                 |
| Find orgs by policy position        | `SemanticOrganizationService.findByPolicyPosition()` |
| Already have embedding              | `findByEmbedding()`                             |

---

## Cost Quick Reference

| Operation            | Model         | Cost/1M Tokens | Typical Use       |
| -------------------- | ------------- | -------------- | ----------------- |
| Generate embeddings  | voyage-3      | $0.06          | Documents (index) |
| Generate embeddings  | voyage-3-lite | $0.02          | Queries (search)  |
| Rerank results       | rerank-2      | $0.05          | Precision boost   |

**Typical Monthly Cost (10K templates):** ~$0.60

---

## Troubleshooting

### No Results

```typescript
// Lower the score threshold
const results = await service.search(query, {
	minScore: 0.0 // Accept any similarity
});
```

### Index Not Found

```bash
# Verify indexes exist
# Atlas Console → Database → Search

# Recreate if needed
pnpm tsx scripts/setup-vector-indexes.ts
```

### High Costs

```typescript
// Use lite model for queries
const [embedding] = await createEmbedding(query, {
	model: 'voyage-3-lite' // 3x cheaper
});

// Batch operations
const embeddings = await createBatchEmbeddings(texts, {
	batchSize: 64
});
```

---

## Full Documentation

- **Comprehensive Guide:** [docs/VECTOR_SEARCH_GUIDE.md](./docs/VECTOR_SEARCH_GUIDE.md)
- **API Reference:** [src/lib/server/embeddings/README.md](./src/lib/server/embeddings/README.md)
- **MongoDB Schema:** [src/lib/server/mongodb/schema.ts](./src/lib/server/mongodb/schema.ts)
