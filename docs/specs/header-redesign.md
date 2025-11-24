# Header Redesign: Perceptual Engineering Specification

**Status**: Implementation Ready
**Created**: 2024-01-23
**Methodology**: Perceptual Engineering (GROUND → MAP → DESIGN → IMPLEMENT → VALIDATE)

---

## Executive Summary

The current AppHeader is a cognitive tax—6+ elements competing for attention, generic SaaS styling that clashes with RelayLoom's sophistication, and CTAs that duplicate affordances in content. This specification defines a header that disappears not by hiding, but by perfect perceptual alignment.

**Core Principle**: The header provides orientation and identity confirmation. Nothing more.

---

## Part 1: Perceptual Analysis

### 1.1 User Cognitive States

| Context | Mental State | What Header Must Provide |
|---------|--------------|-------------------------|
| Homepage (Discovery) | Scanning, deciding if this is for them | Brand recognition, auth state |
| Template Page (Advocacy) | Focused on specific action | Way back, identity confirmation |
| Authenticated | "I have context here" | Status confirmation, profile access |
| Anonymous | "Do I need to sign in?" | Non-intrusive auth option |

### 1.2 Current Violations

| Perceptual Principle | Violation |
|---------------------|-----------|
| Working memory (4±1) | 6+ elements: Logo, back, share, CTA, profile, logout |
| Peripheral monitoring | CTAs demand focal attention |
| Predictive processing | Multiple buttons create decision paralysis |
| Gestalt proximity | Elements don't group logically |

### 1.3 What to Remove

| Element | Reason |
|---------|--------|
| Header CTAs | Primary actions belong in content, not header |
| Share button | Secondary action; lives with template content |
| Verbose greeting | "Welcome back, Sarah!" → avatar is enough |
| Multiple visible actions | Profile, logout both visible is redundant |

---

## Part 2: Design System Integration

### 2.1 Color Palette (oklch)

```css
:root {
  /* Header surfaces */
  --header-bg: oklch(0.99 0.005 250 / 0.85);
  --header-bg-solid: oklch(0.99 0.005 250 / 0.95);
  --header-border: oklch(0.85 0.02 250 / 0.6);

  /* Shadows (layered, from RelayLoom) */
  --header-shadow:
    0 1px 3px oklch(0 0 0 / 0.03),
    0 4px 12px -6px oklch(0.25 0.05 250 / 0.15);
  --header-shadow-scrolled:
    0 1px 3px oklch(0 0 0 / 0.04),
    0 8px 20px -10px oklch(0.25 0.05 250 / 0.25);

  /* Interactive (from RelayLoom edge colors) */
  --header-action-primary: oklch(0.55 0.18 270);      /* Share purple */
  --header-action-primary-hover: oklch(0.5 0.2 270);
  --header-action-congress: oklch(0.65 0.14 175);     /* Deliver teal */
  --header-action-congress-hover: oklch(0.6 0.16 175);

  /* Text hierarchy */
  --header-text-primary: oklch(0.15 0.02 250);
  --header-text-secondary: oklch(0.45 0.02 250);
  --header-text-muted: oklch(0.55 0.02 250);

  /* Focus ring */
  --header-focus-ring: oklch(0.6 0.15 270 / 0.5);
}
```

### 2.2 Typography

```css
.header-brand {
  font-family: 'Satoshi', system-ui, sans-serif;
  font-weight: 600;
  font-size: 1.125rem;           /* 18px */
  letter-spacing: -0.01em;
  color: var(--header-text-primary);
}

.header-action {
  font-family: 'Satoshi', system-ui, sans-serif;
  font-weight: 500;
  font-size: 0.875rem;           /* 14px */
  letter-spacing: 0;
}
```

### 2.3 Timing Constants

```css
:root {
  --header-transition-fast: 150ms;
  --header-transition-normal: 220ms;
  --header-transition-slow: 320ms;
  --header-easing: cubic-bezier(0.4, 0, 0.2, 1);
  --header-easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## Part 3: Component Architecture

### 3.1 Hybrid Header System

The header adapts based on context:

```
┌─────────────────────────────────────────────────────────────────┐
│                         LAYOUT SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Homepage        →  AmbientPresence (floating elements)         │
│  Template Page   →  IdentityStrip + BottomBar (mobile)          │
│  Profile         →  None (page manages own navigation)          │
│  Focus Mode      →  MinimalBar (exit + progress only)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Hierarchy

```
src/lib/components/layout/
├── HeaderSystem.svelte          # Context-aware router
├── AmbientPresence.svelte       # Floating elements (homepage)
├── IdentityStrip.svelte         # Minimal header bar
├── MobileBottomBar.svelte       # Thumb-zone actions
└── header/
    ├── HeaderAvatar.svelte      # User avatar with dropdown
    ├── HeaderBackButton.svelte  # Contextual back navigation
    └── HeaderSignIn.svelte      # Auth pill
```

