# Documentation Cleanup - Phase 2 Analysis

**Date**: 2025-01-09
**Phase**: Architecture & Strategic Doc Review
**Previous**: Phase 1 completed (deleted 3,926 lines of location/district docs)

---

## Architecture Docs Review

### ✅ KEEP - These Are Excellent

| File | Lines | Status | Reason |
|------|-------|--------|--------|
| `CYPHERPUNK-ARCHITECTURE.md` | 425 | **KEEP** | Authoritative product philosophy, UX principles, honest messaging. No overlap with voter-protocol. |
| `FRONTEND-ARCHITECTURE.md` | 680 | **KEEP** | Excellent SvelteKit 5 technical reference. Runes patterns, component architecture, routing. Frontend-specific (not blockchain). |
| `architecture/ARCHITECTURE-DECISION-RECORD.md` | 329 | **KEEP** | Critical decision: Browser-native WASM proving. Aligns with voter-protocol publishing `@voter-protocol/zk-prover-wasm`. |

**No conflicts found.** These docs correctly describe:
- Communiqué's frontend architecture (SvelteKit 5)
- Product philosophy and messaging
- Technical decision to use browser-native WASM (voter-protocol provides the WASM binary)

**Action**: NONE - Architecture docs are clean

---

## TEE Architecture Docs Review

Need to verify these don't describe cryptographic infrastructure that belongs in voter-protocol:

| File | Status | Action Needed |
|------|--------|---------------|
| `architecture/TEE-SYSTEMS-OVERVIEW.md` | ? | READ - Verify TEE is for congressional message delivery ONLY (not ZK proving) |
| `architecture/cloud-agnostic-tee-abstraction.md` | ? | READ - Same as above |

**Expected finding**: TEE docs should describe **message delivery encryption** (AWS Nitro Enclaves for CWC API), NOT ZK proof generation (which is browser-native WASM).

**If docs describe TEE proving**: UPDATE to clarify proving is browser-native WASM, TEE is delivery only.

---

## Strategic/Vision Docs - Consolidation Candidates

Multiple docs with overlapping strategic content. Need to identify duplication:

| File | Est. Lines | Topic | Likely Status |
|------|-----------|-------|---------------|
| `COORDINATION-PLATFORM.md` | ? | Strategic vision | Read - may overlap with roadmap |
| `GROWTH-STRATEGY.md` | ? | Growth/distribution | Read - may overlap with reality-grounded docs |
| `REALITY-GROUNDED-STRATEGY.md` | ? | Strategic reality check | Read - may duplicate PHASE-1-REALITY-GROUNDED |
| `PHASE-1-REALITY-GROUNDED.md` | ? | Phase 1 reality check | Read - may duplicate above |
| `WHAT-ACTUALLY-WORKS.md` | ? | Product strategy | Read - vague title, likely consolidatable |
| `WHAT-PEOPLE-ARE-ACTUALLY-ORGANIZING-AROUND.md` | ? | Product strategy | Read - vague title, likely consolidatable |
| `THE-VEIL-UNPEELED.md` | ? | Philosophy/vision | Read - unclear purpose |
| `WHAT-BRUTALIST-SHOULD-HAVE-SAID.md` | ? | Design philosophy | Read - unclear purpose |
| `UNIVERSAL-DECISION-MAKER-VOICE.md` | ? | Product voice | Read - may overlap with CYPHERPUNK-ARCHITECTURE |
| `UNIVERSAL-VOICE-RESTORED.md` | ? | Product voice | Read - may duplicate above |

**Hypothesis**: 4-6 of these docs likely describe the same strategic insights and can be consolidated into 1-2 authoritative documents.

**Consolidation target**: Keep 1-2 strategic docs, archive or delete duplicates.

---

## Status/Progress Docs - Historical Cleanup

Multiple status snapshots exist. Need to identify what's current vs historical:

| File | Date | Status | Action |
|------|------|--------|--------|
| `STATUS-2025-11-04.md` | 2025-11-04 | 2 months old | Read - likely outdated |
| `WEEK-1-COMPLETE.md` | Unknown | Historical | Read - archive or delete |
| `MONTH-1-WEEK-1-SUMMARY.md` | Unknown | Historical | Read - archive or delete |
| `PHASE-1-MONTH-1-IMPLEMENTATION.md` | Unknown | Historical | Read - archive or delete |
| `IMPLEMENTATION-COMPLETE-SOCIAL-PROOF.md` | Unknown | Feature complete? | Read - may be current |
| `UNIVERSAL-SHARING-IMPLEMENTATION-COMPLETE.md` | Unknown | Feature complete? | Read - may be current |

**Recommendation**:
- Keep: One current status/roadmap doc
- Archive: Historical progress docs (move to `/docs/archive/historical/`)
- Delete: Obsolete status docs referencing removed features

---

## Integration/Technical Docs - Accuracy Verification

| File | Status | Action |
|------|--------|--------|
| `INTEGRATION-GUIDE.md` | ? | Read - ensure voter-protocol integration is accurate |
| `cwc-integration.md` | ? | Read - verify congressional delivery flow |
| `legislative-abstraction.md` | ? | Read - check for location/district references |
| `TEMPLATE-CREATOR-EMAIL-LOOKUP.md` | ? | Read - verify implementation status |
| `TEMPLATE-CREATOR-JURISDICTION-INTEGRATION.md` | ? | Read - may reference deleted location features |
| `TEMPLATE-SEARCH-DISCOVERY.md` | ? | Read - verify semantic search status |
| `TEMPLATE-SYSTEM.md` | ? | Read - core doc, verify accuracy |

