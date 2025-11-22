# Typography System

**Words in Satoshi. Numbers in Mono.**

---

## The System: Satoshi + JetBrains Mono

### Satoshi (Words)
**Use for:** Headlines, UI copy, buttons, CTAs, body text, navigation

**Why:** Geometric but warm. Not corporate bland (Arial, Helvetica). Not crypto tacky (Poppins).

**Weights:**
- **400 (Regular)** - Body text, descriptions
- **500 (Medium)** - UI elements, labels, navigation
- **700 (Bold)** - Headlines, emphasis, CTAs

### JetBrains Mono (Numbers)
**Use for:** Counts, metrics, codes, timestamps, technical data

**Why:** Tabular figures align. Numbers tick like scoreboards. Technical credibility.

**Weights:**
- **400 (Regular)** - Standard metrics
- **500 (Medium)** - Emphasized counts
- **700 (Bold)** - Large numbers, hero metrics

---

## Implementation

### Tailwind Classes

```html
<!-- DEFAULT: Satoshi for all text -->
<p>This uses Satoshi by default</p>

<!-- EXPLICIT: Use brand font (Satoshi) -->
<h1 class="font-brand">Coordination Infrastructure</h1>

<!-- DATA: Use mono font for metrics -->
<span class="font-mono">1,247</span>

<!-- LEGACY: Gradually migrate from font-participation -->
<div class="font-participation">Legacy component text</div>
```

### CSS Custom Properties

The typography system is defined in `tailwind.config.ts`:

```typescript
fontFamily: {
  sans: ['"Satoshi"', ...],     // Default for all text
  brand: ['"Satoshi"', ...],    // Explicit brand font
  mono: ['"JetBrains Mono"', ...], // Data/metrics
  participation: ['"Satoshi"', ...] // Legacy support
}
```

---

## Usage Patterns

### ✅ CORRECT Examples

```svelte
<!-- Template title: Satoshi Bold -->
<h1 class="font-brand text-3xl font-bold">
  Tell Spotify: Fair artist pay
</h1>

<!-- Coordination count: JetBrains Mono Medium -->
<p class="font-mono text-sm font-medium text-violet-600">
  1,247 sent this
</p>

<!-- Button text: Satoshi Medium -->
<button class="font-brand font-medium">
  Send Now
</button>

<!-- Body copy: Satoshi Regular -->
<p class="font-brand text-base">
  Your message will be encrypted and delivered via certified channels.
</p>

<!-- Timestamp: JetBrains Mono Regular -->
<time class="font-mono text-xs text-slate-500">
  2025-11-18 16:30:00
</time>

<!-- District code: JetBrains Mono Bold -->
<span class="font-mono text-lg font-bold">
  CA-11
</span>
```

### ❌ WRONG Examples

```svelte
<!-- DON'T: Use mono for UI copy -->
<button class="font-mono">Send Message</button>

<!-- DON'T: Use brand font for metrics -->
<span class="font-brand">1,247</span>

<!-- DON'T: Mix fonts within same semantic unit -->
<h1>
  <span class="font-brand">Total:</span>
  <span class="font-mono">1,247</span> <!-- WRONG: Split number from label -->
</h1>

<!-- CORRECT version -->
<div class="flex items-baseline gap-2">
  <h2 class="font-brand text-sm uppercase tracking-wide text-slate-600">Total</h2>
  <span class="font-mono text-3xl font-bold">1,247</span>
</div>
```

---

## Component-Specific Patterns

### Coordination Ticker

```svelte
<div class="flex items-baseline gap-1.5">
  <!-- Label: Satoshi Medium -->
  <span class="font-brand text-sm font-medium text-slate-600">
    Coordinating
  </span>

  <!-- Count: JetBrains Mono Bold with spring animation -->
  <span class="font-mono text-2xl font-bold text-violet-600 tabular-nums">
    {Math.floor($displayCount)}
  </span>
</div>
```

**Key:** `tabular-nums` ensures consistent width for animated numbers.

