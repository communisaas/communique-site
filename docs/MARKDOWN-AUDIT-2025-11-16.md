# Markdown Documentation Audit
**Date**: 2025-11-16
**Total Files Analyzed**: 139 (excluding node_modules, .svelte-kit, build, coverage artifacts)

## Executive Summary

**Current State**: 139 markdown files, significant redundancy and fragmentation
**Recommendation**: Consolidate to ~30-40 core files, archive/delete the rest
**Priority**: HIGH - Documentation debt is making navigation difficult for both humans and AI

---

## Analysis by Category

### ✅ KEEP - Core Documentation (Already Well-Organized)

#### Navigation & Architecture (5 files)
- `/CLAUDE.md` (792 lines) - Claude Code entry point ✅
- `/README.md` (507 lines) - Project overview ✅
- `/docs/README.md` (186 lines) - Documentation navigation map ✅
- `/docs/ARCHITECTURE.md` (635 lines) - Communiqué/voter-protocol separation ✅
- `/docs/IMPLEMENTATION-STATUS.md` (839 lines) - SINGLE SOURCE OF TRUTH ✅

#### Integration & Frontend (2 files)
- `/docs/INTEGRATION.md` (542 lines) - CWC API, OAuth, integrations ✅
- `/docs/FRONTEND.md` (679 lines) - SvelteKit 5, runes, patterns ✅

#### Features (11 files in `/docs/features/`)
**KEEP ALL** - Well-organized feature documentation:
- `abstraction.md` (319 lines)
- `creator.md` (411 lines)
- `email-lookup.md` (868 lines)
- `embeddings.md` (609 lines)
- `index.md` (225 lines)
- `jurisdiction.md` (822 lines)
- `oauth.md` (544 lines)
- `onboarding.md` (698 lines)
- `search.md` (384 lines)
- `sharing.md` (386 lines)
- `templates.md` (749 lines)

#### Development (11 files in `/docs/development/`)
**KEEP ALL** - Active development references:
- `analytics.md` (384 lines)
- `aws-deployment.md` (851 lines)
- `deployment.md` (517 lines)
- `flags.md` (499 lines)
- `index.md` (254 lines)
- `maintenance.md` (271 lines)
- `ownership.md` (543 lines)
- `quickstart.md` (975 lines)
- `schema.md` (748 lines)
- `seeding.md` (101 lines)
- `testing.md` (373 lines)

#### Specs (6 files in `/docs/specs/`)
**KEEP ALL** - Deep technical specifications:
- `civic-recognition-system.md` (582 lines)
- `interactive-location-breadcrumb.md` (541 lines)
- `portable-identity.md` (606 lines)
- `progressive-template-sections.md` (926 lines)
- `universal-credibility.md` (507 lines)
- `zk-proof-integration.md` (954 lines)

#### Architecture Deep-Dives (5 files in `/docs/architecture/`)
- `cloud-tee.md` (1049 lines) ✅
- `decision-record.md` (328 lines) ✅
- `index.md` (106 lines) ✅
- `LOCATION-SIGNAL-ACCURACY-LIMITS.md` (268 lines) ✅ NEW
- `tee-systems.md` (60 lines) ✅

**Total Core Docs to Keep**: ~41 files

---

## 🗑️ DELETE - Redundant / Superseded

### Root Level - Implementation Status Docs (DELETE 4 files)
**These are superseded by `/docs/IMPLEMENTATION-STATUS.md`**:

- `/CWC_MVP_STATUS.md` (52 lines) ❌ **DELETE** - Covered in IMPLEMENTATION-STATUS
- `/SLUG-FIX-SUMMARY.md` (75 lines) ❌ **DELETE** - Historical fix, done
- `/TEMPLATE-MODAL-AUTHWALL-REMOVAL.md` (209 lines) ❌ **DELETE** - Historical fix, done (this session!)
- `/TEST-SKIP-SUMMARY.md` (121 lines) ❌ **DELETE** - Test status, outdated

### Root Level - Hackathon Temporary Docs (DELETE 2 files)
- `/DEVPOST_STORY.md` (143 lines) ❌ **DELETE** - One-time hackathon submission
- `/HACKATHON-DEPLOY-CHECKLIST.md` (235 lines) ❌ **DELETE** - Superseded by `docs/development/deployment.md`

### `/docs` Root - Phase 2 Redundancy (DELETE/CONSOLIDATE 8 files)

