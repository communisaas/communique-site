# Subscription Cost Model

> **Status:** Architecture document (February 2026)
> **Scope:** Unit economics for Free / Pro / Org tiers. Every external API call traced from code, priced at current rates, projected against realistic usage.
> **Companion:** `org-data-model.md` (data model), `civic-intelligence-cost-model.md` (intelligence pipeline costs)
> **Last verified:** February 2026. Costs traced from actual code paths, not estimates.

---

## External API Pricing (as of February 2026)

Every cost in this document derives from these rates. When prices change, update this table and the projections recalculate.

### Gemini 3 Flash Preview (primary model — `gemini-3-flash-preview`)

| | Per 1M tokens |
|---|---|
| Input (text/image) | $0.50 |
| Output (**including thinking tokens**) | $3.00 |
| Embedding | $0.15 |
| Batch input | $0.25 |
| Batch output | $1.50 |

**Critical: Thinking tokens are billed at the output rate ($3.00/1M).** Every agent in the stack uses thinking. Thinking budgets: low=1,024 tokens, medium=4,096, high=8,192.

**Google Search grounding:** 5,000 free grounded prompts/month, then **$14.00 per 1,000 search queries.** A single grounded request may trigger multiple search queries. Each query is billed individually.

Source: [Google AI pricing](https://ai.google.dev/gemini-api/docs/pricing)

### Exa Search API

| Endpoint | Per 1,000 requests |
|---|---|
| Search (1-25 results, flat rate) | $7.00 |
| Contents (full page retrieval) | $1.00 |
| Free: 1,000 requests/month | — |

`maxResults: 10` and `maxResults: 15` cost the same. No price difference within 1-25 range.

Source: [Exa pricing](https://exa.ai/pricing)

### Firecrawl (headless browser scrape)

| Plan | Credits/month | Cost | Per credit |
|---|---|---|---|
| Hobby | 3,000 | $16/mo | $0.0053 |
| Standard | 100,000 | $83/mo | $0.00083 |
| Growth | 500,000 | $333/mo | $0.00067 |

1 credit = 1 page scrape with JS rendering.

Source: [Firecrawl pricing](https://www.firecrawl.dev/pricing)

### Groq (Llama Guard 4 12B + Prompt Guard 2)

Free tier: 14,400 requests/day (~432,000/month). Both moderation layers run on Groq free tier.

Source: [Groq rate limits](https://console.groq.com/docs/rate-limits)

### Cloudflare

| Service | Included | Overage |
|---|---|---|
| Workers Paid | 10M requests/mo | $0.30/M |
| KV reads | 10M/mo | $0.50/M |
| KV writes | 1M/mo | $5.00/M |
| Hyperdrive | Included | — |
| Base | $5/mo | — |

---

## Cost Per User Action — Traced From Code

### Action 1: Generate a message

This is the action users perform most. **It is NOT a single Gemini call.** The `generateMessage()` pipeline in `message-writer.ts` runs a two-phase process:

**Phase 1 — Source Discovery** (`source-discovery.ts` line 216):
- Google Search grounding enabled (`enableGrounding: true`)
- `thinkingLevel: 'medium'` (4,096 thinking tokens)
- System prompt: ~1,200 chars = ~300 input tokens
- User prompt (subject + message + topics + location): ~800 chars = ~200 input tokens
- Grounding adds search result context: ~2,000 input tokens
- Output: ~250 tokens (JSON with 3-8 sources)

| Component | Tokens | Rate | Cost |
|---|---|---|---|
| Input (prompt + grounding context) | ~2,500 | $0.50/1M | $0.00125 |
| Thinking tokens | 4,096 | $3.00/1M | $0.01229 |
| Output tokens | ~250 | $3.00/1M | $0.00075 |
| Google Search grounding | 1 query | $14/1K | $0.014 |
| **Phase 1 subtotal** | | | **$0.028** |

**Phase 1.5 — URL Validation** (`url-validator.ts`):
- HEAD requests to each discovered URL (3-8 URLs)
- Free (just HTTP requests from Workers)

**Phase 2 — Message Generation** (`message-writer.ts` line 249):
- Grounding disabled (`enableGrounding: false`)
- `thinkingLevel: 'high'` (8,192 thinking tokens)
- System prompt (MESSAGE_WRITER_PROMPT): ~3,300 chars = ~825 input tokens
- User prompt (subject + DMs + verified sources): ~1,300 chars = ~325 input tokens
- Output: ~500 tokens (message body + metadata JSON)

| Component | Tokens | Rate | Cost |
|---|---|---|---|
| Input (system + user prompt) | ~1,150 | $0.50/1M | $0.00058 |
| Thinking tokens | 8,192 | $3.00/1M | $0.02458 |
| Output tokens | ~500 | $3.00/1M | $0.00150 |
| **Phase 2 subtotal** | | | **$0.027** |

**Total per message generation: ~$0.055**

Note: If the Google Search grounding free tier (5,000/month) is not exhausted, the $0.014 grounding cost drops to $0. At 5,000 free queries/month, that covers ~5,000 message generations before grounding becomes a paid cost.

### Action 2: Generate a subject line

Fires during template creation (`subject-line.ts` line 171).

| Component | Tokens | Rate | Cost |
|---|---|---|---|
| Input (system prompt ~442 tokens + user input ~300) | ~742 | $0.50/1M | $0.00037 |
| Thinking tokens (`thinkingLevel: 'high'`) | 8,192 | $3.00/1M | $0.02458 |
| Output tokens | ~150 | $3.00/1M | $0.00045 |
| **Total** | | | **$0.025** |

Can retry once on failure, doubling to $0.050.

### Action 3: Moderation pipeline

Fires on template publish.

| Layer | Service | Cost |
|---|---|---|
| Layer 0: Prompt Guard 2 | Groq free tier | $0 |
| Layer 1: Llama Guard 4 12B | Groq free tier | $0 |
| Layer 2: Gemini quality (~350 input, no thinking, ~100 output) | Gemini 3 Flash | $0.0005 |
| **Total** | | **$0.0005** |

Layer 2 fires ~70% of the time (only when Layers 0+1 pass). No thinking tokens — it's a direct REST call, not the SDK.

### Action 4: Template embeddings

| Component | Service | Cost |
|---|---|---|
| Gemini embedding (~500 tokens) | gemini-embedding-001 (768 dim) | $0.0001 |
| **Total** | | **$0.0001** |

Note: An OpenAI embedding module exists (`openai-embeddings.ts`) but is not imported by any route. Template publish uses Gemini embeddings exclusively.

### Action 5: Decision-maker discovery

Full pipeline for one template targeting N uncached decision-makers. Four phases in `gemini-provider.ts`.

**Phase 1 — Role Discovery** (1 Gemini call):
- `thinkingLevel: 'medium'` (4,096 thinking tokens)
- ROLE_DISCOVERY_PROMPT: ~525 input tokens + user context ~300
- Output: ~300 tokens

| Component | Cost |
|---|---|
| Input | $0.00041 |
| Thinking | $0.01229 |
| Output | $0.00090 |
| **Phase 1 total** | **$0.014** |

**Phase 2a — Identity Resolution** (N parallel Exa searches + 1 Gemini extraction):

| Component | For 3 DMs | For 5 DMs |
|---|---|---|
| Exa searches (1 per role, 10 results each) | 3 × $0.007 = $0.021 | 5 × $0.007 = $0.035 |
| Gemini extraction (1 batch call, thinkingLevel: 'low' = 1,024 tokens) | $0.004 | $0.005 |
| **Phase 2a total** | **$0.025** | **$0.040** |

**Phase 2b — Contact Hunting** (fan-out-synthesize, 4 deterministic stages):

Stage 1: Parallel Exa searches (1 per uncached identity, 15 results each):

| | For 3 DMs | For 5 DMs |
|---|---|---|
| Exa searches | 3 × $0.007 = $0.021 | 5 × $0.007 = $0.035 |

Stage 2: Page selection (1 Gemini call, `thinkingLevel: 'medium'`):

| Component | Cost |
|---|---|
| Input (~1,050 tokens) + Thinking (4,096) + Output (~200) | $0.013 |

Stage 3: Parallel Firecrawl reads (`MAX_PAGES_TOTAL = min(N×2, 15)`):

| | For 3 DMs (6 pages) | For 5 DMs (10 pages) |
|---|---|---|
| Firecrawl @ Hobby | 6 × $0.0053 = $0.032 | 10 × $0.0053 = $0.053 |
| Firecrawl @ Standard | 6 × $0.00083 = $0.005 | 10 × $0.00083 = $0.008 |

Stage 4: Contact synthesis (1 Gemini call, `thinkingLevel: 'medium'`):

| Component | Cost |
|---|---|
| Input (~2,625 tokens) + Thinking (4,096) + Output (~250) | $0.014 |

**Phase 3 — Accountability Openers** (1 Gemini call, `thinkingLevel: 'medium'`):

| Component | Cost |
|---|---|
| Input (~1,000 tokens) + Thinking (4,096) + Output (~212) | $0.013 |

**Total per discovery run:**

| DMs | Exa searches | Firecrawl pages | Gemini calls | Total (Hobby FC) | Total (Standard FC) |
|---|---|---|---|---|---|
| 1 | 2 | 2 | 5 | **$0.084** | **$0.075** |
| 3 | 6 | 6 | 5 | **$0.132** | **$0.105** |
| 5 | 10 | 10 | 5 | **$0.182** | **$0.137** |
| 10 | 20 | 15 (capped) | 5 | **$0.239** | **$0.199** |

These costs drop to near-zero on repeat lookups. Cache hit = skip all Exa + Firecrawl + Gemini calls.

### Action 6: Full template creation flow

Everything that fires when a user creates and publishes a new template (with 3 novel DMs):

| Step | What fires | Cost |
|---|---|---|
| Subject line generation | 1 Gemini call (thinking: high) | $0.025 |
| DM discovery (3 DMs, uncached) | 6 Exa + 6 Firecrawl + 5 Gemini | $0.132 |
| Moderation pipeline | 2 Groq + 1 Gemini | $0.0005 |
| Embeddings | 1 Gemini + 1 OpenAI | $0.0002 |
| **Total template creation** | | **$0.158** |

Then each person who generates a message from that template:

| Step | What fires | Cost |
|---|---|---|
| Source discovery + message write | 1 grounded Gemini + 1 Gemini (thinking: high) | $0.055 |

---

## Revised Cost Summary

| Action | Cost | Frequency driver |
|---|---|---|
| **Generate a message** | **$0.055** (or $0.041 within grounding free tier) | Per user, per message |
| **Create template** (DMs cached) | **$0.026** | Per template publish |
| **Create template** (3 novel DMs) | **$0.158** | Per template with new DMs |
| **Create template** (5 novel DMs) | **$0.208** | Per template with new DMs |

The previous model had message generation at $0.004. **The real cost is $0.055 — 14x higher.** The difference is thinking tokens ($0.037 across both phases) and Google Search grounding ($0.014).

---

## Fixed Infrastructure Costs (monthly)

| Service | Plan | Monthly cost | Notes |
|---|---|---|---|
| Cloudflare Workers | Paid | $5 | 10M requests included |
| Firecrawl | Hobby | $16 | 3,000 pages/mo |
| PostgreSQL + pgvector | Managed | $25–50 | |
| Groq | Free tier | $0 | 432K req/mo covers moderation |
| Exa | Pay-as-you-go | $0 base | 1K free searches/mo, then $7/1K |
| Gemini API | Pay-as-you-go | $0 base | 5K free grounded queries/mo |
| **Total baseline** | | **$46–71** | |

---

## User Personas — Corrected Projections

### Free user

| Action | Frequency | Unit cost | Monthly cost |
|---|---|---|---|
| Message generation | 3/mo | $0.041 (within grounding free tier) | $0.12 |
| **Total per free user** | | | **$0.12** |

### Pro individual ($10/mo)

| Action | Frequency | Unit cost | Monthly cost |
|---|---|---|---|
| Message generation | 100/mo | $0.055 | $5.50 |
| Template creation (2 novel DM runs) | 5/mo | $0.026 base + 2 × $0.132 DM | $0.39 |
| **Total COGS** | | | **$5.89** |
| **Revenue** | | | **$10.00** |
| **Gross margin** | | | **$4.11 (41%)** |

### Pro power user ($10/mo)

| Action | Frequency | Unit cost | Monthly cost |
|---|---|---|---|
| Message generation | 300/mo | $0.055 | $16.50 |
| Template creation (5 novel DM runs) | 10/mo | $0.026 base + 5 × $0.132 DM | $0.92 |
| **Total COGS** | | | **$17.42** |
| **Revenue** | | | **$10.00** |
| **Gross margin** | | | **-$7.42 (LOSS)** |

**At 300 messages/month, a $10 pro user is unprofitable.** Break-even is ~170 messages/month at $0.055/message. This is the critical finding the previous model missed.

### Break-even analysis for Pro tier

| Messages/mo | COGS (messages only) | Margin at $10 |
|---|---|---|
| 50 | $2.75 | $7.25 (73%) |
| 100 | $5.50 | $4.50 (45%) |
| 150 | $8.25 | $1.75 (18%) |
| 182 | $10.00 | $0 (break-even) |
| 300 | $16.50 | -$6.50 (loss) |

### Small org ($40–60/mo custom, 5 members)

| Action | Frequency | Unit cost | Monthly cost |
|---|---|---|---|
| Message generation | 500/mo across team | $0.055 | $27.50 |
| Template creation | 15/mo (3 novel DM runs) | varies | $0.79 |
| **Total COGS** | | | **$28.29** |
| **Revenue (low end)** | | | **$40.00** |
| **Gross margin** | | | **$11.71 (29%)** |

At $60: margin is $31.71 (53%). The DM cache helps on discovery, but message generation is the dominant cost.

### Mid org ($100–150/mo custom, 12 members)

| Action | Frequency | Unit cost | Monthly cost |
|---|---|---|---|
| Message generation | 2,000/mo | $0.055 | $110.00 |
| Template creation | 30/mo (8 novel DM runs) | varies | $1.81 |
| **Total COGS** | | | **$111.81** |
| **Revenue** | | | **$150.00** |
| **Gross margin** | | | **$38.19 (25%)** |

At $100 revenue this is a **loss**. Need to price at $150+ or reduce per-message cost.

### Large org ($200–300/mo custom, 25+ members)

| Action | Frequency | Unit cost | Monthly cost |
|---|---|---|---|
| Message generation | 5,000/mo | $0.055 | $275.00 |
| Template creation | 50/mo | varies | $3.50 |
| **Total COGS** | | | **$278.50** |
| **Revenue** | | | **$300.00** |
| **Gross margin** | | | **$21.50 (7%)** |

Thin margins. At 5,000 messages/month, revenue must be $350+ for healthy economics.

---

## The Real Problem: Per-Message Cost

Message generation at $0.055 is the margin killer. The breakdown:

| Component | Cost | % of message |
|---|---|---|
| **Thinking tokens** (high=8,192 in Phase 2) | $0.025 | 45% |
| **Google Search grounding** (Phase 1) | $0.014 | 25% |
| **Thinking tokens** (medium=4,096 in Phase 1) | $0.012 | 22% |
| Input + output tokens | $0.004 | 7% |

**Thinking is 67% of message cost. Grounding is 25%.** The actual input/output tokens that produce the message are only 7%.

### Optimization levers (in order of impact)

**1. Cache verified sources per template ($0.028 → $0 for repeat messages)**

Currently, `verifiedSources` is never pre-populated from the route. Every message generation triggers a fresh source discovery with Google Search grounding. If we cache verified sources from the first message and pass them to subsequent messages on the same template, Phase 1 is eliminated entirely for all but the first message.

Impact: Message cost drops from **$0.055 to $0.027** for cached-source messages. This is 2x improvement on the dominant cost.

First message on a template: $0.055 (full pipeline)
Every subsequent message: $0.027 (Phase 2 only, no grounding)

**2. Reduce thinking level for message writer (high → medium)**

Subject line uses `thinkingLevel: 'high'` for "emotional archaeology" — justified. But the message writer's Phase 2 also uses high. Dropping to medium saves 4,096 thinking tokens per message.

Impact: Phase 2 cost drops from $0.027 to $0.015. Total per message (with source caching) drops from $0.027 to **$0.015**.

**3. Stay within Google Search grounding free tier**

5,000 free grounded prompts/month. If source caching is implemented (lever 1), only the first message per template needs grounding. At 100 templates/month, that's 100 grounding calls — well within the free tier.

Impact: $0.014/message → $0 for all but template-first messages.

**4. Batch Gemini embedding API**

Already using batch pricing for embeddings. Marginal improvement.

### Projected per-message cost after optimization

| Scenario | Cost |
|---|---|
| Current (no optimization) | $0.055 |
| After source caching (lever 1) | $0.027 for repeat, $0.055 for first |
| After source caching + thinking reduction (levers 1+2) | $0.015 for repeat, $0.043 for first |
| Blended (assuming 95% repeat messages) | **$0.016** |

At $0.016/message blended, the economics recover:

| Tier | Messages/mo | COGS | Revenue | Margin |
|---|---|---|---|---|
| Pro | 100 | $1.60 + $0.39 DM | $10 | **80%** |
| Pro power | 300 | $4.80 + $0.92 DM | $10 | **43%** |
| Small org | 500 | $8.00 + $0.79 DM | $40 | **78%** |
| Mid org | 2,000 | $32.00 + $1.81 DM | $150 | **77%** |

---

## Scenario Projections (with source caching implemented)

Using blended $0.016/message after optimization.

### Scenario A: Early traction (Month 6)

| Segment | Count | Revenue/ea | Total revenue | Total COGS |
|---|---|---|---|---|
| Free users | 500 | $0 | $0 | $10 |
| Pro (Stripe) | 30 | $10 | $300 | $65 |
| Pro (crypto) | 5 | $10 | $50 | $11 |
| Small org | 2 | $50 avg | $100 | $18 |
| **Total** | 537 | | **$450** | **$104** |
| **Infrastructure** | | | | **$55** |
| **Net margin** | | | | **$291 (65%)** |

### Scenario B: Growing (Month 12)

| Segment | Count | Revenue/ea | Total revenue | Total COGS |
|---|---|---|---|---|
| Free users | 3,000 | $0 | $0 | $58 |
| Pro (Stripe) | 150 | $10 | $1,500 | $320 |
| Pro (crypto) | 25 | $10 | $250 | $53 |
| Small org | 8 | $50 avg | $400 | $70 |
| Mid org | 3 | $150 avg | $450 | $102 |
| **Total** | 3,186 | | **$2,600** | **$603** |
| **Infrastructure** | | | | **$100** |
| **Net margin** | | | | **$1,897 (73%)** |

### Scenario C: Established (Month 24)

| Segment | Count | Revenue/ea | Total revenue | Total COGS |
|---|---|---|---|---|
| Free users | 15,000 | $0 | $0 | $288 |
| Pro (Stripe) | 600 | $10 | $6,000 | $1,284 |
| Pro (crypto) | 100 | $10 | $1,000 | $214 |
| Small org | 25 | $50 avg | $1,250 | $220 |
| Mid org | 10 | $150 avg | $1,500 | $338 |
| Large org | 3 | $350 avg | $1,050 | $445 |
| **Total** | 15,738 | | **$10,800** | **$2,789** |
| **Infrastructure** | | | | **$200** |
| **Net margin** | | | | **$7,811 (72%)** |

---

## Pricing Floor for Custom Org Deals (corrected)

```
floor = infra_share + (estimated_monthly_messages × $0.016)
                    + (estimated_monthly_dm_lookups × $0.13)
                    + 40% margin
```

For a 12-person org estimating 2,000 messages/month and 8 DM lookups/month:

```
floor = $8 + $32 + $1.04 = $41.04
with margin: $41.04 / 0.6 = $68
```

Price at $150 based on value. Floor ensures no loss.

---

## Critical Action Items

### Must-do before launch

**1. Implement source caching.** Without it, message generation at $0.055 makes the Pro tier unprofitable above ~180 messages/month. Cache verified sources from the first message generation per template and pass them to subsequent generations. This is the single highest-leverage optimization.

Code change: In `src/routes/api/agents/stream-message/+server.ts`, look up the template's cached sources before calling `generateMessage()`. Store sources in a `TemplateSourceCache` table or in the template's existing `sources` JSON field after first generation. Pass as `verifiedSources` option to skip Phase 1.

**2. Monitor per-message cost in production.** The `AgentTrace` model with `costUsd` field exists. Use it. Dashboard the actual per-message cost against these projections. If thinking tokens are consuming more than projected (models don't always use the full budget), adjust.

### Should-do

**3. Evaluate thinking level reduction for message writer.** Test quality impact of `thinkingLevel: 'medium'` vs `'high'` in Phase 2 of message generation. If quality holds, the per-message cost drops another 40%.

**4. Evaluate Gemini 2.5 Flash as fallback.** At $0.30/$2.50 (vs $0.50/$3.00), it's 17% cheaper on thinking tokens. If quality is comparable for message writing, switch the message writer to 2.5 Flash while keeping 3.0 Flash for decision-maker discovery.

---

## Model Versioning

This cost model is versioned by the API pricing table at the top. When any external API price changes:

1. Update the pricing table
2. Recalculate "Cost Per User Action" section
3. Re-run scenario projections
4. Adjust Firecrawl plan thresholds if needed

All projections use Hobby-plan Firecrawl pricing ($0.0053/page). Real costs at Standard plan ($0.00083/page) are lower.

Sources:
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Exa Pricing](https://exa.ai/pricing)
- [Firecrawl Pricing](https://www.firecrawl.dev/pricing)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
