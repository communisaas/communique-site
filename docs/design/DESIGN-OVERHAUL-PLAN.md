# Design System Overhaul: Implementation Plan

**Status**: Planning
**Timeline**: 6 weeks (Dec 2024 - Jan 2025)
**Objective**: Implement design-system.md across entire frontend with design studio quality

---

## Executive Summary

**Problem**: We have a definitive design system (design-system.md) but frontend implementation is inconsistent:
- Mixed typography (Inter/system fonts vs intended Satoshi + JetBrains Mono)
- Incomplete animation philosophy (paper plane exists, coordination tickers don't)
- Language inconsistencies ("campaigns in Texas" vs minimal "Texas")
- Component library doesn't match design system specs

**Solution**: Systematic 6-week overhaul following top design studio practices (Stripe, Linear, Vercel, Airbnb).

**Success Criteria**:
- 100% typography compliance (Satoshi for words, Mono for data)
- All coordination animations implemented (paper plane, share, tickers, reputation)
- Zero language violations (no "campaigns in", all location names minimal)
- 60fps animation performance
- WCAG AA accessibility compliance

---

## Design Philosophy Review

### Core Principle (from design-system.md)

**"Invisible crypto, visible coordination"**

Users see and feel **collective action**, not blockchain plumbing.

### Design Decisions (Definitive)

1. **Typography**: Satoshi (brand/words) + JetBrains Mono (data/metrics)
2. **Animations**: Dopamine-pushing for coordination, subtle for privacy
3. **Voice**: Direct, minimal, coordination-focused (no category labels)
4. **Aesthetics**: "Credibly cool" - distinctive quality, not corporate bland

### What Top Studios Do

**Stripe**:
- Design tokens as source of truth
- Every component documented with all states
- Content design = UX design

**Linear**:
- Design system components before features
- Performance IS user experience
- Motion core to brand identity

**Vercel**:
- Font loading optimized (<100ms)
- Dark mode first-class citizen
- Minimal, refined, precise

**Airbnb**:
- Voice guidelines enforced in code review
- Accessibility non-negotiable
- Trust through familiar patterns (but we're doing distinctive instead)

---

## Phase 1: Typography Foundation (Week 1)

### Design Decisions

**Satoshi Font Strategy**

Research needed:
- [ ] License type (free/commercial?)
- [ ] Cost if commercial
- [ ] Self-hosted vs CDN performance comparison

**Design decision**: Which weights do we need?
- Display: 700 (Bold) for headlines
- UI: 600 (Semibold) for buttons, labels
- Body: 500 (Medium) for subheads
- Body: 400 (Regular) for descriptions

**JetBrains Mono Strategy**

Already available (free/open source).

**Design decision**: Where exactly does Mono replace Satoshi?
- Coordination counts: "847 sent this"
- Reputation scores: "+50 Reputation"
- District codes: "CA-11", "TX-21"
- Timestamps: "2 hours ago"
- Metrics/percentages: "85% match"

### Frontend Implementation Tasks

**Task 1.1: Font Integration**

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    }
  }
}
```

**Files to update**:
- `tailwind.config.ts` - Add Satoshi to font-sans
- `src/app.html` - Add font preload links
- `src/lib/styles/fonts.css` - @font-face declarations

**Performance targets**:
- FOIT (Flash of Invisible Text): <100ms
- Font subset: Latin + Latin Extended only
- Preload critical weights (400, 600, 700)

**Task 1.2: Typography Audit & Migration**

Create audit script to find all text elements:

```bash
# Find all components with text classes
grep -r "text-" src/lib/components/ --include="*.svelte"

# Find hardcoded font-family
grep -r "font-family" src/ --include="*.svelte" --include="*.css"
```

**Migration checklist**:
- [ ] Headers/titles → `font-sans` (Satoshi)
- [ ] Body text → `font-sans` (Satoshi)
- [ ] Button labels → `font-sans` (Satoshi)
- [ ] Navigation → `font-sans` (Satoshi)
- [ ] Metrics/counts → `font-mono` (JetBrains Mono)
- [ ] Codes/IDs → `font-mono` (JetBrains Mono)
- [ ] Timestamps → `font-mono` (JetBrains Mono)

**Task 1.3: Design Token System**

```css
/* src/lib/styles/design-tokens.css */

