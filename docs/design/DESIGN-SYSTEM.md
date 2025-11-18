# Communiqué Design System

**Status**: Definitive Reference
**Last Updated**: 2025-11-16
**Purpose**: Complete design system - typography, color, components, philosophy

---

## Core Philosophy

**"Invisible crypto, visible coordination"**

Make coordination dynamics visceral through quality design while keeping blockchain mechanics completely under the hood.

### Design Principles

1. **Distinctive Quality** - Not safe/familiar, but intuitive and polished
2. **Coordination Visibility** - Make collective action feel powerful and addictive
3. **Privacy Through Architecture** - Reassuring, not paranoid
4. **Honesty Over Persuasion** - No dark patterns, no emotional manipulation
5. **Accessibility Non-Negotiable** - WCAG AA minimum, keyboard navigation, reduced-motion support

---

## Typography

### Font Families

```typescript
// tailwind.config.ts
fontFamily: {
  sans: ['Satoshi', ...systemFonts],  // Brand voice
  mono: ['JetBrains Mono', ...monoFonts]  // Data/metrics
}
```

**Usage Rule**: Words use Satoshi, numbers use JetBrains Mono

**Satoshi (Distinctive Brand)**:
- Headlines, subheads, body copy
- UI labels, navigation, CTAs
- Template titles, descriptions
- Form labels, help text

**JetBrains Mono (Scannable Data)**:
- Coordination counts ("847 sent")
- Reputation scores ("+50")
- District codes ("CA-11")
- Timestamps, metrics, percentages

**Why Both**: Satoshi creates memorable brand identity, Mono ensures data scannability at a glance.

### Type Scale

```css
/* Headlines */
--text-2xl: 24px; /* Page titles */
--text-xl:  20px; /* Section headers */
--text-lg:  18px; /* Card titles */

/* Body */
--text-base: 15px; /* Primary text */
--text-sm:   13px; /* Secondary text */
--text-xs:   12px; /* Captions, badges */

/* Weight */
--font-bold:     700; /* Emphasis */
--font-semibold: 600; /* Headers, CTAs */
--font-medium:   500; /* Subheaders */
--font-regular:  400; /* Body */
```

### Examples

```svelte
<!-- Template Card: Mixed typography -->
<div class="p-4">
  <!-- Title: Satoshi Semibold -->
  <h3 class="font-sans text-lg font-semibold">
    Support Medicare Expansion
  </h3>

  <!-- Metrics: JetBrains Mono for scannability -->
  <div class="flex gap-4 font-mono text-sm text-slate-600">
    <span>Sent: <strong>847</strong></span>
    <span>Districts: <strong>94</strong></span>
  </div>

  <!-- Description: Satoshi Regular -->
  <p class="font-sans text-sm text-slate-700">
    Coordinate across 94 congressional districts
  </p>
</div>
```

---

## Color System

### Primary Palette (Participation)

```css
/* Indigo (participation-primary) */
--primary-500: #6366f1;  /* CTAs, links, active states */
--primary-600: #4f46e5;  /* Hover states */
--primary-700: #4338ca;  /* Pressed states */

/* Violet (participation-accent) */
--accent-500: #a855f7;   /* Magical variant, special moments */
--accent-600: #9333ea;   /* Accent hover */

/* Brand Usage */
- Primary CTAs, links, navigation highlights
- Coordination event indicators
- Active/selected states
```

### Semantic Colors

```css
/* Verified Green (channel-verified) */
--verified-500: #10b981;  /* Identity verification, delivery confirmed */
--verified-600: #059669;  /* Hover state */

/* Community Blue (channel-community) */
--community-500: #0ea5e9; /* Community outreach, social proof */
--community-600: #0284c7; /* Hover state */

/* Warning/Error */
--warning-500: #f59e0b;   /* Actual warnings only */
--danger-500:  #ef4444;    /* Actual errors only */
```

**Never use warning/error colors for privacy indicators** - avoid alarm.

### Surface Colors

```css
/* Backgrounds */
--surface-base:    #ffffff;  /* Cards, modals */
--surface-raised:  #f9fafb;  /* Elevated elements */
--surface-overlay: #f3f4f6;  /* Disabled states */
--surface-inverted: #111827; /* Dark accents */

/* Borders */
--surface-border:        #e5e7eb;  /* Default borders */
--surface-border-strong: #d1d5db;  /* Emphasized borders */
```

### Text Hierarchy

```css
--text-primary:    #111827;  /* Headlines, key text */
--text-secondary:  #374151;  /* Body text */
--text-tertiary:   #6b7280;  /* Supporting text */
--text-quaternary: #9ca3af;  /* Disabled, placeholder */
--text-inverse:    #ffffff;  /* On dark backgrounds */
--text-accent:     #4f46e5;  /* Links, highlights */
```

