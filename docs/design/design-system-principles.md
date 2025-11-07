# Design System Principles: Consumer-Friendly Privacy

**For:** Communiqué frontend developers and designers
**Purpose:** Establish consistent visual language for privacy-preserving features

---

## Core Philosophy

**Privacy guarantees should feel reassuring, not paranoid.**

Users trust Google Maps, Airbnb, Stripe, and Uber with sensitive data every day. We should communicate privacy using the same elegant patterns they recognize, not by screaming about how we're different.

---

## Visual Language Hierarchy

### 1. Trust Through Subtlety

**Don't:**
- ALL CAPS EVERYWHERE
- Heavy borders (border-4)
- Aggressive red/green contrast boxes
- Technical jargon ("CLIENT-SIDE INFERENCE")
- Mono fonts for everything

**Do:**
- Proper capitalization
- Soft shadows and subtle rings (ring-1 ring-slate-900/5)
- Gentle emerald backgrounds (bg-emerald-50)
- Plain language ("Stored in your browser")
- System fonts for readability

### 2. Progressive Disclosure

**Pattern:** Layer complexity from simple → intermediate → advanced

```
Layer 1 (Always Visible):
  Location name + confidence badge

Layer 2 (On Hover):
  Privacy indicator + update option

Layer 3 (Expandable):
  Signal breakdown + technical details
```

**Implementation:**
```html
<!-- Layer 1: Primary information -->
<div class="visible">Austin, TX-18</div>

<!-- Layer 2: Hover-revealed details -->
<div class="group-hover:opacity-100 opacity-0">
  Update location
</div>

<!-- Layer 3: User-expandable technical details -->
<details>
  <summary>How we determined this</summary>
  <!-- Technical implementation details -->
</details>
```

### 3. Familiar Mental Models

**Confidence Scores = Quality Indicators**

Users understand:
- ✅ Airbnb Superhost badge
- ✅ Uber surge pricing multipliers
- ✅ Stripe security indicators
- ✅ Google Maps location accuracy circles

Apply same patterns:
```html
<!-- High confidence (≥70%) -->
<div class="bg-emerald-50 ring-1 ring-emerald-600/10">
  <svg>✓</svg>
  <span class="text-emerald-700">85% match</span>
</div>

<!-- Medium confidence (50-69%) -->
<div class="bg-amber-50 ring-1 ring-amber-600/10">
  <span class="text-amber-700">60% match</span>
</div>

<!-- Low confidence (<50%) -->
<!-- Don't show - gracefully degrade -->
```

---

## Color System

### Primary Colors (Consumer Trust)

```css
/* Trust & Reliability (Stripe Blue) */
--trust-blue: #0066FF;
--trust-blue-light: #EFF6FF;

/* Success & Security (Linear Emerald) */
--trust-emerald: #059669;
--trust-emerald-light: #ECFDF5;

/* Quality Indicators (Airbnb Amber) */
--trust-amber: #D97706;
--trust-amber-light: #FFFBEB;

/* Surface & Background (Neutral) */
--surface-primary: #FFFFFF;
--surface-secondary: #FAFAFA;
--surface-tertiary: #F1F5F9;
```

### Text Hierarchy

```css
/* Primary Text */
--text-primary: #1F2937;   /* Dark gray, not black */
--text-secondary: #6B7280; /* Medium gray */
--text-tertiary: #9CA3AF;  /* Light gray */
```

### Shadow System (Stripe-inspired)

```css
/* Subtle depth */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

/* Soft elevation (cards at rest) */
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
             0 2px 4px -2px rgb(0 0 0 / 0.1);

/* Lift elevation (cards on hover) */
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
             0 4px 6px -4px rgb(0 0 0 / 0.1);
```

### Ring System (Subtle Borders)

```css
/* At rest */
ring-1 ring-slate-900/5

/* On hover */
hover:ring-slate-900/10

/* On focus */
focus-visible:ring-2 focus-visible:ring-blue-500
```

---

## Typography Scale

### Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Noto Sans', Helvetica, Arial, sans-serif;
```

**Why:** System fonts feel familiar, load instantly, respect OS preferences.

### Size Scale

```css
/* Headers */
--text-lg: 18px;   /* Modal titles */
--text-base: 15px; /* Location labels */
--text-sm: 13px;   /* Body text */
--text-xs: 12px;   /* Captions, badges */

