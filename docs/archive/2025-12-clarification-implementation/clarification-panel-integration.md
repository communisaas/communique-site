# ClarificationPanel Integration into UnifiedObjectiveEntry

**Status:** ✅ Complete
**Date:** 2025-12-24
**Component:** `src/lib/components/template/creator/UnifiedObjectiveEntry.svelte`

---

## Overview

Integrated the `ClarificationPanel` component into `UnifiedObjectiveEntry` to handle clarifying questions from the subject-line agent. This enables multi-turn conversation when the agent needs additional context to generate accurate subject lines and target decision-makers.

---

## Changes Made

### 1. Updated SuggestionState Type

**File:** `UnifiedObjectiveEntry.svelte` (lines 50-60)

Added new `clarifying` state to track when agent needs clarification:

```typescript
type SuggestionState =
  | { status: 'idle' }
  | { status: 'thinking'; startTime: number }
  | {
      status: 'clarifying';
      questions: ClarificationQuestion[];
      inferredContext: InferredContext;
      interactionId: string;
    }
  | { status: 'ready'; suggestion: AISuggestion }
  | { status: 'error'; message: string };
```

**Key behavior:**
- `clarifying` state replaces the suggestion surface with the clarification UI
- `interactionId` maintains conversation context across API calls
- `inferredContext` provides agent's best guesses for pre-selection

---

### 2. Extended `generateSuggestionWithTiming` Function

**File:** `UnifiedObjectiveEntry.svelte` (lines 164-261)

Added support for clarification flow:

```typescript
async function generateSuggestionWithTiming(
  text: string,
  clarificationAnswers?: ClarificationAnswers,
  interactionId?: string
): Promise<void>
```

**New logic:**
1. Detects `needs_clarification` in API response
2. Transitions to `clarifying` state instead of generating immediately
3. Passes `clarificationAnswers` and `interactionId` on subsequent calls
4. Handles multi-turn conversation with agent

**Clarification detection:**
```typescript
if (response.data.needs_clarification) {
  suggestionState = {
    status: 'clarifying',
    questions: response.data.clarification_questions || [],
    inferredContext: response.data.inferred_context || { /* defaults */ },
    interactionId: response.data.interactionId || crypto.randomUUID()
  };
  showAISuggest = true;
  return;
}
```

---

### 3. Added Clarification Handlers

**File:** `UnifiedObjectiveEntry.svelte` (lines 371-416)

#### `handleClarificationSubmit()`
Converts user answers to typed `ClarificationAnswers` and re-calls API:

```typescript
async function handleClarificationSubmit(answers: Record<string, string>): Promise<void> {
  if (suggestionState.status !== 'clarifying') return;

  const clarificationAnswers: ClarificationAnswers = {};

  // Convert answers to proper types
  if (answers.location) clarificationAnswers.location = answers.location;
  if (answers.scope) clarificationAnswers.scope = answers.scope as GeographicScope;
  if (answers.target_type) clarificationAnswers.target_type = answers.target_type as TargetType;

  // Re-call API with clarification answers
  await generateSuggestionWithTiming(
    data.rawInput,
    clarificationAnswers,
    suggestionState.interactionId
  );
}
```

#### `handleClarificationSkip()`
Allows user to skip clarification (agent uses best guess):

```typescript
async function handleClarificationSkip(): Promise<void> {
  if (suggestionState.status !== 'clarifying') return;

  // Re-call API with empty answers - agent will use its best guess
  await generateSuggestionWithTiming(data.rawInput, {}, suggestionState.interactionId);
}
```

---

### 4. Added Template Rendering for Clarification

**File:** `UnifiedObjectiveEntry.svelte` (lines 499-509)

Conditionally renders `ClarificationPanel` when in `clarifying` state:

```svelte
<!-- Clarification panel (shown when agent needs clarification) -->
{#if showAISuggest && suggestionState.status === 'clarifying'}
  <div class="mt-4" transition:slide={{ duration: 200 }}>
    <ClarificationPanel
      questions={suggestionState.questions}
      inferredContext={suggestionState.inferredContext}
      onSubmit={handleClarificationSubmit}
      onSkip={handleClarificationSkip}
    />
  </div>
{/if}
```

**Key behavior:**
- ClarificationPanel appears **instead of** the suggestion surface
- Uses Svelte transitions for smooth UX
- Blocks access to suggestion UI until clarification is resolved

---

### 5. Added Type Imports

**File:** `UnifiedObjectiveEntry.svelte` (lines 12-17)

```typescript
import ClarificationPanel from './ClarificationPanel.svelte';
import type {
  ClarificationQuestion,
  InferredContext,
  ClarificationAnswers
} from '$lib/core/agents/types/clarification';
```

---

### 6. Created Types Index File

**File:** `src/lib/core/agents/types/index.ts` (new file)

Central export point for agent types:

```typescript
export type {
  GeographicScope,
  TargetType,
  ClarificationOption,
  ClarificationQuestionId,
  ClarificationQuestionType,
  ClarificationQuestion,
  InferredContext,
  SubjectLineResponseWithClarification,
  ClarificationAnswers
} from './clarification';
```

