# Progressive Precision Unlock: Contextual Discovery Without Disruption

**Status**: SPECIFICATION (Phase 1 Launch - v2.0)
**Created**: 2025-11-12
**Replaces**: Progressive Location Discovery Spec, Location Filter Launch UX v1
**Design Studio Influence**: Stripe (progressive disclosure), Linear (minimal friction), Superhuman (keyboard-first), Apple HIG (spatial relationships)

---

## Executive Summary

**Problem**: Current UX bundles correction ("Not from California?") with progression ("See city templates →") before users understand what they're unlocking. Privacy badge language confuses instead of differentiates.

**Solution**: Separate mental models, contextualize progression AFTER content exposure, minimize privacy friction through icon-only trust indicators.

**Core Insight**: Users must SEE state-level templates before understanding the value of city-level precision. Progression CTAs belong BETWEEN template sections, not BEFORE them.

---

## Design Philosophy

### 1. Cognitive Load Theory

**Mental Model Separation**:
```
Correction (Error Recovery)     ≠    Progression (Value Unlock)
"Not from California?"          ≠    "See city templates"
User thinks: "You got it wrong"  ≠   User thinks: "I want more specific"
```

**Attention Economics**:
- **Top of page**: Correction only (high error rate for IP inference)
- **Between sections**: Progression (after value demonstration)
- **Privacy signals**: Passive trust indicators (icon + hover, not active claims)

### 2. Stripe's Progressive Disclosure Pattern

**Information Revelation Hierarchy**:
```
Level 0: Essential (always visible)
  → Location name
  → Correction affordance
  → Trust indicator (icon)

Level 1: Contextual (revealed on interaction)
  → Privacy mechanism (hover)
  → Geographic breadcrumb (below header)
  → Technical details (disclosure triangle)

Level 2: Value-driven (revealed after engagement)
  → Precision unlock card (after first template section)
  → Template counts per tier
  → Next benefit preview
```

**Why this works**: Users learn through doing, not through reading. Show value BEFORE asking for more data.

### 3. Linear's Minimal Friction UX

**Interaction Cost Budget**:
- **Free actions** (0 clicks): View location, see templates, scan counts
- **Low-cost actions** (1 click): Correct location, view privacy details
- **High-cost actions** (1 click + form): Unlock next precision tier
- **Never**: Pre-emptive modals, unexplained popups, buried explanations

**Cognitive Friction Elimination**:
- ❌ "Private filtering" → ⚡ 3-second comprehension delay
- ✅ Lock icon + hover → ⚡ Instant pattern recognition
- ❌ CTA before context → ⚡ "Why should I care?" doubt
- ✅ CTA after templates → ⚡ "I want more of this" motivation

### 4. Apple HIG: Spatial Relationships & Metaphors

**Vertical Information Architecture**:
```
┌─────────────────────────────────────┐
│ Location Identity                   │  ← Correction zone (error recovery)
│ • California                        │
│ • Not from California?              │
│ • 🔒 (privacy signal)               │
├─────────────────────────────────────┤
│ Navigation Breadcrumb               │  ← Context (where am I in hierarchy)
│ United States > California          │
├─────────────────────────────────────┤
│ Content: State Templates (23)       │  ← Value demonstration
│ [Template 1]                        │
│ [Template 2]                        │
│ [Template 3]                        │
├─────────────────────────────────────┤
│ Precision Unlock Card               │  ← Progression (after value shown)
│ 🎯 12 San Francisco templates       │
│ Enter address for city-level        │
│ [Unlock →]                          │
├─────────────────────────────────────┤
│ More State Templates                │
└─────────────────────────────────────┘
```

**Why this works**: Visual hierarchy matches mental model. Errors at top (immediate attention), value in middle (scroll discovery), progression at natural pause point.

---

## Component Architecture

### LocationFilter.svelte (Header Only)

**Responsibilities**:
- Display current location precision
- Provide correction affordance
- Show passive privacy indicator
- Render geographic breadcrumb

**NOT responsible for**:
- Progression CTAs (moved to unlock card)
- Template counts (computed in parent)
- Modal triggers (handled by unlock card)

**State Management**:
```typescript
// Precision tracking
let currentPrecision = $derived.by(() => {
  if (inferredLocation?.congressional_district) return 'district';
  if (inferredLocation?.city_name) return 'city';
  if (inferredLocation?.state_code) return 'state';
  return 'none';
});

// Error correction only (NOT progression)
let showCorrectionModal = $state(false);
```

