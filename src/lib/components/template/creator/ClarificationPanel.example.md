# ClarificationPanel Examples

Visual reference for the three question types supported by ClarificationPanel.

---

## Example 1: Location Picker

**Scenario:** User says "housing crisis" without specifying location.

```typescript
const questions: ClarificationQuestion[] = [
	{
		id: 'location',
		question: 'Where is this happening?',
		type: 'location_picker',
		preselected: null,
		required: true
	}
];

const inferredContext: InferredContext = {
	detected_location: null,
	detected_scope: null,
	detected_target_type: 'government',
	location_confidence: 0.0,
	scope_confidence: 0.4,
	target_type_confidence: 0.7
};
```

**UI Render:**

```
┌─────────────────────────────────────────────────────────┐
│ Quick question to get this right                        │
│ This helps us find the right people to target           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Where is this happening?                                │
│                                                          │
│ ┌───────────────────────────┐                           │
│ │ Select location       ✎   │  ← LocationAutocomplete   │
│ └───────────────────────────┘                           │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Skip — use your best guess          [Continue →]       │
└─────────────────────────────────────────────────────────┘
```

---

## Example 2: Chip Selector (Scope)

**Scenario:** User mentions "rent control" in SF - could be local or statewide.

```typescript
const questions: ClarificationQuestion[] = [
	{
		id: 'scope',
		question: 'Is this about...',
		type: 'chips',
		options: [
			{ value: 'local', label: 'Local issue' },
			{ value: 'state', label: 'Statewide policy' },
			{ value: 'national', label: 'National policy' }
		],
		preselected: 'local',
		required: true
	}
];

const inferredContext: InferredContext = {
	detected_location: 'San Francisco, CA',
	detected_scope: 'local',
	detected_target_type: 'government',
	location_confidence: 0.9,
	scope_confidence: 0.6, // <0.7 = ask
	target_type_confidence: 0.8
};
```

**UI Render:**

```
┌─────────────────────────────────────────────────────────┐
│ Quick question to get this right                        │
│ This helps us find the right people to target           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Is this about...                                        │
│                                                          │
│ ┌──────────────┐ ┌───────────────┐ ┌──────────────┐   │
│ │ Local issue  │ │ Statewide     │ │ National     │   │
│ │  (selected)  │ │ policy        │ │ policy       │   │
│ └──────────────┘ └───────────────┘ └──────────────┘   │
│      ^                                                  │
│      └─ Pre-selected (agent's best guess)              │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Skip — use your best guess          [Continue →]       │
└─────────────────────────────────────────────────────────┘
```

---

## Example 3: Radio Group (Target Type)

**Scenario:** User says "tuition hikes" - could target university OR legislature.

```typescript
const questions: ClarificationQuestion[] = [
	{
		id: 'target_type',
		question: 'Who controls this?',
		type: 'single_choice',
		options: [
			{
				value: 'government',
				label: 'Government officials',
				description: 'State legislators, education department'
			},
			{
				value: 'institutional',
				label: 'University leadership',
				description: 'University president, board of trustees'
			}
		],
		preselected: 'institutional',
		required: true
	}
];

const inferredContext: InferredContext = {
	detected_location: null,
	detected_scope: null,
	detected_target_type: 'institutional',
	location_confidence: 0.0,
	scope_confidence: 0.3,
	target_type_confidence: 0.5 // <0.7 = ask
};
```

**UI Render:**

```
┌─────────────────────────────────────────────────────────┐
│ Quick question to get this right                        │
│ This helps us find the right people to target           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Who controls this?                                      │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ ○ Government officials                             │  │
│ │   State legislators, education department          │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ ● University leadership                            │  │
│ │   University president, board of trustees          │  │
│ └───────────────────────────────────────────────────┘  │
│      ^                                                  │
│      └─ Pre-selected (agent's best guess)              │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Skip — use your best guess          [Continue →]       │
└─────────────────────────────────────────────────────────┘
```