**Purpose:** Enables clean imports: `from '$lib/core/agents/types'`

---

## User Flow

### Without Clarification (Current Flow)
1. User enters raw input
2. Agent generates subject line immediately
3. User sees suggestion surface

### With Clarification (New Flow)
1. User enters raw input
2. Agent detects ambiguity (e.g., "rent is too high" without location)
3. **ClarificationPanel appears** with pre-selected questions
4. User answers (or skips)
5. Agent generates with context
6. User sees suggestion surface

**Time to clarify:** <10 seconds (0-2 questions max)

---

## API Contract

### Request with Clarification
```typescript
POST /agents/generate-subject
{
  message: string;
  interactionId?: string;  // For multi-turn conversation
  clarificationAnswers?: {
    location?: string;      // "San Francisco, CA"
    scope?: 'local' | 'state' | 'national' | 'international';
    target_type?: 'government' | 'corporate' | 'institutional' | 'other';
  }
}
```

### Response Requesting Clarification
```typescript
{
  needs_clarification: true,
  clarification_questions: [
    {
      id: 'location',
      question: 'Where is this happening?',
      type: 'location_picker',
      preselected: null,
      required: true
    }
  ],
  inferred_context: {
    detected_location: null,
    detected_scope: null,
    detected_target_type: 'government',
    location_confidence: 0,
    scope_confidence: 0,
    target_type_confidence: 0.6
  },
  interactionId: 'uuid-string'
}
```

### Response with Generated Subject Line
```typescript
{
  subject_line: "Make rent affordable in San Francisco",
  core_issue: "Rental costs exceed income growth",
  topics: ["housing", "affordability", "rent-control"],
  url_slug: "make-rent-affordable-sf",
  voice_sample: "The rent keeps going up but wages don't...",
  interactionId: 'uuid-string'
}
```

---

## State Machine

```
┌─────────┐
│  idle   │
└────┬────┘
     │ User types
     ▼
┌─────────┐
│thinking │
└────┬────┘
     │
     ├─► needs_clarification: true
     │   ┌──────────────┐
     │   │ clarifying   │
     │   └──────┬───────┘
     │          │ User answers/skips
     │          ▼
     │   ┌──────────────┐
     │   │  thinking    │
     │   └──────┬───────┘
     │          │
     └─► needs_clarification: false
         ┌──────────────┐
         │    ready     │
         └──────────────┘
```

---

## Testing Checklist

- [ ] Agent returns `needs_clarification: true` → ClarificationPanel renders
- [ ] User answers questions → API called with `clarificationAnswers`
- [ ] User skips questions → API called with empty answers
- [ ] Agent returns subject line after clarification → Suggestion surface renders
- [ ] `interactionId` is preserved across calls
- [ ] Pre-selected values from `inferred_context` populate UI
- [ ] Keyboard shortcuts work (Enter to submit, Escape to skip)
- [ ] LocationAutocomplete integration works for location questions
- [ ] Chip selector works for scope questions
- [ ] Radio group works for target_type questions
- [ ] Transition animations are smooth (no flashing)

---

## Design Spec Reference

See: `docs/specs/subject-line-clarifying-questions.md`

**Key principles:**
- **0-2 questions maximum** - Beyond this kills engagement
- **Pre-populated answers** - Agent's best guess becomes the default
- **Single screen** - All questions visible at once
- **<5 seconds to answer** - If pre-selections are correct, just confirm
- **Skip option** - User knows their issue better than AI

---

## Metrics to Track

1. **Clarification Rate**: % of inputs that trigger questions
   - **Target:** 10-20% (too high = too aggressive, too low = not helping)

2. **Skip Rate**: % of users who skip clarification
   - **Target:** <30% (high skip = questions aren't useful)

3. **Downstream Accuracy**: % of decision-makers accepted without edits
   - Compare clarified vs. non-clarified flows

4. **Time to Complete**: Seconds from raw input to subject line acceptance
   - **Target:** Clarification adds <10s on average

---

## Related Files

**Component:**
- `src/lib/components/template/creator/UnifiedObjectiveEntry.svelte` (modified)
- `src/lib/components/template/creator/ClarificationPanel.svelte` (existing)

**Types:**
- `src/lib/core/agents/types/clarification.ts` (existing)
- `src/lib/core/agents/types/index.ts` (new)

**API Endpoint:**
- `src/routes/api/agents/generate-subject/+server.ts` (to be updated)

**Spec:**
- `docs/specs/subject-line-clarifying-questions.md`

---

## Code Quality

**ESLint:** ✅ 0 errors, 5 pre-existing warnings (self-closing tags)
**TypeScript:** ✅ No type errors
**Type Safety:** ✅ All types properly imported and used

**Zero tolerance compliance:**
- ✅ No `any` types
- ✅ No type suppressions (`@ts-ignore`, `@ts-expect-error`)
- ✅ Explicit types for all function parameters and returns
- ✅ Proper type guards for state transitions
- ✅ Discriminated union for `SuggestionState`

---

*Integration completed: 2025-12-24*
