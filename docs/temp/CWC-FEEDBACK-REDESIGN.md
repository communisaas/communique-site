# CWC Submission Feedback Redesign

## Perceptual Engineering Specification

**Date:** 2025-01-31
**Status:** Implementation Ready

---

## 1. Core Insight

The user performs **one action** ("contact Congress"). The interface must reflect **one action completing** — not "3 separate API calls happening asynchronously."

**Current State:** Technical implementation leaked into UX
**Target State:** Civic action → confident completion → persistent proof

---

## 2. Constraints

### Hard Constraints
- **Unavailable offices cannot be retried** — If HCA11 isn't in UAT, that's a permanent condition for that submission
- **Results are known immediately** — Backend returns full results; polling is artificial
- **Some offices may never be available** — Test environment limitations are real

### Implications
- Don't promise "retry" for unavailable offices
- Distinguish between:
  - **Delivery failure** (API error, temporary) — potentially retryable
  - **Office unavailable** (not in CWC system) — permanent, explain clearly
- Partial success is still success — celebrate what worked

---

## 3. Information Architecture

### Hierarchy (Most → Least Important)

```
┌─────────────────────────────────────────────────────┐
│ LEVEL 1: Emotional Confirmation (Primary)          │
│ "Your voice reached Congress"                       │
│ Large, immediate, celebratory                       │
├─────────────────────────────────────────────────────┤
│ LEVEL 2: Quantified Outcome (Secondary)            │
│ "2 of 3 offices" with clear success indicator      │
│ Visible but not dominant                            │
├─────────────────────────────────────────────────────┤
│ LEVEL 3: Office Details (Tertiary - On Demand)     │
│ Individual office names, chambers, status          │
│ Hidden by default, toggle to reveal                 │
├─────────────────────────────────────────────────────┤
│ LEVEL 4: Technical Proof (Quaternary - On Demand)  │
│ Confirmation IDs, timestamps, CWC responses        │
│ For verification, shareable receipt                 │
└─────────────────────────────────────────────────────┘
```

---

## 4. Journey Stages

### Stage Model

```typescript
type JourneyStage =
  | 'acknowledging'  // Click received, immediate feedback (<100ms)
  | 'delivering'     // Animated progress (staged reveal, 2-3s total)
  | 'complete'       // Results shown, celebration
  | 'details';       // User examining specifics

type OfficeOutcome =
  | 'delivered'      // Success - message accepted by CWC
  | 'failed'         // Temporary failure - API error
  | 'unavailable';   // Permanent - office not in CWC system
```

### Timing Constants

```typescript
const TIMING = {
  // Acknowledgment
  CLICK_RESPONSE: 50,      // Immediate visual feedback

  // Staged reveal (performative - we know results)
  ANTICIPATION: 600,       // Build expectation
  PROGRESS_DURATION: 2400, // Total animation time
  STAGE_INTERVAL: 800,     // Between office reveals

  // Completion
  CELEBRATION_PULSE: 400,  // Scale animation
  SETTLE: 300,             // Final state transition

  // Interactions
  TRANSITION: 300,         // Standard UI transitions
  HOVER: 150,              // Hover states
} as const;
```

---

## 5. Component Structure

### A. DeliveryJourney.svelte (Container)

Replaces `CWCProgressTracker.svelte`

```
Props:
  - submissionId: string
  - results: DeliveryResult[]  // Already resolved, not polling
  - template: TemplateData
  - onComplete?: () => void

State:
  - stage: JourneyStage
  - revealedOffices: number (for staged animation)
  - showDetails: boolean
  - showProof: boolean
```

### B. DeliveryProgress.svelte (Progress Animation)

Unified progress arc, not per-office bars.

```
Props:
  - progress: number (0-100)
  - stage: 'anticipating' | 'progressing' | 'complete'

Visual:
  - Single circular or linear progress indicator
  - Smooth interpolation (spring physics)
  - Color transition: blue → green at completion
```

### C. DeliveryConfirmation.svelte (Success State)

Primary celebration UI.

```
Props:
  - successCount: number
  - totalCount: number
  - hasUnavailable: boolean

Visual:
  - Large success indicator
  - "X of Y offices reached"
  - Contextual message based on outcome
```

### D. OfficeDetails.svelte (Expandable Details)

Secondary information, on-demand.

```
Props:
  - results: DeliveryResult[]
  - expanded: boolean

Visual:
  - Grouped by chamber (Senate, House)
  - Status icon per office
  - Outcome-specific messaging
```

### E. DeliveryProof.svelte (Persistent Record)

Shareable proof card.

```
Props:
  - submissionId: string
  - results: DeliveryResult[]
  - timestamp: Date
  - templateTitle: string

Actions:
  - Copy receipt text
  - Share (native share API)
  - Download as image/PDF
```

---

## 6. Outcome-Specific Messaging

### Full Success (3/3)
```
Headline: "Your voice reached Congress"
Subtext: "All 3 offices received your message"
Tone: Celebratory, confident
```

### Partial Success (2/3 with unavailable)
```
Headline: "Your voice reached Congress"
Subtext: "2 offices received your message"
Detail: "Rep. [Name]'s office is not currently accepting messages through this system"
Tone: Still positive - focus on success
```

### Partial Success (2/3 with failure)
```
Headline: "Your message was delivered"
Subtext: "2 of 3 offices reached"
Detail: "We couldn't reach [Office] - you can try again or contact them directly"
Tone: Honest but not alarming
Action: Retry button for failed office only
```