/* Weight */
--font-semibold: 600; /* Headers, buttons */
--font-medium: 500;   /* Subheaders */
--font-regular: 400;  /* Body text */
```

### Letter Spacing

```css
/* Tight tracking for headers */
tracking-tight: -0.01em;

/* Normal for body */
tracking-normal: 0;

/* Wide for small caps (sparingly) */
tracking-wide: 0.02em;
```

---

## Component Patterns

### 1. Cards (Primary Container)

```html
<div class="
  rounded-xl          /* Soft corners */
  bg-white            /* Clean surface */
  p-4                 /* Generous padding */
  shadow-sm           /* Subtle depth */
  ring-1 ring-slate-900/5 /* Soft border */
  transition-all      /* Smooth interactions */
  hover:shadow-md     /* Lift on hover */
  hover:ring-slate-900/10 /* Darken ring on hover */
">
  <!-- Card content -->
</div>
```

**Use for:** Location display, template cards, modals

### 2. Buttons (Primary Actions)

```html
<!-- Primary (High Emphasis) -->
<button class="
  rounded-lg
  px-4 py-2.5
  text-sm font-semibold
  bg-slate-900 text-white
  shadow-sm
  hover:bg-slate-800
  active:bg-slate-700
  transition-all duration-150
">
  Show local campaigns
</button>

<!-- Secondary (Medium Emphasis) -->
<button class="
  rounded-lg
  px-4 py-2.5
  text-sm font-semibold
  bg-white text-slate-700
  shadow-sm
  ring-1 ring-slate-900/10
  hover:bg-slate-50
  hover:ring-slate-900/20
  active:bg-slate-100
  transition-all duration-150
">
  Update
</button>

<!-- Tertiary (Low Emphasis) -->
<button class="
  rounded-lg
  px-3 py-1.5
  text-sm font-medium
  bg-slate-100 text-slate-700
  hover:bg-slate-200
  active:bg-slate-300
  transition-colors duration-150
">
  Cancel
</button>
```

### 3. Badges (Quality Indicators)

```html
<!-- Success Badge (High Confidence) -->
<div class="
  inline-flex items-center gap-1
  rounded-full
  bg-emerald-50
  px-2.5 py-1
  ring-1 ring-emerald-600/10
">
  <svg class="h-3 w-3 text-emerald-600">✓</svg>
  <span class="text-xs font-semibold text-emerald-700">
    85% match
  </span>
</div>

<!-- Warning Badge (Medium Confidence) -->
<div class="
  inline-flex items-center gap-1
  rounded-full
  bg-amber-50
  px-2.5 py-1
  ring-1 ring-amber-600/10
">
  <span class="text-xs font-semibold text-amber-700">
    60% match
  </span>
</div>
```

### 4. Icons (Contextual Meaning)

```html
<!-- Security/Privacy Icon (Emerald) -->
<svg class="h-4 w-4 text-emerald-600" fill="currentColor">
  <!-- Shield with checkmark -->
</svg>

<!-- Location Icon (Blue) -->
<svg class="h-4 w-4 text-blue-600" stroke="currentColor">
  <!-- Map pin -->
</svg>

<!-- Information Icon (Slate) -->
<svg class="h-4 w-4 text-slate-400" stroke="currentColor">
  <!-- Info circle -->
</svg>
```

**Icon Container Pattern:**
```html
<div class="
  flex h-8 w-8
  items-center justify-center
  rounded-full
  bg-blue-50        /* Soft color background */
">
  <svg class="h-4 w-4 text-blue-600">
    <!-- Icon -->
  </svg>
</div>
```

### 5. Privacy Indicators

```html
<!-- Subtle Privacy Guarantee -->
<div class="
  flex items-center gap-2
  text-xs text-slate-500
">
  <svg class="h-3.5 w-3.5 text-emerald-600">🔒</svg>
  <span>Stored in your browser only</span>
</div>

<!-- Emphasized Privacy Guarantee (Modal) -->
<div class="
  rounded-lg
  bg-emerald-50
  p-3.5
  ring-1 ring-emerald-100
