# Documentation Cleanup Plan

**Date**: 2025-01-09
**Reason**: voter-protocol architecture separation revealed massive documentation duplication
**Impact**: Delete ~4,000 lines of obsolete docs, consolidate duplicates, update outdated content

---

## Executive Summary

**Problem**: Communiqué docs describe reimplementing infrastructure that voter-protocol already owns (Shadow Atlas, geocoding, district resolution, Merkle trees).

**Solution**: DELETE entire `/docs/location/` folder (2,796 lines), DELETE root-level privacy/verification docs (1,130 lines), CONSOLIDATE duplicates.

**Total cleanup**: ~4,000 lines of obsolete documentation

---

## Category 1: Location/District Verification (DELETE ENTIRE FOLDER)

### **Action: `rm -rf /Users/noot/Documents/communique/docs/location/`**

| File | Lines | Why Delete |
|------|-------|------------|
| `ACTUAL-STATUS.md` | 412 | Documents 95% complete location matching implementation that WON'T HAPPEN (voter-protocol owns this) |
| `CICERO-SECURITY.md` | 430 | Cicero API security architecture - Communiqué won't call Cicero (voter-protocol will) |
| `CYPHERPUNK-BOUNDARY-MATCHING.md` | 553 | Client-side boundary matching - voter-protocol's Shadow Atlas handles this |
| `IMPLEMENTATION-COMPLETE-REVISED.md` | 490 | Claims location matching is "complete" - but it's the WRONG architecture |
| `REALISTIC-RATE-LIMITS.md` | 478 | Rate limiting for Cicero API - Communiqué won't call Cicero directly |
| `UPSTASH-TO-IN-MEMORY-MIGRATION.md` | 433 | Migration from Upstash to in-memory rate limiting - irrelevant (no Cicero calls) |
| **TOTAL** | **2,796** | **Entire folder describes work that belongs in voter-protocol** |

**Why delete all:**
- voter-protocol OWNS: Shadow Atlas, geocoding, district resolution, Halo2 circuits, smart contracts
- Communiqué USES: `@voter-protocol/client` npm package (thin client, ~200 lines)
- These docs describe building infrastructure that already exists elsewhere

---

## Category 2: Root-Level Privacy/Verification Docs (DELETE)

### **Action: Delete obsolete privacy analysis docs**

| File | Lines | Why Delete |
|------|-------|------------|
| `LOCATION-CACHE-PRIVACY-ANALYSIS.md` | 486 | Privacy analysis for LocationCache table that WON'T EXIST (voter-protocol stores commitments, not plaintext) |
| `PRIVACY-PRESERVING-DISTRICT-VERIFICATION.md` | 644 | Merkle tree architecture ALREADY DOCUMENTED in voter-protocol (`/docs/DISTRICT-VERIFICATION.md`) |
| **TOTAL** | **1,130** | **Duplicates voter-protocol architecture** |

**Why delete:**
- `LOCATION-CACHE-PRIVACY-ANALYSIS.md`: Analyzes privacy attacks on a caching layer communiqué won't have
- `PRIVACY-PRESERVING-DISTRICT-VERIFICATION.md`: Describes Merkle tree architecture already implemented in voter-protocol

**Replacement:**
- See `/docs/DISTRICT-VERIFICATION-RESPONSIBILITIES.md` (created 2025-01-09)
- See voter-protocol `/docs/DISTRICT-VERIFICATION.md` (authoritative source)

---

## Category 3: Superseded Implementation Docs (DELETE)

### **Action: Delete old implementation doc**

| File | Lines | Why Delete/Update |
|------|-------|-------------------|
| `DISTRICT-VERIFICATION-IMPLEMENTATION.md` | ~1,500 | **KEEP with deprecation warning** - Already updated with warning at top redirecting to `DISTRICT-VERIFICATION-RESPONSIBILITIES.md` |

**Current status**: Already updated with deprecation warning (2025-01-09)

**Decision**: KEEP as historical reference, but prominently marked as superseded

---

## Category 4: Architecture Docs (REVIEW FOR DUPLICATION)

