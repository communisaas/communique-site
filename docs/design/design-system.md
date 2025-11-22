# Communiqué Design System

**The weight of numbers.**

---

## Philosophy

Communiqué is infrastructure for organized pressure. One complaint gets buried. Five thousand coordinated messages force a response.

The design system exists to make collective action feel inevitable.

Every pixel answers one question: **does this make coordination feel heavier?**

---

## What We're Not

We're not a SaaS product. We're not a "platform." We're not trying to look like Stripe or Linear or Vercel.

Those are tools for individual productivity. Communiqué is a weapon for collective action.

**We don't design for "credibility." We design for momentum.**

---

## The Visual Identity: Coordination Graph

The RelayLoom component defines our visual language. It shows what Communiqué actually does:

- **Nodes** — People and targets, connected
- **Edges** — Messages flowing from many senders to decision-makers
- **Animation** — Flow that reveals collective action in progress

This is the honest aesthetic. Not gradients and glows. A graph of coordination.

### Colors Derived from RelayLoom

```css
/* Coordination flow */
--teal-route: rgba(59, 196, 184, 0.9);    /* #3BC4B8 — Message routes to targets */
--indigo-share: rgba(79, 70, 229, 0.9);   /* #4F46E5 — Sharing/spreading connections */

/* Verification */
--emerald-verified: #10b981;               /* Delivery confirmed, identity verified */

/* Surfaces */
--surface-base: #ffffff;
--surface-node: rgba(255, 255, 255, 0.9);  /* Node cards with blur */
--border-node: rgba(148, 163, 184, 0.45);  /* Subtle node borders */

/* Text */
--text-primary: #0f172a;                   /* Slate-900 */
--text-secondary: #475569;                 /* Slate-600 */
--text-muted: #94a3b8;                     /* Slate-400 */
```

**That's it.** Teal for routes. Indigo for sharing. Emerald for verification. No violet accent. No participation-primary gradients. No five-color palette.

---

## Typography

### The System

**Satoshi** — Words, labels, UI. Geometric but warm. Not corporate bland.

**JetBrains Mono** — Numbers, metrics, codes. Technical credibility. Tabular figures.

### The Rule

If it's a word, use Satoshi. If it's a number, use JetBrains Mono.

```svelte
<!-- Location + count -->
<h1 class="font-sans text-2xl font-bold">California</h1>
<p class="font-mono text-sm">47 coordinating</p>

<!-- Template metrics -->
<span class="font-mono tabular-nums">1,247</span> sent
<span class="font-mono tabular-nums">94</span> districts
```

### Weights

- **700 (Bold)** — Headlines, counts, CTAs
- **600 (Semibold)** — Subheads, emphasis
- **500 (Medium)** — UI elements, labels
- **400 (Regular)** — Body text

---

## Motion

### What Gets Animated

**Coordination signals:**
- Paper plane flight (Button.svelte) — Message leaving
- Particle burst (ShareButton.svelte) — Template spreading
- Count increment — Numbers ticking up with spring physics
- Route flow (RelayLoom.svelte) — Edges drawing on load

**Nothing else.** Privacy badges don't animate. Forms don't animate. Cards hover-lift slightly, that's it.

### The Physics

```typescript
// Spring physics for coordination counts
spring(count, { stiffness: 0.2, damping: 0.8 })
```

Numbers should tick like scoreboards—weighted, inevitable. Not bouncy or playful.

### Performance Budget

- Max 3 animated elements per viewport
- GPU-accelerated only (transform, opacity)
- `prefers-reduced-motion` respected

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Components

### Nodes (from RelayLoom)

The node card is the base unit. White with slight blur, subtle border, soft shadow.

```css
.node {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 12px;
  backdrop-filter: blur(4px);
  box-shadow:
    inset 0 1px 6px rgba(0, 0, 0, 0.08),
    0 20px 50px -28px rgba(15, 23, 42, 0.45);
}
```

### Buttons

```svelte
<!-- Primary action: Teal route color -->
<Button variant="verified" enableFlight={true}>
  Send to Congress
</Button>

<!-- Secondary action: Indigo share color -->
<Button variant="primary">
  Send to Decision-Makers
</Button>
```

The paper plane animation is sophisticated. Keep it. It's earned.

### Cards

Gentle lift on hover. Shadow intensifies. No color change.

```css
.card {
  border: 1px solid var(--border-node);
  border-radius: 12px;
  transition: transform 150ms, box-shadow 150ms;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.2);
}
```

### Edges (Connection Lines)

SVG paths with stroke-dasharray animation. Draw on load, then static.

```css
.edge {
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12));
}

/* Teal for routes to targets */
.edge-route { stroke: rgba(59, 196, 184, 0.9); }

/* Indigo for share connections */
.edge-share { stroke: rgba(79, 70, 229, 0.9); }
```

---

## Voice

### Core Principles

From voice.md—still accurate:

1. **Confident & Direct** — State what is. Don't justify.
2. **Technical Details in Popovers** — Primary UI stays simple.
3. **Imperative Voice** — Commands, not suggestions.
4. **No Category Labels** — "CA-11" not "Campaigns in CA-11"

### What We Don't Say

- campaigns, issues, community, platform, content, engagement, solutions, empower

### What We Do Say

- Send. Coordinate. Verify.
- Location names stand alone: "California" / "CA-11"
- Counts speak for themselves: "847 sent this"

---

## Accessibility

Non-negotiable.

### Contrast

WCAG AA minimum. Body text 4.5:1, large text 3:1.

```css
/* These pass */
color: #0f172a; /* on white: 16.8:1 */
color: #10b981; /* emerald on white: 3.2:1 (large text only) */
```

### Focus States

Visible rings. High contrast.

```css
:focus-visible {
  outline: none;
  ring: 2px solid var(--indigo-share);
  ring-offset: 2px;
}
```

### Touch Targets

44px minimum. No exceptions.

### Reduced Motion

Already covered. All animations respect `prefers-reduced-motion`.

---

## What's Implemented vs. Aspirational

### Implemented (Ship Today)

- Satoshi + JetBrains Mono typography
- Button.svelte with paper plane physics
- ShareButton.svelte with particle burst
- RelayLoom.svelte coordination graph
- ChannelExplainer.svelte channel cards
- Teal/indigo/emerald color vocabulary

### Not Yet Implemented

- Coordination count ticker with spring animation
- Reputation gain feedback
- Live activity pulse
- Graph aesthetic extended to template cards

---

## Decision Rules

### "Should this animate?"

**Yes** if it's a coordination signal (send, share, count update).
**No** if it's anything else.

### "What color?"

**Teal** — Routes, connections, active coordination
**Emerald** — Verification, delivery confirmed
**Indigo** — Sharing, spreading, secondary actions

### "Satoshi or Mono?"

**Satoshi** — Words
**Mono** — Numbers

---

## The Standard

When reviewing design work, ask:

1. Does this make coordination feel heavier?
2. Is the animation communicating information or just decorating?
3. Would this work if we removed all color except teal and emerald?
4. Is the typography hierarchy clear at a glance?
5. Does this feel like infrastructure or like a consumer app?

If it feels like a consumer app, it's wrong.

---

*Communiqué PBC | Design System | 2025-11*
