# Coordination Dynamics: The Definitive Design Philosophy

**Status**: Active Design System Philosophy
**Created**: 2025-11-16
**Purpose**: Define distinctive quality coordination UX while keeping crypto/privacy mechanics invisible

---

## Core Principle

**"Invisible crypto, visible coordination"**

Users see and feel **collective action**, not blockchain plumbing. The interface makes **coordination dynamics visceral** through:
- Quality distinctive typography
- Dopamine-pushing animations for coordination signals
- Subtle progressive disclosure for privacy mechanics
- Intuitive flows that never mention crypto

**We will not be safe and familiar. We will be distinctive in quality and coordination.**

---

## The Synthesis: What We Keep From Both

### From design-system-v2/ (Dynamic Coordination Hub) ✅

**ADOPT** - These align with distinctive quality coordination:

1. **Satoshi as Primary Brand Typeface**
   - Headlines, UI elements, CTAs
   - Distinctive, modern, memorable
   - Creates unique brand identity
   - **NOT** for data/metrics (see below)

2. **Dynamic, Interactive by Default**
   - Animations are core part of experience, not optional
   - Interface feels alive and responsive
   - Purposeful micro-interactions provide feedback
   - Every interaction reinforces coordination visibility

3. **"Credibly Cool" Aesthetic**
   - Cutting-edge tech product confidence
   - Neither corporate bland nor crypto tacky
   - Modern, clean, opinionated
   - Quality signals through design choices

4. **Visible Impact, Invisible Mechanism**
   - Show outcomes (coordination count, impact metrics)
   - Hide blockchain mechanics (proofs, contracts, hashes)
   - User never thinks about crypto
   - User always sees collective power

### From docs/design/ (Consumer-Friendly Privacy) ✅

**KEEP** - These maintain intuitiveness and trust:

1. **JetBrains Mono for Data/Metrics**
   - Numbers, counts, codes, timestamps
   - Scannability matters for coordination signals
   - Functional hierarchy through font differentiation
   - "847 coordinating" readable at glance

2. **Progressive Disclosure for Privacy**
   - Hover-revealed privacy badges
   - Expandable technical details (popovers)
   - Don't overwhelm with crypto explanations
   - Privacy mechanics under the hood, accessible when needed

3. **Pragmatic Cypherpunk Voice**
   - Confident, direct language
   - No pre-defending, no marketing speak
   - Honest about what we do/don't know
   - Respect user intelligence

4. **Accessibility Non-Negotiable**
   - Keyboard navigation, screen readers
   - Color contrast (WCAG AA minimum)
   - Touch targets (44px minimum)
   - `prefers-reduced-motion` respected

---

## Typography System: Tactical Font Usage

### Rule: Words Use Satoshi, Numbers Use JetBrains Mono

**Satoshi** (Distinctive Brand Voice):
- Headlines, subheads
- Body copy, descriptions
- UI labels, navigation
- CTAs, buttons
- Template titles, user-generated content

**JetBrains Mono** (Scannable Data):
- Coordination counts ("847 sent this")
- Reputation scores ("+50 Reputation")
- District codes ("CA-11", "TX-21")
- Timestamps ("2 hours ago")
- Metrics, percentages, statistics

**Why Both**:
- Satoshi creates **memorable brand**
- Mono ensures **data scannability**
- Combined: **distinctive yet functional**

### Implementation Example

```svelte
<!-- Template Card -->
<div class="rounded-lg border p-4">
  <!-- Title: Satoshi -->
  <h3 class="font-sans text-lg font-semibold">
    Support Medicare Expansion
  </h3>

  <!-- Coordination metrics: JetBrains Mono -->
  <div class="flex gap-4 font-mono text-sm text-slate-600">
    <span>Sent: <strong class="text-slate-900">847</strong></span>
    <span>Districts: <strong class="text-slate-900">94</strong></span>
  </div>

  <!-- Description: Satoshi -->
  <p class="font-sans text-sm text-slate-700">
    Coordinate with constituents across 94 congressional districts
  </p>
</div>
```

