# Migration Guide: Clarification System

**For developers working with the subject-line agent**

## Breaking Changes

✅ **None** - The system is fully backward compatible.

## What Changed

The subject-line agent response type changed from:

```typescript
// OLD (still works)
interface SubjectLineResponse {
  subject_line: string;
  core_issue: string;
  topics: string[];
  url_slug: string;
  voice_sample: string;
}
```

To:

```typescript
// NEW (superset of old)
interface SubjectLineResponseWithClarification {
  // Standard output (still present when no clarification needed)
  subject_line?: string;
  core_issue?: string;
  topics?: string[];
  url_slug?: string;
  voice_sample?: string;

  // Clarification (only present when needed)
  needs_clarification?: boolean;
  clarification_questions?: ClarificationQuestion[];

  // Inferred context (always present)
  inferred_context: InferredContext;
}
```

## Updating Your Code

### Option 1: No Changes Required (Safe)

If your code just needs the output, **no changes required**:

```typescript
// This still works exactly as before
const result = await generateSubjectLine({ description });
console.log(result.data.subject_line);
```

**Why it works:**
- When confidence ≥ 0.7, agent returns complete output
- All standard fields are still populated
- `inferred_context` is ignored by existing code

### Option 2: Add Clarification Support (Recommended)

To support clarification questions:

```typescript
const result = await generateSubjectLine({ description });

// Use type guard to check response type
if (needsClarification(result.data)) {
  // TypeScript now knows:
  // - needs_clarification === true
  // - clarification_questions is ClarificationQuestion[]

  showClarificationUI(result.data.clarification_questions);

  // After user answers:
  const finalResult = await generateSubjectLine({
    description,
    previousInteractionId: result.interactionId,
    clarificationAnswers: userAnswers
  });

  processOutput(finalResult.data);
} else {
  // Has complete output
  processOutput(result.data);
}
```

### Option 3: Use Type Narrowing

TypeScript can narrow types automatically:

```typescript
const result = await generateSubjectLine({ description });

if (result.data.needs_clarification) {
  // TypeScript knows: clarification_questions exists
  handleClarification(result.data.clarification_questions!);
} else {
  // TypeScript knows: subject_line exists
  handleOutput(result.data.subject_line!);
}
```

## Type Guards

Import helpers for clean type narrowing:

```typescript
import {
  needsClarification,
  hasCompleteOutput,
  meetsConfidenceThreshold
} from '$lib/core/agents';

// Type guard: response needs clarification
if (needsClarification(response)) {
  // TS knows: needs_clarification === true
  // TS knows: clarification_questions is ClarificationQuestion[]
}

// Type guard: response has complete output
if (hasCompleteOutput(response)) {
  // TS knows: subject_line is string
  // TS knows: core_issue is string
  // TS knows: topics is string[]
  // etc.
}

// Check confidence threshold
if (meetsConfidenceThreshold(response.inferred_context, 0.7)) {
  // All dimensions >= 0.7
}
```

## API Endpoint Changes

### Request Body

```typescript
// OLD
interface RequestBody {
  message: string;
  interactionId?: string;
}

// NEW (backward compatible)
interface RequestBody {
  message: string;
  interactionId?: string;
  clarificationAnswers?: ClarificationAnswers;  // ADDED
}
```

### Response Body

```typescript
// Response now includes all fields from SubjectLineResponseWithClarification
{
  // Standard output (when no clarification needed)
  "subject_line": "...",
  "core_issue": "...",
  "topics": [...],
  "url_slug": "...",
  "voice_sample": "...",

  // OR clarification request (when needed)
  "needs_clarification": true,
  "clarification_questions": [...],

  // Always present
  "inferred_context": {...},
  "interactionId": "..."
}
```

## Frontend Component Updates

### Before (Simple)

```svelte
<script lang="ts">
  async function handleSubmit() {
    const res = await fetch('/api/agents/generate-subject', {
      method: 'POST',
      body: JSON.stringify({ message: userInput })
    });

    const data = await res.json();
    subjectLine = data.subject_line;
  }
</script>
```

### After (With Clarification Support)

