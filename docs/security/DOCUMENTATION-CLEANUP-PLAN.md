# Documentation Cleanup Plan

**Date:** October 13, 2025
**Context:** After architectural correction (PostgreSQL encryption → NEAR CipherVault)
**Purpose:** Identify outdated docs, preserve correct docs, prevent future confusion

---

## 📋 Current State Analysis

### Files in `docs/security/`:

```
blockchain-integration-plan.md          Oct 13 14:56  (5-week plan, partially outdated)
bootstrap-strategy.md                   Oct 13 15:37  (contains misguiding advice)
CLEANUP-COMPLETE.md                     Oct 13 17:26  ✅ KEEP
CRITICAL-ARCHITECTURAL-REALIGNMENT.md   Oct 13 17:06  ✅ KEEP
IMPLEMENTATION-STATUS.md                Oct 13 17:31  ✅ KEEP (primary doc)
week2-infrastructure-research.md        Oct 13 15:26  (IPFS/Lit Protocol research)
week2-rpc-integration-complete.md       Oct 13 16:02  ✅ KEEP
week2-rpc-strategy-revised.md           Oct 13 15:45  (superseded by integration-complete)
week2-testing-strategy.md               Oct 13 16:37  ✅ KEEP
```

---

## 🗑️ Files to DELETE

### 1. `blockchain-integration-plan.md`

**Why Delete:**
- **Lines 275-288**: "Move Metadata to IPFS" - Wrong approach, should be CipherVault
- **Lines 193-209**: "Social Recovery Part B" - Redundant with correct docs
- **Entire Week 2-5 plan**: Superseded by `IMPLEMENTATION-STATUS.md`
- **Week 1 content**: Redundant with commit history and correct docs

**What's Valuable (Already Captured Elsewhere):**
- Week 1 critical fixes: Documented in git history and IMPLEMENTATION-STATUS.md
- Security checklist: Covered in IMPLEMENTATION-STATUS.md launch readiness section
- Trust model discussion: Will be created properly in Week 3

**Replacement:** `IMPLEMENTATION-STATUS.md` is the authoritative implementation plan going forward.

### 2. `week2-rpc-strategy-revised.md`

**Why Delete:**
- Superseded by `week2-rpc-integration-complete.md`
- Research phase document, implementation is done
- All valuable info captured in integration-complete doc

**What's Valuable (Already Captured):**
- Free RPC provider analysis: In `week2-rpc-integration-complete.md`
- Implementation strategy: Already implemented

### 3. `bootstrap-strategy.md`

**Why Delete (MOST IMPORTANT):**
- **Lines 23-24**: "Can use simpler client-side encryption" - THIS EXACT GUIDANCE CAUSED THE ARCHITECTURAL VIOLATION
- **Lines 117-163**: Full AES-256-GCM example - Wrong algorithm (should be XChaCha20-Poly1305)
- **Lines 425-433**: "Add client-side encryption (2-3 days)" - Misleading task
- **Entire "free tier" framing**: While budget-conscious, it led to wrong technical decisions

**The Danger:**
This document contains the **exact misinterpretation** that led us to build PostgreSQL encryption instead of CipherVault. It says:

> "Client-side encryption for sensitive data before it touches Supabase."

This was intended as **temporary bootstrap guidance** but we implemented it as **permanent architecture**.

**Replacement:**
- Budget strategy: Can be a separate doc without encryption guidance
- RPC failover discussion: Already implemented and documented
- Cost analysis: Relevant but dangerous when mixed with architecture decisions

**Option:** Rewrite as `ZERO-BUDGET-INFRASTRUCTURE.md` with:
- ✅ RPC free tier strategy (correct)
- ✅ Supabase free tier analysis (correct for metadata)
- ❌ Remove ALL encryption guidance (defer to VOTER Protocol architecture)

---

## 📚 Files to KEEP

### Keep As-Is (Current & Accurate)

