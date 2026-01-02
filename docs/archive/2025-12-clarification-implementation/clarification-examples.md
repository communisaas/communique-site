# Clarification System - Response Examples

**Phase 1:** Agent can return clarification questions OR complete output

## Example 1: Clear Input (No Clarification)

### Input
```json
{
  "message": "SF's 28-day housing policy makes it impossible to help homeless people get permanent housing"
}
```

### Response
```json
{
  "subject_line": "SF's 28-Day Policy Blocks Permanent Housing for Homeless",
  "core_issue": "Municipal regulations preventing homeless service providers from securing stable housing",
  "topics": ["housing", "homeless", "municipal-policy"],
  "url_slug": "sf-28-day-block",
  "voice_sample": "makes it impossible to help homeless people get permanent housing",
  "inferred_context": {
    "detected_location": "San Francisco, CA",
    "detected_scope": "local",
    "detected_target_type": "government",
    "location_confidence": 0.95,
    "scope_confidence": 0.9,
    "target_type_confidence": 0.85
  },
  "interactionId": "abc123..."
}
```

**Analysis:**
- All confidence scores ≥ 0.7
- Clear location signal ("SF's")
- Clear scope (local policy)
- Clear target (government)
- **Result:** Generate immediately

---

## Example 2: Ambiguous Location (Ask Location)

### Input
```json
{
  "message": "rent is out of control and landlords are getting away with murder"
}
```

### Response
```json
{
  "needs_clarification": true,
  "clarification_questions": [
    {
      "id": "location",
      "question": "Where is this happening?",
      "type": "location_picker",
      "preselected": null,
      "required": true
    },
    {
      "id": "target_type",
      "question": "Who should address this?",
      "type": "single_choice",
      "options": [
        {
          "value": "government",
          "label": "Government (rent control, tenant protections)"
        },
        {
          "value": "corporate",
          "label": "Landlord/Property company directly"
        }
      ],
      "preselected": "government",
      "required": false
    }
  ],
  "inferred_context": {
    "detected_location": null,
    "detected_scope": null,
    "detected_target_type": "government",
    "location_confidence": 0.0,
    "scope_confidence": 0.4,
    "target_type_confidence": 0.6
  },
  "interactionId": "def456..."
}
```

**Analysis:**
- Location confidence = 0.0 (no location signal)
- Would change decision-makers (local vs state vs national rent control)
- Target type confidence = 0.6 (could be government OR corporate landlord)
- **Result:** Ask 2 questions (max)

### User Provides Clarification
```json
{
  "message": "rent is out of control and landlords are getting away with murder",
  "interactionId": "def456...",
  "clarificationAnswers": {
    "location": "San Francisco, CA",
    "target_type": "government"
  }
}
```

### Final Response
```json
{
  "subject_line": "Your Landlord Gets Tax Breaks While You Pay 60% of Income on Rent",
  "core_issue": "Housing affordability crisis driven by tax policy favoring landlords over tenants",
  "topics": ["rent", "landlords", "housing", "taxes"],
  "url_slug": "landlord-tax-breaks",
  "voice_sample": "rent is out of control and landlords are getting away with murder",
  "inferred_context": {
    "detected_location": "San Francisco, CA",
    "detected_scope": "local",
    "detected_target_type": "government",
    "location_confidence": 1.0,
    "scope_confidence": 0.9,
    "target_type_confidence": 0.9
  },
  "interactionId": "def456..."
}
```

---

## Example 3: Ambiguous Scope (Ask Scope)

### Input
```json
{
  "message": "tuition hikes are destroying students"
}
```

### Response
```json
{
  "needs_clarification": true,
  "clarification_questions": [
    {
      "id": "scope",
      "question": "Is this about...",
      "type": "chips",
      "options": [
        { "value": "local", "label": "A specific university" },
        { "value": "state", "label": "State university system" },
        { "value": "national", "label": "National student debt policy" }
      ],
      "preselected": "national",
      "required": true
    }
  ],
  "inferred_context": {
    "detected_location": null,
    "detected_scope": null,
    "detected_target_type": "government",
    "location_confidence": 0.0,
    "scope_confidence": 0.3,
    "target_type_confidence": 0.7
  },
  "interactionId": "ghi789..."
}
```

**Analysis:**
- Scope confidence = 0.3 (could be specific university OR state OR national)
- Would change decision-makers (university admin vs state legislature vs Congress)
- Target type confidence = 0.7 (meets threshold - likely government)
- Location confidence = 0.0 BUT scope question covers it
- **Result:** Ask 1 question (scope)

---

## Example 4: Corporate Target (Clear)

### Input
```json
{
  "message": "Amazon workers deserve better pay and bathroom breaks"
}
```

