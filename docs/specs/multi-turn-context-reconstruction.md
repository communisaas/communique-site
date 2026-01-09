# Multi-Turn Context Reconstruction Spec

**Status:** Implementation Ready
**Author:** Engineering Team
**Date:** 2026-01-09

## Problem Statement

The current multi-turn refinement system is broken. The `interact()` function in `gemini-client.ts` accepts `previousInteractionId` but **never uses it** to retrieve conversation history. Every API call is completely stateless—the model has zero memory of previous turns.

When a user answers clarification questions, the agent receives ONLY the answers without the original context:
- No original description
- No questions that were asked
- No inferred context from first turn

Result: The agent prompt assumes context that doesn't exist.

## Solution: Context Reconstruction (Option B)

Instead of maintaining server-side conversation state, we reconstruct full context on every turn by passing everything the agent needs in a single call.

### Data Flow

```
Turn 1 (Initial):
  Frontend → API: { message: "rent is out of control in my city" }
  API → Agent: Analyzes, returns needs_clarification=true with questions
  API → Frontend: { interactionId, needs_clarification, questions, inferred_context }
  Frontend: Stores all of this in component state

Turn 2 (Clarification):
  Frontend → API: {
    message: "rent is out of control in my city",     // ORIGINAL description
    interactionId: "xxx",
    clarificationContext: {
      questionsAsked: [...],                           // Questions from turn 1
      inferredContext: {...},                          // Agent's inferences
      answers: { location: "San Francisco, CA" }       // User's answers
    }
  }
  API → Agent: Builds FULL context prompt with everything
  Agent: Has complete picture, generates final output
```

### Key Principle

**The frontend owns conversation state.** The backend is stateless but receives complete context on each turn.

## Implementation Changes

### 1. Types (`src/lib/core/agents/types/clarification.ts`)

Add new interface for full context reconstruction:

```typescript
/**
 * Full conversation context for stateless multi-turn
 * Frontend stores this and sends it back on clarification turn
 */
export interface ConversationContext {
  /** Original user description from turn 1 */
  originalDescription: string;

  /** Questions the agent asked */
  questionsAsked: ClarificationQuestion[];

  /** Agent's inferred context from turn 1 */
  inferredContext: InferredContext;

  /** User's answers keyed by question ID */
  answers: ClarificationAnswers;
}
```

### 2. Agent Options (`src/lib/core/agents/agents/subject-line.ts`)

Update `GenerateSubjectOptions`:

```typescript
export interface GenerateSubjectOptions {
  description: string;

  /** Full context for clarification turns (replaces broken multi-turn) */
  conversationContext?: ConversationContext;

  /** @deprecated - kept for backwards compatibility, use conversationContext */
  previousInteractionId?: string;
  clarificationAnswers?: ClarificationAnswers;
}
```

Update prompt building logic:

```typescript
if (options.conversationContext) {
  const ctx = options.conversationContext;

  // Build complete context prompt
  prompt = `## Original Issue
${ctx.originalDescription}

## Questions I Asked
${ctx.questionsAsked.map(q => `- ${q.question} (${q.type})`).join('\n')}