**Visual Structure**:
```svelte
<div class="location-header">
  <!-- Location Identity -->
  <div class="flex items-start gap-3">
    <LocationPinIcon />
    <div class="flex-1">
      <h2 class="text-3xl font-bold">
        {locationLabel || 'Nationwide'}
      </h2>

      {#if districtLabel}
        <p class="text-sm text-slate-500">
          {districtLabel}
        </p>
      {/if}

      <!-- Correction (error recovery only) -->
      <button
        onclick={() => showCorrectionModal = true}
        class="mt-1 text-sm text-slate-600 underline decoration-dotted"
      >
        Not from {locationLabel}?
      </button>

      <!-- Privacy indicator (passive trust signal) -->
      <PrivacyIndicator />
    </div>
  </div>

  <!-- Geographic breadcrumb (context) -->
  {#if hasBreadcrumb}
    <BreadcrumbNav items={breadcrumbItems} />
  {/if}

  <!-- Technical details (progressive disclosure) -->
  <details>
    <summary>How we determined this location</summary>
    <TechnicalDetails signals={locationSignals} />
  </details>
</div>
```

### PrivacyIndicator.svelte (Trust Signal)

**Design Pattern**: Icon-only with tooltip (Superhuman style)

**Visual Treatment**:
```svelte
<div class="privacy-indicator">
  <button
    class="group relative inline-flex items-center gap-1.5 text-xs text-slate-500"
    aria-label="Privacy information"
  >
    <!-- Lock icon (passive trust indicator) -->
    <svg class="h-3.5 w-3.5" fill="currentColor">
      <path d="M5 9V7a5 5 0 0110 0v2..." />
    </svg>

    <!-- Tooltip on hover -->
    <div class="tooltip">
      Your location stays private.
      <a href="/privacy">Details →</a>
    </div>
  </button>
</div>
```

**Interaction States**:
- **Default**: Subtle lock icon (slate-500)
- **Hover**: Tooltip appears, icon brightens (slate-700)
- **Click**: Opens privacy documentation page

**Why icon-only**:
1. **Stripe pattern**: Trust indicators don't explain, they reassure
2. **Reduced noise**: "Private filtering" adds 2 words of cognitive load
3. **Universal symbol**: Lock = security across all digital literacy levels
4. **Progressive disclosure**: Those who care will hover/click

### PrecisionUnlockCard.svelte (New Component)

**Placement**: Between first and second template sections (after value demonstration)

**Design Pattern**: Linear's feature preview cards

**Visual Structure**:
```svelte
<div class="precision-unlock-card">
  <!-- Visual attention hook -->
  <div class="flex items-center gap-3">
    <div class="unlock-icon">
      <svg class="h-6 w-6 text-blue-600">
        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" /> <!-- Plus icon -->
      </svg>
    </div>

    <div class="flex-1">
      <!-- Value proposition (specific, not generic) -->
      <h3 class="text-base font-semibold text-slate-900">
        {nextUnlock.count} {nextUnlock.level} templates
      </h3>

      <!-- Benefit (what you'll see) -->
      <p class="text-sm text-slate-600">
        {#if nextUnlock.level === 'city'}
          San Francisco-specific templates
        {:else if nextUnlock.level === 'district'}
          Your congressional district
        {/if}
      </p>
    </div>

    <!-- Action (clear benefit-action relationship) -->
    <button
      onclick={() => showAddressModal = true}
      class="btn-primary"
    >
      Enter address →
    </button>
  </div>
</div>
```

**Conditional Rendering**:
```typescript
// Only show if:
// 1. User has seen templates at current level
// 2. Next precision tier has templates
// 3. Not at maximum precision
const showUnlockCard = $derived(
  currentPrecision !== 'district' &&
  nextUnlock?.count > 0 &&
  templatesViewed > 0
);
```