### Complete Failure (0/3)
```
Headline: "Delivery unsuccessful"
Subtext: "We couldn't reach your representatives"
Detail: Specific error information
Tone: Direct, actionable
Action: Retry all, or alternative contact methods
```

---

## 7. Visual Design Tokens

### Colors (Semantic)

```css
:root {
  /* Journey states */
  --journey-active: oklch(0.65 0.15 250);      /* Blue - in progress */
  --journey-success: oklch(0.70 0.17 145);     /* Green - delivered */
  --journey-unavailable: oklch(0.75 0.08 250); /* Gray-blue - unavailable */
  --journey-failed: oklch(0.65 0.20 25);       /* Red - failed */

  /* Surfaces */
  --surface-celebration: linear-gradient(135deg,
    oklch(0.97 0.02 145) 0%,   /* Green tint */
    oklch(0.98 0.01 250) 100%  /* Blue tint */
  );

  /* Text */
  --text-primary: oklch(0.20 0.02 250);
  --text-secondary: oklch(0.45 0.02 250);
  --text-tertiary: oklch(0.60 0.01 250);
}
```

### Typography Scale

```css
:root {
  --text-headline: 1.5rem;    /* 24px - "Your voice reached Congress" */
  --text-stat: 2.5rem;        /* 40px - "3/3" */
  --text-body: 1rem;          /* 16px - Descriptions */
  --text-detail: 0.875rem;    /* 14px - Office names */
  --text-micro: 0.75rem;      /* 12px - Confirmation IDs */
}
```

### Spacing Scale

```css
:root {
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */
}
```

### Motion

```css
:root {
  /* Easing */
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* Durations */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 600ms;
}
```

---

## 8. Data Flow

### Current Flow (Remove)
```
Click → POST /api/submissions/create
     → Return submissionId
     → Poll /api/cwc/jobs/{id} every 1.5s
     → Update UI on each poll
     → Stop when complete
```

### New Flow (Implement)
```
Click → POST /api/submissions/create
     → Backend processes synchronously
     → Return FULL results immediately:
        {
          submissionId,
          results: [
            { office, chamber, outcome, confirmationId?, error? }
          ],
          summary: { delivered, failed, unavailable }
        }
     → Frontend orchestrates REVEAL animation
     → No polling needed
```

### Result Structure

```typescript
interface DeliveryResult {
  office: string;           // "Sen. Adam Schiff"
  chamber: 'senate' | 'house';
  state: string;            // "CA"
  district?: string;        // "11" (house only)

  outcome: 'delivered' | 'failed' | 'unavailable';

  // On success
  confirmationId?: string;  // CWC message ID
  deliveredAt?: string;     // ISO timestamp

  // On failure
  error?: string;           // User-friendly message
  errorCode?: string;       // Technical code
  retryable?: boolean;      // Can user retry?
}

interface DeliverySummary {
  total: number;
  delivered: number;
  failed: number;
  unavailable: number;
}
```

---

## 9. Implementation Waves

### Wave 1: Core Components ✅
- [x] Create `DeliveryJourney.svelte` container
- [x] Create `DeliveryProgress.svelte` unified progress
- [x] Create `DeliveryConfirmation.svelte` success state
- [x] Define TypeScript interfaces

### Wave 2: Details & Proof ✅
- [x] Create `OfficeDetails.svelte` expandable details
- [x] Create `DeliveryProof.svelte` shareable card
- [x] Implement copy/share functionality

### Wave 3: Integration ✅
- [x] Update `/api/submissions/create` to return full results
- [x] Remove polling from frontend (MVP mode bypasses polling)
- [x] Replace `CWCProgressTracker` with `DeliveryJourney`
- [x] Update `TemplateModal` integration

### Wave 4: Polish ✅
- [x] Add spring animations (DeliveryProgress, DeliveryConfirmation)
- [x] Implement staged reveal timing (DeliveryJourney orchestration)
- [x] Add celebration particles/confetti (Confetti.svelte, integrated into DeliveryConfirmation)
- [x] Mobile responsive refinements (touch targets, safe areas, small screens)

---

## 10. Files to Create/Modify

### New Files
```
src/lib/components/delivery/
├── DeliveryJourney.svelte      # Main container
├── DeliveryProgress.svelte     # Progress animation
├── DeliveryConfirmation.svelte # Success celebration
├── OfficeDetails.svelte        # Expandable office list
├── DeliveryProof.svelte        # Shareable receipt
├── delivery-types.ts           # TypeScript interfaces
└── delivery-utils.ts           # Helper functions
```

### Files to Modify
```
src/routes/api/submissions/create/+server.ts  # Return full results
src/lib/components/template/TemplateModal.svelte  # Use new component
```

### Files to Deprecate
```
src/lib/components/template/CWCProgressTracker.svelte  # Replace entirely
src/routes/api/cwc/jobs/[jobId]/+server.ts  # No longer needed for this flow
```

---

## 11. Acceptance Criteria

### Perceptual
- [ ] Click-to-acknowledgment < 100ms
- [ ] Total journey animation 2-4 seconds
- [ ] No visible polling/loading gaps
- [ ] Success celebration feels earned
- [ ] Details available but not forced

### Functional
- [ ] All three outcomes handled (delivered, failed, unavailable)
- [ ] Unavailable offices explained clearly (no false retry promise)
- [ ] Proof card copyable and shareable
- [ ] Works on mobile

### Trust
- [ ] Confirmation IDs visible for verification
- [ ] Timestamps shown
- [ ] No ambiguity about what was delivered