**Expected issues**:
- References to deleted location infrastructure
- Outdated integration flows
- Superseded implementation details

---

## Data Model Docs - Schema Accuracy

| File | Status | Action |
|------|--------|--------|
| `DATA-MODEL-SPECIFICATION.md` | ? | Read - verify reflects voter-protocol separation |
| `DATA-MODEL-COMPLEXITY-ANALYSIS.md` | ? | Read - may be outdated complexity analysis |

**Check for**:
- References to LocationCache table (deleted)
- References to plaintext district fields (should be commitment hashes)
- Outdated schema assumptions

---

## Design Docs - Quick Scan

Design docs are likely fine (UI/UX focused), but need quick scan for:

| Folder | Files | Action |
|--------|-------|--------|
| `/docs/design/` | 11 files | Quick scan for references to: |
|  |  | - Location-based filtering (deleted feature?) |
|  |  | - District-based template routing (changed architecture?) |
|  |  | - Outdated user flows |

**Likely outcome**: Minor updates needed, no major consolidation.

---

## Delivery/Congressional Docs

| File | Status | Action |
|------|--------|--------|
| `DELIVERY-PATHS.md` | ? | Read - verify TEE delivery flow accurate |
| `congressional/dashboard-implementation-plan.md` | ? | Read - verify implementation status |

---

## Research/Outline Docs

| File | Status | Action |
|------|--------|--------|
| `RESEARCH-OUTLINE-ALL-POWER-STRUCTURES.md` | ? | Read - may be exploratory research (archive?) |

---

## Miscellaneous Docs - Purpose Verification

| File | Status | Action |
|------|--------|--------|
| `ARCHITECTURE-SEPARATION-CICERO-HUNTER.md` | ? | Read - may be related to deleted location docs |
| `STRATEGIC-DOCUMENTATION.md` | ? | Read - meta-doc about documentation strategy? |
| `TECHNICAL-FEASIBILITY-ASSESSMENT.md` | ? | Read - may be outdated feasibility analysis |
| `PROGRESSIVE-ONBOARDING.md` | ? | Read - verify current onboarding flow |
| `GOOGLE-GEMINI-EMBEDDING-INTEGRATION.md` | ? | Read - verify semantic search implementation |
| `NEXT-STEPS-EMBEDDINGS.md` | ? | Read - may be obsolete next-steps doc |

---

## Immediate Next Steps

### Priority 1: TEE Docs Verification (15 minutes)

Read and verify:
- `architecture/TEE-SYSTEMS-OVERVIEW.md`
- `architecture/cloud-agnostic-tee-abstraction.md`

**Decision criteria**:
- If describes TEE for message delivery only → KEEP
- If describes TEE for ZK proving → UPDATE or DELETE (proving is browser WASM)

### Priority 2: Strategic Doc Consolidation (1 hour)

Read ALL strategic docs:
- COORDINATION-PLATFORM.md
- GROWTH-STRATEGY.md
- REALITY-GROUNDED-STRATEGY.md
- PHASE-1-REALITY-GROUNDED.md
- WHAT-ACTUALLY-WORKS.md
- WHAT-PEOPLE-ARE-ACTUALLY-ORGANIZING-AROUND.md
- THE-VEIL-UNPEELED.md
- WHAT-BRUTALIST-SHOULD-HAVE-SAID.md
- UNIVERSAL-DECISION-MAKER-VOICE.md
- UNIVERSAL-VOICE-RESTORED.md

**Goal**: Identify which docs are duplicates, which is authoritative, consolidate or delete.

### Priority 3: Status Doc Cleanup (30 minutes)

Read status docs, identify:
- Current status doc (KEEP)
- Historical snapshots (ARCHIVE to `/docs/archive/historical/`)
- Obsolete status docs (DELETE)

### Priority 4: Integration Doc Verification (30 minutes)

Scan integration docs for references to:
- Deleted location infrastructure
- Outdated voter-protocol integration
- Superseded flows

---

## Success Metrics (Phase 2)

**Before Phase 2:**
- Strategic docs: 10+ files with vague, overlapping titles
- Status docs: 6+ historical snapshots mixed with current
- Integration docs: Unknown accuracy (not yet verified)

**After Phase 2 (Goal):**
- Strategic docs: 1-2 authoritative documents
- Status docs: 1 current + archived historical
- Integration docs: 100% accurate, references voter-protocol correctly

**Estimated cleanup**: 10-15 more files consolidated or deleted

---

## Timeline

**Phase 1**: ✅ COMPLETE (Jan 9) - Deleted 8 files, 3,926 lines of location/district duplication
**Phase 2**: IN PROGRESS - Architecture verified clean, strategic consolidation next
**Phase 3**: PENDING - Final cleanup, create `/docs/archive/` structure

**Estimated total time**: 3-4 hours to complete full cleanup

---

**Next action**: Read TEE docs to verify they describe message delivery only (not ZK proving)