**Animation** (Framer Motion style):
```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.precision-unlock-card {
  animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## Template Section Integration

### TemplateList.svelte Updates

**Injection Point**: Between template groups

```svelte
{#each groups as group, index}
  <!-- Section header -->
  <div class="section-header">
    <h3>{group.title}</h3>
    <span class="count">{group.templates.length} templates</span>
  </div>

  <!-- Templates -->
  {#each group.templates as template}
    <TemplateCard {template} />
  {/each}

  <!-- INJECT UNLOCK CARD after first section if applicable -->
  {#if index === 0 && showUnlockCard}
    <PrecisionUnlockCard
      {nextUnlock}
      onUnlock={() => showAddressModal = true}
    />
  {/if}
{/each}
```

**Why after first section**:
1. User has scrolled (engaged)
2. User has seen value (templates exist)
3. Natural pause point (end of section)
4. Contextual timing (not interruption)

---

## Copy Specifications

### Location Header

**Pattern**: `{Location Name}`

**Examples**:
```
California
San Francisco
San Francisco • CA-11
```

**Correction Affordance**: `Not from {Location}?`

**Privacy Indicator**: 🔒 (icon only)
**Hover text**: `Your location stays private.`

### Precision Unlock Card

**Pattern**: `{Count} {Level} templates`

**Examples**:
```
12 San Francisco templates
Enter address for city-level

8 district templates
Enter address for CA-11
```

**Button**: `Enter address →`

### Section Headers

**Pattern**: `{Geographic Scope}` • `{Count} templates`

**Examples**:
```
IN CALIFORNIA
23 templates

IN SAN FRANCISCO
12 templates

IN YOUR DISTRICT
8 templates

NATIONWIDE
47 templates
```

---

## Technical Implementation

### State Flow

```typescript
// Parent component (template browser page)
let inferredLocation = $state<InferredLocation | null>(null);
let templateGroups = $state<TemplateGroup[]>([]);
let showAddressModal = $state(false);

// Derived precision state
const currentPrecision = $derived.by(() => {
  if (!inferredLocation) return 'none';
  if (inferredLocation.congressional_district) return 'district';
  if (inferredLocation.city_name) return 'city';
  if (inferredLocation.state_code) return 'state';
  return 'none';
});

// Template counts per tier
const templateCountsByTier = $derived.by(() => {
  // ... (existing logic from LocationFilter.svelte)
});

// Next unlock opportunity
const nextUnlock = $derived.by(() => {
  if (currentPrecision === 'none') {
    return { level: 'state', count: templateCountsByTier.state };
  }
  if (currentPrecision === 'state') {
    return { level: 'city', count: templateCountsByTier.city };
  }
  if (currentPrecision === 'city') {
    return { level: 'district', count: templateCountsByTier.district };
  }
  return null; // Max precision
});

// Show unlock card only after engagement
let hasScrolledToTemplates = $state(false);
const showUnlockCard = $derived(
  hasScrolledToTemplates &&
  nextUnlock !== null &&
  nextUnlock.count > 0
);
```

### Scroll Detection (IntersectionObserver)

```typescript
import { onMount } from 'svelte';

onMount(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        hasScrolledToTemplates = true;
        observer.disconnect();
      }
    },
    { threshold: 0.5 }
  );

  const firstTemplate = document.querySelector('[data-first-template]');
  if (firstTemplate) {
    observer.observe(firstTemplate);
  }

  return () => observer.disconnect();
});
```

### Component Tree

```
+page.svelte (template browser)
├── LocationFilter.svelte (header only)
│   ├── PrivacyIndicator.svelte (icon + tooltip)
│   ├── BreadcrumbNav.svelte (geographic hierarchy)
│   └── TechnicalDetails.svelte (disclosure)
│
├── TemplateList.svelte (template sections)
│   ├── TemplateGroup (state templates)
│   │   ├── TemplateCard
│   │   ├── TemplateCard
│   │   └── TemplateCard
│   │
│   ├── PrecisionUnlockCard ← NEW (after first group)
│   │
│   ├── TemplateGroup (more state templates)
│   └── TemplateGroup (nationwide templates)
│
└── AddressConfirmationModal (shared)
```

---

## Animation & Transitions

### Unlock Card Entrance

**Timing**: 400ms cubic-bezier(0.16, 1, 0.3, 1) (iOS spring curve)

```svelte
<script>
  import { fade, slide } from 'svelte/transition';

  let visible = $state(false);

  $effect(() => {
    if (showUnlockCard) {
      setTimeout(() => visible = true, 100);
    }
  });
</script>

{#if visible}
  <div
    transition:slide={{ duration: 400, easing: cubicOut }}
    class="precision-unlock-card"
  >
    <!-- Card content -->
  </div>
{/if}
```

### Privacy Indicator Tooltip

**Timing**: 200ms ease-out (instant feedback)

```css
.tooltip {
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
  pointer-events: none;
}

.group:hover .tooltip {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
```

---

## Accessibility

### Keyboard Navigation

```svelte
<!-- Privacy indicator -->
<button
  tabindex="0"
  aria-label="Your location stays private. Press Enter for details."
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      window.location.href = '/privacy';
    }
  }}