### Template Card

```svelte
<!-- Title: Satoshi Bold -->
<h3 class="font-brand text-lg font-bold text-slate-900">
  {template.title}
</h3>

<!-- Description: Satoshi Regular -->
<p class="font-brand text-sm text-slate-600">
  {template.description}
</p>

<!-- Metrics: JetBrains Mono Medium -->
<div class="flex gap-4 font-mono text-xs font-medium text-slate-500">
  <span>{template.sent_count} sent</span>
  <span>{template.district_count} districts</span>
</div>
```

### Privacy Badge

```svelte
<div class="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 border border-emerald-200">
  <!-- Icon -->
  <svg class="h-4 w-4 text-emerald-600" />

  <!-- Label: Satoshi Medium -->
  <span class="font-brand text-xs font-medium text-emerald-700">
    Zero-knowledge verified
  </span>
</div>
```

### Location Filter

```svelte
<!-- Location name: Satoshi Bold -->
<h1 class="font-brand text-3xl font-bold text-slate-900">
  California
</h1>

<!-- Coordination count: JetBrains Mono Medium -->
<p class="font-mono text-sm font-medium text-violet-600">
  47 coordinating
</p>
```

---

## Font Loading Strategy

### Self-Hosted Satoshi

**Location:** `/static/fonts/satoshi/`

**Weights included:**
- Satoshi-Regular.woff2 (400)
- Satoshi-Medium.woff2 (500)
- Satoshi-Bold.woff2 (700)

**Loading:** Preloaded in `app.html` for <100ms FOIT target

```html
<!-- Preload critical fonts -->
<link
  rel="preload"
  href="/fonts/satoshi/Satoshi-Medium.woff2"
  as="font"
  type="font/woff2"
  crossorigin="anonymous"
/>
<link
  rel="preload"
  href="/fonts/satoshi/Satoshi-Bold.woff2"
  as="font"
  type="font/woff2"
  crossorigin="anonymous"
/>
```

### Google Fonts JetBrains Mono

**Loading:** Via `@import` in `app.css` with `display=swap`

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

**Why Google Fonts:** Widely cached, reliable CDN, automatic subset optimization

---

## Performance Targets

### Font Loading Performance

**Target:** <100ms FOIT (Flash of Invisible Text)

**Strategy:**
1. **Preload** critical fonts (Medium, Bold) in `<head>`
2. **font-display: swap** prevents invisible text, shows fallback immediately
3. **Self-hosted Satoshi** eliminates external DNS lookup
4. **WOFF2 format** provides best compression (30-50% smaller than WOFF)

### Measurement

```javascript
// Measure font load time
performance.getEntriesByType('resource')
  .filter(entry => entry.name.includes('fonts'))
  .forEach(entry => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
```

**Expected results:**
- Satoshi-Medium.woff2: ~40-60ms
- Satoshi-Bold.woff2: ~40-60ms
- JetBrains Mono (Google): ~80-120ms (cached: <10ms)

---

## Migration Guide

### Phase 1: New Components ✅

**All new components use dual-font system by default.**

No action needed - Satoshi is now the default `font-sans`.

### Phase 2: Existing Components (Gradual)

**Audit these high-traffic components first:**

1. **Button.svelte** - Ensure CTAs use `font-brand font-medium`
2. **TemplateCard.svelte** - Title: `font-brand font-bold`, metrics: `font-mono`
3. **LocationFilter.svelte** - Location: `font-brand font-bold`, count: `font-mono`
4. **PrivacyBadge.svelte** - Label: `font-brand font-medium`
5. **ShareButton.svelte** - Button text: `font-brand font-medium`

**Pattern:**
```diff
- <button class="text-base font-medium">
+ <button class="font-brand text-base font-medium">
  Send Now
</button>

- <span class="text-2xl font-bold">1,247</span>
+ <span class="font-mono text-2xl font-bold tabular-nums">1,247</span>
```

### Phase 3: Remove Legacy

**After all components migrated:**

