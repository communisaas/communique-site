# Design System Documentation

**Design system foundations, UI patterns, and interaction design.**

---

## Start Here: Design Foundations

### 1. [principles.md](principles.md) - Design Principles

Color tokens, typography scale, spacing system, visual hierarchy.

**What it defines**: Core design tokens used throughout the application.

**Read first**: Establishes design language foundation.

### 2. [voice.md](voice.md) - Voice & Tone

Writing style, messaging guidelines, copy patterns.

**What it defines**: How Communiqué speaks to users (direct, honest, technical).

**Key principle**: No bullshit. No emotional manipulation. Respect user intelligence.

### 3. [system.md](system.md) - Component Library

Reusable UI components, patterns, usage guidelines.

**What it defines**: Button variants, form inputs, modals, cards, navigation.

**Dependencies**: principles.md (uses design tokens)

---

## Layout & Structure

### 4. [structure.md](structure.md) - Layout Patterns

Grid system, responsive breakpoints, spacing conventions.

**What it defines**: How components are arranged on pages.

**Dependencies**: principles.md (spacing scale)

### 5. [friction.md](friction.md) - UX Friction Reduction

Patterns for reducing cognitive load, minimizing clicks, progressive disclosure.

**What it defines**: One-click actions, smart defaults, contextual help.

**Key insight**: Every extra click loses 20% of users.

---

## Feature-Specific UX

### 6. [discovery.md](discovery.md) - Template Discovery

Template browsing, filtering, recommendation UX.

**What it defines**: How users find relevant templates (search, categories, trending).

**Dependencies**: search-ux.md

### 7. [search-ux.md](search-ux.md) - Search Interaction

Search input behavior, autocomplete, result ranking display.

**What it defines**: Search interaction patterns, instant results, query refinement.

**Dependencies**: principles.md (typography, spacing)

---

## Advanced Patterns

### 8. [governance.md](governance.md) - Privacy-Preserving Governance UI

UI patterns for zero-knowledge voting, reputation display, challenge mechanisms.

**What it defines**: How to show collective decision-making without revealing individual votes.

**Key challenge**: Display "80% voted yes" without showing who voted.

### 9. [redesign.md](redesign.md) - Design Evolution

Notes on design iterations, rationale for changes, before/after comparisons.

**What it documents**: Why we redesigned X, what we learned, what worked/didn't work.

**Use case**: Historical context for design decisions.

---

## Component Documentation

### 10. [identity-verification.md](identity-verification.md) - Identity Verification UI

UI components for identity verification flow.

**What it defines**: IdentityVerificationFlow component architecture, emotional design, conversion optimization.

**Key principle**: "Stealthily cypherpunk" - privacy as empowerment, not paranoia.

### 11. [component-examples.md](component-examples.md) - Component Usage Examples

Practical usage examples for UI components.

**What it provides**: Code examples, integration patterns, common use cases.

---

## Design Philosophy (Definitive)

### ⭐ Start Here: Complete Design System

**[design-system.md](design-system.md)** - THE definitive design system (consolidated)

**Single source of truth** blending all philosophy docs:
- Typography system (Satoshi + JetBrains Mono)
- Color system (participation, semantic, surfaces)
- Component patterns (buttons, cards, forms, badges)
- Animation philosophy (paper plane, share, coordination dynamics)
- Voice & language (pragmatic cypherpunk)
- Accessibility standards (WCAG AA, keyboard, reduced-motion)
- Migration roadmap (3 phases, 6 weeks)

**Core principle**: "Invisible crypto, visible coordination"

**Key decisions**:
- ✅ Satoshi for words (headlines, UI, CTAs) - distinctive brand identity
- ✅ JetBrains Mono for numbers (counts, metrics, codes) - scannable data
- ✅ Dopamine-pushing animations for coordination (send, share, count updates)
- ✅ Subtle progressive disclosure for privacy (popovers, expandable details)
- ✅ "Credibly cool" aesthetic - neither corporate bland nor crypto tacky

### 📚 Historical Context

**[design-philosophy-evolution.md](design-philosophy-evolution.md)** - Analysis of philosophy evolution

Compares two competing philosophies that existed in codebase:
1. **Consumer-Friendly Privacy** (docs/design/) - Blend in with consumer apps
2. **Dynamic Coordination Hub** (design-system-v2/) - Distinctively cool

Shows reasoning for synthesis decision.

**[coordination-dynamics-philosophy.md](coordination-dynamics-philosophy.md)** - Initial synthesis (superseded by design-system.md)

First attempt at blending both philosophies. Preserved for historical context.

### Current Design Principles (Philosophy)

**1. Honesty over persuasion**
- No dark patterns
- No emotional manipulation
- No gamification that exploits psychology
- Respect user intelligence

**2. Clarity over cleverness**
- Clear labels (not cute metaphors)
- Direct language (not marketing speak)
- Obvious actions (not hidden features)

**3. Privacy-first UI**
- Zero-knowledge patterns visible in UI
- Make privacy guarantees tangible
- Show what we DON'T see, not just what we do

**4. Progressive disclosure**
- Start simple, reveal complexity on demand
- Don't overwhelm new users
- Power users can access advanced features

**5. Accessibility is non-negotiable**
- Keyboard navigation
- Screen reader support
- Color contrast (WCAG AA minimum)
- Touch targets (44px minimum)

---

## Cross-References

**Component implementation** → See `/src/lib/components/`

**Design tokens (CSS)** → See `/src/lib/styles/`

**Feature specs** → See `/docs/features/`

**Template UX** → See `/docs/features/creator.md`

---

## For Designers

**New to the design system?**
1. Read principles.md (design tokens)
2. Read voice.md (writing style)
3. Read system.md (component library)
4. Explore `/src/lib/components/` (implementation)

**Designing a new feature?**
1. Check friction.md (reduce cognitive load)
2. Check governance.md (if privacy-related)
3. Check discovery.md or search-ux.md (if search-related)
4. Prototype in Figma, then implement in code

**Writing copy?**
1. Read voice.md first
2. Avoid: marketing speak, emotional appeals, dark patterns
3. Prefer: direct language, honest claims, respect for user

---

## For Developers

**Implementing a component?**
1. Check system.md for existing patterns
2. Use design tokens from principles.md
3. Follow accessibility guidelines
4. Add to component library in `/src/lib/components/ui/`

**Building a feature?**
1. Read relevant UX doc (discovery.md, search-ux.md, governance.md)
2. Match spacing/typography to principles.md
3. Test keyboard navigation
4. Check mobile responsiveness
