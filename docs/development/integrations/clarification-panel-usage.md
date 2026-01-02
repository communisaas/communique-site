# ClarificationPanel Usage Guide

**Component:** `/src/lib/components/template/creator/ClarificationPanel.svelte`

**Purpose:** Display minimal clarifying questions (0-2 max) when the subject-line agent needs disambiguation for targeting decisions.

---

## Quick Integration

### 1. Import the Component

```typescript
import ClarificationPanel from '$lib/components/template/creator/ClarificationPanel.svelte';
import type { SubjectLineResponseWithClarification } from '$lib/core/agents/types';
```

### 2. Detect Clarification Needed

```typescript
// In your component state
let agentResponse = $state<SubjectLineResponseWithClarification | null>(null);
let needsClarification = $derived(agentResponse?.needs_clarification ?? false);
let hasQuestions = $derived((agentResponse?.clarification_questions?.length ?? 0) > 0);

// Call the agent API
const response = await api.post('/agents/generate-subject', {
	message: rawInput,
	interactionId: previousInteractionId
});

agentResponse = response.data;

// Check if clarification is needed
if (agentResponse.needs_clarification && agentResponse.clarification_questions) {
	// Show ClarificationPanel
	showClarificationUI = true;
} else {
	// Use the generated subject line directly
	acceptSubjectLine(agentResponse);
}
```

### 3. Render the Panel

```svelte
{#if needsClarification && hasQuestions && agentResponse}
	<ClarificationPanel
		questions={agentResponse.clarification_questions}
		inferredContext={agentResponse.inferred_context}
		onSubmit={handleClarificationAnswers}
		onSkip={handleSkipClarification}
	/>
{/if}
```

### 4. Handle User Answers

```typescript
async function handleClarificationAnswers(answers: Record<string, string>) {
	console.log('[Clarification] User answered:', answers);

	// Re-call the agent with clarification context
	const response = await api.post('/agents/generate-subject', {
		message: rawInput,
		interactionId: agentResponse.interactionId, // CRITICAL: Maintain conversation state
		clarificationAnswers: answers // Agent will use these to refine targeting
	});

	// Now we should get a complete response
	if (response.data.subject_line) {
		acceptSubjectLine(response.data);
	}
}

function handleSkipClarification() {
	console.log('[Clarification] User skipped - using agent best guess');

	// Use the inferred context from agent's initial analysis
	// Agent already has best guesses in inferred_context
	acceptSubjectLine(agentResponse);
}
```

---

## Question Types

### 1. Location Picker (`location_picker`)

Uses the existing `LocationAutocomplete` component.

**When triggered:**
- Input mentions a place name that could be local OR references broader policy
- No clear location signal from user's inferred location
- Scope would change target decision-makers

**Example:**
```json
{
	"id": "location",
	"question": "Where is this happening?",
	"type": "location_picker",
	"preselected": null,
	"required": true
}
```

### 2. Chip Selector (`chips`)

Inline chip buttons for quick scope selection.

**When triggered:**
- Geographic place detected but unclear if issue is local instance or systemic
- Would change whether we target local officials or national policymakers

**Example:**
```json
{
	"id": "scope",
	"question": "Is this about...",
	"type": "chips",
	"options": [
		{ "value": "local", "label": "Local issue" },
		{ "value": "state", "label": "Statewide policy" },
		{ "value": "national", "label": "National policy" },
		{ "value": "corporate", "label": "Corporate/Private" }
	],
	"preselected": "local",
	"required": true
}
```

### 3. Radio Group (`single_choice`)

Radio buttons with descriptions for target type disambiguation.

**When triggered:**
- Input could target multiple power structure types
- Would route to completely different decision-makers

