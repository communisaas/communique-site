# Voyage AI Embeddings Module

Production-ready client for Voyage AI embeddings and reranking, optimized for semantic search in Communique.

## Quick Start

```typescript
import { createEmbedding, rerankDocuments } from '$lib/server/embeddings';

// Generate an embedding
const [embedding] = await createEmbedding('Climate change policy');
// → [0.123, -0.456, ...] (1024 dimensions)

// Batch embeddings (more efficient)
const embeddings = await createBatchEmbeddings([
	'Text 1',
	'Text 2',
	'Text 3'
]);

// Rerank search results
const results = await rerankDocuments(
	'renewable energy',
	['Solar power', 'Wind turbines', 'Fossil fuels'],
	{ topK: 2 }
);
```

## API Reference

### Embedding Generation

#### `createEmbedding(input, options?)`

Generate embeddings for one or more texts.

**Parameters:**

- `input: string | string[]` - Text(s) to embed
- `options.model?: 'voyage-3' | 'voyage-3-lite'` - Model (default: voyage-3)
- `options.inputType?: 'document' | 'query'` - Input type (default: document)

**Returns:** `Promise<number[][]>` - Array of embedding vectors

**Example:**

```typescript
// Single text
const [embedding] = await createEmbedding('Hello world');

// Multiple texts (batch)
const embeddings = await createEmbedding(['Text 1', 'Text 2']);

// Query optimization
const [queryEmbedding] = await createEmbedding('search query', {
	inputType: 'query'
});
```

---

#### `createBatchEmbeddings(texts, options?)`

Generate embeddings for large batches with automatic chunking.

**Parameters:**

- `texts: string[]` - Array of texts
- `options.model?: VoyageModel` - Default: voyage-3
- `options.inputType?: VoyageInputType` - Default: document
- `options.batchSize?: number` - Batch size (default: 64, max: 128)
- `options.showProgress?: boolean` - Show progress logs (default: false)

**Returns:** `Promise<number[][]>` - Embeddings in same order as input

**Example:**

```typescript
const texts = await loadDocuments(); // 500 documents

const embeddings = await createBatchEmbeddings(texts, {
	model: 'voyage-3',
	batchSize: 64,
	showProgress: true
});

// Save embeddings
texts.forEach((text, i) => {
	saveDocument({
		text,
		embedding: embeddings[i]
	});
});
```

---

### Reranking

#### `rerankDocuments(query, documents, options?)`

Rerank documents by relevance using cross-encoder model.

**Parameters:**

- `query: string` - Search query
- `documents: string[]` - Documents to rerank
- `options.model?: 'rerank-2' | 'rerank-lite-1'` - Default: rerank-2
- `options.topK?: number` - Number to return (default: 10)
- `options.returnDocuments?: boolean` - Include docs in response (default: false)

**Returns:** `Promise<RerankResult[]>` - Reranked results sorted by score

**Example:**

```typescript
const results = await rerankDocuments(
	'climate change legislation',
	vectorSearchResults.map((r) => r.snippet),
	{ topK: 5 }
);

// Results sorted by relevance
results.forEach((r) => {
	console.log(`Score: ${r.relevanceScore}, Index: ${r.index}`);
});
```

---

### Utilities

#### `cosineSimilarity(a, b)`

Calculate cosine similarity between two embeddings.

**Returns:** `number` - Similarity score (0-1, higher = more similar)

**Example:**

```typescript
const similarity = cosineSimilarity(embedding1, embedding2);
console.log(`Similarity: ${similarity.toFixed(4)}`); // 0.8532
```

---

#### `estimateTokenCount(text)`

Rough token count estimation for cost calculation.

**Returns:** `number` - Approximate tokens

**Example:**

```typescript
const tokens = estimateTokenCount(myText);
console.log(`Estimated tokens: ${tokens}`);
```

---

#### `estimateEmbeddingCost(texts, model?)`

Estimate cost for batch embedding.

**Returns:** `number` - Estimated cost in USD

**Example:**

```typescript
const texts = await loadDocuments();
const cost = estimateEmbeddingCost(texts, 'voyage-3');
console.log(`Estimated cost: $${cost.toFixed(4)}`);

if (cost > 1.0) {
	console.warn('High cost - consider batching or using voyage-3-lite');
}
```

---

#### `costTracker`

Global cost tracking object.

**Methods:**

- `getStats()` - Get session statistics
- `reset()` - Reset counters

**Example:**

```typescript
import { costTracker } from '$lib/server/embeddings';

// After operations
const stats = costTracker.getStats();
console.log(`Total tokens: ${stats.totalTokens}`);
console.log(`Estimated cost: $${stats.estimatedCost}`);

// Reset for new session
costTracker.reset();
```

