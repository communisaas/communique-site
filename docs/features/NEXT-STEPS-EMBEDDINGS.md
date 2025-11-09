# Next Steps: Embedding Generation (Migrating to Google Gemini)

**Status**: Database deployed ✅ | Seeded ✅ | **MIGRATION IN PROGRESS** 🔄

**Last Updated**: 2025-11-05
**Decision**: Migrate from OpenAI to Google Gemini embeddings

**See**: `docs/GOOGLE-GEMINI-EMBEDDING-INTEGRATION.md` for complete migration plan

---

## Quick Start (When Ready to Generate Embeddings)

### 1. Configure Google Gemini API Key

⚠️ **IMPORTANT**: We're migrating to Google Gemini for better performance and free tier.

Add to `.env` file:

```bash
# Google Gemini (NEW - for embeddings)
GEMINI_API_KEY=AIza-your-actual-api-key-here

# OpenAI (keep for agent moderation only)
OPENAI_API_KEY=sk-your-openai-key-here
```

**Where to get Gemini API key:**
1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy key (starts with `AIza...`)
4. Add to `.env` file

**FREE TIER**: Unlimited requests in Google AI Studio!

### 2. Run Embedding Generation Script

```bash
# Preview changes (no API calls, no cost)
npx tsx scripts/generate-template-embeddings.ts --dry-run

# Generate embeddings for all 16 templates
npx tsx scripts/generate-template-embeddings.ts

# Force regenerate existing embeddings
npx tsx scripts/generate-template-embeddings.ts --force

# Generate for single template
npx tsx scripts/generate-template-embeddings.ts --template-id <template-id>
```

### 3. Expected Output

```
════════════════════════════════════════════════════════════════
  Generate OpenAI Embeddings for Templates
════════════════════════════════════════════════════════════════

Found 16 template(s) to process

📍 35% Offices Empty, Only 1 Building Converting
   Slug: 35-offices-empty-only-1-building-converting
   Jurisdictions: 1
   Location context: 245 tokens (est.)
   Topic context: 812 tokens (est.)
   Generating location embedding...
   Generating topic embedding...
   ✅ Embeddings generated and stored

... (15 more templates)

════════════════════════════════════════════════════════════════
  Summary
════════════════════════════════════════════════════════════════

Templates processed:          16
Location embeddings generated: 16
Topic embeddings generated:    16
Templates skipped:            0
Errors:                       0
Total tokens (estimated):     25,600
Total cost (estimated):       $0.0033

✅ Embedding generation complete!
```

### 4. Verify Embeddings Were Stored

```bash
npx tsx scripts/verify-migration.ts
```

Expected output should show:
```
✅ Templates with embeddings: 16 (was 0 initially)
```

---

## Cost Breakdown (Updated for Google Gemini)

**Model**: `gemini-embedding-001` (768 dimensions recommended)
**Pricing**: $0.15 per 1M tokens (or **FREE** in Google AI Studio)

**Estimated for 16 templates:**
- Average template: ~800 tokens (title + description + body)
- 2 embeddings per template (location + topic)
- Total: 16 templates × 2 embeddings × 800 tokens = 25,600 tokens
- **Cost: $0.00** (FREE tier) or **$0.004** (paid tier)

**Scaling estimates:**
- 100 templates: $0.021
- 1,000 templates: $0.208
- 10,000 templates: $2.08

**Monthly recurring costs (with caching):**
- 10k daily users × 1 search/day × 100 templates = 1M searches/month
- With 1-week cache: 1M / 7 = 142k API calls
- 142k × 800 tokens = 113M tokens
- **Cost: ~$14.69/month** (with caching)

---

## What the Script Does

### 1. Location Embedding Generation

Generates semantic vector from geographic targeting:

```typescript
// Example location context:
"Geographic targeting: City: San Francisco, CA. Issue: 35% Offices Empty, Only 1 Building Converting"
```

**Use case**: Find templates relevant to user's location (congressional district, city, state)

### 2. Topic Embedding Generation

Generates semantic vector from content:

```typescript
// Example topic context:
"Title: 35% Offices Empty, Only 1 Building Converting

Category: Housing

Description: San Francisco's downtown office vacancy crisis...

Content: San Francisco's commercial real estate collapse threatens..."
```

**Use case**: Find templates matching user's interests and search queries

### 3. Database Update

Stores both embeddings in Prisma:

```typescript
await prisma.template.update({
  where: { id: template.id },
  data: {
    location_embedding: [0.123, -0.456, ...], // 3072 dimensions
    topic_embedding: [0.789, -0.234, ...],    // 3072 dimensions
    embedding_version: 'v1',
    embeddings_updated_at: new Date()
  }
});
```

---

## How Semantic Search Works (After Embeddings Generated)

### Client-Side Search Flow