**Example:**
```json
{
	"id": "target_type",
	"question": "Who controls this?",
	"type": "single_choice",
	"options": [
		{
			"value": "government",
			"label": "Government officials",
			"description": "Mayors, legislators, regulators"
		},
		{
			"value": "corporate",
			"label": "Corporate executives",
			"description": "CEOs, boards, shareholders"
		},
		{
			"value": "institutional",
			"label": "Institutional leaders",
			"description": "Universities, hospitals, school boards"
		},
		{
			"value": "other",
			"label": "Other",
			"description": "Unions, HOAs, nonprofits"
		}
	],
	"preselected": "government",
	"required": true
}
```

---

## Full Integration Example

See `/src/lib/components/template/creator/UnifiedObjectiveEntry.svelte` for the complete integration pattern:

```svelte
<script lang="ts">
	import ClarificationPanel from './ClarificationPanel.svelte';
	import type { SubjectLineResponseWithClarification } from '$lib/core/agents/types';
	import { api } from '$lib/core/api/client';

	let rawInput = $state('');
	let agentResponse = $state<SubjectLineResponseWithClarification | null>(null);
	let showClarificationPanel = $state(false);
	let currentInteractionId = $state<string | null>(null);

	// Generate subject line with clarification support
	async function generateSubjectLine() {
		const response = await api.post('/agents/generate-subject', {
			message: rawInput,
			interactionId: currentInteractionId
		});

		agentResponse = response.data;
		currentInteractionId = response.data.interactionId;

		// Check if clarification needed
		if (agentResponse.needs_clarification && agentResponse.clarification_questions) {
			showClarificationPanel = true;
		} else {
			// Direct to acceptance
			acceptSubjectLine(agentResponse);
		}
	}

	// Handle clarification answers
	async function handleClarificationAnswers(answers: Record<string, string>) {
		showClarificationPanel = false;

		// Re-generate with context
		const response = await api.post('/agents/generate-subject', {
			message: rawInput,
			interactionId: currentInteractionId,
			clarificationAnswers: answers
		});

		agentResponse = response.data;

		if (agentResponse.subject_line) {
			acceptSubjectLine(agentResponse);
		}
	}

	// Handle skip
	function handleSkipClarification() {
		showClarificationPanel = false;
		if (agentResponse) {
			acceptSubjectLine(agentResponse);
		}
	}

	// Accept final subject line
	function acceptSubjectLine(response: SubjectLineResponseWithClarification) {
		if (response.subject_line) {
			// Use the generated data
			data.title = response.subject_line;
			data.description = response.core_issue;
			data.slug = response.url_slug;
			data.topics = response.topics;
			data.voiceSample = response.voice_sample;
		}
	}
</script>

<!-- Raw input -->
<textarea bind:value={rawInput} />

<!-- Clarification panel (if needed) -->
{#if showClarificationPanel && agentResponse?.clarification_questions}
	<ClarificationPanel
		questions={agentResponse.clarification_questions}
		inferredContext={agentResponse.inferred_context}
		onSubmit={handleClarificationAnswers}
		onSkip={handleSkipClarification}
	/>
{/if}
```

---

## UX Principles

### 1. Pre-selection is Key
- Agent's best guess is ALWAYS pre-selected
- User confirms or changes in <5 seconds
- "Skip" option respects user agency

### 2. Single Screen
- All questions visible at once (0-2 max)
- No wizards, no pagination
- Feels like one quick decision, not an interrogation

### 3. Helpful, Not Blocking
- "Skip — use your best guess" is always available
- Frame as "helps us find the right people"
- Not "we need this information from you"

### 4. Keyboard Navigation
- **Enter** to submit (if all required fields filled)
- **Escape** to skip
- Arrow keys for radio/chip navigation

---

## Accessibility

- ✅ Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- ✅ ARIA labels for screen readers
- ✅ Focus management (auto-focus on first question)
- ✅ Color contrast meets WCAG 2.1 AA standards
- ✅ Clear error states (required field validation)

---

## Design Tokens

Uses existing participation-primary colors:

```css
/* Primary actions */
bg-participation-primary-600
hover:bg-participation-primary-700

/* Panel background */
bg-participation-primary-50
border-participation-primary-200

/* Selected state */
border-participation-primary-500
bg-participation-primary-100
text-participation-primary-900
```