/* Typography Scale */
:root {
  --font-sans: 'Satoshi', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Coordination-specific sizes */
  --text-coordination-count: 2rem; /* 32px for impact */
  --text-coordination-label: 0.875rem; /* 14px supporting */
  --text-coordination-metric: 1.5rem; /* 24px data prominence */
}
```

**Deliverables**:
- [ ] Satoshi font licensed and integrated
- [ ] Font loading optimized (<100ms FOIT)
- [ ] Design tokens CSS file created
- [ ] Typography audit completed (spreadsheet of all violations)
- [ ] Top 10 high-traffic pages migrated

---

## Phase 2: Component Architecture (Weeks 2-3)

### Design Studio Approach

**Component Specification Template** (Stripe/Linear standard):

```markdown
## ComponentName

**Purpose**: What problem this solves
**Usage**: When to use vs alternatives

### API
- Props (with types, defaults, required)
- Events (with payload types)
- Slots (if applicable)

### States
- Default
- Hover
- Active/pressed
- Focus (keyboard)
- Loading
- Disabled
- Error

### Variants
- Size (sm, md, lg)
- Visual style (primary, secondary, tertiary)
- Context (verified, community, etc.)

### Accessibility
- ARIA attributes
- Keyboard navigation
- Screen reader announcements

### Animation
- Timing (duration, easing)
- Trigger (hover, click, mount)
- Performance (GPU-accelerated properties)
```

### Priority Components

**1. Button Component Enhancement**

**Current state** (src/lib/components/ui/Button.svelte):
- ✅ Sophisticated paper plane physics exist (lines 233-379)
- ✅ Spring animations implemented
- ❌ No trail effect during flight
- ❌ No impact ripple at destination
- ❌ Typography not Satoshi

**Design enhancements**:
```typescript
// New props needed
interface ButtonProps {
  // Existing...
  enableFlight?: boolean;
  variant?: 'primary' | 'secondary' | 'magical';

  // NEW for design system compliance
  enableTrail?: boolean; // Trail effect during flight
  enableImpact?: boolean; // Ripple on arrival
  coordinationFeedback?: boolean; // Show count increment on success
}
```

**Animation enhancements**:
- Trail effect: Motion blur + particle trail during flight
- Impact ripple: Concentric circles on arrival (like dropping stone in water)
- Coordination pulse: Brief glow on all template instances when one is sent

**Typography migration**:
```svelte
<!-- BEFORE -->
<button class="font-semibold">Send to Congress</button>

<!-- AFTER -->
<button class="font-sans font-semibold">Send to Congress</button>
```

**Files to modify**:
- `src/lib/components/ui/Button.svelte` - Main component
- `src/lib/components/ui/Button.test.ts` - Update tests
- `src/lib/components/ui/Button.stories.svelte` - Add new variants

**Task 2.1: Button Typography Migration**
- [ ] Replace all button text with `font-sans`
- [ ] Verify font-weight hierarchy (400/500/600)
- [ ] Test across all variants (primary, secondary, magical)

**Task 2.2: Paper Plane Trail Effect**
- [ ] Design trail particle system (small planes behind main plane)
- [ ] Implement with CSS transforms + motion blur
- [ ] Performance test (must maintain 60fps)

**Task 2.3: Impact Ripple Animation**
- [ ] Design ripple effect (SVG or CSS radial gradients)
- [ ] Coordinate with paper plane "sent" state
- [ ] Ensure GPU acceleration

**Task 2.4: Coordination Feedback Integration**
- [ ] Add coordination count increment on send success
- [ ] Pulse animation on related template instances
- [ ] Debounce rapid clicks (prevent spam)

**Deliverables**:
- [ ] Button component fully compliant with design-system.md
- [ ] All animation enhancements implemented
- [ ] Visual regression tests passing
- [ ] Performance budget met (60fps)

---

**2. Template Card Component** (NEW)

**Purpose**: Display template with coordination metrics, respecting typography hierarchy

**Design spec**:
```svelte
<script>
  interface TemplateCardProps {
    template: {
      id: string;
      title: string; // Satoshi Semibold
      description: string; // Satoshi Regular
      sentCount: number; // JetBrains Mono Bold
      districtCount: number; // JetBrains Mono Bold
      activeStates: number; // JetBrains Mono Bold
    };
    onSend?: () => void;
    onShare?: () => void;
  }