1. **`IMPLEMENTATION-STATUS.md`** ✅
   - **Purpose:** Single source of truth for current implementation status
   - **Content:** Week 1-2 complete, Week 2-3 in progress (CipherVault), Week 3-5 planned
   - **Status:** PRIMARY DOCUMENT - all other docs defer to this

2. **`CRITICAL-ARCHITECTURAL-REALIGNMENT.md`** ✅
   - **Purpose:** Historical record of what went wrong and why
   - **Content:** Documents PostgreSQL encryption violation and correct CipherVault approach
   - **Value:** Prevents repeating the same mistake
   - **Status:** Important historical document, never delete

3. **`CLEANUP-COMPLETE.md`** ✅
   - **Purpose:** Verification that legacy code was removed
   - **Content:** Lists deleted files, database schema cleanup, verification commands
   - **Value:** Audit trail showing no dead code remains
   - **Status:** Historical verification, keep indefinitely

4. **`week2-rpc-integration-complete.md`** ✅
   - **Purpose:** Documents production-ready RPC abstraction layer
   - **Content:** Architecture, implementation details, zero-budget strategy
   - **Value:** RPC work is correct and valuable
   - **Status:** Reference doc for RPC infrastructure

5. **`week2-testing-strategy.md`** ✅
   - **Purpose:** Philosophy of testing approach
   - **Content:** Logic tests now (foundation), chaos tests later (with production data)
   - **Value:** Explains why we're not over-testing right now
   - **Status:** Still relevant, philosophy is sound

### Keep for Reference (Historical/Future)

6. **`week2-infrastructure-research.md`** 📚
   - **Purpose:** IPFS and Lit Protocol research
   - **Content:** Lighthouse, 4EVERLAND, encryption strategies
   - **Value:** Useful when we have revenue for infrastructure upgrades
   - **Status:** Archive as reference, not current plan
   - **Action:** Add header noting "Future Infrastructure Options - Not Current Implementation"

---

## ✏️ Files to REWRITE

### 1. Create: `ZERO-BUDGET-INFRASTRUCTURE.md`

**Extract from `bootstrap-strategy.md`:**
- ✅ Supabase free tier analysis (correct for public/pseudonymous data)
- ✅ RPC free tier strategy (already implemented)
- ✅ Growth projections and cost analysis
- ✅ Grant and sponsorship options

**REMOVE:**
- ❌ All encryption guidance (defer to VOTER Protocol)
- ❌ "Client-side encryption" section (caused the violation)
- ❌ AES-256-GCM examples (wrong algorithm)

**NEW CONTENT:**
- Link to VOTER Protocol architecture for PII storage
- Clear statement: "PII must be stored in NEAR CipherVault, NOT PostgreSQL"
- Budget analysis for CipherVault gas costs (user-paid)

---

## 📝 Action Plan

### Step 1: Delete Obsolete Docs (Immediate)

```bash
# Move to archive instead of deleting (safety)
mkdir -p docs/security/archive

git mv docs/security/blockchain-integration-plan.md docs/security/archive/
git mv docs/security/bootstrap-strategy.md docs/security/archive/
git mv docs/security/week2-rpc-strategy-revised.md docs/security/archive/

git commit -m "archive: move outdated security docs to archive/

- blockchain-integration-plan.md: Superseded by IMPLEMENTATION-STATUS.md
- bootstrap-strategy.md: Contained misguiding encryption advice
- week2-rpc-strategy-revised.md: Superseded by week2-rpc-integration-complete.md

These docs are preserved in archive/ for historical reference but should
not be consulted for current implementation guidance.
"
```

### Step 2: Add Warning Headers (Safety)

Add to archived files:

```markdown
# ⚠️ ARCHIVED DOCUMENT ⚠️

**Status:** OUTDATED - Do not use for implementation guidance
**Archived:** October 13, 2025
**Reason:** [Specific reason - see DOCUMENTATION-CLEANUP-PLAN.md]
**Current Docs:** See `IMPLEMENTATION-STATUS.md` for authoritative plan

---
```