---

## Part 4: Detailed Specifications

### 4.1 AmbientPresence (Homepage)

**Purpose**: Provide orientation without a header bar.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [← Back]                                         [Sign in] ○   │
│  (if navigated from template)                     (floating)    │
│                                                                 │
│                    HERO + RELAY LOOM                            │
│                    (brand lives here)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications**:

| Property | Value |
|----------|-------|
| Position | `fixed`, top: 20px, left/right: 20px |
| Visibility | Fade in after 1.5s OR 80px scroll |
| Background | `oklch(0 0 0 / 0.04)` + `backdrop-filter: blur(8px)` |
| Border | `1px solid oklch(0 0 0 / 0.06)` |
| Border radius | 20px (pill shape) |
| Opacity | 0.7 at rest, 1.0 on hover |
| Transition | 300ms ease-out |

**Anonymous State** (Sign In pill):
```css
.ambient-auth-pill {
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  color: oklch(0.4 0.02 250);
}

.ambient-auth-pill:hover {
  background: oklch(1 0 0 / 0.9);
  box-shadow: 0 2px 8px oklch(0 0 0 / 0.08);
  transform: translateY(-1px);
}
```

**Authenticated State** (Avatar pill):
```css
.ambient-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 12px;
  background: oklch(1 0 0 / 0.85);
  backdrop-filter: blur(12px);
}

.ambient-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid oklch(0.7 0.02 260);
}

.ambient-user-name {
  font-size: 14px;
  font-weight: 500;
  color: oklch(0.25 0.02 250);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 4.2 IdentityStrip (Template Pages)

**Purpose**: Minimal header for pages requiring navigation context.

```
┌─────────────────────────────────────────────────────────────────┐
│  [←] All Templates                              [●] Sarah  [▼] │
└─────────────────────────────────────────────────────────────────┘
     44px                     flexible                    44px
```

**Specifications**:

| Property | Value |
|----------|-------|
| Height | 48px |
| Background | `var(--header-bg)` + `backdrop-filter: blur(12px)` |
| Border | `1px solid var(--header-border)` bottom only |
| Padding | 0 16px (mobile), 0 24px (desktop) |
| Position | `fixed`, top: 0 |
| Z-index | 100 |

**Layout Grid**:
```css
.identity-strip {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
}
```

**Back Button**:
```css
.header-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: -8px;                  /* Expand hit area */
  border-radius: 8px;
  color: var(--header-text-secondary);
  transition: all var(--header-transition-fast) var(--header-easing);
}

.header-back:hover {
  background: oklch(0.95 0.01 250);
  color: var(--header-text-primary);
}

.header-back-icon {
  width: 18px;
  height: 18px;
  transition: transform var(--header-transition-fast) var(--header-easing);
}

.header-back:hover .header-back-icon {
  transform: translateX(-2px);
}
```

**Avatar with Dropdown**:
```css
.header-avatar-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: 24px;
  background: transparent;
  border: 1px solid transparent;
  transition: all var(--header-transition-fast) var(--header-easing);
}

.header-avatar-button:hover {
  background: oklch(0.95 0.01 250);
  border-color: var(--header-border);
}

.header-avatar-button[aria-expanded="true"] {
  background: oklch(0.95 0.01 250);
  border-color: var(--header-border);
}

.header-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid oklch(0.7 0.02 260);
  object-fit: cover;
}

.header-avatar-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--header-text-primary);
}

.header-avatar-chevron {
  width: 16px;
  height: 16px;
  color: var(--header-text-muted);
  transition: transform var(--header-transition-fast) var(--header-easing);
}

.header-avatar-button[aria-expanded="true"] .header-avatar-chevron {
  transform: rotate(180deg);
}
```

**Dropdown Menu**:
```css
.header-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  padding: 6px;
  background: oklch(1 0 0 / 0.98);
  backdrop-filter: blur(12px);
  border: 1px solid var(--header-border);
  border-radius: 12px;
  box-shadow:
    0 4px 6px oklch(0 0 0 / 0.05),
    0 10px 24px oklch(0 0 0 / 0.1);

  transform-origin: top right;
  animation: dropdown-enter 150ms var(--header-easing);
}

@keyframes dropdown-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.header-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--header-text-secondary);
  transition: all 100ms ease-out;
}

.header-dropdown-item:hover {
  background: oklch(0.95 0.01 250);
  color: var(--header-text-primary);
}

.header-dropdown-item-icon {
  width: 18px;
  height: 18px;
  opacity: 0.7;
}

.header-dropdown-divider {
  height: 1px;
  margin: 6px 0;
  background: var(--header-border);
}
```

### 4.3 Scroll Behavior

**Pattern**: Hide on scroll down, reveal on scroll up.

```typescript
const SCROLL_CONFIG = {
  hideThreshold: 60,      // px scrolled down to hide
  showThreshold: 20,      // px scrolled up to show
  topZone: 100,           // px from top where header always shows
  animationDuration: 200, // ms
};
```

**CSS**:
```css
.identity-strip {
  transform: translateY(0);
  transition: transform var(--header-transition-normal) var(--header-easing);
}

