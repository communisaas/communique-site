# Design Documentation Index

**Last Updated:** 2025-11-03

Strategic design documents for Communique's interface redesign, template discovery system, and multi-level governance architecture.

---

## Critical Path Documents (Read in Order)

### 1. [INTERFACE-REDESIGN-INTENTIONS.md](./INTERFACE-REDESIGN-INTENTIONS.md)
**Why it exists:** Democracy lost the attention game. This document defines how to make civic participation compete through economic architecture, cryptographic sovereignty, and instant feedback loops.

**Key sections:**
- Core design principles (economic feedback, cryptographic sovereignty, congressional quality signals)
- Specific interface changes (landing page, template browser, user dashboard, template creator dashboard)
- Mobile-first design imperatives (Face ID flow, retention hooks)
- Implementation priority (Phase 1 reputation-only → Phase 2 token economics)

**Read this first to understand the fundamental intentions behind the redesign.**

---

### 2. [TEMPLATE-LOCATION-ARCHITECTURE.md](./TEMPLATE-LOCATION-ARCHITECTURE.md) 🚨 BLOCKER
**Why it exists:** Templates currently store location as unstructured strings (`["Austin, TX"]`), making semantic search, VPN-resistant location matching, and network effects impossible.

**Key sections:**
- Current schema inadequacy (string arrays can't be queried efficiently)
- Required schema: `TemplateJurisdiction` table (structured congressional districts, state/county/city FIPS codes)
- Template embeddings (location_embedding, topic_embedding for semantic search)
- VPN remediation through 5-signal progressive inference
- Template writer UX (jurisdiction picker with autocomplete, coverage preview)
- Database migration script

**Read this second. This is the BLOCKER that must be resolved before semantic search, network effects, or VPN-resistant discovery can work.**

---

### 3. [CONTEXTUAL-TEMPLATE-DISCOVERY.md](./CONTEXTUAL-TEMPLATE-DISCOVERY.md)
**Why it exists:** Discrete filters (Federal/State/County dropdown) force users to think like bureaucrats. Real people live in overlapping civic contexts (federal healthcare + local housing + state education funding). We need semantic discovery that intuits "where users are at" across all dimensions.

**Key sections:**
- Silent, progressive location resolution (5 signals: IP → browser API → OAuth → behavioral → identity verification)
- Semantic template discovery (multi-dimensional embeddings, contextual boosting)
- Cross-jurisdiction affordances (VIEW any template, SEND only yours, ADAPT, SHARE, TRACK)
- Privacy-preserving network effects (on-chain district commitments with zero-knowledge proofs)
- Implementation roadmap (Phase 1-5)

**Read this third. This document depends on TEMPLATE-LOCATION-ARCHITECTURE.md being implemented first.**

---

### 4. [MULTI-LEVEL-GOVERNANCE-PRIVACY.md](./MULTI-LEVEL-GOVERNANCE-PRIVACY.md)
**Why it exists:** Federal delivery is fully cryptographic (ZK proofs, AWS Nitro Enclaves, CWC API), but state/county/city uses client-side `mailto:` links. This document addresses the privacy implications and architecture gap.

**Key sections:**
- Current architecture state (federal district verification + OAuth for all entities)
- Tiered privacy model (federal = maximum privacy via ZK, local = action-based privacy)
- Client-side location resolution for all governance levels
- Recipient name privacy assessment (public officials, acceptable)
- Template delivery guarantees across jurisdiction types

**Read this fourth to understand how privacy works differently across governance levels.**

---

## Implementation Dependencies

```
TEMPLATE-LOCATION-ARCHITECTURE.md (Database Migration)
    ↓
    ├──→ CONTEXTUAL-TEMPLATE-DISCOVERY.md (Semantic Search)
    ├──→ INTERFACE-REDESIGN-INTENTIONS.md (Template Browser, Network Effects)
    └──→ MULTI-LEVEL-GOVERNANCE-PRIVACY.md (Multi-Level Templates)
```

**Nothing works without the database migration.** Current schema is inadequate.

---

## Quick Reference: What Each Document Solves

| Problem | Document | Solution |
|---------|----------|----------|
| Democracy doesn't compete for attention | INTERFACE-REDESIGN-INTENTIONS.md | Economic architecture: reputation → tokens, immediate feedback loops, Phase 2 previews |
| VPN users see wrong templates | TEMPLATE-LOCATION-ARCHITECTURE.md | 5-signal progressive inference (IP → OAuth → behavioral → identity verification) |
| Discrete filters force bureaucratic thinking | CONTEXTUAL-TEMPLATE-DISCOVERY.md | Semantic embeddings + contextual boosting (geographic + temporal + network + impact) |
| Can't search "I can't afford rent" and get zoning + vouchers + wages | CONTEXTUAL-TEMPLATE-DISCOVERY.md | Multi-dimensional embeddings understand problem interconnections |
| Template creators don't know who can receive their templates | TEMPLATE-LOCATION-ARCHITECTURE.md | Structured jurisdictions + coverage preview ("~950,000 residents, TX-21/TX-25/TX-35") |
| Network effects expose user locations | CONTEXTUAL-TEMPLATE-DISCOVERY.md | On-chain district commitments (Poseidon hashed), client-side count resolution |
| State/county/city delivery less private than federal | MULTI-LEVEL-GOVERNANCE-PRIVACY.md | Tiered privacy model, action-based revelation (clicking template reveals minimal info) |

---

## Cypherpunk Privacy Standards Across All Documents

**Core principle:** Privacy through architecture, not promises.

### User Location Resolution
1. **Client-side only** - All 5 signals resolved in IndexedDB/sessionStorage, never transmitted to server
2. **Progressive signals** - IP (weak, VPN-vulnerable) → OAuth (strong) → Identity verification (ground truth)
3. **Action-based revelation** - Server learns "user clicked Austin template" (minimal), not "user lives in Austin"
4. **No persistent server-side tracking** - Location data doesn't exist in any database we control

### Template Discovery
1. **Bulk download** - Server provides ALL templates to client (no location filtering server-side)
2. **Client-side filtering** - Browser filters by jurisdiction using IndexedDB location data
3. **Semantic search local** - Embeddings pre-computed (server), scoring happens client-side
4. **No search query tracking** - User's search terms never transmitted to server

### Network Effects
1. **On-chain district commitments** - Poseidon hash of jurisdiction (irreversible)
2. **Client-side count resolution** - Browser computes own district hash, queries contract directly
3. **No centralized identity mapping** - Platform cannot reverse-engineer which hash = which district
4. **Zero-knowledge set membership** - Prove you're in a district without revealing which one

### Template Creation
1. **Jurisdiction selection is public info** - "This template applies to Austin" is not PII
2. **Authorship pseudonymous** - Wallet address, not real identity
3. **Coverage preview public** - "~950,000 residents" is Census data, not user data
4. **No tracking of WHO creates WHAT WHERE** - Creation events on-chain (pseudonymous), not linked to location

---

## For Developers

**Start here:**
1. Read INTERFACE-REDESIGN-INTENTIONS.md (understand the "why")
2. Read TEMPLATE-LOCATION-ARCHITECTURE.md (understand the blocker)
3. Implement database migration (TemplateJurisdiction table, embeddings)
4. Generate embeddings for all templates (OpenAI batch job)
5. Implement 5-signal client-side location resolution
6. Build semantic search with contextual boosting
7. Build template creator jurisdiction picker
8. Build network effects with on-chain commitments

**See implementation checklist in TEMPLATE-LOCATION-ARCHITECTURE.md.**

---

## For Template Writers

**Your workflow will change from:**
```
Create Template → Enter "Austin, TX" as string → Hope it works
```

**To:**
```
Create Template → Jurisdiction Picker (autocomplete) → Select:
  - City: Austin, TX (Census place code 4805000)
  - Auto-resolves: Travis County, TX-21/TX-25/TX-35, State districts

Coverage Preview:
  - Estimated reach: ~950,000 residents
  - Congressional districts: TX-21, TX-25, TX-35
  - State legislative districts: SD-14, HD-47, HD-48, HD-49

[Create Template]
```

**Benefits:**
- Know exactly who can receive your template
- See coverage preview before publishing
- Network effects show adoption by district
- Semantic search surfaces your template to right users (even on VPN)

---

## For Product/Design

**The interface must make economic architecture visceral:**
- Every interaction shows reputation accumulating
- Every template shows network effects forming ("89 Austin residents sent this")
- Every message shows congressional priority increasing
- Every action previews Phase 2 economic consequences
- Phase 1 builds muscle memory for Phase 2 token behaviors

**Not "sign this petition."**

**"Generate zero-knowledge proof. Build portable reputation. Coordinate network effects. Preview your Phase 2 earnings. Congressional offices just bumped your message to policy staff review. Quality discourse pays. Your sovereignty is cryptographically guaranteed."**

---

## Status

**Current State:**
- ✅ INTERFACE-REDESIGN-INTENTIONS.md (complete)
- ✅ TEMPLATE-LOCATION-ARCHITECTURE.md (complete)
- ✅ CONTEXTUAL-TEMPLATE-DISCOVERY.md (complete)
- ✅ MULTI-LEVEL-GOVERNANCE-PRIVACY.md (complete)
- ❌ Database migration (NOT STARTED - BLOCKER)
- ❌ Semantic search implementation (NOT STARTED - DEPENDS ON DB MIGRATION)
- ❌ Template creator jurisdiction picker (NOT STARTED - DEPENDS ON DB MIGRATION)

**Next Steps:**
1. Review TEMPLATE-LOCATION-ARCHITECTURE.md with database team
2. Create Prisma migration for TemplateJurisdiction table
3. Write data migration script (parse existing `specific_locations` strings)
4. Generate embeddings for all templates (OpenAI batch job)
5. Implement 5-signal client-side location resolution
6. Build semantic search with contextual boosting

---

*These design documents represent the fundamental rethinking of how civic participation competes for attention. Not through moral appeals. Through economic architecture, cryptographic sovereignty, and making participation economically smarter than not participating.*