**Problem**: Multiple overlapping "Phase 2" and "Proof Generation" docs. Should be consolidated.

- `/docs/COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md` (786 lines) ⚠️ **CONSOLIDATE** → Merge into `docs/specs/zk-proof-integration.md`
- `/docs/JURISDICTION-PRECISION-ANALYSIS.md` (452 lines) ⚠️ **CONSOLIDATE** → Merge into `docs/architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md`
- `/docs/LOCATION-UX-IMPLEMENTATION-COMPLETE.md` (319 lines) ❌ **DELETE** - Historical status doc
- `/docs/PHASE-2-COMPLETE-SUMMARY.md` (736 lines) ❌ **DELETE** - Historical summary
- `/docs/PHASE-2-IMPLEMENTATION-STATUS.md` (390 lines) ❌ **DELETE** - Superseded by IMPLEMENTATION-STATUS
- `/docs/PHASE-2-PROOF-GENERATION-UX-SPEC.md` (652 lines) ⚠️ **CONSOLIDATE** → Merge into `specs/zk-proof-integration.md`
- `/docs/PROGRESSIVE-FUNNEL-IMPLEMENTATION.md` (697 lines) ❌ **DELETE** - Historical implementation doc
- `/docs/PROOF-GENERATION-UX.md` (341 lines) ⚠️ **CONSOLIDATE** → Merge into `specs/zk-proof-integration.md`

### `/docs` Root - UX Responsibilities (DELETE 1 file)
- `/docs/UX-RESPONSIBILITIES.md` (691 lines) ⚠️ **CONSOLIDATE** → Split between `FRONTEND.md` and `design/principles.md`

### `/docs/congressional` - Redundant Index Files (DELETE 1 file)
**All 4 files are useful**, but `index.md` duplicates content:
- `cwc.md` (484 lines) ✅ KEEP
- `dashboard.md` (529 lines) ✅ KEEP
- `delivery.md` (408 lines) ✅ KEEP
- `index.md` (281 lines) ❌ **DELETE** - Redundant with the other 3 files

### `/docs/design` - Massive Redundancy (CONSOLIDATE 18 → 8 files)

**Problem**: 18 design docs with heavy overlap. Many are completion reports, not references.

**KEEP (Core Design Principles - 8 files)**:
- `principles.md` (679 lines) ✅
- `voice.md` (495 lines) ✅
- `system.md` (850 lines) ✅
- `discovery.md` (819 lines) ✅
- `component-examples.md` (712 lines) ✅
- `INFERRABLE-DEFAULTS-PATTERN.md` (329 lines) ✅
- `LOCATION-AS-FILTER-PRINCIPLE.md` (325 lines) ✅
- `README.md` (206 lines) ✅

**DELETE/CONSOLIDATE (10 files)**:
- `component-examples.md` (712 lines) ⚠️ **CONSOLIDATE** → Merge examples into `system.md`
- `friction.md` (72 lines) ⚠️ **CONSOLIDATE** → Merge into `principles.md` (too small)
- `governance.md` (679 lines) ❌ **MOVE** → Should be in `/docs/strategy/`
- `identity-verification.md` (472 lines) ⚠️ **CONSOLIDATE** → Merge into `features/oauth.md`
- `index.md` (189 lines) ❌ **DELETE** - Redundant with README.md
- `OAUTH-FLOW-REFACTOR-COMPLETE.md` (471 lines) ❌ **DELETE** - Historical completion report
- `OAUTH-FLOW-REFACTOR-SPEC.md` (501 lines) ❌ **DELETE** - Superseded by features/oauth.md
- `PROGRESSIVE-PRECISION-UNLOCK-UX.md` (684 lines) ⚠️ **CONSOLIDATE** → Merge into LOCATION-AS-FILTER-PRINCIPLE
- `redesign.md` (589 lines) ❌ **DELETE** - Historical redesign doc
- `search-ux.md` (235 lines) ⚠️ **CONSOLIDATE** → Merge into features/search.md
- `structure.md` (49 lines) ⚠️ **CONSOLIDATE** → Merge into principles.md (too small)
- `UI-COPY-PHASE-1-AUDIT.md` (481 lines) ❌ **DELETE** - Historical audit, completed

### `/docs/hackathon` - Temporary Specs (MOVE 4 files)