">
  <div class="flex items-start gap-2">
    <svg class="mt-0.5 h-4 w-4 text-emerald-600">🔒</svg>
    <div>
      <div class="font-medium text-emerald-900">
        Your privacy is protected
      </div>
      <div class="mt-0.5 text-sm text-emerald-700">
        Everything stays in your browser. We never send this to our servers.
      </div>
    </div>
  </div>
</div>
```

---

## Interaction Patterns

### 1. Hover States (Gentle Lifts)

```css
/* Cards */
default:  shadow-sm ring-1 ring-slate-900/5
hover:    shadow-md ring-slate-900/10

/* Buttons */
default:  bg-slate-900
hover:    bg-slate-800
active:   bg-slate-700

/* Links */
default:  text-slate-600
hover:    text-slate-900
```

### 2. Transitions (Smooth, Fast)

```css
/* Standard interactive elements */
transition-all duration-150

/* Color changes only */
transition-colors duration-150

/* Transform animations */
transition-transform duration-150
```

### 3. Loading States

```html
<!-- Skeleton (Subtle Pulse) -->
<div class="animate-pulse">
  <div class="h-8 w-8 rounded-full bg-slate-100"></div>
  <div class="h-4 w-32 rounded bg-slate-100"></div>
</div>

<!-- Spinner (Smooth Rotation) -->
<svg class="h-4 w-4 animate-spin text-slate-400">
  <!-- Circle paths -->
</svg>
```

### 4. Progressive Disclosure

```html
<!-- Native <details> Element -->
<details class="group">
  <summary class="
    cursor-pointer
    text-xs font-medium
    text-slate-500
    hover:text-slate-700
    transition-colors
  ">
    <span class="inline-flex items-center gap-1.5">
      <svg class="
        h-3 w-3
        transition-transform
        group-open:rotate-180
      ">▼</svg>
      How we determined this
    </span>
  </summary>

  <!-- Hidden content (revealed on open) -->
  <div class="mt-2.5 space-y-1.5 pl-1">
    <!-- Technical details -->
  </div>
</details>
```

---

## Accessibility Standards

### 1. Color Contrast (WCAG AA)

```css
/* Body text on white background */
color: #1F2937; /* 4.5:1 contrast ✓ */

/* Small text on colored backgrounds */
color: #065F46; /* On bg-emerald-50, 4.5:1 ✓ */
color: #92400E; /* On bg-amber-50, 4.5:1 ✓ */
```

### 2. Focus States

```html
<button class="
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-blue-500
  focus-visible:ring-offset-2
">
  Button text
</button>
```

### 3. Touch Targets (Mobile)

```css
/* Minimum 44px for tap targets */
min-height: 44px;
min-width: 44px;

/* Or use padding to achieve size */
padding: 0.625rem 1rem; /* 10px + 24px content = 44px total */
```

### 4. Semantic HTML

```html
<!-- Use native elements -->
<details>
  <summary>Expandable content</summary>
</details>

<!-- Proper heading hierarchy -->
<h2>Section title</h2>
<h3>Subsection title</h3>

<!-- Aria labels for icon buttons -->
<button aria-label="Update location" title="Improve location accuracy">
  <svg>↻</svg>
</button>
```

---

## Animation Principles

### 1. Purpose-Driven Motion

**Use animation to:**
- ✅ Provide feedback (button press, loading state)
- ✅ Direct attention (new content appearing)
- ✅ Explain relationships (expanding accordion)

**Don't use animation for:**
- ❌ Decoration without purpose
- ❌ Distracting movement
- ❌ Slow transitions (>300ms)

### 2. Timing Curves

```css
/* Fast interactions (buttons, hovers) */
transition-duration: 150ms;
transition-timing-function: ease-out;

/* Medium transitions (modals, drawers) */
transition-duration: 200ms;
transition-timing-function: ease-in-out;

