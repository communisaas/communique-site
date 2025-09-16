# Communique Design System

**Democratic credibility through thoughtful design**

This design system creates trustworthy, accessible civic engagement experiences. Every choice reinforces that this is serious infrastructure for democratic participation—not social media engagement theater.

---

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [Color System](#color-system)
- [Typography](#typography)
- [Component Architecture](#component-architecture)
- [Interaction Patterns](#interaction-patterns)
- [Accessibility Standards](#accessibility-standards)
- [Voice & Language](#voice--language)
- [Implementation Guide](#implementation-guide)

---

## Design Philosophy

### Core Principles

**1. Democratic Credibility First**

- Visual weight signals importance
- Trust through consistency and reliability
- Legislative information deserves institutional gravitas

**2. Inclusive by Design**

- WCAG 2.1 AA compliance as foundation, not afterthought
- Progressive enhancement for all devices and connections
- Cognitive load reduction through clear information hierarchy

**3. Feedback-Rich Interactions**

- Every civic action provides immediate, clear confirmation
- Status transparency throughout legislative processes
- No uncertainty about message delivery or verification

**4. International Legislative Scalability**

- Color-coded delivery channels work across parliamentary systems
- Cultural neutrality in core visual language
- Flexible component architecture for different governmental structures

---

## Color System

### Civic Brand Colors

Our primary blue represents institutional trust and democratic stability. This color works internationally and conveys the serious nature of civic engagement.

```css
/* Primary Civic Blue - Trustworthy, institutional */
--civic-primary-500: #3b82f6; /* Primary actions, links */
--civic-primary-600: #2563eb; /* Hover states */
--civic-primary-700: #1d4ed8; /* Active states */
```

### Delivery Channel Colors

Clear semantic differentiation between delivery methods helps users understand their impact and routing.

```css
/* Congressional/Parliamentary Delivery - Government Green */
--channel-congressional-500: #10b981;
--channel-congressional-50: #ecfdf5; /* Light backgrounds */
--channel-congressional-700: #047857; /* Text on light backgrounds */

/* Direct Outreach - Action Blue */
--channel-direct-500: #0ea5e9;
--channel-direct-50: #f0f9ff;
--channel-direct-700: #0369a1;
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

- **Congressional Green**: Use for verified governmental delivery, official channels, certified routes
- **Direct Blue**: Use for email outreach, direct contact, unofficial channels
- **Status Colors**: Always pair colored backgrounds with appropriate text colors for accessibility
- **Never**: Use red/green only to convey information (colorblind accessibility)

---

## Typography

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

### Font Stacks

- **Primary**: System font stack for reliability and performance
- **Monospace**: JetBrains Mono for technical content, addresses, IDs
- **Civic**: Inter for headings when available, falls back gracefully

```css
font-family: 'civic'; /* Inter → system fonts */
font-family: 'mono'; /* JetBrains Mono → monospace stack */
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
- `.civic-interactive-congressional` - Government channel focus
- `.civic-interactive-direct` - Direct outreach focus

**3. Status Communication**

- `.civic-badge-success` - Delivered, verified, completed
- `.civic-badge-warning` - Pending, in progress
- `.civic-badge-error` - Failed, rejected, blocked
- `.civic-badge-congressional` - Government delivery channel
- `.civic-badge-direct` - Direct outreach channel

### Button System

Democratic actions require clear, accessible buttons with proper touch targets.

```html
<!-- Primary Civic Action -->
<button class="civic-btn civic-btn-primary civic-btn-lg">Send to Representative</button>

<!-- Channel-Specific Actions -->
<button class="civic-btn civic-btn-congressional">Congressional Delivery</button>

<button class="civic-btn civic-btn-direct">Direct Outreach</button>

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
	class="civic-input civic-input-congressional"
	placeholder="Your message to Congress"
	required
	aria-describedby="message-help"
/>

<!-- With Channel Context -->
<input class="civic-input civic-input-direct" />
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
<span class="civic-badge civic-badge-congressional">
	<ShieldIcon class="h-3 w-3" />
	Congressional Delivery
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

This isn't optional. Democracy must be accessible to all citizens.

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
<div id="message-help">This message will be delivered via Congressional website</div>

<!-- Status Communication -->
<div role="status" aria-live="polite">
	<span class="civic-badge civic-badge-success"> Message delivered successfully </span>
</div>

<!-- Loading States -->
<button aria-describedby="loading-text">
	Send Message
	<span id="loading-text" class="sr-only">Sending message, please wait</span>
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

### Error Communication

Civic engagement errors are serious. Our messaging should be helpful and actionable.

**Good Error Messages:**

- "Your representative's office requires a verified address. We'll help you add one."
- "This template contains information that couldn't be verified. Review the highlighted sections."
- "Message delivery failed because the Congressional server is temporarily unavailable. We'll retry automatically."

**Bad Error Messages:**

- "Error 500"
- "Something went wrong"
- "Invalid input"

### Success Communication

Success in civic engagement should feel meaningful, not gamified.

**Message Delivery:**

- "Message delivered to Representative Smith's office"
- "Delivery confirmed via Congressional system"
- "Your voice has been recorded in the legislative process"

**Verification Success:**

- "Address verified with postal records"
- "Identity confirmed - you can now use Congressional delivery"
- "Account verified - all civic features unlocked"

---

## Implementation Guide

### SvelteKit 5 Integration

Our design system integrates seamlessly with the existing SvelteKit setup:

**1. Token Usage**

```svelte
<button class="civic-btn civic-btn-primary" onclick={handleSubmit}> Send Message </button>

<div class="civic-surface civic-surface-raised p-civic-xl">
	<h2 class="text-primary text-civic-2xl mb-civic-lg">Active Campaigns</h2>
	<!-- content -->
</div>
```

**2. Component Props**

```svelte
<script>
	let variant = 'congressional' | 'direct' | 'neutral';
	let status = 'success' | 'warning' | 'error' | 'info';
	let size = 'sm' | 'md' | 'lg';
</script>

<Badge {variant} {status} {size}>Message Status</Badge>
```

**3. Responsive Design**

```svelte
<div class="civic-surface p-civic-lg md:p-civic-xl">
	<!-- Mobile-first, progressively enhanced -->
</div>
```

### Feature Flag Integration

Components respect the existing feature flag system:

```svelte
{#if $features.ENABLE_CONGRESSIONAL_DELIVERY}
	<button class="civic-btn civic-btn-congressional"> Congressional Delivery </button>
{/if}

{#if $features.ENABLE_BETA}
	<div class="civic-surface-overlay">
		<!-- Beta features -->
	</div>
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

### Testing Considerations

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

## Migration Guide

### From Existing Components

**Badge Component Update:**

```svelte
<!-- Before -->
<Badge variant="congressional" size="sm" pulse={true}>Status</Badge>

<!-- After -->
<span class="civic-badge civic-badge-sm civic-badge-congressional civic-pulse">
	<Icon class="h-3 w-3" />
	Status
</span>
```

**Button Component Update:**

```svelte
<!-- Before -->
<Button variant="primary" size="lg">Send</Button>

<!-- After -->
<button class="civic-btn civic-btn-primary civic-btn-lg"> Send </button>
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

---

## International Considerations

### Parliamentary Systems

The design system adapts to different governmental structures:

**UK Parliament:**

- "Parliamentary Delivery" instead of "Congressional Delivery"
- MP-specific terminology in messaging
- Integration with UK postal code verification

**Canadian Parliament:**

- Bilingual text support (English/French)
- Provincial vs Federal routing
- Indigenous governance integration considerations

**EU Parliament:**

- Multi-language support architecture
- Cross-border representation handling
- Subsidiarity principle in messaging

### Cultural Adaptations

**Color Sensitivity:**

- Green avoids political party associations in some contexts
- Blue chosen for international trust associations
- Status colors work across cultural contexts

**Typography:**

- System fonts adapt to local language needs
- Right-to-left (RTL) support architecture
- Character density considerations for different languages

**Interaction Patterns:**

- Touch target sizes accommodate global device usage
- Progressive enhancement for varying internet speeds
- Offline-capable core functionality

---

## Maintenance & Evolution

### Design Token Versioning

Design tokens follow semantic versioning:

- Major: Breaking changes to token names/values
- Minor: New tokens added
- Patch: Color adjustments, spacing refinements

### Component Lifecycle

**Alpha**: New components, experimental patterns
**Beta**: Components under review, may change
**Stable**: Production-ready, versioned components
**Deprecated**: Marked for removal, alternatives provided

### Feedback Integration

**User Research Integration:**

- Accessibility testing with disabled users
- International user testing for cultural appropriateness
- Legislative staff feedback on professional presentation

**Analytics Integration:**

- Component usage tracking
- Error rate monitoring
- Performance impact measurement

---

This design system creates the foundation for trustworthy, accessible democratic engagement. Every component choice serves the larger goal: helping citizens effectively participate in democracy while building verifiable political influence through quality discourse and authentic civic action.