**These are integration guides, not "hackathon" docs. Move to `/docs/development/integrations/`**:

- `decision-maker-resolution-integration.md` (1026 lines) ↗️ **MOVE** → `development/integrations/decision-makers.md`
- `message-generation-integration.md` (897 lines) ↗️ **MOVE** → `development/integrations/message-generation.md`
- `multi-target-delivery-spec.md` (1114 lines) ↗️ **MOVE** → `specs/multi-target-delivery.md`
- `toolhouse-subject-line-integration.md` (968 lines) ↗️ **MOVE** → `development/integrations/toolhouse.md`

### `/docs/research` - Underutilized (KEEP for now, monitor)
- `index.md` (105 lines) ✅
- `power-structures.md` (608 lines) ✅
- `tee-security.md` (479 lines) ✅

**Note**: Only 3 files. This is fine as a lightweight research reference.

### `/docs/strategy` - Overlapping Strategy Docs (CONSOLIDATE 8 → 5 files)

**KEEP**:
- `coordination.md` (372 lines) ✅
- `delivery-verification.md` (401 lines) ✅
- `launch.md` (477 lines) ✅
- `roadmap.md` (254 lines) ✅
- `viral.md` (744 lines) ✅

**DELETE**:
- `index.md` (83 lines) ❌ DELETE - Redundant with README.md
- `organizing.md` (341 lines) ⚠️ **CONSOLIDATE** → Merge into coordination.md
- `README.md` (94 lines) ❌ DELETE - Redundant with index.md

### `/docs/testing` - Good but Tiny (CONSOLIDATE 2 → 1 file)
- `DATABASE-CLEARING-ISSUE.md` (86 lines) ⚠️ **CONSOLIDATE** → Merge into `development/testing.md`
- `ZK-PROOF-TESTING-STRATEGY.md` (322 lines) ⚠️ **CONSOLIDATE** → Merge into `specs/zk-proof-integration.md`

---

## 📦 ARCHIVE - Already Archived (Leave Untouched)

### `/docs/archive/` (30 files)
**Status**: Already properly archived. No action needed. ✅

**Categories**:
- `migrations/` (3 files) - Privacy migration history
- `2025-11-location-progressive-discovery/` (3 files) - Location refactor history
- `2025-11-refactor/` (4 files) - Architecture refactor history
- `2025-01-district-verification/` (1 file) - Pre-voter-protocol separation
- `historical/` (19 files) - Various historical docs

**Action**: None. Leave as-is.

---

## 🔧 SPECIAL CASES - Technical READMEs (KEEP)

### Infrastructure & Code Documentation (KEEP ALL)
**These are code-adjacent READMEs, not narrative docs**:

- `/design-system-v2/*.md` (4 files) ✅ - Design system migration docs
- `/infrastructure/aws/**/*.md` (3 files) ✅ - AWS deployment
- `/prisma/*.md` (2 files) ✅ - Database schema docs
- `/scripts/README-ANALYTICS-AUDIT.md` (1 file) ✅
- `/src/lib/services/aws/README.md` (1 file) ✅
- `/src/test/README.md` (1 file) ✅
- `/tests/README.md` (1 file) ✅
- `/tee-workload/README.md` (1 file) ✅
- `/static/boundaries/README.md` (1 file) ✅
- `/.claude/agents/ux-frontend-engineer.md` (1 file) ✅

**Total**: 16 files - All essential code documentation.

---

## Consolidation Plan

### Phase 1: Delete Obvious Cruft (11 files)
```bash
# Root level
rm /Users/noot/Documents/communique/CWC_MVP_STATUS.md
rm /Users/noot/Documents/communique/SLUG-FIX-SUMMARY.md
rm /Users/noot/Documents/communique/TEMPLATE-MODAL-AUTHWALL-REMOVAL.md
rm /Users/noot/Documents/communique/TEST-SKIP-SUMMARY.md
rm /Users/noot/Documents/communique/DEVPOST_STORY.md
rm /Users/noot/Documents/communique/HACKATHON-DEPLOY-CHECKLIST.md

# docs/ root
rm /Users/noot/Documents/communique/docs/LOCATION-UX-IMPLEMENTATION-COMPLETE.md
rm /Users/noot/Documents/communique/docs/PHASE-2-COMPLETE-SUMMARY.md
rm /Users/noot/Documents/communique/docs/PHASE-2-IMPLEMENTATION-STATUS.md
rm /Users/noot/Documents/communique/docs/PROGRESSIVE-FUNNEL-IMPLEMENTATION.md

# docs/congressional
rm /Users/noot/Documents/communique/docs/congressional/index.md
```