---

## Component Patterns

### Buttons

```svelte
<!-- Primary (Send, Coordinate) -->
<Button
  variant="primary"
  size="default"
  enableFlight={true}
  icon="send"
>
  Send to Congress
</Button>

<!-- Magical (Share, Special Actions) -->
<Button
  variant="magical"
  size="lg"
>
  Share Template
</Button>

<!-- Secondary (Update, Less Emphasis) -->
<Button variant="secondary" size="sm">
  Update Location
</Button>
```

**Styles**:
```css
/* Primary */
bg-participation-primary-500 hover:bg-participation-primary-600
text-white shadow-sm

/* Magical */
bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600
text-white shadow-xl shadow-purple-500/30

/* Secondary */
bg-participation-primary-50 hover:bg-participation-primary-100
text-participation-primary-700 border border-participation-primary-200
```

### Cards

```svelte
<div class="
  rounded-lg border border-surface-border p-4
  hover:shadow-lg hover:-translate-y-0.5 transition-all
">
  <!-- Hierarchy: Satoshi for words, Mono for numbers -->
  <h3 class="font-sans text-lg font-semibold text-text-primary">
    {template.title}
  </h3>

  <div class="flex gap-4 font-mono text-sm text-text-tertiary">
    <span>Sent: <strong class="text-text-primary">847</strong></span>
    <span>Districts: <strong class="text-text-primary">94</strong></span>
  </div>
</div>
```

**Key Patterns**:
- Gentle lift on hover (`-translate-y-0.5`)
- Shadow intensifies (`shadow-sm` → `shadow-lg`)
- Coordination count uses tabular nums

### Forms (Privacy-Reassuring)

```svelte
<form class="space-y-4">
  <div>
    <!-- Label: Satoshi Medium -->
    <label class="font-sans text-sm font-medium text-text-primary">
      Congressional District
    </label>

    <!-- Privacy indicator: Subtle emerald -->
    <p class="flex items-center gap-1.5 text-xs text-text-tertiary">
      <LockIcon class="h-3 w-3 text-verified-500" />
      Stored in your browser only
    </p>

    <!-- Input -->
    <input
      class="
        mt-1.5 w-full rounded-md border border-surface-border px-3 py-2
        focus:border-participation-primary-500 focus:ring-2 focus:ring-participation-primary-500/20
      "
    />
  </div>
</form>
```

**Privacy UX**:
- Soft emerald for privacy indicators (not harsh green)
- Small lock icon, subtle color
- Plain language: "Stored in your browser only"
- Progressive disclosure: Hover for technical details

### Privacy Badges (Progressive Disclosure)

```svelte
<!-- Layer 1: Always visible -->
<div class="flex items-center gap-2 text-xs text-text-tertiary">
  <ShieldCheckIcon class="h-3.5 w-3.5 text-verified-500" />
  <span class="font-sans">Verified Residency</span>
</div>

<!-- Layer 2: Hover reveals popover -->
<Popover>
  <p class="font-sans text-xs text-text-secondary">
    Zero-knowledge proof verifies you live in the district without revealing your address.
  </p>
  <a href="/docs/privacy" class="text-participation-primary-600 underline">
    Learn more
  </a>
</Popover>
```

**Three Layers**:
1. **Visible**: Outcome statement ("Verified Residency")
2. **Hover**: Mechanism summary ("Zero-knowledge proof...")
3. **Click**: Full technical docs (link to documentation)

---

## Animation Philosophy

### Core Principle: Animate What Matters

**Dopamine-pushing for coordination signals**:
- Paper plane send (existing, keep and enhance)
- Share button particle burst (existing, keep and enhance)
- Coordination count ticker (NEW)
- Reputation accumulation (NEW)
- Live activity pulse (NEW)

**Subtle for privacy mechanics**:
- Privacy badge hover reveals
- Verification status transitions
- Security indicator pulses

### Existing Animations (Keep & Enhance)

**1. Paper Plane Send** (`Button.svelte`):
- ✅ Sophisticated physics (banking, rotation, blur, spring animations)
- ✅ Multi-stage flight (takeoff → flying → sent → departing → returning)
- ✅ Hover breath animation
- 🎯 **Enhance**: Add trail effect, impact ripple, sync with count increment

**2. Share Button Particle Burst** (`ShareButton.svelte`):
- ✅ Spring-based scaling and glow
- ✅ Particle system (sparkles/hearts/zap)
- ✅ Icon morph (Share → CheckCircle)
- 🎯 **Enhance**: Coordination pulse, social proof micro-animation