/* Slow, dramatic (page transitions) */
transition-duration: 300ms;
transition-timing-function: ease-in-out;
```

### 3. Reduced Motion

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

## Privacy Messaging Guidelines

### Language Patterns

**Don't:**
- "SERVER BLIND" (aggressive, technical)
- "CLIENT-SIDE INFERENCE" (jargon)
- "ZERO server-side tracking" (defensive)
- "YOUR browser" (possessive, emphatic)

**Do:**
- "Stored in your browser only" (simple, clear)
- "Everything stays in your browser" (reassuring)
- "We never send this to our servers" (trustworthy)
- "Your privacy is protected" (confident)

### Visual Hierarchy

1. **Primary message** (always visible):
   - Simple statement: "Stored in your browser only"
   - Small icon: 🔒 (emerald color)
   - 12px text, secondary color

2. **Explanation** (first-time modal):
   - Friendly header: "We found campaigns in your area"
   - Plain language explanation
   - Soft emerald box for privacy guarantee

3. **Technical details** (progressive disclosure):
   - Behind expandable section
   - For power users and technical audience
   - Still use plain language, not jargon

---

## Component Examples

### Example 1: Location Card (Complete)

```html
<div class="
  group
  rounded-xl bg-white p-4
  shadow-sm ring-1 ring-slate-900/5
  transition-all
  hover:shadow-md hover:ring-slate-900/10
">
  <!-- Header -->
  <div class="mb-3 flex items-center justify-between gap-3">
    <!-- Location icon + name -->
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
        <svg class="h-4 w-4 text-blue-600">📍</svg>
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-[15px] font-medium tracking-tight text-slate-900 truncate">
          Austin, TX-18
        </h3>
        <p class="mt-0.5 text-xs text-slate-500">
          Your location
        </p>
      </div>
    </div>

    <!-- Confidence badge -->
    <div class="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-600/10">
      <svg class="h-3 w-3 text-emerald-600">✓</svg>
      <span class="text-xs font-semibold text-emerald-700">85% match</span>
    </div>
  </div>

  <!-- Privacy indicator -->
  <div class="mb-3 flex items-center gap-2 text-xs text-slate-500">
    <svg class="h-3.5 w-3.5 text-emerald-600">🔒</svg>
    <span>Stored in your browser only</span>
  </div>

  <!-- Actions -->
  <div class="flex items-center gap-2">
    <button class="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold bg-slate-900 text-white shadow-sm hover:bg-slate-800 transition-all duration-150">
      Show local campaigns
    </button>
    <button class="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/10 hover:bg-slate-50 transition-all duration-150">
      Update
    </button>
  </div>
</div>
```

---

## Testing Checklist

### Visual Design
- [ ] No ALL CAPS text (except legitimate acronyms)
- [ ] System fonts used (not mono everywhere)
- [ ] Rounded corners (rounded-lg or rounded-xl)
- [ ] Soft shadows (shadow-sm, shadow-md)
- [ ] Subtle rings (ring-1 ring-slate-900/5)
- [ ] Proper capitalization throughout

### Color & Contrast
- [ ] WCAG AA contrast ratios met (4.5:1 for body, 3:1 for large)
- [ ] Emerald for success/security (not harsh green)
- [ ] Amber for warnings (not harsh yellow/red)
- [ ] Slate for neutrals (not pure black/white)

### Interactions
- [ ] Smooth transitions (150ms standard)
- [ ] Hover states provide feedback
- [ ] Active states show pressed state
- [ ] Focus states visible for keyboard navigation
- [ ] Loading states are clear and non-blocking

### Accessibility
- [ ] Focus indicators visible (ring-2 ring-blue-500)
- [ ] Touch targets ≥44px on mobile
- [ ] Aria labels on icon-only buttons
- [ ] Semantic HTML used (details, summary, etc.)
- [ ] Reduced motion respected

### Privacy Messaging
- [ ] Plain language (no jargon)
- [ ] Reassuring tone (not defensive)
- [ ] Progressive disclosure (simple → advanced)
- [ ] Familiar mental models (Google Maps, Airbnb patterns)

---

## Conclusion

**Remember:** Privacy guarantees are architectural. Emotional design is presentational. We can have both.

**Goal:** Build interfaces that normal people—who use Google Maps, Airbnb, and Stripe—will trust and enjoy using.

**Test:** Would your non-technical friend feel comfortable using this? Or would they ask "why is this website screaming at me?"