---

## Animation Philosophy: Coordination Visibility

### Core Principle: Animate What Matters

**Dopamine-pushing animations for coordination signals:**
- Paper plane send (KEEP and enhance)
- Share button particle burst (KEEP and enhance)
- Coordination count ticking up (NEW)
- Reputation accumulation (NEW)
- Live activity indicators (NEW)

**Subtle disclosure for privacy mechanics:**
- Privacy badge hover reveals
- Verification status transitions
- Security indicator pulses

### Existing Animations to Keep & Enhance

#### 1. Paper Plane Send Animation (Button.svelte)

**Current state**: Sophisticated physics-based flight with spring animations

**Keep**:
- ✅ Realistic paper plane physics (banking, rotation, blur)
- ✅ Spring-based natural movement
- ✅ Multi-stage flight (takeoff → flying → sent → departing → returning)
- ✅ Hover breath animation (subtle life)

**Enhance**:
- 🎯 Add coordination count increment synchronized with "sent" state
- 🎯 Trail effect during flight (motion blur + particle trail)
- 🎯 Impact ripple at destination (visual feedback on arrival)
- 🎯 Vary flight path based on template type (federal = higher arc, local = direct)

**Principle**: This animation makes **sending feel powerful**. Every send is **a civic action with weight**.

#### 2. Share Button Particle Burst (ShareButton.svelte)

**Current state**: Magical variant with sparkle/heart/zap particles on hover

**Keep**:
- ✅ Spring-based scaling and glow
- ✅ Particle system with random icons
- ✅ Icon morph (Share → CheckCircle on copy)
- ✅ Glow intensity based on interaction state

**Enhance**:
- 🎯 Particle direction follows mouse movement
- 🎯 Coordination pulse when link copied (brief glow on all instances of template)
- 🎯 Count increment when share succeeds
- 🎯 Social proof micro-animation ("3 people shared in last hour")

**Principle**: Sharing amplifies coordination. Animation reinforces **your action enables others**.

### New Animations to Add

#### 3. Coordination Count Ticker

```svelte
<!-- Animated count update -->
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
- Tabular nums for alignment

#### 4. Reputation Accumulation Feedback

```svelte
<!-- Reputation gain animation -->
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
- Main score counts up smoothly
- Brief glow on reputation badge

#### 5. Live Activity Pulse

```svelte
<!-- Real-time coordination indicator -->
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
- Pulse animation on green dot
- Gentle fade in/out of text
- Updates every 30 seconds

---

## Animation Performance Budget

### Guidelines

**Maximum per viewport**: 3 simultaneously animated elements

**Must communicate information**, not just decoration:
- ❌ Decorative sparkles everywhere
- ✅ Sparkles on successful share action

**Respect accessibility**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**GPU acceleration**:
- Use `transform` and `opacity` (GPU-accelerated)
- Avoid `width`, `height`, `top`, `left` (CPU-bound)
- Apply `transform-gpu` class for explicit GPU hint

---

## Privacy UX: Invisible by Default, Accessible on Demand

### Principle: "Privacy Through Architecture, Not Promises"

**User never sees**:
- "Zero-knowledge proof" in primary UI
- "TEE" or "AWS Nitro Enclaves" in CTAs
- "Halo2" or "blockchain" anywhere
- "Encrypted" unless specifically relevant

**User always can access** (via hover/popover):
- How location inference works
- What privacy guarantees exist
- Where data is stored (browser/TEE/chain)
- Technical implementation details

### Privacy Badge Pattern

```svelte
<!-- Primary UI: Simple badge -->
<div class="flex items-center gap-2">
  <span class="font-sans text-sm">Verified Residency</span>
  <InfoIcon class="h-4 w-4 text-slate-400" />