### Phase 2: Consolidate Overlapping Docs (12 files)

**Consolidation Map**:

1. **ZK Proof Docs** (4 → 1):
   - Merge `COMMUNIQUE-ZK-IMPLEMENTATION-SPEC.md` → `specs/zk-proof-integration.md`
   - Merge `PHASE-2-PROOF-GENERATION-UX-SPEC.md` → `specs/zk-proof-integration.md`
   - Merge `PROOF-GENERATION-UX.md` → `specs/zk-proof-integration.md`
   - Merge `testing/ZK-PROOF-TESTING-STRATEGY.md` → `specs/zk-proof-integration.md`

2. **Location/Jurisdiction Docs** (2 → 1):
   - Merge `JURISDICTION-PRECISION-ANALYSIS.md` → `architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md`
   - Merge `design/PROGRESSIVE-PRECISION-UNLOCK-UX.md` → `architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md`

3. **Design Docs** (5 consolidations):
   - Merge `design/friction.md` → `design/principles.md`
   - Merge `design/structure.md` → `design/principles.md`
   - Merge `design/search-ux.md` → `features/search.md`
   - Merge `design/identity-verification.md` → `features/oauth.md`
   - Move `design/governance.md` → `strategy/governance.md`

4. **Strategy Docs** (1 consolidation):
   - Merge `strategy/organizing.md` → `strategy/coordination.md`

5. **Testing Docs** (1 consolidation):
   - Merge `testing/DATABASE-CLEARING-ISSUE.md` → `development/testing.md`

6. **UX Responsibilities**:
   - Split `UX-RESPONSIBILITIES.md` between `FRONTEND.md` and `design/principles.md`

### Phase 3: Move Misplaced Files (4 files)

```bash
# Create new directory
mkdir -p /Users/noot/Documents/communique/docs/development/integrations

# Move hackathon integration guides
mv /Users/noot/Documents/communique/docs/hackathon/decision-maker-resolution-integration.md \
   /Users/noot/Documents/communique/docs/development/integrations/decision-makers.md

mv /Users/noot/Documents/communique/docs/hackathon/message-generation-integration.md \
   /Users/noot/Documents/communique/docs/development/integrations/message-generation.md

mv /Users/noot/Documents/communique/docs/hackathon/toolhouse-subject-line-integration.md \
   /Users/noot/Documents/communique/docs/development/integrations/toolhouse.md

mv /Users/noot/Documents/communique/docs/hackathon/multi-target-delivery-spec.md \
   /Users/noot/Documents/communique/docs/specs/multi-target-delivery.md

# Remove empty hackathon directory
rmdir /Users/noot/Documents/communique/docs/hackathon
```

### Phase 4: Delete Redundant Index/README Files (7 files)

```bash
rm /Users/noot/Documents/communique/docs/design/index.md  # Redundant with README
rm /Users/noot/Documents/communique/docs/design/redesign.md  # Historical
rm /Users/noot/Documents/communique/docs/design/OAUTH-FLOW-REFACTOR-COMPLETE.md  # Historical
rm /Users/noot/Documents/communique/docs/design/OAUTH-FLOW-REFACTOR-SPEC.md  # Superseded
rm /Users/noot/Documents/communique/docs/design/UI-COPY-PHASE-1-AUDIT.md  # Historical
rm /Users/noot/Documents/communique/docs/strategy/index.md  # Redundant
rm /Users/noot/Documents/communique/docs/strategy/README.md  # Redundant
```

---

## Final Structure (After Consolidation)

### Target: ~45 Core Documentation Files

