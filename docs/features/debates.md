# Staked Deliberation (Debates)

**Status:** Frontend implemented, off-chain only. On-chain integration pending DebateMarket.sol deployment.
**Tier Requirement:** 3+ (ZK-verified identity)
**Contract:** `voter-protocol/contracts/src/DebateMarket.sol` (721 lines, 107 tests)
**Spec:** `voter-protocol/specs/STAKED-DEBATE-PROTOCOL-SPEC.md`

---

## What It Is

When a user disagrees with a template's framing, they can open a *deliberation* — a structured, anonymous, staked debate scoped to the template's jurisdiction. Arguments compete on merit weighted by engagement tier, not raw capital.

This is NOT a prediction market (bet on what will happen) or a vote (count heads). It's a *debate market*: stake on the quality of reasoning, weighted by earned credibility.

## User Journey

### Discovery

Templates with active debates display an amber "Deliberating" indicator in the browse view. The indicator uses a pulsing amber dot (peripheral motion detection) with the word "Deliberating" in amber-600 — matching the amber palette used by `DebateSurface` on the detail page.

**Data flow:** The browse page server load and `/api/templates` GET endpoint query `SELECT DISTINCT template_id FROM debate WHERE status = 'active'` and set `hasActiveDebate: true` on matching templates. The indicator renders in `TemplateCard` (grid view) and `TemplateList` (list view).

The `DebateSurface` component renders on the template detail page (`/s/[slug]`), visible to:

- **Any user** if a debate exists (read-only for Tier 0-2)
- **Tier 3+ only** if no debate exists ("Challenge this framing" affordance)

### Initiation (Tier 3+)

1. User clicks "Challenge this framing" on a template without a debate
2. `DebateModal` opens in `proposition` phase
3. User writes a proposition (the specific claim to debate, min 10 chars)
4. Selects stance: SUPPORT / OPPOSE / AMEND
5. Composes argument (min 20 chars, + amendment text if AMEND)
6. Sets stake via `StakeVisualizer` (range $1-$100, spring-animated formula display)
7. `DebateProofGenerator` generates three-tree ZK proof with debate-scoped action domain
8. Submits: creates debate + first argument atomically

### Participation (Tier 3+)

1. User views active debate on template page
2. Reads existing arguments (sorted by weighted score, filterable by stance)
3. Clicks "Add your argument"
4. `DebateModal` opens in `stance-selection` phase (skips proposition)
5. Same flow: stance -> compose -> stake -> proof -> submit

### Co-signing

Tier 3+ users can co-sign existing arguments, adding their stake and tier weight. One co-sign per identity per debate (nullifier-enforced).

**Known gap:** No co-sign UI button on `ArgumentCard`. The API endpoint exists (`POST /api/debates/[debateId]/cosign`) but there is no frontend affordance to trigger it. This will be resolved when we add a co-sign button with proof generation to `ArgumentCard`.

### Resolution

After the deadline passes, anyone can trigger resolution. The argument with the highest `weighted_score` wins.

**Known gap:** No automatic resolution. The `POST /api/debates/[debateId]/resolve` endpoint exists but must be called manually. No cron job or event listener triggers it. This will be resolved with either a cron-based resolver or deadline-aware UI that prompts resolution.

### Settlement

Winners claim their proportional share of the losing pool.

**Known gap:** Settlement is a stub. The `POST /api/debates/[debateId]/claim` endpoint records claims but does not execute on-chain settlement. This will be resolved when DebateMarket.sol is deployed and the claim endpoint calls `DebateMarket.claimSettlement()`.

---

## Scoring Formula

```
weighted_score = sqrt(stake_in_dollars) * 2^engagement_tier
```

- **Tier 3, $1 stake:** sqrt(1) * 2^3 = 8
- **Tier 3, $100 stake:** sqrt(100) * 2^3 = 80
- **Tier 4, $1 stake:** sqrt(1) * 2^4 = 16

The square root compresses the influence of money. The exponential amplifies the influence of earned credibility. A Tier 4 member staking $1 has double the weight of a Tier 3 member staking $1.

---

## Architecture

### Data Model

