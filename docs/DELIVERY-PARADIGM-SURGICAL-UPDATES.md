# Delivery Paradigm Surgical Updates Needed

**Date**: 2025-11-09
**Status**: Protocol-first framing complete in core docs, minor references remain

---

## Completed Updates

### Core Documentation (✅ Complete)
- `docs/congressional/delivery.md` - Complete rewrite, protocol-first
- `docs/congressional/index.md` - Protocol participation framing

**New paradigm**: OAuth enables protocol participation (impact tracking, reputation, coordination), not just "delivery verification."

---

## Files Needing Minor Surgical Updates

### 1. `docs/features/search.md:119`
**Current**: `"CWC_MESSAGE" → Delivery method filter`
**Should be**: `"CWC_MESSAGE" → Message type filter` or remove "delivery method" language

**Context**: Search filter examples

---

### 2. `docs/design/system.md:84`
**Current**: "Clear semantic differentiation between delivery methods helps users understand their impact and routing."
**Should be**: "Clear semantic differentiation between message types helps users understand routing."

**Context**: Design system colors

---

### 3. `docs/design/system.md:537`
**Current**: "Representative's office mailbox is full. Trying alternate delivery method."
**Should be**: "Representative's office mailbox is full. We'll retry automatically."

**Context**: Error message copy

---

### 4. `docs/design/README.md:57`
**Current**: "Current architecture state (federal vs. state/county/city delivery methods)"
**Should be**: "Current architecture state (federal district verification + OAuth for all entities)"

**Context**: Index description

---

### 5. `docs/design/governance.md:91-92`
**Current**:
```
// Delivery method depends on governance level
delivery_method String  // 'cwc_api' | 'mailto' | 'direct_form'
```

**Should be**:
```
// Message routing handled by protocol (users don't choose)
delivery_method String  // Internal: 'cwc_api' | 'mailto' | 'direct_form'
```

**Context**: Database schema documentation

---

## Why These Are Minor

These are **implementation details** or **internal terminology**, not user-facing paradigm shifts.

The core user-facing framing is complete:
- Users join the protocol (OAuth) to track impact and coordinate
- Users can send without tracking (no OAuth)
- OAuth enables the voter-protocol utility, not just "delivery verification"

---

## When to Update

**Priority**: Low (technical debt cleanup)

**Timing**: Next time editing these files for other reasons, update terminology

**Not urgent**: User-facing docs are correct, these are internal/design system references