Need to check these for overlap:

| File | Status | Action Needed |
|------|--------|---------------|
| `CYPHERPUNK-ARCHITECTURE.md` | ? | Read - may overlap with voter-protocol crypto docs |
| `FRONTEND-ARCHITECTURE.md` | ? | Read - should focus on Communiqué frontend only |
| `architecture/ARCHITECTURE-DECISION-RECORD.md` | ? | Read - may have outdated decisions |
| `architecture/TEE-SYSTEMS-OVERVIEW.md` | ? | Read - TEE architecture may belong in voter-protocol |
| `architecture/cloud-agnostic-tee-abstraction.md` | ? | Read - same as above |

---

## Category 5: Design Docs (LIKELY OK, BUT VERIFY)

These are probably fine (UI/UX focused), but check for:
- References to deprecated features
- Outdated user flows
- Superseded design decisions

| Folder | Files | Action |
|--------|-------|--------|
| `/docs/design/` | 11 files | Quick scan for references to location/district features that changed |

---

## Category 6: Status/Progress Docs (CONSOLIDATE)

Multiple status docs exist - consolidate or delete stale ones:

| File | Status | Action |
|------|--------|--------|
| `STATUS-2025-11-04.md` | Outdated (2 months old) | Review - may be obsolete |
| `WEEK-1-COMPLETE.md` | Historical | Review - may be obsolete |
| `MONTH-1-WEEK-1-SUMMARY.md` | Historical | Review - may be obsolete |
| `PHASE-1-MONTH-1-IMPLEMENTATION.md` | Historical | Review - may be obsolete |

**Recommendation**: Keep one current status doc, archive or delete historical ones

---

## Category 7: Strategic/Vision Docs (REVIEW FOR RELEVANCE)

| File | Status | Action |
|------|--------|--------|
| `COORDINATION-PLATFORM.md` | ? | Read - ensure aligns with current vision |
| `GROWTH-STRATEGY.md` | ? | Read - check if outdated |
| `REALITY-GROUNDED-STRATEGY.md` | ? | Read - may be superseded |
| `PHASE-1-REALITY-GROUNDED.md` | ? | Read - duplicate? |
| `WHAT-ACTUALLY-WORKS.md` | ? | Read - vague title, may be consolidatable |
| `WHAT-PEOPLE-ARE-ACTUALLY-ORGANIZING-AROUND.md` | ? | Read - same as above |
| `THE-VEIL-UNPEELED.md` | ? | Read - unclear purpose |
| `WHAT-BRUTALIST-SHOULD-HAVE-SAID.md` | ? | Read - unclear purpose |

**Recommendation**: Consolidate strategic vision docs into single authoritative source

---

## Category 8: Integration/Technical Docs (VERIFY ACCURACY)

| File | Status | Action |
|------|--------|--------|
| `INTEGRATION-GUIDE.md` | ? | Read - ensure voter-protocol integration is accurate |
| `cwc-integration.md` | ? | Read - Congressional delivery integration |
| `legislative-abstraction.md` | ? | Read - check for location/district references |

---

## Immediate Actions (This Session)

### **Priority 1: Delete Obsolete Location Docs** ✅

```bash
# Delete entire location folder (2,796 lines)
rm -rf /Users/noot/Documents/communique/docs/location/

# Delete root-level privacy docs (1,130 lines)
rm /Users/noot/Documents/communique/docs/LOCATION-CACHE-PRIVACY-ANALYSIS.md
rm /Users/noot/Documents/communique/docs/PRIVACY-PRESERVING-DISTRICT-VERIFICATION.md
```

**Impact**: Remove ~4,000 lines of obsolete documentation

### **Priority 2: Update README to Reference Correct Docs**

Check if `/docs/README.md` or root `README.md` references deleted docs - update links

### **Priority 3: Scan Remaining Docs for Location References**

Search for references to deleted concepts:
- LocationCache
- Cicero API (server-side)
- Client-side boundary matching
- Census Bureau geocoding (from Communiqué)

Update any docs that reference these as if Communiqué implements them

---