>
  <LockIcon />
</button>

<!-- Unlock card -->
<div
  role="region"
  aria-labelledby="unlock-heading"
  tabindex="-1"
>
  <h3 id="unlock-heading">
    {nextUnlock.count} {nextUnlock.level} templates
  </h3>
  <button>Enter address →</button>
</div>
```

### Screen Readers

```html
<!-- Location header -->
<h2 aria-live="polite">
  {locationLabel}
</h2>

<!-- Unlock card -->
<div aria-live="polite" aria-atomic="true">
  Unlock {nextUnlock.count} {nextUnlock.level} templates by entering your address
</div>
```

---

## Implementation Checklist

### Phase 1: Header Cleanup
- [x] Remove "See city templates →" from LocationFilter header
- [ ] Update PrivacyBadge → PrivacyIndicator (icon only)
- [ ] Move correction affordance to right after location name
- [ ] Ensure breadcrumb appears below correction

### Phase 2: Create Unlock Card
- [ ] Create PrecisionUnlockCard.svelte component
- [ ] Implement nextUnlock derived state
- [ ] Add scroll detection for hasScrolledToTemplates
- [ ] Wire up unlock card to address modal

### Phase 3: Template List Integration
- [ ] Inject unlock card after first template section
- [ ] Add conditional rendering logic
- [ ] Implement entrance animation
- [ ] Test with different precision states

### Phase 4: Copy & Voice Audit
- [ ] All headers use geographic names (not "your area")
- [ ] All CTAs use imperative voice
- [ ] All counts show templates (not coordination until threshold)
- [ ] Privacy language minimal (icon + hover only)

### Phase 5: Accessibility & Polish
- [ ] Keyboard navigation for all interactive elements
- [ ] ARIA labels for screen readers
- [ ] Focus management for modal triggers
- [ ] Animation respects prefers-reduced-motion

---

## Success Metrics

### Engagement (Week 1-4)
- Template view rate: >70% (users scroll to templates)
- Unlock card impression: >40% (users see the card)
- Address modal open rate: >20% (click unlock CTA)
- Address completion rate: >60% (of those who open modal)

### Precision Adoption (Week 5-12)
- City precision: 25%+ of users
- District precision: 15%+ of users
- Correction usage: <10% (IP inference accurate enough)

### Privacy Trust
- Privacy indicator hover rate: 5-10% (curious users explore)
- Privacy page visits: 2-3% (deep interest)
- Modal abandonment: <30% (clear value proposition)

---

## Design Studio Patterns Applied

### Stripe: Progressive Disclosure
- ✅ Icon-only trust indicators
- ✅ Tooltips on demand (not preemptive)
- ✅ Technical details collapsed by default

### Linear: Minimal Friction
- ✅ Zero-click information (location visible immediately)
- ✅ One-click correction (no modal, just re-prompt)
- ✅ Value-first progression (templates before ask)

### Superhuman: Keyboard-First
- ✅ Tab navigation to all interactive elements
- ✅ Enter/Space to activate
- ✅ Escape to dismiss modals

### Apple HIG: Spatial Relationships
- ✅ Hierarchy matches mental model
- ✅ Errors at top (immediate attention)
- ✅ Progression at pause points (after sections)
- ✅ Context in breadcrumbs (navigation affordance)

---

## Voice Compliance

From `voice.md`:

### Primary UI
- [x] No corporate buzzwords (templates, not campaigns)
- [x] No hedging language (California, not "we think California")
- [x] No passive voice (Enter address, not "You can enter")
- [x] Geographic scope clear (San Francisco, not "your city")
- [x] No pre-defending (icon + hover, not "Private filtering")

### Popovers/Tooltips
- [x] Maximum 2 sentences + link
- [x] Technical mechanism ("Location stays private")
- [x] No marketing fluff (just facts)

---

## Bottom Line

**Before**:
- Correction + progression bundled (confusing mental models)
- Privacy badge verbose ("Private filtering" - unclear meaning)
- CTA before context (why should I unlock city templates?)
- Progression in header (too early, no motivation)

**After**:
- Correction separate from progression (clear mental models)
- Privacy indicator minimal (icon + hover - trust signal)
- CTA after value demonstration (I want more of this!)
- Unlock card between sections (natural pause point)

**Core Principle**: Show value → Create desire → Provide path. Not: Ask for data → Promise value → Hope for trust.