### New Animations to Add

**3. Coordination Count Ticker**:
```svelte
<script>
  import { spring } from 'svelte/motion';

  let count = $state(847);
  let displayCount = spring(count, { stiffness: 0.2, damping: 0.8 });

  $effect(() => { displayCount.set(count); });
</script>

<span class="font-mono text-2xl font-bold tabular-nums">
  {Math.round($displayCount)}
</span>
```

**4. Reputation Gain Feedback**:
```svelte
<div class="relative">
  <span class="font-mono font-bold">{score}</span>

  {#if showGain}
    <span
      class="absolute -right-8 top-0 font-mono text-sm font-semibold text-verified-600"
      in:scale={{ start: 0.5, duration: 400 }}
      out:fly={{ y: -20, duration: 600 }}
    >
      +{gainAmount}
    </span>
  {/if}
</div>
```

**5. Live Activity Pulse**:
```svelte
<div class="flex items-center gap-2">
  <div class="h-2 w-2 rounded-full bg-verified-500" class:animate-pulse={isActive} />
  <span class="font-sans text-sm text-text-tertiary">
    3 people coordinating now
  </span>
</div>
```

### Performance Budget

- **Max 3 animated elements per viewport**
- **Must communicate information**, not just decoration
- **GPU-accelerated only** (transform, opacity - not width/height/top/left)
- **Respect accessibility**:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Voice & Language

### Core Principles

**From `voice.md` - Pragmatic Cypherpunk**:

1. **Confident & Direct** - State what is, don't justify or defend
2. **Technical Details in Popovers** - Primary UI simple, popover for mechanism
3. **Don't Wear Cypherpunk on Sleeve** - Users don't need crypto jargon
4. **No Pre-Defending** - Don't apologize for what we are
5. **Imperative Voice** - Commands, not suggestions

### Language Patterns

**Privacy Messaging**:
```
❌ DON'T: "SERVER BLIND", "CLIENT-SIDE INFERENCE", "ZERO tracking"
✅ DO: "Stored in your browser only", "Your privacy is protected"
```

**Coordination Messaging**:
```
❌ DON'T: "Find campaigns in your area", "Join the movement"
✅ DO: "CA-11" (location), "847 coordinating" (count), "Send to Congress" (action)
```

**Template Scope** (from voice.md):
- Federal: "All 50 states + DC + territories" (not "national")
- State: "California" (just state name)
- District: "CA-11" (just district code)

**Vocabulary to Avoid**:
- campaigns, issues, community, platform, content, engagement, solutions, empower

**Use Instead**:
- Specific nouns (template, message, coordination count)
- Direct verbs (send, coordinate, verify)
- Precise locations (CA-11, Texas, nationwide)

---

## Accessibility Standards

### Color Contrast (WCAG AA)

```css
/* Body text on white */
color: #111827; /* 4.5:1 minimum ✓ */

/* Small text on colored backgrounds */
color: #065F46; /* On bg-emerald-50, 4.5:1 ✓ */
color: #92400E; /* On bg-amber-50, 4.5:1 ✓ */
```

### Focus States

```html
<button class="
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-participation-primary-500
  focus-visible:ring-offset-2
">
  Button text
</button>
```

### Touch Targets (Mobile)

```css
/* Minimum 44px for tap targets */
min-height: 44px;
min-width: 44px;
```

### Semantic HTML

```html
<!-- Use native elements -->
<details><summary>Expandable</summary></details>

<!-- Proper heading hierarchy -->
<h2>Section</h2><h3>Subsection</h3>

<!-- Aria labels for icon buttons -->
<button aria-label="Update location">
  <UpdateIcon />
</button>
```

---

## Shadow & Elevation

```css
/* At rest */
shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)

/* Soft elevation (cards) */
shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
           0 2px 4px -2px rgb(0 0 0 / 0.1)

/* Lift elevation (hover) */
shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
           0 4px 6px -4px rgb(0 0 0 / 0.1)

/* Magical variant (brand glow) */
shadow-xl shadow-purple-500/30
```

---

## Spacing Scale

```css
--space-xs:  0.25rem;  /* 4px */
--space-sm:  0.5rem;   /* 8px */
--space-md:  0.75rem;  /* 12px */
--space-lg:  1rem;     /* 16px */
--space-xl:  1.5rem;   /* 24px */
--space-2xl: 2rem;     /* 32px */
--space-3xl: 3rem;     /* 48px */
```

