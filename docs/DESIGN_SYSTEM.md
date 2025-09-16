# Communique Design System

*Infrastructure for consequential participation in any governance system*

## Philosophy

This design system moves beyond traditional "democratic participation" to enable **infrastructure for consequential participation in any governance system** - from existing democracies to entirely new forms of collective decision-making we haven't invented yet.

### Core Principles

1. **Governance-Neutral**: Works for Westminster, Congressional, Parliamentary, and future governance forms
2. **Future-Ready**: Enables new collective decision-making structures beyond current political systems
3. **Sophisticated Interactions**: Maintains engaging micro-animations and spring physics
4. **Global Accessibility**: WCAG 2.1 AA compliance with international considerations
5. **Trust Infrastructure**: Conveys seriousness and credibility for consequential participation

## Design Tokens

### Color System

#### Primary Colors (Infrastructure Trust)
```css
--participation-primary-50: #f0f4f8
--participation-primary-100: #d9e2ec
--participation-primary-200: #bcccdc
--participation-primary-300: #9fb3c8
--participation-primary-400: #829ab1
--participation-primary-500: #1e3a5f  /* Infrastructure navy - trustworthy, future-ready */
--participation-primary-600: #1a334d
--participation-primary-700: #162d42
--participation-primary-800: #122637
--participation-primary-900: #0e1f2b
--participation-primary-950: #0a1720
```

#### Channel Colors (Global Semantic)
```css
/* Verified Delivery */
--channel-verified-500: #10b981  /* Verified delivery green */
--channel-verified-600: #059669
--channel-verified-700: #047857

/* Community Outreach */  
--channel-community-500: #0ea5e9  /* Community outreach blue */
--channel-community-600: #0284c7
--channel-community-700: #0369a1
```

#### Status Colors
```css
--status-success-500: #22c55e    /* Action completed */
--status-warning-500: #f59e0b    /* Verification pending */
--status-error-500: #ef4444     /* Failed delivery */
--status-info-500: #3b82f6      /* Information */
--status-neutral-500: #6b7280   /* Draft, inactive */
```

### Typography

#### Primary Font Stack
```css
font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif
```

**Inter Variable** is used throughout for:
- All user interface text
- Headlines and body copy  
- International accessibility
- Clean, modern governance-neutral aesthetic

#### Technical Font Stack
```css
font-family: 'JetBrains Mono', ui-monospace, monospace
```

**JetBrains Mono** is reserved only for:
- Code and technical elements
- Data display and timestamps
- API responses and logs

### Spacing System

```css
--participation-xs: 0.25rem    /* 4px */
--participation-sm: 0.5rem     /* 8px */  
--participation-md: 0.75rem    /* 12px */
--participation-lg: 1rem       /* 16px */
--participation-xl: 1.5rem     /* 24px */
--participation-2xl: 2rem      /* 32px */
--participation-3xl: 3rem      /* 48px */
```

## Component Architecture

### Naming Convention

All components use governance-neutral naming:

- `participation-` prefix for infrastructure elements
- `verified` instead of "congressional" for formal channels
- `community` instead of "direct" for community outreach
- Universal terminology that works across governance systems

### Core Components

#### ParticipationButton
```svelte
<script>
  import ParticipationButton from '$lib/components/ui/CivicButton.svelte';
</script>

<!-- Verified delivery channel -->
<ParticipationButton variant="verified" size="lg">
  Send Verified Delivery
</ParticipationButton>

<!-- Community outreach -->
<ParticipationButton variant="community" loading={sending}>
  Community Outreach  
</ParticipationButton>
```

**Features:**
- Spring-physics interactions preserved
- Haptic feedback on supported devices
- Touch-friendly 44px minimum height
- Loading states with screen reader support
- Channel-appropriate visual feedback

#### ParticipationBadge
```svelte
<script>
  import CivicBadge from '$lib/components/ui/CivicBadge.svelte';
</script>

<!-- Channel identification -->
<CivicBadge variant="verified">Verified Delivery</CivicBadge>
<CivicBadge variant="community">Community Outreach</CivicBadge>

<!-- Status communication -->
<CivicBadge variant="success" pulse={true}>Delivered</CivicBadge>
<CivicBadge variant="warning">Verification Pending</CivicBadge>
```

**Features:**
- Semantic color coding
- Icon + text for accessibility
- Pulse animation for active states
- International governance compatibility

### CSS Classes

#### Interactive Elements
```css
.participation-interactive {
  /* Spring-based hover animations */
  @apply transition-all duration-200 ease-out;
  @apply focus:outline-none focus-visible:ring-2;
  transform: translateY(-1px) on hover;
}

.participation-interactive-verified:focus-visible {
  box-shadow: var(--focus-ring-verified);
}

.participation-interactive-community:focus-visible {
  box-shadow: var(--focus-ring-community);
}
```

#### Surface System
```css
.participation-surface {
  background-color: var(--surface-base);
  border: 1px solid var(--surface-border);
  border-radius: 0.75rem;
  box-shadow: var(--shadow-sm);
}
```