---

#### `voyageHealthCheck()`

Test Voyage AI API connectivity.

**Returns:** `Promise<boolean>` - true if healthy

**Example:**

```typescript
const isHealthy = await voyageHealthCheck();
if (!isHealthy) {
	throw new Error('Voyage AI service unavailable');
}
```

---

## Models

### Embedding Models

| Model           | Dimensions | Price/1M Tokens | Use Case               |
| --------------- | ---------- | --------------- | ---------------------- |
| `voyage-3`      | 1024       | $0.06           | Best quality (default) |
| `voyage-3-lite` | 512        | $0.02           | High throughput        |

### Reranking Models

| Model           | Price/1M Tokens | Use Case      |
| --------------- | --------------- | ------------- |
| `rerank-2`      | $0.05           | Best quality  |
| `rerank-lite-1` | $0.01           | High speed    |

---

## Best Practices

### 1. Use Input Types Correctly

```typescript
// ✅ Document for indexing
const [docEmbedding] = await createEmbedding(documentText, {
	inputType: 'document'
});

// ✅ Query for searching
const [queryEmbedding] = await createEmbedding(searchQuery, {
	inputType: 'query'
});
```

### 2. Batch When Possible

```typescript
// ❌ Bad: Sequential
const embeddings = await Promise.all(
	texts.map((t) => createEmbedding(t))
);

// ✅ Good: Batched
const embeddings = await createBatchEmbeddings(texts, {
	batchSize: 64
});
```

### 3. Choose Model Based on Need

```typescript
// ✅ High-quality search
const [embedding] = await createEmbedding(text, {
	model: 'voyage-3'
});

// ✅ High-volume, cost-sensitive
const [embedding] = await createEmbedding(text, {
	model: 'voyage-3-lite'
});
```

### 4. Cache Embeddings

```typescript
// ✅ Good: Save with metadata
await db.collection('documents').insertOne({
	text,
	embedding,
	embeddingModel: 'voyage-3',
	embeddingGeneratedAt: new Date()
});

// ❌ Bad: Re-generate on every request
const [embedding] = await createEmbedding(text); // Wasteful
```

### 5. Handle Errors Gracefully

```typescript
// ✅ Good: Fallback strategy
try {
	const [embedding] = await createEmbedding(text);
	return embedding;
} catch (error) {
	console.error('Embedding failed:', error);
	// Fallback to keyword search or cached embedding
	return await getFallbackStrategy(text);
}
```

---

## Error Handling

### Rate Limiting

The client automatically retries with exponential backoff:

```typescript
// Automatically handles 429 responses
const embeddings = await createBatchEmbeddings(manyTexts);
// Retries up to 3 times with delays: 1s, 2s, 4s
```

### API Key Missing

```typescript
// Throws clear error if VOYAGE_API_KEY not set
try {
	await createEmbedding('test');
} catch (error) {
	// Error: VOYAGE_API_KEY environment variable is not set.
	// Get your API key at https://dash.voyageai.com/
}
```

### Dimension Mismatch

```typescript
// Throws if embeddings have different dimensions
const sim = cosineSimilarity(embedding1, embedding2);
// Error: Embedding dimension mismatch: 1024 vs 512
```

---

## Cost Optimization

### Strategy 1: Use Lite Model for Queries

```typescript
// Documents: High quality
const [docEmbedding] = await createEmbedding(document, {
	model: 'voyage-3' // $0.06/1M
});

// Queries: Lower cost
const [queryEmbedding] = await createEmbedding(query, {
	model: 'voyage-3-lite' // $0.02/1M (3x cheaper)
});
```

### Strategy 2: Batch Operations

```typescript
// Cost: 500 API calls
for (const text of texts) {
	await createEmbedding(text);
}

// Cost: ~8 API calls (batches of 64)
await createBatchEmbeddings(texts, { batchSize: 64 });
```

### Strategy 3: Selective Reranking

```typescript
// Only rerank when precision critical
if (isPrecisionCritical) {
	results = await rerankDocuments(query, docs, { topK: 5 });
} else {
	// Use vector search alone (no reranking cost)
	results = vectorSearchResults;
}
```

---

## Environment Variables

```bash
# Required
VOYAGE_API_KEY=your-api-key-here

# Get your key at: https://dash.voyageai.com/
```

---

## Related Documentation

- [Vector Search Guide](../../../../docs/VECTOR_SEARCH_GUIDE.md)
- [Intelligence Service Layer](../intelligence/README.md)
- [Voyage AI Official Docs](https://docs.voyageai.com/)