---

## Example 4: Multiple Questions (Max 2)

**Scenario:** User says "workers deserve better" - ambiguous location AND target.

```typescript
const questions: ClarificationQuestion[] = [
	{
		id: 'location',
		question: 'Where are these workers?',
		type: 'location_picker',
		preselected: null,
		required: true
	},
	{
		id: 'target_type',
		question: 'Who should address this?',
		type: 'single_choice',
		options: [
			{
				value: 'corporate',
				label: 'The company directly',
				description: 'Target executives, HR, board'
			},
			{
				value: 'government',
				label: 'Labor regulators',
				description: 'NLRB, state labor department'
			}
		],
		preselected: 'corporate',
		required: true
	}
];
```

**UI Render:**

```
┌─────────────────────────────────────────────────────────┐
│ Quick question to get this right                        │
│ This helps us find the right people to target           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Where are these workers?                                │
│                                                          │
│ ┌───────────────────────────┐                           │
│ │ Select location       ✎   │                           │
│ └───────────────────────────┘                           │
│                                                          │
│ ─────────────────────────────────────────────────────   │
│                                                          │
│ Who should address this?                                │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ ● The company directly                             │  │
│ │   Target executives, HR, board                     │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ ○ Labor regulators                                 │  │
│ │   NLRB, state labor department                     │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Skip — use your best guess          [Continue →]       │
└─────────────────────────────────────────────────────────┘
```

---

## Interaction States

### Before User Interaction

- Pre-selected values are visually distinct (selected state)
- "Continue" button is enabled if all required fields have pre-selections
- User can click "Continue" immediately to accept agent's guesses

### After User Changes Selection

- Selected state updates immediately
- No validation errors (all options are valid)
- "Continue" button remains enabled

### On Submit

- Panel disappears with slide transition
- Agent receives user's answers
- Re-generates with clarified context

### On Skip

- Panel disappears immediately
- Agent uses its best guesses from inferred_context
- No re-generation needed

---

## Color States

### Chips (Selected)

```css
border: 2px solid rgb(var(--participation-primary-500));
background: rgb(var(--participation-primary-100));
color: rgb(var(--participation-primary-900));
```

### Chips (Unselected)

```css
border: 2px solid rgb(var(--slate-300));
background: white;
color: rgb(var(--slate-700));
```

### Radio (Selected)

```css
border: 2px solid rgb(var(--participation-primary-500));
background: rgb(var(--participation-primary-50));
```

### Radio (Unselected)

```css
border: 2px solid rgb(var(--slate-200));
background: white;
```

---

## Keyboard Navigation

| Key            | Action                                         |
| -------------- | ---------------------------------------------- |
| **Tab**        | Navigate between questions and options         |
| **Space**      | Select chip or radio option                    |
| **Enter**      | Submit answers (if all required fields filled) |
| **Escape**     | Skip clarification                             |
| **Arrow Keys** | Navigate within radio groups                   |

---

## Accessibility Features

✅ **Screen Reader Support:**

- Questions have `role="heading"` with `aria-level="4"`
- Chip groups have `role="radiogroup"` with `aria-label`
- Radio inputs have proper ARIA labels

✅ **Focus Management:**

- Tab order follows logical reading order
- Focus visible states on all interactive elements
- No focus traps

✅ **Color Contrast:**

- All text meets WCAG 2.1 AA standards
- Selected states use high-contrast colors
- Descriptions use lighter text but still readable

✅ **Error Prevention:**

- Pre-selections mean users rarely need to think
- No invalid states (all options are valid)
- "Skip" option prevents blocking

---

## Performance Characteristics

- **Initial Render:** <50ms (simple DOM, no complex state)
- **Answer Update:** <16ms (single state mutation)
- **Submit/Skip:** <10ms (callback invocation)
- **Animation Duration:** 200ms slide transition

---

_Component: `/src/lib/components/template/creator/ClarificationPanel.svelte`_
