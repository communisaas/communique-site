# Communique Design System

**Infrastructure for consequential participation in governance**

This design system creates trustworthy, accessible civic engagement experiences that work across any governance structure—from existing democratic systems to future forms of collective decision-making we haven't invented yet.

---

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [Color System](#color-system)
- [Typography](#typography)
- [Component Architecture](#component-architecture)
- [Interaction Patterns](#interaction-patterns)
- [Accessibility Standards](#accessibility-standards)
- [Voice & Language](#voice--language)
- [SvelteKit 5 Implementation](#sveltekit-5-implementation)
- [Migration Guide](#migration-guide)

---

## Design Philosophy

### Core Principles

**1. Governance-Neutral Infrastructure**

- Works for Westminster, Congressional, Parliamentary, and future governance forms
- Enables new collective decision-making structures beyond current political systems
- Avoids democracy-specific terminology or US-centric political assumptions

**2. Institutional Credibility**

- Visual weight signals importance and seriousness
- Trust through consistency and reliability
- Conveys institutional gravitas without being antiquated

**3. Inclusive by Design**

- WCAG 2.1 AA compliance as foundation, not afterthought
- Progressive enhancement for all devices and connections
- Cognitive load reduction through clear information hierarchy
- International accessibility with global language support

**4. Feedback-Rich Interactions**

- Every civic action provides immediate, clear confirmation
- Status transparency throughout legislative processes
- Sophisticated micro-animations and spring physics
- No uncertainty about message delivery or verification

**5. International Legislative Scalability**

- Color-coded delivery channels work across parliamentary systems
- Cultural neutrality in core visual language
- Flexible component architecture for different governmental structures

---

## Color System

### Primary Colors (Infrastructure Trust)

Our primary navy represents institutional trust and governance credibility. This color works internationally and conveys the serious nature of consequential participation.

```css
/* Primary Civic Navy - Trustworthy, governance-neutral */
--civic-primary-50: #f0f4f8;
--civic-primary-100: #d9e2ec;
--civic-primary-200: #bcccdc;
--civic-primary-300: #9fb3c8;
--civic-primary-400: #829ab1;
--civic-primary-500: #1e3a5f; /* Primary actions, links */
--civic-primary-600: #1a334d; /* Hover states */
--civic-primary-700: #162d42; /* Active states */
--civic-primary-800: #122637;
--civic-primary-900: #0e1f2b;
--civic-primary-950: #0a1720;
```

### Delivery Channel Colors

Clear semantic differentiation between delivery methods helps users understand their impact and routing.

```css
/* Verified Delivery (Congressional/Parliamentary) - Government Green */
--channel-verified-500: #10b981;
--channel-verified-600: #059669;
--channel-verified-700: #047857;
--channel-verified-50: #ecfdf5; /* Light backgrounds */

/* Community Outreach (Direct) - Action Blue */
--channel-community-500: #0ea5e9;
--channel-community-600: #0284c7;
--channel-community-700: #0369a1;
--channel-community-50: #f0f9ff; /* Light backgrounds */
```

**Legacy Support** (will be deprecated):
```css
--channel-congressional-500: #10b981; /* Use --channel-verified-500 */
--channel-direct-500: #0ea5e9;       /* Use --channel-community-500 */
```

### Status Communication

Legislative processes have complex states. Our status colors provide clear, immediate feedback.

```css
/* Message Delivered Successfully */
--status-success-500: #22c55e;
--status-success-50: #f0fdf4;

/* Verification Pending */
--status-warning-500: #f59e0b;
--status-warning-50: #fffbeb;

/* Delivery Failed */
--status-error-500: #ef4444;
--status-error-50: #fef2f2;

/* Informational Status */
--status-info-500: #3b82f6;
--status-neutral-500: #6b7280;
```

### Usage Guidelines

- **Verified Delivery**: Use for verified governmental delivery, official channels, certified routes
- **Community Outreach**: Use for email outreach, direct contact, unofficial channels
- **Status Colors**: Always pair colored backgrounds with appropriate text colors for accessibility
- **Never**: Use red/green only to convey information (colorblind accessibility)

---

## Typography

### Font Stacks

#### Primary: Inter Variable

```css
font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
```

Used throughout for:
- All user interface text
- Headlines and body copy
- International accessibility
- Clean, modern governance-neutral aesthetic

#### Technical: JetBrains Mono

```css
font-family: 'JetBrains Mono', ui-monospace, monospace;
```

Reserved only for:
- Code and technical elements
- Data display and timestamps
- API responses and logs

### Hierarchy & Scale

Democratic information requires clear hierarchy. Citizens must understand what's important, what's actionable, and what's contextual.

```css
/* Information Hierarchy */
.text-primary {
  color: #111827;
  font-weight: 600;
} /* Headlines, crucial info */

.text-secondary {
  color: #374151;
  font-weight: 400;
} /* Body text, descriptions */

.text-tertiary {
  color: #6b7280;
  font-weight: 400;
} /* Supporting information */

.text-quaternary {
  color: #9ca3af;
  font-weight: 400;
} /* Placeholders, disabled */

.text-accent {
  color: #1d4ed8;
  font-weight: 500;
} /* Links, interactive elements */
```

### Text Sizing

All sizes include appropriate line heights for readability:

- `text-civic-xs` (12px): Small labels, metadata
- `text-civic-sm` (14px): Supporting text, captions
- `text-civic-base` (16px): Body text, forms (prevents iOS zoom)
- `text-civic-lg` (18px): Emphasis, important content
- `text-civic-xl` (20px): Section headings
- `text-civic-2xl` (24px): Page headings
- `text-civic-3xl` (30px): Major headings
- `text-civic-4xl` (36px): Hero content

---

## Component Architecture

### Naming Convention

All components use governance-neutral naming:

- `civic-` or `participation-` prefix for infrastructure elements
- `verified` instead of "congressional" for formal channels
- `community` instead of "direct" for community outreach
- Universal terminology that works across governance systems

### Design Token Structure

All components use CSS custom properties for consistency and maintainability:

```css
/* Token Example */
.civic-btn-primary {
  background-color: var(--civic-primary-500);
  color: var(--text-inverse);
  border: 1px solid var(--civic-primary-600);
  box-shadow: var(--shadow-civic-sm);
  border-radius: var(--civic-border-radius);
}
```

### Component Categories

**1. Surfaces**

- `.civic-surface` - Base level (white background, subtle border)
- `.civic-surface-raised` - Cards, elevated content
- `.civic-surface-overlay` - Modals, tooltips, overlays

**2. Interactive Elements**

- `.civic-interactive` - Base interactive behavior
- `.civic-interactive-verified` - Government channel focus
- `.civic-interactive-community` - Direct outreach focus

**3. Status Communication**

- `.civic-badge-success` - Delivered, verified, completed
- `.civic-badge-warning` - Pending, in progress
- `.civic-badge-error` - Failed, rejected, blocked
- `.civic-badge-verified` - Government delivery channel
- `.civic-badge-community` - Direct outreach channel

### Button System

Democratic actions require clear, accessible buttons with proper touch targets.

```html
<!-- Primary Civic Action -->
<button class="civic-btn civic-btn-primary civic-btn-lg">
  Send to Representative
</button>

<!-- Channel-Specific Actions -->
<button class="civic-btn civic-btn-verified">Verified Delivery</button>
<button class="civic-btn civic-btn-community">Community Outreach</button>

<!-- Secondary Actions -->
<button class="civic-btn civic-btn-secondary">Save Draft</button>
```

**Button Requirements:**

- Minimum 44px height (iOS touch targets)
- Clear focus indicators for keyboard navigation
- Loading states for civic actions
- Disabled states with appropriate feedback
- Channel-appropriate colors and focus rings

### Form Components

Civic forms collect important information. They must be accessible, clear, and provide helpful feedback.

```html
<!-- Civic Text Input -->
<input
  class="civic-input civic-input-verified"
  placeholder="Your message to Congress"
  required
  aria-describedby="message-help"
/>

<!-- With Channel Context -->
<input class="civic-input civic-input-community" />
```

**Form Requirements:**

- 16px font size minimum (prevents iOS zoom)
- Clear error messaging
- Required field indicators
- Appropriate autocomplete attributes
- Proper labeling for screen readers

### Badge System

Status communication is critical in civic engagement. Citizens need to know if their message was delivered, verified, and received.

```html
<!-- Delivery Status -->
<span class="civic-badge civic-badge-success">
  <CheckIcon class="h-3 w-3" />
  Message Delivered
</span>

<!-- Channel Identification -->
<span class="civic-badge civic-badge-verified">
  <ShieldIcon class="h-3 w-3" />
  Verified Delivery
</span>

<!-- Process Status -->
<span class="civic-badge civic-badge-warning civic-pulse">
  <ClockIcon class="h-3 w-3" />
  Verification Pending
</span>
```

**Badge Guidelines:**

- Always include an icon when possible
- Use color AND text/icons (colorblind accessibility)
- Consistent sizing: sm (small metadata), md (standard)
- Pulsing animation only for active processes

---

## Interaction Patterns

### Civic Action Flows

Civic engagement has predictable patterns. Our interactions should feel familiar while providing clear feedback.

**1. Message Creation Flow**

```
Draft → Review → Channel Selection → Authentication → Delivery → Confirmation
```

**2. Template Usage Flow**

```
Browse → Select → Customize → Send → Track Impact
```

**3. Verification Flow**

```
Submit → Identity Check → Address Validation → Channel Assignment → Delivery
```

### Micro-interactions

Small details reinforce that civic actions matter and are being processed.

- **Button Press**: Subtle scale (0.98) on active state
- **Form Focus**: Channel-appropriate focus rings
- **Success States**: Gentle bounce animation
- **Loading States**: Purposeful pulse, not distracting spinner
- **Error States**: Subtle shake, clear messaging

### Animation System (Spring Physics)

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

### Progressive Enhancement

Core functionality works without JavaScript. Enhanced interactions layer on top.

**Base Experience (No JS):**

- Forms submit via standard POST
- Navigation works with page loads
- All content is server-rendered
- Status information is in HTML

**Enhanced Experience (With JS):**

- Smooth transitions between states
- Inline form validation
- Real-time status updates
- Progressive form flows
- Preloaded navigation

---

## Accessibility Standards

### WCAG 2.1 AA Compliance

This isn't optional. Governance infrastructure must be accessible to all citizens.

**Color Contrast Requirements:**

- Normal text: 4.5:1 minimum
- Large text (18pt+): 3:1 minimum
- UI components: 3:1 minimum

**Interactive Element Requirements:**

- Minimum 44px touch targets
- Keyboard navigation for all functionality
- Focus indicators with 2px minimum thickness
- Form labels for all inputs
- Error messaging associated with fields

### Screen Reader Support

All components include proper ARIA attributes:

```html
<!-- Proper Form Labeling -->
<label for="representative-message">Message to Representative</label>
<textarea
  id="representative-message"
  aria-describedby="message-help"
  aria-required="true"
></textarea>
<div id="message-help">
  This message will be delivered via Congressional website
</div>

<!-- Status Communication -->
<div role="status" aria-live="polite">
  <span class="civic-badge civic-badge-success">
    Message delivered successfully
  </span>
</div>

<!-- Loading States -->
<button aria-describedby="loading-text">
  Send Message
  <span id="loading-text" class="sr-only">
    Sending message, please wait
  </span>
</button>
```

### Motion & Animation

Respect `prefers-reduced-motion` for users who need calmer interfaces:

```css
@media (prefers-reduced-motion: reduce) {
  .civic-btn {
    transition: none;
  }

  .civic-pulse {
    animation: none;
  }

  .civic-bounce {
    animation: none;
  }
}
```

### International Considerations

- **RTL Language Support**: Logical CSS properties
- **High Contrast Mode**: Enhanced borders and outlines
- **Touch Targets**: 44px minimum for mobile accessibility
- **Typography**: Inter Variable for global language support

---

## Voice & Language

### Civic Tone Principles

**Direct without being abrupt**

- "Your message will be delivered to Representative Smith"
- Not: "Message sent!" or "We'll try to deliver your message"

**Confident but not presumptuous**

- "This template has influenced 3 legislative votes"
- Not: "This template will definitely change policy"

**Inclusive without being condescending**

- "Representatives track constituent communication carefully"
- Not: "Here's how Congress works" or overly simple explanations

### Message Hierarchy

**Primary Messages**: Action outcomes, delivery confirmations
**Secondary Messages**: Process explanations, helpful context
**Tertiary Messages**: Tips, additional information

### Civic Action Language

**Channel-Specific Delivery**

- Verified: "Delivered via House/Senate contact system"
- Community: "Sent directly to representative's district office"
- Both: "Routed through both governmental and district channels"

**Delivery Confirmation**

- "Delivery confirmed by Congressional system at [timestamp]"
- "Message received by Representative [Name]'s office"
- "Automatic receipt generated - message logged in official system"

**Delivery Issues**

- "Congressional system temporarily unavailable. We'll retry automatically."
- "Representative's office mailbox is full. Trying alternate delivery method."
- "Your address couldn't be verified. This is required for verified delivery."

### Error Communication

Civic engagement errors can be frustrating. Our messaging should be immediately actionable and respectful of citizens' time.

**Address Issues**

- **Problem**: "Your representative's office requires a verified address."
- **Solution**: "We'll help you add one. This takes about 2 minutes."
- **Context**: "Required by Congressional security protocols."

**Verification Problems**

- **Problem**: "We couldn't verify your address with postal records."
- **Solution**: "Try using the exact format from your voter registration or utility bill."
- **Assistance**: "Or contact support - we verify manually within 24 hours."

**Delivery Failures**

- **Problem**: "Message delivery failed because the Congressional server is down."
- **Automatic**: "We'll retry automatically every 15 minutes."
- **Alternative**: "We can also send via the representative's district office."

**Template Issues**

- **Problem**: "This template contains information that couldn't be verified."
- **Guidance**: "Review the highlighted sections and add sources where possible."
- **Context**: "Verified information gets priority routing to Congressional staff."

### Success Communication

Success in civic engagement should feel meaningful, not gamified.

**Message Delivery Success**

- "Message delivered to Representative Smith's office"
- "Delivery confirmed via Congressional system"
- "Your voice has been recorded in the legislative process"
- "Added to the official constituent communication record"

**Verification Success**

- "Address verified - Congressional delivery enabled"
- "Identity confirmed - full civic features unlocked"
- "Your account can now access all legislative channels"

**Impact Recognition**

- "Your template was cited by Representative Johnson in floor speech"
- "This campaign contributed to Committee Amendment 42"
- "Your information appeared in legislative hearing transcript"

### Microcopy Standards

**Button Text**

- "Send to Representative" (not "Submit" or "Send Message")
- "Deliver via Congress" (not "Use Congressional Channel")
- "Community Outreach" (not "Send Direct" or "Email Representative")

**Form Labels**

- "Your address" (not "Home address" - some people move frequently)
- "Zip code" or "Postal code" (context-appropriate)
- "This confirms which representative serves you" (helpful context)

**Status Indicators**

- "✓ Delivered to Congressional office"
- "✓ Address verified for Congressional delivery"
- "⏱ Awaiting Congressional server response"

### International Adaptation

**Parliamentary Systems**

- UK: "Message delivered to MP's Westminster office"
- Canada: "Sent to MP's Ottawa and constituency offices"
- EU: "Delivered to MEP's Brussels and home-country offices"

**Formal vs. Informal Address**

- US: "Representative Smith" (formal but accessible)
- UK: "Your MP" or "Member of Parliament" (institutional respect)
- Canada: "Your Member of Parliament" (full formal title)

---

## SvelteKit 5 Implementation

### Component Integration

Design system components work seamlessly with SvelteKit 5's snippet syntax and runes:

```svelte
<script>
  import { CivicButton, CivicBadge } from '$lib/components/ui';

  let messageStatus = $state('sending');
  let deliveryChannel = $state('verified');

  // Reactive badge variant based on status
  let badgeVariant = $derived(() => {
    if (messageStatus === 'delivered') return 'success';
    if (messageStatus === 'failed') return 'error';
    return 'warning';
  });
</script>

<!-- Button with snippet content -->
<CivicButton variant="verified" size="lg">
  {#snippet}
    <ShieldIcon class="w-4 h-4" />
    Send Verified Delivery
  {/snippet}
</CivicButton>

<!-- Reactive status badge -->
<CivicBadge variant={badgeVariant} pulse={messageStatus === 'sending'}>
  {messageStatus === 'sending' ? 'Delivering message...' :
   messageStatus === 'delivered' ? 'Message delivered' :
   'Delivery failed'}
</CivicBadge>
```

### Feature Flag Integration

Components respect your existing feature flag system:

```svelte
<script>
  import { features } from '$lib/stores/features.js';
</script>

{#if $features.ENABLE_CONGRESSIONAL_DELIVERY}
  <CivicButton variant="verified">Verified Delivery</CivicButton>
{:else}
  <CivicButton variant="community">Community Outreach Only</CivicButton>
{/if}
```

### Tailwind Integration

Use Tailwind utilities alongside design system classes:

```html
<!-- Combine system classes with Tailwind utilities -->
<div class="civic-surface flex items-center justify-between p-4 md:p-6">
  <span class="text-secondary">Draft saved</span>
  <button class="civic-btn civic-btn-sm">Continue</button>
</div>
```

### Responsive Design

```svelte
<!-- Mobile-first civic components -->
<div class="civic-surface p-civic-md md:p-civic-xl">
  <CivicButton variant="primary" size="md" fullWidth class="md:w-auto">
    Send Message
  </CivicButton>
</div>

<!-- Grid layouts with civic spacing -->
<div class="gap-civic-lg grid grid-cols-1 md:grid-cols-2">
  <div class="civic-surface-raised">
    <!-- Verified channel -->
  </div>
  <div class="civic-surface-raised">
    <!-- Community channel -->
  </div>
</div>
```

### Accessibility Implementation

```svelte
<!-- Proper ARIA labeling for civic actions -->
<CivicButton
  variant="verified"
  onclick={sendMessage}
  aria-describedby="send-help"
>
  Send to Representative
</CivicButton>

<div id="send-help" class="text-tertiary text-civic-sm">
  This message will be delivered via the official Congressional contact system
  and recorded in your representative's correspondence database.
</div>

<!-- Status updates with live regions -->
<div role="status" aria-live="polite">
  {#if messageStatus === 'sending'}
    <CivicBadge variant="warning" pulse>
      Delivering message to Congressional system...
    </CivicBadge>
  {:else if messageStatus === 'delivered'}
    <CivicBadge variant="success">
      Message delivered to Representative Smith's office
    </CivicBadge>
  {/if}
</div>
```

---

## Migration Guide

### From Legacy Components

#### Old (US-centric)

```svelte
<Button variant="certified">Send to Congress</Button>
<Badge variant="congressional">Congressional</Badge>
```

#### New (Governance-neutral)

```svelte
<CivicButton variant="verified">Send Verified Delivery</CivicButton>
<CivicBadge variant="verified">Verified Delivery</CivicBadge>
```

### Backward Compatibility

Legacy color tokens remain available during transition:

```css
/* Legacy support - will be deprecated */
--civic-primary-500: #3b82f6;
--channel-congressional-500: #10b981;
--channel-direct-500: #0ea5e9;

/* New governance-neutral tokens */
--civic-primary-500: #1e3a5f;
--channel-verified-500: #10b981;
--channel-community-500: #0ea5e9;
```

### CSS Variable Migration

Replace hardcoded colors with semantic tokens:

```css
/* Before */
background-color: #3b82f6;
border-color: #2563eb;

/* After */
background-color: var(--civic-primary-500);
border-color: var(--civic-primary-600);
```

### Progressive Migration Path

**Phase 1: Foundation (Immediate)**

Update base styles and tokens without changing component interfaces:

```svelte
<!-- Existing Button.svelte - minimal changes -->
<button class="civic-btn civic-btn-{variant} {existingClasses}" {disabled}>
  <slot />
</button>
```

**Phase 2: Component Enhancement (Week 1-2)**

Replace high-impact components with design system versions:

```svelte
<!-- Replace existing Badge with CivicBadge -->
- <Badge variant="congressional" size="sm">Status</Badge>
+ <CivicBadge variant="verified" size="sm">Status</CivicBadge>
```

**Phase 3: Advanced Patterns (Week 3-4)**

Implement complex civic interaction patterns with full design system integration.

---

## Testing Considerations

**Visual Regression Testing:**

- Test component variants across different states
- Verify color contrast meets accessibility standards
- Check responsive behavior at standard breakpoints

**Accessibility Testing:**

- Screen reader navigation
- Keyboard-only interaction
- Color contrast validation
- Motion preference respect

**Integration Testing:**

- Form submission flows
- Status communication accuracy
- Progressive enhancement graceful degradation

---

## Conclusion

This design system creates **infrastructure for consequential participation that works for traditional democratic systems AND entirely new governance forms**, with sophisticated interactions that make participation engaging and trustworthy.

The system scales from individual verified actions to international governance systems, always maintaining the institutional gravitas that serious participation infrastructure deserves—while remaining accessible and empowering for all citizens.