### Response
```json
{
  "subject_line": "Amazon Drivers Pissing in Bottles While Bezos Makes $2.5M/Hour",
  "core_issue": "Warehouse workers lack basic dignities while executives profit",
  "topics": ["labor", "wages", "gig-workers", "warehouse", "big-tech"],
  "url_slug": "piss-bottle-prime",
  "voice_sample": "workers deserve better pay and bathroom breaks",
  "inferred_context": {
    "detected_location": "nationwide",
    "detected_scope": "national",
    "detected_target_type": "corporate",
    "location_confidence": 0.8,
    "scope_confidence": 0.9,
    "target_type_confidence": 0.95
  },
  "interactionId": "jkl012..."
}
```

**Analysis:**
- Clear target type ("Amazon workers" → corporate)
- Clear scope (corporate issue, nationwide)
- Implicit location (nationwide)
- **Result:** Generate immediately

---

## Example 5: User Skips Clarification

**Scenario:** User clicks "Skip — use your best guess"

### Frontend Code
```typescript
async function handleSkipClarification() {
  // Don't send clarificationAnswers
  // Agent uses inferred_context as-is
  const res = await fetch('/api/agents/generate-subject', {
    method: 'POST',
    body: JSON.stringify({
      message: originalMessage,
      interactionId: response.interactionId
      // No clarificationAnswers
    })
  });
}
```

### Agent Behavior
- Uses best guesses from `inferred_context`
- Generates output with moderate confidence
- May target broader scope when uncertain (safer default)

---

## Type Guard Usage

```typescript
import {
  needsClarification,
  hasCompleteOutput,
  meetsConfidenceThreshold
} from '$lib/core/agents';

const response = await generateSubjectLine({ description });

if (needsClarification(response)) {
  // TypeScript now knows:
  // - response.needs_clarification === true
  // - response.clarification_questions is ClarificationQuestion[]
  showClarificationPanel(response.clarification_questions);
}

if (hasCompleteOutput(response)) {
  // TypeScript now knows:
  // - response.subject_line is string
  // - response.core_issue is string
  // - etc.
  proceedToNextStep(response);
}

if (meetsConfidenceThreshold(response.inferred_context, 0.7)) {
  // All dimensions >= 0.7
  console.log('High confidence generation');
}
```

---

## Confidence Score Interpretation

### Location Confidence
- **1.0** - Explicit location ("SF's policy", "Texas abortion ban")
- **0.8** - Implicit from context ("the mayor should", "my city council")
- **0.5** - Ambiguous ("housing crisis" - could be anywhere)
- **0.0** - No location signal

### Scope Confidence
- **1.0** - Clear scope ("Congress must act", "my landlord")
- **0.7** - Likely scope ("rent too high" → probably local)
- **0.5** - Could go either way ("tuition hikes" → university or Congress?)
- **0.0** - No scope signals

### Target Type Confidence
- **1.0** - Explicit target ("Amazon workers", "my congressman")
- **0.7** - Implied target ("fix roads" → government)
- **0.5** - Multiple valid targets ("healthcare costs" → hospital or Congress?)
- **0.0** - No target signals

### Decision Rule
**Ask clarification if:**
- ANY dimension < 0.7 **AND**
- Answer would change which decision-makers get targeted

**Generate immediately if:**
- ALL dimensions >= 0.7

---

## UI Component Structure (Phase 2)

```svelte
<!-- ClarificationPanel.svelte -->
<div class="clarification-panel">
  <header>
    <h3>Quick question to get this right</h3>
    <p>This helps us find the right people to target</p>
  </header>

  {#each questions as question}
    {#if question.type === 'location_picker'}
      <LocationAutocomplete
        preselected={question.preselected}
        on:select={(e) => answers[question.id] = e.detail}
      />
    {:else if question.type === 'chips'}
      <ChipSelector
        options={question.options}
        preselected={question.preselected}
        on:change={(e) => answers[question.id] = e.detail}
      />
    {:else if question.type === 'single_choice'}
      <RadioGroup
        options={question.options}
        preselected={question.preselected}
        on:change={(e) => answers[question.id] = e.detail}
      />
    {/if}
  {/each}

  <footer>
    <button on:click={onSkip}>
      Skip — use your best guess
    </button>
    <button on:click={() => onSubmit(answers)}>
      Continue →
    </button>
  </footer>
</div>
```

---

## Conversation Flow Diagram

```
User Input
    ↓
┌─────────────────┐
│ Agent Analyzes  │
│ - Location?     │
│ - Scope?        │
│ - Target?       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
All ≥ 0.7  Any < 0.7
    │         │
    ↓         ↓
┌─────────┐ ┌──────────────┐
│Generate │ │Ask Questions │
│Output   │ │+ Best Guesses│
└─────────┘ └──────┬───────┘
                   │
            ┌──────┴──────┐
            │             │
         User Answers  User Skips
            │             │
            ↓             ↓
    ┌──────────────┐ ┌──────────────┐
    │Generate with │ │Generate with │
    │Clarification │ │Best Guesses  │
    └──────────────┘ └──────────────┘
```