.identity-strip--hidden {
  transform: translateY(-100%);
}
```

### 4.4 MobileBottomBar (Template Pages, Mobile Only)

**Purpose**: Place primary actions in thumb zone.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    TEMPLATE CONTENT                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│     [Share]                    [Send to Congress]               │
│     secondary                       primary                     │
└─────────────────────────────────────────────────────────────────┘
```

**Specifications**:

| Property | Value |
|----------|-------|
| Height | 64px + safe-area-inset-bottom |
| Position | `fixed`, bottom: 0 |
| Background | `oklch(1 0 0 / 0.98)` + `backdrop-filter: blur(12px)` |
| Border | `1px solid var(--header-border)` top only |
| Padding | 8px 16px |
| Z-index | 100 |

**Buttons**:
```css
.bottom-bar-primary {
  flex: 1;
  height: 48px;
  padding: 0 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  color: white;
  background: var(--header-action-primary);
  transition: all var(--header-transition-fast) var(--header-easing);
}

.bottom-bar-primary:active {
  transform: scale(0.98);
}

.bottom-bar-primary--congress {
  background: var(--header-action-congress);
}

.bottom-bar-secondary {
  height: 44px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--header-text-secondary);
  background: oklch(0.95 0.01 250);
}

.bottom-bar-secondary:active {
  background: oklch(0.9 0.02 250);
}
```

---

## Part 5: Responsive Behavior

### 5.1 Breakpoints

| Breakpoint | Header Treatment |
|------------|------------------|
| < 640px | IdentityStrip (48px) + BottomBar for templates |
| 640-1023px | IdentityStrip (48px), no bottom bar |
| >= 1024px | IdentityStrip (48px), full dropdown |

### 5.2 Homepage Responsive

| Breakpoint | Treatment |
|------------|-----------|
| < 640px | AmbientPresence, smaller pills (36px avatar) |
| >= 640px | AmbientPresence, standard pills (40px avatar) |

---

## Part 6: Accessibility

### 6.1 Keyboard Navigation

- Tab order: Back → Avatar dropdown → Dropdown items
- Escape closes dropdown, returns focus to trigger
- Skip link present for keyboard users

### 6.2 Screen Reader

```html
<header aria-label="Site header">
  <nav aria-label="Primary navigation">
    <a href="/" aria-label="Back to all templates">...</a>
  </nav>
  <div>
    <button
      aria-expanded="false"
      aria-haspopup="menu"
      aria-label="Account menu for Sarah"
    >
      ...
    </button>
  </div>
</header>
```

### 6.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .identity-strip,
  .header-dropdown,
  .ambient-presence {
    transition: none;
    animation: none;
  }

  .identity-strip--hidden {
    visibility: hidden;
  }
}
```

---

## Part 7: Implementation Checklist

### Phase 1: Foundation
- [ ] Create CSS custom properties in `app.css`
- [ ] Create `HeaderSystem.svelte` context router
- [ ] Create `IdentityStrip.svelte` base component

### Phase 2: Core Components
- [ ] Create `HeaderAvatar.svelte` with dropdown
- [ ] Create `HeaderBackButton.svelte`
- [ ] Create `HeaderSignIn.svelte` pill

### Phase 3: Homepage
- [ ] Create `AmbientPresence.svelte`
- [ ] Integrate with `+layout.svelte`
- [ ] Add progressive reveal logic

### Phase 4: Mobile
- [ ] Create `MobileBottomBar.svelte`
- [ ] Add responsive breakpoint logic
- [ ] Test touch targets (44px minimum)

### Phase 5: Polish
- [ ] Add scroll-triggered visibility
- [ ] Add reduced motion support
- [ ] Add keyboard navigation
- [ ] Validate against accessibility checklist

### Phase 6: Cleanup
- [ ] Remove old `AppHeader.svelte` (or deprecate)
- [ ] Update all route layouts
- [ ] Document migration path

---

## Part 8: Migration Strategy

### Gradual Rollout

1. **Feature flag**: `HEADER_V2=true` enables new system
2. **A/B test**: Compare engagement metrics
3. **Full rollout**: Remove old header after validation

### Breaking Changes

- **CTAs removed from header**: Update any code expecting header CTAs
- **Share moved to content**: Template pages need share button in content
- **Mobile bottom bar**: New component for template pages

---

## Appendix: Reference Files

- Current header: `src/lib/components/layout/AppHeader.svelte`
- RelayLoom (design reference): `src/lib/components/landing/hero/RelayLoom.svelte`
- Design voice: `docs/design/voice.md`
- Perceptual engineering: `~/.claude/skills/perceptual-engineering/`