## Next Steps (Follow-Up Session)

### **Phase 1: Architecture Doc Review** (1-2 hours)

Read and categorize:
- `CYPHERPUNK-ARCHITECTURE.md`
- `FRONTEND-ARCHITECTURE.md`
- `architecture/ARCHITECTURE-DECISION-RECORD.md`
- `architecture/TEE-SYSTEMS-OVERVIEW.md`
- `architecture/cloud-agnostic-tee-abstraction.md`

**Decision criteria:**
- Does this belong in voter-protocol? → Move or delete
- Is this outdated? → Update or delete
- Does this duplicate another doc? → Consolidate

### **Phase 2: Strategic Doc Consolidation** (1 hour)

Consolidate vision/strategy docs:
- Keep: Single authoritative roadmap/vision doc
- Archive: Historical strategy docs (move to `/docs/archive/`)
- Delete: Duplicates or obsolete

### **Phase 3: Integration Doc Verification** (30 minutes)

Ensure integration docs reflect correct architecture:
- `INTEGRATION-GUIDE.md`: Should mention `@voter-protocol/client`
- `cwc-integration.md`: Verify congressional delivery flow
- `legislative-abstraction.md`: Check for outdated location logic

### **Phase 4: Database Schema Doc Update** (15 minutes)

Verify database docs reflect:
- NO LocationCache table
- NO CiceroBudget table
- YES district_commitment field (User model)
- YES zero-knowledge fields

---

## Metrics

### **Before Cleanup:**
- Total markdown files: ~100
- Obsolete documentation: ~4,000 lines
- Duplication level: HIGH (location/district docs duplicated across 8 files)

### **After Cleanup (Projected):**
- Total markdown files: ~85-90 (10-15% reduction)
- Obsolete documentation: 0 lines
- Duplication level: LOW (single source of truth for each topic)

### **Time Saved (Future Developers):**
- Reading obsolete docs: ~4 hours saved
- Implementing wrong architecture: ~2-3 weeks saved
- Debugging mismatched expectations: ~1 week saved

**Total ROI**: ~4 weeks of development time saved by deleting misleading docs

---

## Checklist

### Immediate (This Session):
- [ ] Delete `/docs/location/` folder (2,796 lines)
- [ ] Delete `LOCATION-CACHE-PRIVACY-ANALYSIS.md` (486 lines)
- [ ] Delete `PRIVACY-PRESERVING-DISTRICT-VERIFICATION.md` (644 lines)
- [ ] Verify `DISTRICT-VERIFICATION-IMPLEMENTATION.md` has deprecation warning (already done)
- [ ] Update any README files referencing deleted docs
- [ ] Commit with message: "docs: remove obsolete location/district verification documentation (voter-protocol owns this infrastructure)"

### Follow-Up (Next Session):
- [ ] Review architecture docs for voter-protocol overlap
- [ ] Consolidate strategic/vision docs
- [ ] Verify integration docs are accurate
- [ ] Check database schema docs
- [ ] Create `/docs/archive/` for historical docs (if keeping any)

---

## Communication

**For future developers:**

If you're looking for documentation on:
- **District verification**: See voter-protocol `/docs/DISTRICT-VERIFICATION.md`
- **Shadow Atlas**: See voter-protocol `/docs/SHADOW-ATLAS-DATA-STRATEGY.md`
- **Geocoding**: See voter-protocol `/docs/GEOCODING-ARCHITECTURE.md`
- **Communiqué's role**: See `/docs/DISTRICT-VERIFICATION-RESPONSIBILITIES.md`

**Communiqué is a THIN CLIENT. It does NOT implement:**
- ❌ Shadow Atlas generation
- ❌ Geocoding services
- ❌ District resolution
- ❌ Merkle tree building
- ❌ Halo2 ZK circuits

**Communiqué ONLY:**
- ✅ Installs `@voter-protocol/client`
- ✅ Calls `voterClient.verifyDistrict(address)`
- ✅ Stores commitment hash in database
- ✅ Displays verification status in UI

---

**Next action**: Execute Priority 1 deletions and commit changes