---

## API Contract

### Request (Initial)
```typescript
POST /api/agents/generate-subject
{
	"message": "housing crisis in the bay area",
	"interactionId": null // First call
}
```

### Response (Clarification Needed)
```typescript
{
	"needs_clarification": true,
	"clarification_questions": [
		{
			"id": "location",
			"question": "Where is this happening?",
			"type": "location_picker",
			"preselected": "San Francisco, CA",
			"required": true
		}
	],
	"inferred_context": {
		"detected_location": "San Francisco, CA",
		"detected_scope": "local",
		"detected_target_type": "government",
		"location_confidence": 0.6,
		"scope_confidence": 0.7,
		"target_type_confidence": 0.8
	},
	"interactionId": "interaction-abc123"
}
```

### Request (With Clarification)
```typescript
POST /api/agents/generate-subject
{
	"message": "housing crisis in the bay area",
	"interactionId": "interaction-abc123", // MUST pass same ID
	"clarificationAnswers": {
		"location": "San Francisco, CA"
	}
}
```

### Response (Final)
```typescript
{
	"subject_line": "End SF's Housing Crisis with Affordable Zoning",
	"core_issue": "San Francisco housing affordability crisis",
	"topics": ["housing", "zoning", "affordability"],
	"url_slug": "sf-housing-crisis",
	"voice_sample": "housing crisis in the bay area",
	"inferred_context": {
		"detected_location": "San Francisco, CA",
		"detected_scope": "local",
		"detected_target_type": "government",
		"location_confidence": 1.0,
		"scope_confidence": 1.0,
		"target_type_confidence": 1.0
	},
	"interactionId": "interaction-abc123"
}
```

---

## Testing

### Unit Tests
```typescript
import { render, fireEvent } from '@testing-library/svelte';
import ClarificationPanel from './ClarificationPanel.svelte';

test('pre-selects agent best guess', () => {
	const questions = [{
		id: 'scope',
		question: 'Is this about...',
		type: 'chips',
		options: [
			{ value: 'local', label: 'Local issue' },
			{ value: 'national', label: 'National policy' }
		],
		preselected: 'local',
		required: true
	}];

	const { getByText } = render(ClarificationPanel, {
		props: { questions, inferredContext: {...}, onSubmit: vi.fn(), onSkip: vi.fn() }
	});

	// "Local issue" should be selected
	expect(getByText('Local issue')).toHaveClass('border-participation-primary-500');
});

test('calls onSubmit with answers', async () => {
	const onSubmit = vi.fn();
	const { getByText } = render(ClarificationPanel, { props: {..., onSubmit } });

	await fireEvent.click(getByText('Continue'));

	expect(onSubmit).toHaveBeenCalledWith({ scope: 'local' });
});

test('calls onSkip when skip clicked', async () => {
	const onSkip = vi.fn();
	const { getByText } = render(ClarificationPanel, { props: {..., onSkip } });

	await fireEvent.click(getByText('Skip — use your best guess'));

	expect(onSkip).toHaveBeenCalled();
});
```

---

## Metrics to Track

1. **Clarification Rate**: % of inputs that trigger questions (target: 10-20%)
2. **Skip Rate**: % of users who skip (target: <30%)
3. **Answer Change Rate**: % who change agent's pre-selection (shows accuracy)
4. **Time to Complete**: Seconds from question to answer (target: <10s)
5. **Downstream Accuracy**: % of decision-makers accepted without edits

---

## Related Files

- **Component**: `/src/lib/components/template/creator/ClarificationPanel.svelte`
- **Types**: `/src/lib/core/agents/types/clarification.ts`
- **Agent**: `/src/lib/core/agents/agents/subject-line.ts`
- **API**: `/src/routes/api/agents/generate-subject/+server.ts`
- **Spec**: `/docs/specs/subject-line-clarifying-questions.md`
- **Example**: `/src/lib/components/template/creator/UnifiedObjectiveEntry.svelte`

---

*Last updated: 2025-01-24*
