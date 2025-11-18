# Design Iterations Archive (November 2025)

**Status**: Historical - Completed design iterations
**Created**: 2025-11-16 (consolidated from docs/design/)

## What's Here

Historical design iteration documents from completed UX improvements:

- **OAUTH-FLOW-REFACTOR-SPEC.md** - Original specification for OAuth flow redesign
- **OAUTH-FLOW-REFACTOR-COMPLETE.md** - Completion summary (implemented Nov 2025)
- **UI-COPY-PHASE-1-AUDIT.md** - Phase 1 launch copy audit (Jan 2025)
- **PROGRESSIVE-PRECISION-UNLOCK-UX.md** - Progressive precision UX iteration

## Current Documentation

For **current** design documentation, see:
- `/docs/design/voice.md` - Voice & tone guidelines (active)
- `/docs/design/principles.md` - Design principles (active)
- `/docs/design/system.md` - Component library (active)
- `/docs/design/index.md` - Design system navigation

## Why Archived

### OAuth Flow Refactor (Complete)
**Problem solved**: 40-60% drop-off at forced address collection wall after OAuth

**Solution implemented**:
- OAuth callback no longer redirects to `/onboarding/address`
- Address collection happens inline within modals, only when needed
- Context preserved throughout flow

**Result**: OAuth → message sent conversion improved 60-90%

**Current state**: Implemented and working as designed. Spec and completion summary archived for historical reference.

### UI Copy Audit (Phase 1)
**Context**: Pre-OAuth launch (Jan 2025)

**Focus**: Align copy with reality (Congressional delivery only, no OAuth email yet)

**Current state**: OAuth implemented, copy evolved beyond this audit. Retained for historical context.

### Progressive Precision UX
**Context**: Early location inference UX iterations

**Current state**: Location system evolved into comprehensive 5-signal progressive inference (see `/docs/architecture/LOCATION-SIGNAL-ACCURACY-LIMITS.md`)

## Evolution Path

These documents show the evolution of key UX patterns:

1. **OAuth Flow** (2025-11-10)
   - Before: Forced address wall
   - After: Contextual inline address collection

2. **Copy Strategy** (2025-01-09)
   - Before: Generic "delivery methods" language
   - After: User-centric "who you're messaging" framing

3. **Location Precision** (iterative)
   - Before: False precision from IP geolocation
   - After: Honest state-level from IP, district-level only with permission

**Retained for understanding design evolution, not for current implementation guidance.**