```
Debate (prisma)
  ├── template_id        → FK to Template
  ├── debate_id_onchain  → keccak256 hash (unique)
  ├── action_domain      → derived: keccak256(debateId, "debate", propHash) mod BN254
  ├── proposition_hash   → keccak256(propositionText)
  ├── proposition_text   → human-readable claim
  ├── deadline           → debate end time
  ├── status             → 'active' | 'resolved'
  ├── winning_argument_index
  ├── winning_stance
  └── arguments[]        → DebateArgument[]

DebateArgument (prisma)
  ├── debate_id          → FK to Debate
  ├── argument_index     → sequential per debate
  ├── stance             → 'SUPPORT' | 'OPPOSE' | 'AMEND'
  ├── body + body_hash
  ├── amendment_text     → only for AMEND stance
  ├── stake_amount       → BigInt (6-decimal token)
  ├── engagement_tier    → user's tier at submission time
  ├── weighted_score     → computed: sqrt(stake) * 2^tier
  ├── total_stake        → cumulative with co-signs
  └── co_sign_count      → aggregate cache
```

No `CoSign` model — co-signs are on-chain only (stakeRecords in DebateMarket.sol). The `co_sign_count` and `total_stake` on DebateArgument are aggregate caches updated by event indexing (when implemented).

### ZK Integration

Debate proofs use the same three-tree circuit but with a **debate-scoped action domain**:

```typescript
// In action-domain-builder.ts (exported from zkp/index.ts)
buildDebateActionDomain(baseDomain, propositionHash)
// → keccak256(baseDomain, "debate", propositionHash) mod BN254_MODULUS
```

This mirrors `DebateMarket.deriveDomain()` on-chain, ensuring the nullifier is scoped to the specific debate — a user can send a message (template action domain) AND debate the same template (debate action domain) without nullifier collision.

### Components

```
src/lib/components/debate/
├── DebateSurface.svelte          → container on template page
├── ActiveDebatePanel.svelte      → renders debate with arguments
├── ArgumentCard.svelte           → single argument display
├── DebateMetrics.svelte          → participants, stake, countdown
├── PropositionDisplay.svelte     → blockquote proposition + hash
├── StanceSelector.svelte         → three-option picker with spring physics
├── StakeVisualizer.svelte        → animated formula visualization
├── DebateProofGenerator.svelte   → ZK proof with debate action domain
└── DebateModal.svelte            → full composition flow (content-only, rendered by ModalRegistry)
```

### API Routes

```
POST   /api/debates/create                          → create debate (Tier 3+)
GET    /api/debates/by-template/[templateId]         → fetch debate for template
GET    /api/debates/[debateId]/arguments             → list arguments (filterable)
POST   /api/debates/[debateId]/arguments             → submit argument with ZK proof
POST   /api/debates/[debateId]/cosign                → co-sign argument
POST   /api/debates/[debateId]/resolve               → resolve after deadline
POST   /api/debates/[debateId]/claim                 → claim settlement (stub)
```

### Routes

```
/s/[slug]                        → template page with DebateSurface below preview
/s/[slug]/debate/[debateId]      → deep link to specific debate
```

---

## Known Gaps (Resolve Later)

| Gap | Severity | Resolution Path |
|-----|----------|-----------------|
| ~~No debate badge on TemplateCard in browse view~~ | ~~High~~ **Resolved** | Amber "Deliberating" indicator on TemplateCard + TemplateList; `hasActiveDebate` field in both API and server loads |
| No co-sign button on ArgumentCard | **Medium** — API exists but no frontend trigger | Add co-sign affordance with proof generation to ArgumentCard |
| No automatic resolution | **Medium** — deadline passes silently | Add cron job or deadline-aware UI prompt |
| Settlement is a stub | **Medium** — claims recorded but not executed | Wire to DebateMarket.claimSettlement() after contract deployment |
| No event indexer for on-chain state sync | **Medium** — off-chain and on-chain state can diverge | Build indexer that listens to DebateMarket events and updates Prisma |
| No wallet integration UI | **Low** — server-side transaction submission assumed | Add wallet connect for direct on-chain staking |
| No content moderation for arguments | **Low** — needed eventually | Extend existing moderation pipeline to debate arguments |
| Debate not mentioned in README or architecture docs | **Low** — developer onboarding gap | This document and the implementation-status update address it |

---

## Contract Integration (Not Yet Wired)

When DebateMarket.sol is deployed to Scroll L2:

1. `POST /api/debates/create` calls `DebateMarket.proposeDebate()` with proposer bond
2. `POST /api/debates/[debateId]/arguments` calls `DebateMarket.submitArgument()` with ZK proof + stake
3. `POST /api/debates/[debateId]/cosign` calls `DebateMarket.coSignArgument()` with ZK proof + stake
4. `POST /api/debates/[debateId]/resolve` calls `DebateMarket.resolveDebate()` (permissionless after deadline)
5. `POST /api/debates/[debateId]/claim` calls `DebateMarket.claimSettlement()` with ZK proof
6. Event indexer syncs `ArgumentSubmitted`, `ArgumentCoSigned`, `DebateResolved`, `SettlementClaimed` events back to Prisma