#### Form Elements
```css
.participation-input {
  @apply w-full px-4 py-3 border rounded-lg;
  font-family: 'Inter', ui-sans-serif, system-ui;
  font-size: 1rem; /* 16px - prevents zoom on iOS */
}

.participation-input-verified:focus {
  border-color: var(--channel-verified-500);
  box-shadow: var(--focus-ring-verified);
}
```

## Animation System

### Spring Physics (Preserved)

All sophisticated micro-interactions are maintained:

```javascript
// Button scale animation
let buttonScale = spring(1, { stiffness: 0.4, damping: 0.8 });

// Paper plane flight physics (Button component)
let planeX = spring(0, { stiffness: 0.3, damping: 0.7 });
let planeY = spring(0, { stiffness: 0.25, damping: 0.6 });

// Particle effects (ShareButton)
let particleSpring = spring(0, { stiffness: 0.3, damping: 0.8 });
```

### Animation Classes
```css
.participation-pulse {
  animation: participation-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.participation-bounce {
  animation: participation-bounce 1s ease-in-out;
}
```

## Accessibility Standards

### WCAG 2.1 AA Compliance

- **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators**: 2px outlines with proper offset
- **Screen Reader Support**: Semantic HTML and ARIA attributes
- **Keyboard Navigation**: Full keyboard accessibility
- **Motion Preferences**: Respects `prefers-reduced-motion`

### International Considerations

- **RTL Language Support**: Logical CSS properties
- **High Contrast Mode**: Enhanced borders and outlines
- **Touch Targets**: 44px minimum for mobile accessibility
- **Typography**: Inter Variable for global language support

## Implementation

### CSS Import Order
```css
/* 1. Import fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

/* 2. Tailwind layers */
@import 'tailwindcss/base';
@import 'tailwindcss/components';  
@import 'tailwindcss/utilities';

/* 3. Design system tokens and components */
@layer base { /* CSS custom properties */ }
@layer components { /* Component classes */ }
```

### Tailwind Configuration
```typescript
export default {
  theme: {
    extend: {
      fontFamily: {
        'sans': ['"Inter"', 'ui-sans-serif', 'system-ui'], // Set as default
        'participation': ['"Inter"', 'ui-sans-serif'],
        'mono': ['"JetBrains Mono"', 'ui-monospace'],
      },
      colors: {
        'participation-primary': { /* Color scale */ },
        'channel-verified': { /* Verified delivery colors */ },
        'channel-community': { /* Community outreach colors */ },
      }
    }
  }
} satisfies Config;
```

## Migration Guide

### From Legacy Components

#### Old (US-centric)
```svelte
<Button variant="certified">Send to Congress</Button>
<Badge variant="congressional">Congressional</Badge>
```

#### New (Governance-neutral)
```svelte
<ParticipationButton variant="verified">Send Verified Delivery</ParticipationButton>
<CivicBadge variant="verified">Verified Delivery</CivicBadge>
```

### Backward Compatibility

Legacy color tokens remain available during transition:
```css
/* Legacy support - will be deprecated */
--civic-primary-500: #3b82f6
--channel-congressional-500: #10b981
--channel-direct-500: #0ea5e9

/* New governance-neutral tokens */
--participation-primary-500: #1e3a5f
--channel-verified-500: #10b981  
--channel-community-500: #0ea5e9
```

## Usage Examples

### Future Governance Systems
```svelte
<!-- Works for any governance structure -->
<ParticipationButton variant="verified">
  Submit to Governance Council
</ParticipationButton>

<ParticipationButton variant="community">  
  Community Consensus Building
</ParticipationButton>

<!-- Status indicators -->
<CivicBadge variant="success">Consensus Reached</CivicBadge>
<CivicBadge variant="warning">Verification in Progress</CivicBadge>
```

### International Systems
```svelte
<!-- Westminster System -->
<ParticipationButton variant="verified">
  Submit to Parliament
</ParticipationButton>

<!-- Continental System -->
<ParticipationButton variant="verified">
  Submit to Assembly  
</ParticipationButton>

<!-- Future Systems -->
<ParticipationButton variant="verified">
  Submit to Collective
</ParticipationButton>
```

## Visual Language

### What It Conveys

- **Trust and Verification**: This participation matters and is real
- **Sophisticated Infrastructure**: Serious tools for serious participation  
- **Future Governance**: Beyond current democratic/authoritarian binaries
- **Global Accessibility**: Works for any community or governance structure
- **Institutional Gravitas**: Credible without being antiquated

### What It Avoids

- Democracy-specific terminology or imagery
- US-centric political assumptions  
- Social media engagement patterns
- Generic "Claude-generated" aesthetics
- Platform-locked interaction patterns

## Conclusion

This design system creates **infrastructure for consequential participation that works for traditional democratic systems AND entirely new governance forms**, with sophisticated interactions that make participation engaging and trustworthy.

The system scales from individual verified actions to international governance systems, always maintaining the institutional gravitas that serious participation infrastructure deserves.