```typescript
import { searchTemplates } from '$lib/core/search';

// 1. User types search query
const results = await searchTemplates({
  query: "housing crisis downtown",
  userLocation: {
    congressionalDistrict: "CA-11",
    city: "San Francisco",
    state: "CA"
  },
  limit: 10
});

// 2. Generate query embedding (client-side, < 100ms)
const queryEmbedding = await generateEmbedding(query);

// 3. Calculate cosine similarity with all templates (< 50ms for 1000 templates)
const similarities = templates.map(t =>
  cosineSimilarity(queryEmbedding, t.topic_embedding)
);

// 4. Apply contextual boosting (< 50ms)
const boostedScores = similarities.map((score, i) => {
  const template = templates[i];
  return score * calculateBoostingFactors({
    geographic: isLocalTemplate(template, userLocation) ? 2.0 : 1.0,
    temporal: recentlyPopular(template) ? 1.5 : 1.0,
    network: networkEffects(template) ? 3.0 : 1.0,
    impact: highQualityTemplate(template) ? 2.0 : 1.0
  });
});

// 5. Return top results (< 300ms total)
return sortByScore(boostedScores).slice(0, limit);
```

### Performance Targets

- ✅ **Query embedding**: < 100ms (OpenAI API)
- ✅ **Similarity calculation**: < 50ms (client-side, 1000 templates)
- ✅ **Contextual boosting**: < 50ms (client-side)
- ✅ **Total search time**: < 300ms (including API call)

### Caching Strategy

**IndexedDB cache** (1-week expiry):
- Template embeddings cached after first fetch
- Query embeddings cached per unique query
- Reduces API calls by ~85%

---

## Alternative: Skip Embeddings for Now

If you want to defer embedding generation, you can proceed with **Phase 2.5-2.7: Template Creator Integration** instead:

### Phase 2.5-2.7 Tasks (5-8 hours)

1. **Integrate JurisdictionPicker into TemplateCreator form** (2-3 hours)
   - Add jurisdiction picker to step 2 (audience selection)
   - Wire up form state management
   - Add validation for minimum 1 jurisdiction

2. **Update template creation API endpoint** (2-3 hours)
   - Modify `src/routes/api/templates/+server.ts`
   - Create TemplateJurisdiction records on template creation
   - Handle jurisdiction validation

3. **Create integration tests** (1-2 hours)
   - Test jurisdiction picker component
   - Test API endpoint with jurisdictions
   - Test end-to-end template creation flow

**Benefits of doing Phase 2.5-2.7 first:**
- No external API key required
- Enables full template creation workflow
- Can test jurisdiction filtering without embeddings
- Embedding generation can happen anytime later

---

## Files Created This Session

### Database Scripts
- ✅ `scripts/migrate-template-locations.ts` (286 lines) - Parse location strings → structured jurisdictions
- ✅ `scripts/verify-migration.ts` (55 lines) - Verify migration success
- ✅ `scripts/generate-template-embeddings.ts` (NEW, 339 lines) - Generate OpenAI embeddings

### Database Status
- ✅ Schema synchronized to Supabase (TemplateJurisdiction table added)
- ✅ 16 templates seeded
- ✅ 12 users seeded (8 verified, 4 unverified)
- ✅ 7 San Francisco jurisdictions created
- ⏸️ 0 templates with embeddings (pending OpenAI API key)

### Documentation
- ✅ `docs/DEPLOYMENT-COMPLETE-2025-11-04.md` (424 lines) - Complete deployment report
- ✅ `docs/NEXT-STEPS-EMBEDDINGS.md` (THIS FILE) - Embedding generation guide

---

## Decision Point: What's Next?

### Option A: Generate Embeddings (Recommended)
**Time**: 5 minutes
**Requirements**: OpenAI API key
**Cost**: ~$0.003
**Outcome**: Semantic search fully functional

### Option B: Phase 2.5-2.7 (Template Creator Integration)
**Time**: 5-8 hours
**Requirements**: None
**Cost**: $0
**Outcome**: Full template creation workflow with jurisdictions

### Option C: Phase 5 (Network Effects)
**Time**: 2-3 weeks
**Requirements**: Smart contract deployment
**Cost**: Gas fees
**Outcome**: On-chain adoption metrics, social proof

**Recommendation**: Do Option A first (5 minutes), then Option B (enables full workflow).

---

**Questions?**

If you hit any issues with embedding generation or have questions about the semantic search implementation, check:

- Phase 4 implementation: `docs/design/SEMANTIC-SEARCH-IMPLEMENTATION.md`
- Phase 4 summary: `docs/design/SEMANTIC-SEARCH-SUMMARY.md`
- OpenAI embeddings code: `src/lib/core/search/openai-embeddings.ts`
- Search integration: `src/lib/core/search/embedding-search.ts`

**Ready to proceed?** Just add the OpenAI API key to `.env` and run the script!
