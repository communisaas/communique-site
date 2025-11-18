# Design Documentation

**Design system, voice guidelines, and UX patterns for Communiqué**

---

## Start Here

### ⭐ [design-system.md](design-system.md) - THE Definitive Design System

**Single source of truth** for all design decisions.

**Complete coverage:**
- Core philosophy: "Invisible crypto, visible coordination"
- Typography: Satoshi (brand/words) + JetBrains Mono (data/metrics)
- Color system: Participation colors, semantic states, surfaces
- Component patterns: Buttons, cards, forms, badges
- Animation philosophy: Dopamine-pushing for coordination, subtle for privacy
- Accessibility: WCAG AA, keyboard navigation, reduced-motion support
- Migration roadmap: 3 phases, 6 weeks

**Key decisions:**
- ✅ Satoshi for words (headlines, UI, CTAs) - distinctive brand identity
- ✅ JetBrains Mono for numbers (counts, metrics, codes) - scannable data
- ✅ Dopamine-pushing animations for coordination (send, share, count updates)
- ✅ Subtle progressive disclosure for privacy (popovers, expandable details)
- ✅ "Credibly cool" aesthetic - neither corporate bland nor crypto tacky

### 📝 [voice.md](voice.md) - Voice & Language Guidelines

**How Communiqué speaks to users.**

**Core principles:**
1. **Confident & Direct** - State what is. Don't explain, justify, or defend.
2. **Technical Details in Popovers** - Primary UI: simple statement. Popover: mechanism for those who care.
3. **Don't Wear Cypherpunk on Our Sleeve** - Users don't need to know the mechanism unless they ask.
4. **No Pre-Defending** - Don't apologize for what we are. Don't explain what we're not.
5. **Imperative Voice** - Commands, not suggestions.

**Vocabulary to avoid:** campaigns, issues, community, platform, content, engagement, solutions, empower

---

## UX Patterns

**Specific solutions for common design challenges.**

### [patterns/location-filtering.md](patterns/location-filtering.md)

**Location as filter, not category + data inference patterns**

- Core principle: Location names stand alone (no "campaigns in", no "issues in")
- Inferrable defaults: Country from state code, deterministic 1:1 mappings
- Progressive precision funnel: IP → State → County → District
- Voice guidance: When to use minimal headers vs. descriptive affordances

### [patterns/template-discovery.md](patterns/template-discovery.md)

**Template browsing, filtering, recommendation UX**

- How users find relevant templates
- Search, categories, trending patterns
- Template card design
- Progressive disclosure patterns

### [patterns/privacy-governance.md](patterns/privacy-governance.md)

**Privacy-preserving governance UI patterns**

- Zero-knowledge voting displays
- Reputation visualization without revealing votes
- Challenge mechanisms
- How to show collective decision-making without exposing individuals

### [patterns/identity-verification.md](patterns/identity-verification.md)

**Identity verification flow UI**

- IdentityVerificationFlow component architecture
- Emotional design for privacy
- Conversion optimization
- "Stealthily cypherpunk" - privacy as empowerment, not paranoia

---

## Current Design Principles

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
1. Read [design-system.md](design-system.md) - THE complete design system
2. Read [voice.md](voice.md) - Writing style and language guidelines
3. Explore `/src/lib/components/` - Component implementations

**Designing a new feature?**
1. Check [patterns/](patterns/) for existing solutions
2. Use design tokens from [design-system.md](design-system.md)
3. Follow accessibility guidelines (WCAG AA)
4. Prototype in Figma, then implement in code

**Writing copy?**
1. Read [voice.md](voice.md) first
2. Avoid: marketing speak, emotional appeals, dark patterns, category labels
3. Prefer: direct language, honest claims, location-first, coordination-focused

---

## For Developers

**Implementing a component?**
1. Check [design-system.md](design-system.md) for component patterns and examples
2. Use design tokens (Satoshi for words, JetBrains Mono for data)
3. Follow accessibility guidelines (keyboard nav, WCAG AA contrast)
4. Add to component library in `/src/lib/components/ui/`

**Building a feature?**
1. Read relevant pattern docs ([patterns/](patterns/))
2. Match spacing/typography to design-system.md
3. Test keyboard navigation
4. Check mobile responsiveness
5. Respect `prefers-reduced-motion` for animations

---

*Communiqué PBC | Design Documentation | 2025-11-18*