```svelte
<script lang="ts">
  import type { SubjectLineResponseWithClarification } from '$lib/core/agents';
  import { needsClarification } from '$lib/core/agents';

  let response: SubjectLineResponseWithClarification;
  let showClarificationPanel = false;

  async function handleSubmit() {
    const res = await fetch('/api/agents/generate-subject', {
      method: 'POST',
      body: JSON.stringify({ message: userInput })
    });

    response = await res.json();

    if (needsClarification(response)) {
      showClarificationPanel = true;
    } else {
      proceedWithOutput(response);
    }
  }

  async function handleClarificationSubmit(answers) {
    const res = await fetch('/api/agents/generate-subject', {
      method: 'POST',
      body: JSON.stringify({
        message: userInput,
        interactionId: response.interactionId,
        clarificationAnswers: answers
      })
    });

    response = await res.json();
    showClarificationPanel = false;
    proceedWithOutput(response);
  }
</script>

{#if showClarificationPanel}
  <ClarificationPanel
    questions={response.clarification_questions}
    on:submit={handleClarificationSubmit}
    on:skip={() => proceedWithOutput(response)}
  />
{/if}
```

## Common Patterns

### Pattern 1: Mandatory Clarification

Force clarification when confidence is low:

```typescript
const result = await generateSubjectLine({ description });

if (!meetsConfidenceThreshold(result.data.inferred_context, 0.8)) {
  // Force user to clarify, don't use best guesses
  if (!result.data.needs_clarification) {
    throw new Error('Confidence too low, need clarification');
  }

  return { needsClarification: true, questions: result.data.clarification_questions };
}
```

### Pattern 2: Auto-Fill from User Profile

Pre-fill clarification with user's known location:

```typescript
const result = await generateSubjectLine({ description });

if (needsClarification(result.data)) {
  const locationQuestion = result.data.clarification_questions?.find(
    q => q.id === 'location'
  );

  if (locationQuestion && user.verified_location) {
    // Auto-answer with verified location
    const finalResult = await generateSubjectLine({
      description,
      previousInteractionId: result.interactionId,
      clarificationAnswers: {
        location: user.verified_location
      }
    });

    return finalResult.data;
  }
}
```

### Pattern 3: Confidence Logging

Track agent confidence for debugging:

```typescript
const result = await generateSubjectLine({ description });

console.log('[Confidence]', {
  location: result.data.inferred_context.location_confidence,
  scope: result.data.inferred_context.scope_confidence,
  target_type: result.data.inferred_context.target_type_confidence,
  overall: calculateOverallConfidence(result.data.inferred_context),
  metThreshold: meetsConfidenceThreshold(result.data.inferred_context)
});
```

## Testing

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { needsClarification, hasCompleteOutput } from '$lib/core/agents';

describe('Clarification handling', () => {
  it('should detect clarification needed', () => {
    const response = {
      needs_clarification: true,
      clarification_questions: [{ id: 'location', ... }],
      inferred_context: { ... }
    };

    expect(needsClarification(response)).toBe(true);
    expect(hasCompleteOutput(response)).toBe(false);
  });

  it('should detect complete output', () => {
    const response = {
      subject_line: 'Test',
      core_issue: 'Test',
      topics: ['test'],
      url_slug: 'test',
      voice_sample: 'test',
      inferred_context: { ... }
    };

    expect(needsClarification(response)).toBe(false);
    expect(hasCompleteOutput(response)).toBe(true);
  });
});
```

## Rollout Strategy

### Phase 1 (Current): Backend Only
- ✅ Agent can return clarification questions
- ✅ API accepts clarification answers
- ✅ Type guards and helpers available
- ⏸️ Frontend shows "best guess" output (ignores clarification)

### Phase 2 (Next): Frontend UI
- 🔲 `ClarificationPanel.svelte` component
- 🔲 Integration in `UnifiedObjectiveEntry.svelte`
- 🔲 A/B test: clarification vs. best-guess flows

### Phase 3: Optimization
- 🔲 Tune confidence thresholds based on metrics
- 🔲 Track clarification rate, skip rate, accuracy
- 🔲 Refine question framing based on user feedback

## Support

**Questions?** See:
- **Full spec:** `docs/specs/subject-line-clarifying-questions.md`
- **Implementation:** `docs/development/integrations/phase-1-clarification-implementation.md`
- **Examples:** `docs/development/integrations/clarification-examples.md`
- **Types:** `src/lib/core/agents/types/clarification.ts`
- **Tests:** `tests/unit/agents/clarification.test.ts`