## User's Clarifications
${Object.entries(ctx.answers)
  .filter(([, v]) => v?.trim())
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n') || '(User skipped clarification)'}

## My Previous Analysis
- Detected location: ${ctx.inferredContext.detected_location || 'unknown'}
- Detected scope: ${ctx.inferredContext.detected_scope || 'unknown'}
- Reasoning: ${ctx.inferredContext.reasoning || 'none'}

Now generate the final subject line using this complete context.`;
}
```

### 3. API Endpoint (`src/routes/api/agents/generate-subject/+server.ts`)

Update request body interface:

```typescript
interface RequestBody {
  message: string;
  interactionId?: string;

  /** Full context for clarification (new approach) */
  conversationContext?: ConversationContext;

  /** @deprecated */
  clarificationAnswers?: ClarificationAnswers;
}
```

Pass through to agent:

```typescript
const result = await generateSubjectLine({
  description: body.message,
  conversationContext: body.conversationContext,
  // Legacy support
  previousInteractionId: body.interactionId,
  clarificationAnswers: body.clarificationAnswers
});
```

### 4. Frontend State (`src/lib/components/template/creator/UnifiedObjectiveEntry.svelte`)

Update state management:

```typescript
// Store complete context for clarification turn
let conversationContext = $state<{
  originalDescription: string;
  questionsAsked: ClarificationQuestion[];
  inferredContext: InferredContext;
} | null>(null);

// When receiving clarification questions
if (response.data.needs_clarification) {
  conversationContext = {
    originalDescription: text,
    questionsAsked: response.data.clarification_questions || [],
    inferredContext: response.data.inferred_context
  };
  // ... show ClarificationPanel
}

// When submitting answers
async function handleClarificationSubmit(answers: Record<string, string>) {
  if (!conversationContext) return;

  await generateSuggestionWithTiming(data.rawInput, {
    originalDescription: conversationContext.originalDescription,
    questionsAsked: conversationContext.questionsAsked,
    inferredContext: conversationContext.inferredContext,
    answers
  });
}
```

Update API call:

```typescript
const payload = conversationContext
  ? {
      message: text,
      conversationContext: {
        ...conversationContext,
        answers: clarificationAnswers
      }
    }
  : { message: text };

const response = await api.post('/agents/generate-subject', payload);
```

## Location-Aware Clarification

### Agent Scope Inference

The agent already determines `location_level` for `location_picker` questions:
- `city` - Local issues (city councils, mayors, local businesses)
- `state` - State-level issues (state legislature, state agencies)
- `country` - National/international issues

### Frontend Integration

`ClarificationPanel.svelte` already integrates with `LocationAutocomplete`:

```svelte
{#if question.type === 'location_picker'}
  <LocationAutocomplete
    label={answers[question.id] || question.prefilled_location || 'Search...'}
    level={getLocationLevel(question.location_level)}
    on:select={(e) => handleLocationSelect(question.id, e.detail)}
  />
{/if}
```

The `LocationAutocomplete` component:
- Supports `city`, `state`, `country` levels
- Uses cached geocoding API with 300ms debounce
- Returns `LocationHierarchy` with full geographic context

### Prompt Enhancement for Scope Inference

Add to `SUBJECT_LINE_PROMPT`:

```
## Location Scope Inference

When asking location questions, determine the appropriate scope:

**city** - Use when the issue involves:
- Local government (city council, mayor, local agencies)
- Local businesses or employers
- Neighborhood-specific issues
- Municipal services

**state** - Use when the issue involves:
- State legislation or policy
- State agencies or officials
- Regional issues spanning multiple cities
- State-level corporations

**country** - Use when the issue involves:
- Federal legislation
- National corporations
- International policy
- Issues without geographic specificity

Examples:
- "6th street is insane" → location_level: "city" (neighborhood issue)
- "rent control laws" → location_level: "state" (state legislation)
- "Congress needs to act" → No location question needed (already national)
- "Amazon workers" → No location needed (corporate target)
```

## File Change Summary

| File | Changes |
|------|---------|
| `src/lib/core/agents/types/clarification.ts` | Add `ConversationContext` interface |
| `src/lib/core/agents/agents/subject-line.ts` | Accept `conversationContext`, build complete prompts |
| `src/routes/api/agents/generate-subject/+server.ts` | Pass `conversationContext` to agent |
| `src/lib/components/template/creator/UnifiedObjectiveEntry.svelte` | Store/send complete context |
| `src/lib/core/agents/prompts/subject-line.ts` | Enhance scope inference guidance |

## Testing Strategy

1. **Unit test**: Agent prompt building with full context
2. **Integration test**: API endpoint with conversationContext
3. **E2E test**: Full clarification flow (initial → questions → answers → output)

## Migration Notes

- Keep `previousInteractionId` and `clarificationAnswers` for backwards compatibility
- New `conversationContext` takes precedence when present
- No database changes required (state lives in frontend)
- No breaking changes to existing API consumers

## Success Criteria

1. Agent receives complete context on clarification turn
2. Location picker uses correct scope level
3. User answers are interpreted with full original context
4. Graceful fallback for skip (empty answers + full context)