</div>

<!-- Popover (on hover): Technical details -->
<Popover>
  <p class="font-sans text-xs text-slate-600">
    Zero-knowledge proof verifies you live in the district without revealing your address.
  </p>
  <a href="/docs/privacy" class="text-indigo-600 underline">
    Learn more
  </a>
</Popover>
```

**Pattern**:
1. **Layer 1** (Always visible): Outcome statement
2. **Layer 2** (Hover): Mechanism summary
3. **Layer 3** (Click-through): Full technical docs

---

## Component Design Standards

### Buttons

**Primary Actions** (Send, Coordinate, Join):
- Satoshi Medium for text
- Paper plane animation on send
- Spring-based scale feedback
- Dopamine-pushing success state

```svelte
<Button
  variant="primary"
  size="default"
  enableFlight={true}
  icon="send"
>
  Send to Congress
</Button>
```

### Cards (Templates, Coordination Opportunities)

**Content Hierarchy**:
- Title: Satoshi Semibold
- Metrics: JetBrains Mono Bold (numbers stand out)
- Description: Satoshi Regular
- Actions: Satoshi Medium

**Hover State**:
- Gentle lift (translateY -2px)
- Shadow intensifies
- Coordination count animates if recent activity

```svelte
<div
  class="rounded-lg border p-4 transition-all hover:shadow-lg hover:-translate-y-0.5"
>
  <h3 class="font-sans text-lg font-semibold">
    Support Clean Water Act
  </h3>
  <div class="flex gap-4 font-mono text-sm">
    <span>Sent: <strong>1,247</strong></span>
    <span>Districts: <strong>142</strong></span>
  </div>
</div>
```

### Forms (Address Collection, Identity Verification)

**Reassuring, Not Paranoid**:
- Soft emerald background for privacy indicators
- Gentle shadows, subtle rings
- Satoshi for labels and help text
- Progressive disclosure for "Why we need this"

```svelte
<form class="space-y-4">
  <div>
    <label class="font-sans text-sm font-medium">
      Congressional District
    </label>
    <p class="font-sans text-xs text-slate-600">
      Stored in your browser only
      <InfoIcon class="inline h-3 w-3" />
    </p>
  </div>
</form>
```

---

## Color Usage: Coordination Signals

### Primary Palette (Participation)

**Indigo (participation-primary)**:
- Primary CTAs, links, active states
- Coordination highlights
- Brand moments

**Violet (participation-accent)**:
- Magical variant buttons
- Special coordination events
- Premium/verified states

### Semantic Colors

**Verified Green**:
- Identity verification success
- Congressional delivery confirmed
- Reputation milestones

**Coordination Blue**:
- Community outreach
- Network effects visualization
- Social proof indicators

**Warning Amber** / **Danger Red**:
- Only for actual errors/warnings
- Never for privacy indicators (avoid alarm)

---

## Migration Roadmap

### Phase 1: Typography Foundation (Week 1-2)

**Add Satoshi font**:
1. License Satoshi (check pricing)
2. Add to `tailwind.config.ts` font-sans
3. Keep JetBrains Mono in font-mono

**Refactor components**:
1. Update headlines to Satoshi
2. Keep metrics in JetBrains Mono
3. Audit for consistency

**Files to update**:
- `tailwind.config.ts` - Add Satoshi
- `app.html` - Load Satoshi webfont
- Component library - Apply font classes

### Phase 2: Animation Enhancement (Week 3-4)

**Enhance existing animations**:
1. Paper plane trail effect
2. Share button coordination pulse
3. Add impact ripple on send

**Add new animations**:
1. Coordination count ticker
2. Reputation gain feedback
3. Live activity pulse

**Files to update**:
- `Button.svelte` - Enhanced paper plane
- `ShareButton.svelte` - Coordination pulse
- New: `CoordinationTicker.svelte`
- New: `ReputationGain.svelte`

### Phase 3: Component Polish (Week 5-6)

**Refactor component library**:
1. Template cards with new typography
2. Forms with reassuring privacy UX
3. Navigation with Satoshi

**Create showcase**:
1. Component examples document
2. Before/after comparisons
3. Animation demo page

**Files to create**:
- `docs/design/component-showcase.md`
- `src/routes/design-system/+page.svelte` (demo)

---

## Decision Rules

### "Should this be animated?"

**YES if**:
- Coordination signal (count change, send success, share)
- User feedback (button press, form submission)
- State change (loading → success, inactive → active)

**NO if**:
- Purely decorative
- Privacy mechanism explanation
- Static content display

### "Should this use Satoshi or JetBrains Mono?"

**Satoshi if**:
- Words, sentences, labels
- Brand moments, headlines
- UI elements, navigation

**JetBrains Mono if**:
- Numbers, counts, metrics
- Codes, IDs, timestamps
- Data tables, statistics

### "Should this show privacy details?"

**Primary UI**: No technical details
**Popover/hover**: Mechanism summary
**Click-through**: Full technical documentation

---

## Examples: Before & After

### Template Card

**Before (Consumer-Friendly)**:
```svelte
<!-- Inter for everything, subtle everywhere -->
<div class="rounded-lg border border-slate-200 p-4">
  <h3 class="font-sans text-lg">Support Medicare Expansion</h3>
  <div class="text-sm text-slate-600">
    847 sent | 94 districts
  </div>