### Step 3: Update Infrastructure Research (Add Context)

Add to top of `week2-infrastructure-research.md`:

```markdown
# ⚠️ FUTURE INFRASTRUCTURE REFERENCE ⚠️

**Status:** Reference for post-revenue infrastructure upgrades
**Not Current Plan:** See `IMPLEMENTATION-STATUS.md` for current work
**Use Case:** When budget allows IPFS migration and advanced encryption

**Current Implementation:**
- **PII Storage:** NEAR CipherVault (decentralized blockchain)
- **Metadata Storage:** PostgreSQL (public/pseudonymous only)
- **Future Upgrade:** Filecoin archival (post-revenue)

---
```

### Step 4: Create New Budget Doc (Extract Safe Content)

```bash
# Create clean budget doc
cp docs/security/bootstrap-strategy.md docs/security/ZERO-BUDGET-INFRASTRUCTURE.md

# Manually edit to remove encryption guidance
# (This requires careful review and rewriting)
```

### Step 5: Verify Final State

```bash
# Correct docs in place
ls docs/security/*.md

# Expected output:
# CLEANUP-COMPLETE.md
# CRITICAL-ARCHITECTURAL-REALIGNMENT.md
# DOCUMENTATION-CLEANUP-PLAN.md  (this file)
# IMPLEMENTATION-STATUS.md  (PRIMARY)
# week2-infrastructure-research.md  (with warning header)
# week2-rpc-integration-complete.md
# week2-testing-strategy.md
# ZERO-BUDGET-INFRASTRUCTURE.md  (new, clean)

# Archived docs preserved
ls docs/security/archive/*.md

# Expected output:
# blockchain-integration-plan.md  (with warning header)
# bootstrap-strategy.md  (with warning header)
# week2-rpc-strategy-revised.md  (with warning header)
```

---

## 🎯 Success Criteria

After cleanup:

- ✅ `IMPLEMENTATION-STATUS.md` is clearly the primary document
- ✅ No docs contain misleading encryption guidance
- ✅ Historical record preserved in archive/
- ✅ Warning headers prevent accidental use of outdated docs
- ✅ Budget/infrastructure guidance separated from architecture decisions
- ✅ All remaining docs are accurate and current

---

## 🚨 Why This Matters

**The Problem:**
`bootstrap-strategy.md` said "client-side encryption for sensitive data before it touches Supabase" - This guidance led to 12 hours of work on the wrong architecture.

**The Fix:**
Move that doc to archive with warning header. Future readers won't repeat the mistake.

**The Lesson:**
Keep architecture docs (what to build) separate from budget docs (how to afford it). Budget constraints should never drive architectural violations.

---

## 📚 Final Document Structure

```
docs/security/
├── IMPLEMENTATION-STATUS.md              (PRIMARY - current status)
├── CRITICAL-ARCHITECTURAL-REALIGNMENT.md (historical record)
├── CLEANUP-COMPLETE.md                   (verification)
├── DOCUMENTATION-CLEANUP-PLAN.md         (this file)
├── week2-rpc-integration-complete.md     (RPC reference)
├── week2-testing-strategy.md             (testing philosophy)
├── week2-infrastructure-research.md      (future reference, with warning)
├── ZERO-BUDGET-INFRASTRUCTURE.md         (new: clean budget guidance)
└── archive/
    ├── blockchain-integration-plan.md    (superseded, with warning)
    ├── bootstrap-strategy.md             (misleading, with warning)
    └── week2-rpc-strategy-revised.md     (superseded, with warning)
```

---

**Next Steps:**
1. Review this cleanup plan
2. Execute Step 1 (archive outdated docs)
3. Execute Step 2 (add warning headers)
4. Execute Step 3 (update infrastructure research)
5. Defer Step 4 (budget doc rewrite) - not urgent, can do when needed
6. Verify final state

**Time Required:** 30 minutes
**Priority:** High (prevents future confusion)
**Risk:** Low (archiving, not deleting)