1. Remove `font-participation` from `tailwind.config.ts`
2. Search codebase for any lingering Inter references
3. Remove Inter from Google Fonts import in `app.css`

---

## Accessibility

### Font Size Minimums

**Mobile:** 16px base (prevents iOS zoom on input focus)
**Desktop:** 16px base (WCAG AA readability)

**Never go below:**
- Body text: 16px (1rem)
- Small text: 14px (0.875rem)
- Micro text: 12px (0.75rem) - use sparingly

### Contrast Requirements

**WCAG AA (minimum):**
- Normal text: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio

**Test combinations:**
```css
/* ✅ PASS: Slate-900 on white */
color: #111827; /* Contrast: 16.8:1 */

/* ✅ PASS: Violet-600 on white */
color: #9333ea; /* Contrast: 7.3:1 */

/* ❌ FAIL: Slate-400 on white */
color: #9ca3af; /* Contrast: 2.8:1 - TOO LOW */
```

### Font Weight Accessibility

**Avoid font-weight below 400** - Light weights (300, 200) reduce readability

**Prefer Medium (500) over Regular (400)** for:
- Small text (<14px)
- Low-contrast backgrounds
- Important UI elements

---

## Design Tokens Reference

### Font Families

```css
--font-sans: 'Satoshi', ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-brand: 'Satoshi', ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
```

### Font Weights

```css
--font-regular: 400;
--font-medium: 500;
--font-bold: 700;
```

### Font Sizes (with line heights)

```css
--text-xs: 0.75rem / 1rem;      /* 12px / 16px */
--text-sm: 0.875rem / 1.25rem;  /* 14px / 20px */
--text-base: 1rem / 1.5rem;     /* 16px / 24px */
--text-lg: 1.125rem / 1.75rem;  /* 18px / 28px */
--text-xl: 1.25rem / 1.75rem;   /* 20px / 28px */
--text-2xl: 1.5rem / 2rem;      /* 24px / 32px */
--text-3xl: 1.875rem / 2.25rem; /* 30px / 36px */
--text-4xl: 2.25rem / 2.5rem;   /* 36px / 40px */
```

---

## Testing Checklist

Before shipping typography changes:

- [ ] **Visual regression:** Compare before/after screenshots
- [ ] **Font loading:** Verify <100ms FOIT on 3G connection
- [ ] **Contrast:** Run axe DevTools, ensure WCAG AA compliance
- [ ] **Mobile:** Test on iOS Safari, Android Chrome (16px minimum)
- [ ] **Fallbacks:** Disable custom fonts, verify system font stack works
- [ ] **Responsive:** Check typography scales correctly at all breakpoints
- [ ] **Print:** Verify typography renders correctly in print styles

---

## Examples in the Wild

### Stripe

**Pattern:** Inter for UI, SF Mono for code/data

**Takeaway:** Monospace for technical data creates trust + scannability

### Linear

**Pattern:** Custom geometric sans (similar to Satoshi), SF Mono for IDs/codes

**Takeaway:** Distinctive brand font creates memorable identity

### Vercel

**Pattern:** Geist Sans for brand, Geist Mono for code

**Takeaway:** Dual-font system reinforces technical credibility

---

## Why This Works

### Satoshi

**Geometric + Warm:** Not corporate bland (Arial, Helvetica) or crypto tacky (Poppins, Montserrat)

**Medium weight default:** More presence than Regular, less aggressive than Bold

**Generous x-height:** Readable at small sizes, accessible across devices

### JetBrains Mono

**Tabular figures:** Numbers align vertically in columns/lists

**Distinct characters:** 0 vs O, 1 vs l vs I - zero ambiguity

**Technical credibility:** Infrastructure signals competence

### Together: "The weight of numbers"

**Satoshi (words):** Human, direct, infrastructure voice

**JetBrains Mono (numbers):** Weighted, inevitable, like a scoreboard

Numbers tick up. Coordination feels heavier.

---

*Communiqué PBC | Typography System | 2025-11*
