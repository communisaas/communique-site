# Documentation Structure Plan

**Date**: 2025-01-09
**Goal**: Organize docs by context and responsibility, minimal moves

---

## Current Problem

Docs are flat in `/docs/` with unclear relationships:
- 80+ markdown files in one directory
- Similar topics scattered (architecture, strategic, status)
- No clear separation between conceptual vs implementation docs

---

## Proposed Structure

### Keep Flat Root for Core Docs

```
/docs/
├── README.md                          # Documentation index
├── CLAUDE.md                          # (root level - Claude Code instructions)
├── CYPHERPUNK-ARCHITECTURE.md         # Product philosophy (authoritative)
├── FRONTEND-ARCHITECTURE.md           # SvelteKit 5 technical reference
├── DISTRICT-VERIFICATION-RESPONSIBILITIES.md  # voter-protocol separation
└── DOCUMENTATION-CLEANUP-PLAN.md      # Cleanup roadmap
```

### Organize by Domain

```
/docs/
├── architecture/                      # Technical architecture decisions
│   ├── ARCHITECTURE-DECISION-RECORD.md   # Browser WASM proving
│   ├── TEE-SYSTEMS-OVERVIEW.md           # Message delivery TEE (communiqué)
│   └── cloud-agnostic-tee-abstraction.md # Multi-cloud TEE
│
├── congressional/                     # Congressional delivery system
│   ├── cwc-integration.md                # CWC API integration
│   ├── dashboard-implementation-plan.md  # Office dashboard
│   └── DELIVERY-PATHS.md                 # Message delivery flow
│
├── design/                            # UI/UX design
│   ├── README.md                         # Design system overview
│   ├── design-system-principles.md
│   ├── language-voice-guidelines.md
│   └── (11 design docs)
│
├── features/                          # Feature-specific docs
│   ├── template-creator.md
│   ├── TEMPLATE-SYSTEM.md
│   ├── legislative-abstraction.md
│   └── oauth-setup.md
│
├── strategy/                          # Strategic/vision (CONSOLIDATE)
│   ├── PHASE-1-REALITY-GROUNDED.md       # Phase 1 strategy (keep)
│   └── (DELETE: 8 duplicate strategy docs)
│
└── archive/                           # Historical docs
    └── historical/
        ├── WEEK-1-COMPLETE.md
        ├── MONTH-1-WEEK-1-SUMMARY.md
        └── STATUS-2025-11-04.md
```

---

## Action Plan

### Step 1: Create Directories (No Moves Yet)

```bash
mkdir -p /Users/noot/Documents/communique/docs/congressional
mkdir -p /Users/noot/Documents/communique/docs/features
mkdir -p /Users/noot/Documents/communique/docs/strategy
mkdir -p /Users/noot/Documents/communique/docs/archive/historical
```

### Step 2: Move Only What's Clear

**Congressional delivery docs:**
```bash
# Already in /docs/congressional/ - verify:
ls /Users/noot/Documents/communique/docs/congressional/

# Move if needed:
mv /Users/noot/Documents/communique/docs/cwc-integration.md /Users/noot/Documents/communique/docs/congressional/
mv /Users/noot/Documents/communique/docs/DELIVERY-PATHS.md /Users/noot/Documents/communique/docs/congressional/
```

**Feature docs:**
```bash
mv /Users/noot/Documents/communique/docs/template-creator.md /Users/noot/Documents/communique/docs/features/
mv /Users/noot/Documents/communique/docs/TEMPLATE-SYSTEM.md /Users/noot/Documents/communique/docs/features/
mv /Users/noot/Documents/communique/docs/legislative-abstraction.md /Users/noot/Documents/communique/docs/features/
mv /Users/noot/Documents/communique/docs/oauth-setup.md /Users/noot/Documents/communique/docs/features/
```

**Historical status docs:**
```bash
mv /Users/noot/Documents/communique/docs/WEEK-1-COMPLETE.md /Users/noot/Documents/communique/docs/archive/historical/
mv /Users/noot/Documents/communique/docs/MONTH-1-WEEK-1-SUMMARY.md /Users/noot/Documents/communique/docs/archive/historical/
mv /Users/noot/Documents/communique/docs/STATUS-2025-11-04.md /Users/noot/Documents/communique/docs/archive/historical/
```

### Step 3: Delete Duplicates (After Reading)

**Strategic docs to consolidate:**
- Keep: PHASE-1-REALITY-GROUNDED.md (move to /docs/strategy/)
- Read and likely delete:
  - REALITY-GROUNDED-STRATEGY.md (duplicate?)
  - WHAT-ACTUALLY-WORKS.md (vague, consolidatable)
  - WHAT-PEOPLE-ARE-ACTUALLY-ORGANIZING-AROUND.md (vague)
  - THE-VEIL-UNPEELED.md (unclear)
  - WHAT-BRUTALIST-SHOULD-HAVE-SAID.md (unclear)

---

## Documentation Index (Create)

Create `/docs/README.md` as navigation:

```markdown
# Communiqué Documentation

## 📐 Architecture
- [Product Philosophy](CYPHERPUNK-ARCHITECTURE.md) - Authoritative vision
- [Frontend Architecture](FRONTEND-ARCHITECTURE.md) - SvelteKit 5 patterns
- [Architecture Decisions](architecture/ARCHITECTURE-DECISION-RECORD.md)
- [TEE Systems](architecture/TEE-SYSTEMS-OVERVIEW.md)
- [District Verification](DISTRICT-VERIFICATION-RESPONSIBILITIES.md) - voter-protocol integration

## 🏛️ Congressional Delivery
- [CWC Integration](congressional/cwc-integration.md)
- [Delivery Paths](congressional/DELIVERY-PATHS.md)
- [Office Dashboard](congressional/dashboard-implementation-plan.md)

## 🎨 Design System
- [Design Principles](design/design-system-principles.md)
- [Voice Guidelines](design/language-voice-guidelines.md)

## ✨ Features
- [Template System](features/TEMPLATE-SYSTEM.md)
- [Template Creator](features/template-creator.md)
- [OAuth Setup](features/oauth-setup.md)

## 📊 Strategy
- [Phase 1 Strategy](strategy/PHASE-1-REALITY-GROUNDED.md)

## 🗄️ Archive
- [Historical Status Updates](archive/historical/)
```

---

## Principles

1. **Minimal moves** - Only move what's clearly categorizable
2. **No voter-protocol cruft** - TEE docs stay here (communiqué implements delivery TEE)
3. **Related docs together** - Architecture in `/architecture/`, congressional in `/congressional/`
4. **Clear ownership** - Each directory has one clear purpose
5. **Navigation via README** - `/docs/README.md` is entry point

---

**Next**: Create directories, move clear candidates, then tackle strategic consolidation
