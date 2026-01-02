# Phase 1: Clarification System Implementation

**Date:** 2025-12-24
**Status:** Complete
**Spec:** `docs/specs/subject-line-clarifying-questions.md`

## Overview

Phase 1 extends the subject-line agent to support minimal clarifying questions when input ambiguity would lead to different decision-makers. The agent can now return either:

1. **Complete output** (when confidence ≥ 0.7 in all dimensions)
2. **Clarification questions** (when confidence < 0.7 AND would change targeting)

## Implementation

### 1. Type Definitions

**File:** `src/lib/core/agents/types/clarification.ts`

New types for clarification support:

```typescript
// Geographic and target classification
type GeographicScope = 'local' | 'state' | 'national' | 'international';
type TargetType = 'government' | 'corporate' | 'institutional' | 'other';

// Question structure
interface ClarificationQuestion {
  id: 'location' | 'scope' | 'target_type';
  question: string;
  type: 'location_picker' | 'single_choice' | 'chips';
  options?: ClarificationOption[];
  preselected?: string;
  required: boolean;
}

// Inferred context (always returned)
interface InferredContext {
  detected_location: string | null;
  detected_scope: GeographicScope | null;
  detected_target_type: TargetType | null;
  location_confidence: number;      // 0-1
  scope_confidence: number;          // 0-1
  target_type_confidence: number;    // 0-1
}

// Extended response
interface SubjectLineResponseWithClarification {
  // Standard output (optional when clarification needed)
  subject_line?: string;
  core_issue?: string;
  topics?: string[];
  url_slug?: string;
  voice_sample?: string;

  // Clarification request (optional)
  needs_clarification?: boolean;
  clarification_questions?: ClarificationQuestion[];

  // Inferred context (always present)
  inferred_context: InferredContext;
}

// User answers
interface ClarificationAnswers {
  location?: string;
  scope?: GeographicScope;
  target_type?: TargetType;
}
```

### 2. Prompt Extension

**File:** `src/lib/core/agents/prompts/subject-line.ts`

Added **Clarification Protocol** section:

**Confidence Scoring (0-1):**
- **Location:** 1.0 = explicit location, 0.8 = implied, 0.5 = ambiguous, 0.0 = none
- **Scope:** 1.0 = clear scope, 0.7 = likely, 0.5 = could go either way
- **Target Type:** 1.0 = explicit target, 0.7 = implied, 0.5 = multiple valid

**Decision Rules:**
1. If ALL dimensions ≥ 0.7 → Generate immediately
2. If ANY dimension < 0.7 AND would change decision-makers → Ask questions
3. Maximum 2 questions
4. Always include `inferred_context` with best guesses

**Question Types:**
- **Location** (location_picker): No options, uses LocationAutocomplete component
- **Scope** (chips): Local / Statewide / National options
- **Target Type** (single_choice): Government / Corporate / Institutional / Other

### 3. JSON Schema Extension

**File:** `src/lib/core/agents/schemas.ts`

Extended `SUBJECT_LINE_SCHEMA`:

- Made standard output fields optional (not required when clarification needed)
- Added `needs_clarification` (boolean)
- Added `clarification_questions` (array, max 2)
- Added `inferred_context` (always required) with confidence scores

### 4. Agent Function Updates

**File:** `src/lib/core/agents/agents/subject-line.ts`

Extended `generateSubjectLine()` to handle clarification flow:

```typescript
interface GenerateSubjectOptions {
  description: string;
  previousInteractionId?: string;
  refinementFeedback?: string;
  clarificationAnswers?: ClarificationAnswers;  // NEW
}

interface GenerateSubjectResult {
  data: SubjectLineResponseWithClarification;   // CHANGED
  interactionId: string;
}
```

**Conversation Flow:**
1. **Initial call:** Pass description → May get clarification questions OR output
2. **Clarification:** Pass interactionId + clarificationAnswers → Get output
3. **Refinement:** Pass interactionId + refinementFeedback → Get new output

### 5. API Endpoint Updates

**File:** `src/routes/api/agents/generate-subject/+server.ts`

Extended request body:

```typescript
interface RequestBody {
  message: string;
  interactionId?: string;
  clarificationAnswers?: ClarificationAnswers;  // NEW
}
```

Response now includes:
- All fields from `SubjectLineResponseWithClarification`
- `interactionId` for next interaction

### 6. Type Guards and Helpers

**File:** `src/lib/core/agents/utils/clarification-guards.ts`

Utility functions for working with clarification responses:

```typescript
// Type guards
needsClarification(response): boolean
hasCompleteOutput(response): boolean

// Confidence calculations
calculateOverallConfidence(context): number
meetsConfidenceThreshold(context, threshold?): boolean
getLeastConfidentDimensions(context): string[]
```

### 7. Public API Exports

**File:** `src/lib/core/agents/index.ts`