</script>

<div class="template-card rounded-lg border p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
  <!-- Title: Satoshi Semibold -->
  <h3 class="font-sans text-lg font-semibold">
    {template.title}
  </h3>

  <!-- Metrics: JetBrains Mono Bold -->
  <div class="flex gap-4 font-mono text-sm text-slate-600">
    <span>Sent: <strong class="text-slate-900">{template.sentCount}</strong></span>
    <span>Districts: <strong class="text-slate-900">{template.districtCount}</strong></span>
  </div>

  <!-- Description: Satoshi Regular -->
  <p class="font-sans text-sm text-slate-700">
    {template.description}
  </p>

  <!-- Actions -->
  <div class="flex gap-2">
    <Button variant="primary" onclick={onSend}>Send Now</Button>
    <ShareButton {template} />
  </div>
</div>
```

**Typography hierarchy**:
- Title: `font-sans font-semibold` (Satoshi 600)
- Metrics: `font-mono font-bold` (JetBrains Mono 700)
- Description: `font-sans font-normal` (Satoshi 400)

**Hover state**:
- Gentle lift: `translateY(-2px)`
- Shadow intensifies: `shadow-sm` → `shadow-lg`
- Coordination count animates if recent activity (optional)

**Task 2.5: Template Card Component**
- [ ] Create component file structure
- [ ] Implement typography hierarchy exactly as spec
- [ ] Add hover state with lift + shadow
- [ ] Integrate Button and ShareButton components
- [ ] Add coordination ticker (if recent activity)

**Task 2.6: Template Card States**
- [ ] Default state
- [ ] Hover state
- [ ] Active/pressed state (if clickable)
- [ ] Loading state (skeleton)
- [ ] Empty state (no templates)

**Deliverables**:
- [ ] TemplateCard.svelte component
- [ ] TemplateCard.test.ts tests
- [ ] TemplateCard.stories.svelte Storybook examples
- [ ] Used in template list/grid views

---

**3. Location Filter Component Refactor**

**Current state** (src/lib/components/landing/template/LocationFilter.svelte):
- ❌ May have category labels ("campaigns in Texas")
- ❌ Typography may not be Satoshi
- ✅ Breadcrumb inference logic exists (country from state code)

**Design spec** (from patterns/location-filtering.md):

```svelte
<header>
  <h1 class="font-sans text-3xl font-bold">
    {#if district}
      {district}
    {:else if county}
      {county}
    {:else if state}
      {state}
    {:else}
      Nationwide
    {/if}
  </h1>

  <p class="font-mono text-sm text-slate-600">
    {coordinationCount} coordinating
  </p>
</header>
```

**NO "in". NO "campaigns". NO "issues".**

Just location name (Satoshi) + count (JetBrains Mono).

**Task 2.7: Location Header Audit**
- [ ] Find all location headers in codebase
- [ ] Remove all "campaigns in", "issues in" language
- [ ] Migrate to minimal format (location + count)
- [ ] Typography: `font-sans` for location, `font-mono` for count

**Task 2.8: Progressive Precision Affordances**
- [ ] "See what's happening in your county →" (state → county)
- [ ] "Find who represents you →" (county → district)
- [ ] Ensure affordances use descriptive language (allowed)
- [ ] But headers stay minimal (location name only)

**Deliverables**:
- [ ] All location headers minimal (location + count only)
- [ ] Typography compliance (Satoshi + Mono)
- [ ] Progressive affordances added
- [ ] Voice.md compliance verified

---

**4. Privacy Badge Component** (NEW)

**Purpose**: Show privacy guarantees with progressive disclosure

**Design spec** (from design-system.md):

```svelte
<script>
  interface PrivacyBadgeProps {
    label: string; // "Verified Residency", "Stored in browser"
    description?: string; // Popover content
    technicalDocs?: string; // Link to full docs
  }
</script>

<!-- Primary UI: Simple badge -->
<div class="flex items-center gap-2">
  <span class="font-sans text-sm">{label}</span>
  {#if description}
    <InfoIcon class="h-4 w-4 text-slate-400" />
  {/if}
</div>

<!-- Popover (on hover): Technical details -->
{#if description}
  <Popover>
    <p class="font-sans text-xs text-slate-600">
      {description}
    </p>
    {#if technicalDocs}
      <a href={technicalDocs} class="text-indigo-600 underline">
        Learn more
      </a>
    {/if}
  </Popover>
{/if}
```

**Progressive disclosure pattern**:
1. **Layer 1** (Always visible): Outcome statement ("Verified Residency")
2. **Layer 2** (Hover): Mechanism summary (popover)
3. **Layer 3** (Click-through): Full technical docs

**Task 2.9: Privacy Badge Component**
- [ ] Create PrivacyBadge.svelte component
- [ ] Implement popover on hover (or click on mobile)
- [ ] Typography: Satoshi for all text
- [ ] Integrate with InfoIcon component

**Task 2.10: Privacy Badge Usage**
- [ ] Identity verification flow
- [ ] Location inference display
- [ ] Address collection form
- [ ] Template preview (if privacy-relevant)

**Deliverables**:
- [ ] PrivacyBadge.svelte component
- [ ] Popover implementation (accessible)
- [ ] Used in all privacy-relevant contexts
- [ ] Mobile-friendly (click to reveal on touch)

---

## Phase 3: Animation Implementation (Week 4)

### Animation Philosophy (from design-system.md)

**Dopamine-pushing for coordination signals:**
- Paper plane send ✅ (exists, needs enhancement)
- Share button particle burst ✅ (exists, needs coordination feedback)
- Coordination count ticking up ❌ (NEW)
- Reputation accumulation ❌ (NEW)
- Live activity indicators ❌ (NEW)

**Subtle disclosure for privacy mechanics:**
- Privacy badge hover reveals ✅ (will exist after Phase 2)
- Verification status transitions ❌ (NEW)
- Security indicator pulses ❌ (NEW)

### Animation Performance Budget

**Rule**: Maximum 3 simultaneously animated elements per viewport

**Performance requirements**:
- 60fps for all animations
- GPU acceleration (transform/opacity only)
- Respect `prefers-reduced-motion`

### Priority Animations

**1. Coordination Count Ticker** (NEW - High Priority)

**Design spec**:
```svelte
<script>
  import { spring } from 'svelte/motion';

  let count = $state(847);
  let displayCount = spring(count, { stiffness: 0.2, damping: 0.8 });

  $effect(() => {
    displayCount.set(count);
  });
</script>

<span class="font-mono text-2xl font-bold tabular-nums">
  {Math.round($displayCount)}
</span>
```

**Triggers**:
- New coordination event (someone sends template)
- User's own send completes
- Real-time updates via WebSocket/polling

**Visual**:
- Number smoothly increments (spring physics)
- Subtle glow pulse on change
- Tabular nums for alignment (no layout shift)

**Task 3.1: Coordination Ticker Component**
- [ ] Create CoordinationTicker.svelte component
- [ ] Implement spring-based number animation
- [ ] Add glow pulse on value change
- [ ] Ensure tabular-nums class (no layout shift)
- [ ] Performance test (must be GPU-accelerated)

**Task 3.2: Integration Points**
- [ ] Template cards (sent count)
- [ ] Location headers (coordination count)
- [ ] Impact dashboard (if exists)
- [ ] Real-time update system (WebSocket or polling)

**Deliverables**:
- [ ] CoordinationTicker.svelte component
- [ ] Real-time update integration
- [ ] Performance verified (60fps)
- [ ] Used in all coordination count displays

---

**2. Reputation Gain Feedback** (NEW - Medium Priority)

**Design spec**:
```svelte
<script>
  import { scale, fly } from 'svelte/transition';

  let reputationScore = $state(150);
  let showGain = $state(false);
  let gainAmount = $state(0);

  function onReputationGain(amount: number) {
    gainAmount = amount;
    showGain = true;
    setTimeout(() => showGain = false, 1000);
  }
</script>

<div class="relative">
  <span class="font-mono font-bold">
    {reputationScore}
  </span>

  {#if showGain}
    <span
      class="absolute -right-8 top-0 font-mono text-sm font-semibold text-green-600"
      in:scale={{ start: 0.5, duration: 400 }}
      out:fly={{ y: -20, duration: 600 }}
    >
      +{gainAmount}
    </span>
  {/if}
</div>
```

**Triggers**:
- Message sent successfully
- Template coordination threshold reached
- Impact verification confirmed

**Visual**:
- Green "+50" flies up and fades
- Main score counts up smoothly (use CoordinationTicker)
- Brief glow on reputation badge

**Task 3.3: Reputation Gain Component**
- [ ] Create ReputationGain.svelte component
- [ ] Implement "+X" fly-up animation
- [ ] Coordinate with CoordinationTicker for score update
- [ ] Add glow effect on reputation badge

**Task 3.4: Integration Points**
- [ ] Message send success callback
- [ ] Template coordination milestones
- [ ] Impact verification events

**Deliverables**:
- [ ] ReputationGain.svelte component
- [ ] Integrated with reputation system
- [ ] Triggers verified in production flows

---

**3. Share Button Coordination Feedback** (Enhancement)

**Current state** (src/lib/components/ui/ShareButton.svelte):
- ✅ Particle burst exists (lines 28-82)
- ✅ Spring-based scaling and glow
- ❌ No coordination pulse when link copied
- ❌ No count increment visual feedback

**Design enhancements**:
```typescript
interface ShareButtonProps {
  // Existing...
  variant?: 'default' | 'magical';

  // NEW for coordination feedback
  showCoordinationPulse?: boolean; // Pulse all template instances
  onShareSuccess?: () => void; // Callback for count increment
}
```

**Animation enhancements**:
- Particle direction follows mouse movement (existing particles)
- Coordination pulse when link copied (brief glow on all template instances)
- Count increment when share succeeds (use CoordinationTicker)
- Social proof micro-animation ("3 people shared in last hour")

**Task 3.5: Share Button Enhancement**
- [ ] Particle direction follows mouse cursor
- [ ] Add coordination pulse on copy success
- [ ] Integrate with CoordinationTicker for share count
- [ ] Add social proof micro-copy (optional)

**Deliverables**:
- [ ] ShareButton.svelte enhanced
- [ ] Coordination pulse implemented
- [ ] Share count increment animated

---

**4. Live Activity Pulse** (NEW - Low Priority)

**Design spec**:
```svelte
<div class="flex items-center gap-2">
  <div
    class="h-2 w-2 rounded-full bg-green-500"
    class:animate-pulse={isActive}
  ></div>
  <span class="font-sans text-sm text-slate-600">
    3 people coordinating now
  </span>
</div>
```

**Triggers**:
- Recent activity (last 5 minutes)
- Multiple users viewing template
- Coordination wave in progress

**Visual**:
- Pulse animation on green dot (CSS `animate-pulse`)
- Gentle fade in/out of text
- Updates every 30 seconds

**Task 3.6: Live Activity Indicator**
- [ ] Create LiveActivity.svelte component
- [ ] Implement pulse animation
- [ ] Integrate with real-time activity tracking
- [ ] Add to template cards (if recent activity)

**Deliverables**:
- [ ] LiveActivity.svelte component
- [ ] Real-time activity integration
- [ ] Used in template cards/headers

---

## Phase 4: Voice & Language Audit (Week 5)

### Voice Guidelines (from voice.md)

**Core principles**:
1. **Confident & Direct** - State what is. Don't explain, justify, defend.
2. **Technical Details in Popovers** - Primary UI simple, mechanism in hover.
3. **Don't Wear Cypherpunk on Our Sleeve** - Users don't need to know mechanism.
4. **No Pre-Defending** - Don't apologize for what we are.
5. **Imperative Voice** - Commands, not suggestions.

**Vocabulary to avoid**:
- ❌ campaigns, issues, community, platform, content, engagement, solutions, empower

**Geographic scope language**:
- Federal: "All 50 states + DC + territories" (NOT "national issues")
- State: "California" (just the state name)
- District: "CA-11" (just the district code)
- Templates speak for themselves - location is filter, not category

### Systematic Audit Process

**Task 4.1: Automated Language Scan**

Create linting rules or grep scripts to find violations:

```bash
# Find "campaigns in" violations
grep -r "campaigns in" src/ --include="*.svelte" --include="*.ts"

# Find "issues in" violations
grep -r "issues in" src/ --include="*.svelte" --include="*.ts"

# Find "community" misuse (allowed in "community outreach", not as category)
grep -r "community" src/ --include="*.svelte" --include="*.ts"

# Find "platform" misuse
grep -r "platform" src/ --include="*.svelte" --include="*.ts"
```

**Create violation report**:
- File path
- Line number
- Violation type
- Suggested fix

**Task 4.2: Location Header Audit**

All location headers must be minimal:

**WRONG**:
```svelte
<h1>Campaigns in Texas</h1>
<h1>Issues in CA-11</h1>
<h1>Find campaigns in your area</h1>
```

**CORRECT**:
```svelte
<h1 class="font-sans">Texas</h1>
<h1 class="font-sans">CA-11</h1>
<h1 class="font-sans">{congressionalDistrict || stateName || 'Nationwide'}</h1>
```

**Audit checklist**:
- [ ] Landing page headers
- [ ] Template list headers
- [ ] Location filter component
- [ ] Navigation breadcrumbs
- [ ] Empty states
- [ ] Meta descriptions

**Task 4.3: Template Title Audit**

Templates must be self-explanatory, no category labels:

**WRONG**:
```svelte
<h3>Campaign: Support Medicare Expansion</h3>
<h3>Issue: Clean Water Act</h3>
```

**CORRECT**:
```svelte
<h3 class="font-sans font-semibold">Support Medicare Expansion</h3>
<h3 class="font-sans font-semibold">Tell Spotify: Fair artist pay</h3>
```

**Audit checklist**:
- [ ] Template cards
- [ ] Template preview modals
- [ ] Template creator UI
- [ ] Share preview text
- [ ] Email subject lines

**Task 4.4: Empty State Audit**

Empty states must be coordination-focused:

**WRONG**:
```svelte
<p>No campaigns in TX-25 yet</p>
<p>No issues available</p>
```

**CORRECT**:
```svelte
<p class="font-sans">Nothing coordinating in TX-25 yet</p>
<p class="font-sans">Create the first template for your district</p>
```

**Audit checklist**:
- [ ] Template list empty states
- [ ] Search results empty states
- [ ] Location filter no results
- [ ] User dashboard (no templates sent yet)

**Task 4.5: Voice Lint Rules**

Create ESLint or custom linting rules:

```typescript
// .eslintrc.js or custom linter
module.exports = {
  rules: {
    'no-category-labels': {
      meta: {
        messages: {
          noCampaignsIn: 'Use location name only, not "campaigns in {{location}}"',
          noIssuesIn: 'Use location name only, not "issues in {{location}}"',
        }
      },
      create(context) {
        return {
          Literal(node) {
            const text = node.value;
            if (typeof text === 'string') {
              if (/campaigns in/i.test(text)) {
                context.report({ node, messageId: 'noCampaignsIn' });
              }
              if (/issues in/i.test(text)) {
                context.report({ node, messageId: 'noIssuesIn' });
              }
            }
          }
        };
      }
    }
  }
};
```

**Deliverables**:
- [ ] Automated violation scan complete
- [ ] All location headers corrected
- [ ] All template titles self-explanatory
- [ ] All empty states coordination-focused
- [ ] Lint rules created (prevent future violations)

---

## Phase 5: Polish & Performance (Week 6)

### Design Studio Standards

**Vercel**: Performance IS user experience
**Linear**: Everything feels instant
**Stripe**: Accessibility non-negotiable

### Performance Targets

**Font Loading**:
- FOIT (Flash of Invisible Text): <100ms
- FOUT (Flash of Unstyled Text): Minimized with font-display: swap
- Preload critical fonts (Satoshi 400, 600, 700)

**Animation Performance**:
- 60fps for all animations (16.67ms/frame budget)
- GPU acceleration (transform/opacity only, no width/height)
- Max 3 animated elements per viewport

**Accessibility**:
- WCAG AA contrast ratios (4.5:1 for body, 3:1 for large)
- Keyboard navigation (all interactive elements)
- Screen reader support (proper ARIA, semantic HTML)
- Reduced motion respect (prefers-reduced-motion media query)

### Task 5.1: Font Loading Optimization

**Current state**: Fonts may block render, cause FOIT

**Implementation**:

```html
<!-- src/app.html -->
<head>
  <!-- Preload critical fonts -->
  <link rel="preload" href="/fonts/Satoshi-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/Satoshi-Semibold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/Satoshi-Bold.woff2" as="font" type="font/woff2" crossorigin>
</head>
```

```css
/* src/lib/styles/fonts.css */
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap; /* Prevent FOIT, show fallback immediately */
  unicode-range: U+0000-00FF, U+0131, U+0152-0153; /* Latin subset */
}

@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Semibold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}

@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}
```

**Optimization checklist**:
- [ ] Self-host fonts (no external CDN requests)
- [ ] WOFF2 format only (best compression)
- [ ] Latin subset only (reduce file size)
- [ ] Preload critical weights
- [ ] font-display: swap (prevent FOIT)
- [ ] Lighthouse font score >90

**Task 5.2: Animation Performance Audit**

**Audit all animations**:
```bash
# Find all animation/transition uses
grep -r "transition" src/ --include="*.svelte" --include="*.css"
grep -r "animate" src/ --include="*.svelte" --include="*.css"
grep -r "spring" src/ --include="*.svelte"
```

**Performance checklist per animation**:
- [ ] Uses transform/opacity only (GPU-accelerated)
- [ ] No width/height/top/left animations (CPU-bound)
- [ ] Will-change hints for transform/opacity
- [ ] Respects prefers-reduced-motion
- [ ] Max 3 animations per viewport
- [ ] 60fps verified in Chrome DevTools Performance

**Bad example** (CPU-bound):
```css
/* WRONG: Animates width (causes layout recalc) */
.card {
  transition: width 300ms;
}
```

**Good example** (GPU-accelerated):
```css
/* CORRECT: Animates transform (GPU) */
.card {
  transition: transform 300ms;
  will-change: transform;
}
```

**Task 5.3: Accessibility Audit**

**Run automated tools**:
```bash
# Install axe-core
npm install -D @axe-core/cli

# Audit all pages
npx axe http://localhost:5173
npx axe http://localhost:5173/templates
npx axe http://localhost:5173/s/[slug]
```

**Manual testing checklist**:
- [ ] Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- [ ] Screen reader testing (VoiceOver on macOS, NVDA on Windows)
- [ ] Color contrast (all text meets WCAG AA)
- [ ] Focus indicators visible (ring-2 ring-blue-500)
- [ ] Touch targets ≥44px (mobile)
- [ ] Reduced motion respected

**ARIA requirements**:
```svelte
<!-- Button with icon only -->
<button aria-label="Share template" title="Share this template">
  <ShareIcon />
</button>

<!-- Status updates -->
<div role="status" aria-live="polite">
  {#if sending}
    Sending message...
  {:else if sent}
    Message delivered successfully
  {/if}
</div>

<!-- Form fields -->
<label for="template-title">Template Title</label>
<input
  id="template-title"
  aria-describedby="title-help"
  aria-required="true"
/>
<div id="title-help">Choose a clear, action-oriented title</div>
```

**Task 5.4: Visual Regression Testing**

**Setup Percy or Chromatic**:
```bash
# Install Chromatic
npm install -D chromatic

# Run visual tests
npm run chromatic
```

**Test all component states**:
- Default
- Hover
- Active/pressed
- Focus (keyboard)
- Loading
- Disabled
- Error
- Empty

**Deliverables**:
- [ ] Font loading <100ms FOIT
- [ ] All animations 60fps
- [ ] WCAG AA compliance (100% axe-core pass)
- [ ] Visual regression tests setup
- [ ] Production deployment checklist complete

---

## Success Metrics

### Quantitative

**Performance**:
- [ ] Lighthouse Performance score ≥90
- [ ] Font loading <100ms FOIT
- [ ] All animations 60fps (verified in DevTools)
- [ ] Page load time <2s (3G network)

**Accessibility**:
- [ ] axe-core score: 100% (zero violations)
- [ ] WCAG AA compliance verified
- [ ] Keyboard navigation: all flows testable
- [ ] Screen reader: all content accessible

**Code Quality**:
- [ ] TypeScript errors: 0
- [ ] ESLint errors: 0
- [ ] Voice lint violations: 0
- [ ] Test coverage ≥80%

### Qualitative

**Design Compliance**:
- [ ] Typography: 100% Satoshi (words) + JetBrains Mono (data)
- [ ] Animations: All coordination signals animated
- [ ] Voice: Zero category labels, all location headers minimal
- [ ] Aesthetics: "Credibly cool" achieved (not corporate, not tacky)

**User Experience**:
- [ ] Feels distinctive (not generic web app)
- [ ] Coordination dynamics visceral (animations feel rewarding)
- [ ] Privacy mechanics invisible (popovers for details)
- [ ] Trust signals clear (verification, delivery confirmation)

---

## Risk Mitigation

### Risk 1: Satoshi Font Licensing Cost

**Risk**: Satoshi may require expensive commercial license

**Mitigation**:
- Research free alternatives (Commissioner, Plus Jakarta Sans)
- Budget approval process if commercial
- Fallback: Use distinctive free font + refine other aspects

### Risk 2: Animation Performance

**Risk**: Complex animations drop below 60fps on low-end devices

**Mitigation**:
- Performance budget enforced (max 3 animations/viewport)
- GPU acceleration mandatory (transform/opacity only)
- Fallback: Respect prefers-reduced-motion, disable on slow devices

### Risk 3: Voice Audit Scope Creep

**Risk**: Too many violations, audit takes >1 week

**Mitigation**:
- Prioritize high-traffic pages first
- Create lint rules to prevent new violations
- Phase violations: fix critical first, minor later

### Risk 4: Design-Dev Handoff Ambiguity

**Risk**: Design specs incomplete, frontend makes wrong decisions

**Mitigation**:
- Component specification template (Stripe/Linear standard)
- Design review meeting before each phase
- Figma mockups for complex components
- Daily standups during implementation

---

## Team Structure & Responsibilities

### Roles Needed

**Design Lead**:
- Design decision authority
- Component spec review
- Visual QA
- Figma mockups

**Frontend Engineer (Primary)**:
- Component implementation
- Animation development
- Performance optimization
- Accessibility compliance

**Frontend Engineer (Secondary)**:
- Typography migration
- Voice audit
- Test coverage
- Documentation

**Product Manager**:
- Timeline management
- Priority decisions
- Stakeholder communication

---

## Timeline & Milestones

**Week 1** (Typography Foundation):
- [ ] Satoshi font licensed and integrated
- [ ] Design tokens created
- [ ] Typography audit completed
- [ ] Top 10 pages migrated

**Week 2-3** (Component Architecture):
- [ ] Button component enhanced
- [ ] Template card component created
- [ ] Location filter refactored
- [ ] Privacy badge component created

**Week 4** (Animation Implementation):
- [ ] Coordination ticker component
- [ ] Reputation gain animation
- [ ] Share button coordination feedback
- [ ] Live activity indicator

**Week 5** (Voice & Language Audit):
- [ ] Automated violation scan
- [ ] All location headers corrected
- [ ] All template titles self-explanatory
- [ ] Lint rules created

**Week 6** (Polish & Performance):
- [ ] Font loading optimized
- [ ] Animation performance verified
- [ ] Accessibility compliance 100%
- [ ] Production deployment ready

---

## Post-Launch

### Monitoring

**Performance monitoring**:
- Real User Monitoring (RUM) for font loading times
- Animation frame rate tracking (chrome://tracing)
- Lighthouse CI integration

**Accessibility monitoring**:
- Automated axe-core tests in CI
- Screen reader testing on every release
- Keyboard navigation regression tests

**Design compliance monitoring**:
- Visual regression tests (Percy/Chromatic)
- Voice lint rules in pre-commit hooks
- Component audit quarterly

### Iteration

**Month 1 post-launch**:
- User feedback collection
- Performance tuning
- Edge case fixes

**Month 2-3 post-launch**:
- Advanced animation polish
- Dark mode (if not Phase 1)
- Additional component variants

---

## Appendix: Reference Documentation

**Primary Sources**:
- `docs/design/design-system.md` - THE definitive design system
- `docs/design/voice.md` - Language guidelines
- `docs/design/patterns/location-filtering.md` - Location UX patterns
- `docs/design/patterns/template-discovery.md` - Template browsing UX
- `docs/design/patterns/privacy-governance.md` - Privacy UI patterns

**Component Examples**:
- `src/lib/components/ui/Button.svelte` - Existing paper plane animation
- `src/lib/components/ui/ShareButton.svelte` - Existing particle burst
- `src/lib/components/landing/template/LocationFilter.svelte` - Location inference

**External References**:
- Stripe Design System: https://stripe.com/docs/design
- Linear Design: https://linear.app/design
- Vercel Design: https://vercel.com/design
- Airbnb Design: https://airbnb.design

---

*Communiqué PBC | Design Overhaul Plan | 2025-11-18*