```
/ (2 docs)
├── CLAUDE.md
└── README.md

docs/ (35 docs + subdirectories)
├── README.md                           # Navigation map
├── IMPLEMENTATION-STATUS.md            # Single source of truth
├── ARCHITECTURE.md                     # System architecture
├── INTEGRATION.md                      # External integrations
├── FRONTEND.md                         # SvelteKit 5, runes
│
├── architecture/ (5 docs)
│   ├── cloud-tee.md
│   ├── decision-record.md
│   ├── index.md
│   ├── LOCATION-SIGNAL-ACCURACY-LIMITS.md ← CONSOLIDATED
│   └── tee-systems.md
│
├── congressional/ (3 docs)
│   ├── cwc.md
│   ├── dashboard.md
│   └── delivery.md
│
├── design/ (8 docs)
│   ├── component-examples.md
│   ├── discovery.md
│   ├── INFERRABLE-DEFAULTS-PATTERN.md
│   ├── LOCATION-AS-FILTER-PRINCIPLE.md
│   ├── principles.md ← CONSOLIDATED (friction, structure merged)
│   ├── README.md
│   ├── system.md
│   └── voice.md
│
├── development/ (11 docs + integrations/)
│   ├── analytics.md
│   ├── aws-deployment.md
│   ├── deployment.md
│   ├── flags.md
│   ├── index.md
│   ├── maintenance.md
│   ├── ownership.md
│   ├── quickstart.md
│   ├── schema.md
│   ├── seeding.md
│   ├── testing.md ← CONSOLIDATED (database-clearing merged)
│   └── integrations/ (NEW - 3 docs)
│       ├── decision-makers.md ← MOVED from hackathon/
│       ├── message-generation.md ← MOVED from hackathon/
│       └── toolhouse.md ← MOVED from hackathon/
│
├── features/ (11 docs)
│   ├── abstraction.md
│   ├── creator.md
│   ├── email-lookup.md
│   ├── embeddings.md
│   ├── index.md
│   ├── jurisdiction.md
│   ├── oauth.md ← CONSOLIDATED (identity-verification merged)
│   ├── onboarding.md
│   ├── search.md ← CONSOLIDATED (search-ux merged)
│   ├── sharing.md
│   └── templates.md
│
├── research/ (3 docs)
│   ├── index.md
│   ├── power-structures.md
│   └── tee-security.md
│
├── specs/ (7 docs)
│   ├── civic-recognition-system.md
│   ├── interactive-location-breadcrumb.md
│   ├── multi-target-delivery.md ← MOVED from hackathon/
│   ├── portable-identity.md
│   ├── progressive-template-sections.md
│   ├── universal-credibility.md
│   └── zk-proof-integration.md ← CONSOLIDATED (4 docs merged)
│
├── strategy/ (6 docs)
│   ├── coordination.md ← CONSOLIDATED (organizing merged)
│   ├── delivery-verification.md
│   ├── governance.md ← MOVED from design/
│   ├── launch.md
│   ├── roadmap.md
│   └── viral.md
│
└── archive/ (30 docs) ← UNCHANGED

design-system-v2/ (4 docs)
infrastructure/ (3 docs)
prisma/ (2 docs)
scripts/ (1 doc)
src/lib/services/aws/ (1 doc)
src/test/ (1 doc)
tests/ (1 doc)
tee-workload/ (1 doc)
static/boundaries/ (1 doc)
.claude/agents/ (1 doc)
```

**Total After Consolidation**: ~45 core docs (down from 139)
**Reduction**: 68% fewer files
**Improvement**: Clearer structure, no redundancy, faster navigation

---

## Immediate Action Items

### High Priority (Do First)
1. ✅ Delete 11 obvious cruft files (Phase 1)
2. ⚠️ Move 4 hackathon files to proper locations (Phase 3)
3. ❌ Delete 7 redundant index/README files (Phase 4)

### Medium Priority (Do Next)
4. 🔄 Consolidate ZK proof docs (4 → 1)
5. 🔄 Consolidate location docs (3 → 1)
6. 🔄 Clean up design/ directory (18 → 8 files)

### Low Priority (Nice to Have)
7. 🔄 Merge small testing docs
8. 🔄 Merge small strategy docs
9. 📝 Update all cross-references after consolidation
10. 📝 Update docs/README.md with new structure

---

## Success Metrics

**Before**: 139 markdown files, fragmented navigation, redundant information
**After**: ~45 core files, clear hierarchy, single source of truth for each topic
**Navigation Time**: <30 seconds to find any information (already claimed in README.md)
**Maintainability**: Low - each piece of information has ONE home

---

## Notes

- All file sizes are approximate (line counts)
- Archive directory (30 files) left untouched - proper historical record
- Code-adjacent READMEs (16 files) kept - essential for developers
- Total active documentation reduced from 109 narrative docs to ~45 core docs

**Next Step**: Execute Phase 1 deletions immediately?