Exported new types and utilities:

```typescript
// Types
export type {
  GeographicScope,
  TargetType,
  ClarificationQuestion,
  InferredContext,
  SubjectLineResponseWithClarification,
  ClarificationAnswers
}

// Utils
export {
  needsClarification,
  hasCompleteOutput,
  calculateOverallConfidence,
  meetsConfidenceThreshold,
  getLeastConfidentDimensions
}
```

## Usage Example

### Backend (Agent)

```typescript
import { generateSubjectLine } from '$lib/core/agents';

// Initial call - ambiguous input
const result = await generateSubjectLine({
  description: 'rent is out of control and landlords are getting away with murder'
});

if (result.data.needs_clarification) {
  // Return questions to frontend
  return json({
    needsClarification: true,
    questions: result.data.clarification_questions,
    inferredContext: result.data.inferred_context,
    interactionId: result.interactionId
  });
}

// User answers questions
const finalResult = await generateSubjectLine({
  description: 'rent is out of control and landlords are getting away with murder',
  previousInteractionId: result.interactionId,
  clarificationAnswers: {
    location: 'San Francisco, CA',
    target_type: 'government'
  }
});

// Now has complete output
console.log(finalResult.data.subject_line);
```

### Frontend (UI Component - Phase 2)

```svelte
<script lang="ts">
  import type { SubjectLineResponseWithClarification } from '$lib/core/agents';

  let response: SubjectLineResponseWithClarification;

  async function handleSubmit(description: string) {
    const res = await fetch('/api/agents/generate-subject', {
      method: 'POST',
      body: JSON.stringify({ message: description })
    });

    response = await res.json();

    if (response.needs_clarification) {
      // Show ClarificationPanel (Phase 2)
      showClarificationUI = true;
    } else {
      // Proceed with output
      handleComplete(response);
    }
  }

  async function handleClarification(answers: ClarificationAnswers) {
    const res = await fetch('/api/agents/generate-subject', {
      method: 'POST',
      body: JSON.stringify({
        message: originalDescription,
        interactionId: response.interactionId,
        clarificationAnswers: answers
      })
    });

    response = await res.json();
    handleComplete(response);
  }
</script>
```

## Testing

**File:** `tests/unit/agents/clarification.test.ts`

Comprehensive unit tests covering:
- Type guards (`needsClarification`, `hasCompleteOutput`)
- Confidence calculations (`calculateOverallConfidence`, `meetsConfidenceThreshold`)
- Dimension prioritization (`getLeastConfidentDimensions`)
- Type definitions (valid question IDs, types, scopes, targets)

**Test Results:** ✅ All 142 tests passing

## Next Steps (Phase 2)

1. **UI Component:** `ClarificationPanel.svelte`
   - Render questions based on type
   - Pre-select agent's best guesses
   - Single-screen UX (no wizard)
   - "Skip" option to use best guesses

2. **Integration:** Wire up in `UnifiedObjectiveEntry.svelte`
   - Detect clarification responses
   - Show ClarificationPanel when needed
   - Pass answers back to agent

3. **LocationAutocomplete Integration:**
   - Use existing component for location questions
   - Pre-fill with detected location if available

## Backward Compatibility

✅ **Fully backward compatible**

The schema change makes standard output fields optional, but:
- Agent still generates complete output when confidence ≥ 0.7
- Existing code expecting `SubjectLineResponse` still works
- New `SubjectLineResponseWithClarification` is a superset
- `inferred_context` is always present (can be ignored by existing code)

## Files Changed

### Created:
- `src/lib/core/agents/types/clarification.ts` - New type definitions
- `src/lib/core/agents/utils/clarification-guards.ts` - Type guards and helpers
- `tests/unit/agents/clarification.test.ts` - Unit tests

### Modified:
- `src/lib/core/agents/types.ts` - Re-export clarification types
- `src/lib/core/agents/prompts/subject-line.ts` - Added clarification protocol
- `src/lib/core/agents/schemas.ts` - Extended subject line schema
- `src/lib/core/agents/agents/subject-line.ts` - Handle clarification answers
- `src/routes/api/agents/generate-subject/+server.ts` - Accept clarification answers
- `src/lib/core/agents/index.ts` - Export new types and utilities

## Code Quality

✅ **Zero ESLint errors**
✅ **No TypeScript `any` types**
✅ **Comprehensive type safety**
✅ **All existing tests passing**
✅ **142 total unit tests passing**

## References

- **Spec:** `docs/specs/subject-line-clarifying-questions.md`
- **Research:** [ICLR 2025 - Clarifying Questions in LLMs](https://proceedings.iclr.cc/paper_files/paper/2025/file/97e2df4bb8b2f1913657344a693166a2-Paper-Conference.pdf)
- **Design:** Minimal friction (0-2 questions max), effortless answers (multiple choice only)