**Usage**:
- `gap-2` (8px) - Inline elements (icon + text)
- `gap-4` (16px) - Card sections
- `space-y-4` (16px) - Form fields
- `p-4` (16px) - Card padding

---

## Border Radius

```css
--radius:    0.375rem; /* 6px - Default */
--radius-md: 0.5rem;   /* 8px - Buttons */
--radius-lg: 0.75rem;  /* 12px - Cards */
--radius-xl: 1rem;     /* 16px - Modals */
--radius-full: 9999px; /* Pills, badges */
```

---

## Migration Roadmap

### Phase 1: Typography (Week 1-2)

**Add Satoshi**:
1. License Satoshi font (check pricing/licensing)
2. Add to `tailwind.config.ts` font-sans
3. Load webfont in `app.html`

**Refactor Components**:
1. Headlines → Satoshi Semibold
2. Body text → Satoshi Regular
3. Numbers/metrics → JetBrains Mono Bold
4. Audit all components for consistency

### Phase 2: Animation Enhancement (Week 3-4)

**Enhance Existing**:
1. Paper plane: Add trail effect, impact ripple
2. Share button: Add coordination pulse
3. Sync animations with backend events

**Add New**:
1. Coordination count ticker
2. Reputation gain feedback (+50 flies up)
3. Live activity pulse

### Phase 3: Component Polish (Week 5-6)

**Refactor**:
1. Template cards with new typography
2. Forms with reassuring privacy UX
3. Navigation with Satoshi

**Documentation**:
1. Component showcase page
2. Before/after examples
3. Animation demo

---

## Decision Rules

### "Should this be animated?"

**YES** if:
- Coordination signal (count update, send success, share)
- User feedback (button press, loading state)
- State change meaningful to user

**NO** if:
- Purely decorative
- Privacy mechanism explanation
- Static content

### "Should this use Satoshi or Mono?"

**Satoshi** if: Words, labels, UI elements
**JetBrains Mono** if: Numbers, metrics, codes

### "Should this show privacy details?"

**Primary UI**: No technical jargon
**Hover/Popover**: Mechanism summary
**Click-through**: Full technical docs

---

## Testing Checklist

### Typography
- [ ] Headlines use Satoshi Semibold
- [ ] Numbers use JetBrains Mono
- [ ] Tabular nums for metrics

### Color & Contrast
- [ ] WCAG AA contrast (4.5:1 body, 3:1 large)
- [ ] Emerald for success/privacy (not harsh green)
- [ ] Participation-primary for brand moments

### Animation
- [ ] Max 3 animated elements per viewport
- [ ] GPU-accelerated (transform/opacity only)
- [ ] Reduced-motion respected
- [ ] 60fps maintained

### Accessibility
- [ ] Focus indicators visible
- [ ] Touch targets ≥44px mobile
- [ ] Aria labels on icon buttons
- [ ] Keyboard navigation works

### Voice
- [ ] No crypto jargon in primary UI
- [ ] Direct, imperative language
- [ ] Privacy explanations reassuring, not paranoid
- [ ] Vocabulary avoids: campaigns, issues, community, solutions

---

## Example: Complete Template Card

```svelte
<div class="
  group rounded-lg border border-surface-border p-4
  bg-surface-base shadow-sm
  hover:shadow-lg hover:-translate-y-0.5 transition-all
">
  <!-- Title: Satoshi -->
  <h3 class="font-sans text-lg font-semibold text-text-primary">
    Support Medicare Expansion
  </h3>

  <!-- Coordination metrics: JetBrains Mono -->
  <div class="mt-2 flex items-center gap-4 font-mono text-sm text-text-tertiary">
    <div class="flex items-center gap-1.5">
      <span class="h-2 w-2 rounded-full bg-participation-accent-500" />
      <span>Sent: <CoordinationTicker count={847} /></span>
    </div>
    <span>Districts: <strong class="text-text-primary">94</strong></span>
  </div>

  <!-- Description: Satoshi -->
  <p class="mt-2 font-sans text-sm text-text-secondary">
    Coordinate with constituents across 94 congressional districts
  </p>

  <!-- Privacy badge: Subtle, progressive -->
  <div class="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary">
    <LockIcon class="h-3 w-3 text-verified-500" />
    <span class="font-sans">Encrypted delivery via TEE</span>
  </div>

  <!-- Actions -->
  <div class="mt-4 flex gap-2">
    <Button variant="primary" size="default" enableFlight={true} icon="send">
      Send to Congress
    </Button>
    <ShareButton url={templateUrl} variant="secondary" />
  </div>
</div>
```

---

**This is the complete, definitive design system. Everything else is historical context.**

*Communiqué PBC | Design System | 2025-11-16*