</div>
```

**After (Coordination Dynamics)**:
```svelte
<!-- Satoshi for words, Mono for numbers, dynamic count -->
<div class="rounded-lg border border-slate-200 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
  <h3 class="font-sans text-lg font-semibold">
    Support Medicare Expansion
  </h3>
  <div class="flex gap-4 font-mono text-sm text-slate-600">
    <span>Sent: <CoordinationTicker count={847} /></span>
    <span>Districts: <strong class="text-slate-900">94</strong></span>
  </div>
</div>
```

### Send Button

**Before (Consumer-Friendly)**:
```svelte
<!-- Static button, no animation -->
<button class="bg-indigo-600 text-white px-4 py-2 rounded-md">
  Send Message
</button>
```

**After (Coordination Dynamics)**:
```svelte
<!-- Satoshi text, paper plane animation, dopamine feedback -->
<Button
  variant="primary"
  enableFlight={true}
  icon="send"
  onclick={handleSend}
>
  Send to Congress
</Button>
<!-- Paper plane flies, coordination count increments, reputation +50 appears -->
```

---

## Success Metrics

### User Experience
- **Perceived quality**: Users describe interface as "polished" or "professional"
- **Coordination clarity**: Users can articulate coordination count meaning
- **Privacy confidence**: Users trust platform without reading privacy docs

### Technical Performance
- **Animation frame rate**: 60fps for all coordination animations
- **Font load time**: <100ms for Satoshi (woff2 subset)
- **Accessibility score**: 100% axe-core compliance

### Business Impact
- **Conversion rate**: Send completion after template view
- **Sharing behavior**: Share button usage rate
- **Return engagement**: Users coordinating on multiple templates

---

## Conclusion

**This is the definitive philosophy**: Distinctive quality through Satoshi typography, dopamine-pushing coordination animations, and invisible crypto mechanics.

**We lean towards design-system-v2** but tactically preserve:
- JetBrains Mono for data scannability
- Progressive disclosure for privacy
- Accessibility standards
- Pragmatic voice guidelines

**The goal**: Make coordination dynamics **visceral and addictive** while keeping blockchain/crypto **completely invisible**.

**Remember**: Design serves user understanding of **collective power**, not designer aesthetics. Every choice must make coordination **more visible, more engaging, more rewarding**.

---

*Communiqué PBC | Coordination Dynamics Design Philosophy | 2025-11-16*
