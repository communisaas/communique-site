# Decision-Maker Resolution Integration Spec

**Agent**: Toolhouse Decision-Maker Resolver
**Agent ID**: `3004aca3-c465-498b-a1af-361d451aa7fc`
**Endpoint**: `https://agents.toolhouse.ai/3004aca3-c465-498b-a1af-361d451aa7fc`
**Status**: Design → Implementation
**Last Updated**: 2025-01-15

---

## Executive Summary

The Decision-Maker Resolution agent identifies the actual people with power to act on an issue. This is the critical second step in template creation, inserted AFTER objective definition and BEFORE content creation.

**Why this matters:**
- Most advocacy campaigns fail because they target the wrong person
- Finding decision-makers is time-consuming research (10-30 min manual work)
- AI can cross-reference organizational charts, public records, and news sources
- Provenance links build trust and verify accuracy

**User Experience:**
- User completes subject line + description (Step 1)
- Clicks "Next" → Agent resolves decision-makers (10-20s wait)
- User sees AI-identified contacts with verified provenance
- Can add/remove/modify before proceeding to content creation

---

## System Architecture

### Flow Integration

```
Template Creator Flow (Before):
Step 1: Objective → Step 2: Audience → Step 3: Content → Step 4: Review

Template Creator Flow (After):
Step 1: Objective → Step 2: Decision-Maker Resolution → Step 3: Content → Step 4: Review
```

**Step 1: Objective**
- Subject line (AI-assisted or manual)
- Description
- Category
- URL slug

**Step 2: Decision-Maker Resolution (NEW)**
- Automatic: Agent resolves decision-makers based on Step 1 data
- User review: Can add/remove/modify contacts
- Congressional option: Checkbox to include user's reps
- One-time only: User can't re-run agent (must manually edit)

**Step 3: Content**
- Message body creation
- Variable customization
- Preview

**Step 4: Review**
- Final verification
- Publish

### Data Flow

```typescript
// Input to Decision-Maker Agent
interface DecisionMakerRequest {
  subject_line: string;    // From formData.objective.title
  core_issue: string;      // From formData.objective.description
  domain: string;          // From formData.objective.category (lowercase)
  url_slug?: string;       // From formData.objective.slug (optional context)
}

// Output from Decision-Maker Agent
interface DecisionMakerResponse {
  decision_makers: Array<{
    name: string;
    title: string;
    organization: string;
    email?: string;
    provenance: string;      // Full verification text with embedded URL
  }>;
  runId?: string;            // For conversation continuity (not used in this integration)
}

// Processed for frontend
interface ProcessedDecisionMaker {
  name: string;
  title: string;
  organization: string;
  email?: string;
  provenance: string;        // Full text from agent
  reasoning: string;         // Extracted: why this person matters
  source?: string;           // Extracted: verification URL
  powerLevel?: 'primary' | 'secondary' | 'supporting'; // Inferred from position
}

// Stored in formData
interface AudienceFormData {
  decisionMakers: ProcessedDecisionMaker[];
  recipientEmails: string[];  // Extracted from decisionMakers + manual additions
  includesCongress: boolean;
  customRecipients: Array<{
    email: string;
    name: string;
    organization?: string;
  }>;
}
```

### Fork Handling: AI vs Manual Subject Lines

**Path A: User selected AI-generated subject line**
```typescript
// formData.objective.aiGenerated = true
// Already have structured output from subject-line agent
const request = {
  subject_line: formData.objective.title,
  core_issue: formData.objective.description,
  domain: formData.objective.category.toLowerCase(),
  url_slug: formData.objective.slug
};

// Single API call → immediate transition to resolution UI
```

**Path B: User wrote their own subject line**
```typescript
// formData.objective.aiGenerated = false
// Need to structure the input first

// Option 1: Quick structure pass (RECOMMENDED)
// 1. Show "Analyzing your issue..." (1-2s)
// 2. Call subject-line agent to get structured output
// 3. Use structured output for decision-maker agent
// 4. Show "Finding decision-makers..." (10-20s)

// Option 2: Pass through unstructured (FALLBACK)
// Decision-maker agent handles unstructured input
// Single API call, simpler flow
```

**Implementation: Two-stage with seamless UX**

```svelte
<script>
let stage = $state<'structuring' | 'resolving' | 'results'>('structuring');

async function resolveDecisionMakers() {
  if (!formData.objective.aiGenerated) {
    // Path B: Structure first
    stage = 'structuring';
    const structured = await structureIssue(formData.objective);
    formData.objective = { ...formData.objective, ...structured };
  }

  // Both paths: Resolve decision-makers
  stage = 'resolving';
  const result = await api.post('/toolhouse/resolve-decision-makers', {
    subject_line: formData.objective.title,
    core_issue: formData.objective.description,
    domain: formData.objective.category.toLowerCase(),
    url_slug: formData.objective.slug
  });

  formData.audience.decisionMakers = processDecisionMakers(result.data);
  stage = 'results';
}
</script>

{#if stage === 'structuring'}
  <!-- Brief: 1-2 seconds -->
  <div class="analyzing">
    <Loader />
    <p>Analyzing your issue...</p>
  </div>
{:else if stage === 'resolving'}
  <!-- Main wait: 10-20 seconds -->
  <AnticipationBuilder />
{:else if stage === 'results'}
  <DecisionMakerResults />
{/if}
```

---

## UX Design Specifications

### 1. Anticipation Builder (During Resolution)

**Challenge**: No progress updates from Toolhouse (10-20 second wait)

**Solution**: Make the wait meaningful, not just tolerable

**Design Pattern**: Educational phases + organic animation

```
┌─────────────────────────────────────────────┐
│                                             │
│   Finding who can actually fix this        │
│                                             │
│   [●] Analyzing issue context              │
│   [○] Identifying power structures         │
│   [○] Cross-referencing authority          │
│   [○] Validating contact pathways          │
│                                             │
│   Most campaigns fail because they target  │
│   the wrong person. We're finding who      │
│   actually has the power to act.           │
│                                             │
│   This takes 10-20 seconds. Worth it.      │
│                                             │
└─────────────────────────────────────────────┘
```

**Phases (cycle every 3-5 seconds, not tied to actual progress):**

1. **Analyzing issue context** (Search icon)
   - What: Understanding the problem domain
   - Visual: Pulsing center node

2. **Identifying power structures** (Building icon)
   - What: Mapping organizational hierarchies
   - Visual: Network nodes appearing

3. **Cross-referencing authority** (Users icon)
   - What: Finding who has decision-making power
   - Visual: Connections forming

4. **Validating contact pathways** (CheckCircle icon)
   - What: Verifying email addresses and roles
   - Visual: Nodes solidifying

**Educational Context (rotates or static):**
- "Most campaigns fail because they target the wrong person"
- "We're finding who actually has the power to act"
- "This takes 10-20 seconds. Worth it."
- "Checking organizational charts and public records"

**Visual Style:**
- Clean, confident, not anxious
- Organic animation (not mechanical progress bars)
- Monochrome or subtle color (not garish)
- Feels like research happening, not fake loading

### 2. Decision-Maker Results (After Resolution)

**Initial View: Compact Cards**

```
┌─────────────────────────────────────────────┐
│ We found 6 decision-makers                  │
├─────────────────────────────────────────────┤
│                                             │
│ [✓] Udit Madan                              │
│     VP, Worldwide Operations • Amazon       │
│                                             │
│ [✓] Beth Galetti                            │
│     SVP, People eXperience • Amazon         │
│                                             │
│ [✓] Drew Herdener                           │
│     SVP, Communications • Amazon            │
│                                             │
│ [+] Add another decision-maker              │
│                                             │
│ [ ] Also send to my congressional reps     │
│                                             │
│ [Next →]                                    │
└─────────────────────────────────────────────┘
```

**Expanded Card (click to expand):**

```
┌─────────────────────────────────────────────┐
│ [✓] Udit Madan                              │
│     VP, Worldwide Operations • Amazon       │
│                                             │
│     Why this matters:                       │
│     Directly responsible for logistics,     │
│     delivery, and driver operations.        │
│                                             │
│     [📧 uditmadan@amazon.com]               │
│     [→ View source] [✕ Remove]              │
└─────────────────────────────────────────────┘
```

**Email Click → Provenance Popover:**

```
┌─────────────────────────────────────────────┐
│ Contact Details                             │
│                                             │
│ Udit Madan                                  │
│ uditmadan@amazon.com                        │
│                                             │
│ How we verified this:                       │
│ • Confirmed via Amazon's S-team page        │
│ • Email format verified via Amazon exec     │
│   conventions and public disclosures        │
│                                             │
│ Source:                                     │
│ https://aboutamazon.com/news/workplace      │
│                                             │
│ [→ View source]  [Copy email]  [✕ Close]    │
└─────────────────────────────────────────────┘
```

### 3. Progressive Disclosure Pattern

**Level 1: Name + Title + Organization**
- User sees: "These look legit"
- Trust signal: Green checkmark
- Action: Click to expand

**Level 2: Why This Matters (Reasoning)**
- User sees: "Oh, they're the right people"
- Trust signal: Clear explanation of authority
- Action: Click email to see provenance

**Level 3: Full Provenance + Source**
- User sees: "Holy shit, this is real research"
- Trust signal: Verification methodology + URL
- Action: View source or copy email

**Design Principle**: No overwhelming wall of text. Information revealed as user needs it.

### 4. Manual Additions

**Add Custom Decision-Maker:**

```
┌─────────────────────────────────────────────┐
│ Add a decision-maker                        │
│                                             │
│ Name:         [________________]            │
│ Title:        [________________]            │
│ Organization: [________________]            │
│ Email:        [________________]            │
│                                             │
│ [Add]  [Cancel]                             │
└─────────────────────────────────────────────┘
```

**Validation:**
- Email required
- Name required
- Title/Organization optional but encouraged

**Visual Distinction:**
- AI-resolved: Green checkmark
- Manually added: User icon (neutral)

### 5. Congressional Integration

**Checkbox (bottom of decision-maker list):**

```
[ ] Also send to my congressional representatives
```

**Behavior:**
- Checked: Adds `__CONGRESSIONAL__` marker to recipientEmails
- Unchecked: Removes marker
- No impact on decision-maker list (separate concern)

**Copy:**
- Label: "Also send to my congressional representatives"
- Tooltip: "Your message will be sent via certified delivery to your House rep and both Senators"

---

## Technical Implementation

### 1. API Endpoint

**File**: `src/routes/api/toolhouse/resolve-decision-makers/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TOOLHOUSE_AGENT_ID = '3004aca3-c465-498b-a1af-361d451aa7fc';
const TOOLHOUSE_API_BASE = 'https://agents.toolhouse.ai';

interface DecisionMakerRequest {
	subject_line: string;
	core_issue: string;
	domain: string;
	url_slug?: string;
}

interface DecisionMakerResponse {
	decision_makers: Array<{
		name: string;
		title: string;
		organization: string;
		email?: string;
		provenance: string;
	}>;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Authentication required
		const session = locals.session;
		if (!session?.userId) {
			throw error(401, 'Authentication required');
		}

		const body = (await request.json()) as DecisionMakerRequest;
		const { subject_line, core_issue, domain, url_slug } = body;

		if (!subject_line?.trim() || !core_issue?.trim()) {
			throw error(400, 'Subject line and core issue are required');
		}

		console.log('[DecisionMaker] Resolving decision-makers:', {
			userId: session.userId,
			subject_line,
			domain
		});

		// Build headers with auth
		const apiKey = process.env.TOOLHOUSE_API_KEY;
		if (!apiKey) {
			console.error('[DecisionMaker] TOOLHOUSE_API_KEY not found');
			throw error(500, 'Toolhouse API key not configured');
		}

		// Call Toolhouse agent
		const response = await fetch(`${TOOLHOUSE_API_BASE}/${TOOLHOUSE_AGENT_ID}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				message: JSON.stringify({
					subject_line,
					core_issue,
					domain,
					url_slug
				})
			})
		});

		if (!response.ok) {
			console.error('[DecisionMaker] Agent call failed:', {
				status: response.status,
				statusText: response.statusText
			});
			throw error(500, 'Failed to resolve decision-makers');
		}

		// Parse response (handle streaming like subject-line agent)
		const text = await response.text();
		console.log('[DecisionMaker] Raw response:', text.substring(0, 500));

		let result: DecisionMakerResponse;
		try {
			result = JSON.parse(text);
		} catch {
			// Handle streaming/newline-delimited JSON
			const lines = text.split('\n').filter((line) => line.trim());
			let lastValidJson: DecisionMakerResponse | null = null;

			for (const line of lines) {
				try {
					const parsed = JSON.parse(line);
					if (parsed && typeof parsed === 'object') {
						lastValidJson = parsed as DecisionMakerResponse;
					}
				} catch {
					// Skip non-JSON lines
				}
			}

			if (lastValidJson) {
				result = lastValidJson;
			} else {
				throw error(500, 'Failed to parse agent response');
			}
		}

		console.log('[DecisionMaker] Resolved decision-makers:', {
			userId: session.userId,
			count: result.decision_makers?.length || 0
		});

		return json(result);
	} catch (err) {
		console.error('[DecisionMaker] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to resolve decision-makers');
	}
};
```

### 2. Type Definitions

**File**: `src/lib/types/template.ts` (extend existing)

```typescript
// Add to existing TemplateFormData interface
export interface TemplateFormData {
	objective: {
		title: string;
		description: string;
		category: string;
		slug?: string;
		aiGenerated?: boolean;
	};
	audience: {
		decisionMakers: ProcessedDecisionMaker[];
		recipientEmails: string[];
		includesCongress: boolean;
		customRecipients: CustomRecipient[];
	};
	content: {
		preview: string;
		variables: string[];
	};
	review: Record<string, never>;
}

// New interfaces
export interface ProcessedDecisionMaker {
	name: string;
	title: string;
	organization: string;
	email?: string;
	provenance: string;
	reasoning: string;
	source?: string;
	powerLevel?: 'primary' | 'secondary' | 'supporting';
	isAiResolved: boolean; // vs manually added
}

export interface CustomRecipient {
	email: string;
	name: string;
	organization?: string;
}
```

### 3. Helper Functions

**File**: `src/lib/utils/decision-maker-processing.ts`

```typescript
import type { ProcessedDecisionMaker } from '$lib/types/template';

/**
 * Process raw decision-maker data from Toolhouse agent
 */
export function processDecisionMakers(
	rawDecisionMakers: Array<{
		name: string;
		title: string;
		organization: string;
		email?: string;
		provenance: string;
	}>
): ProcessedDecisionMaker[] {
	return rawDecisionMakers.map((dm) => ({
		...dm,
		reasoning: extractReasoning(dm.provenance),
		source: extractSource(dm.provenance),
		powerLevel: inferPowerLevel(dm.title),
		isAiResolved: true
	}));
}

/**
 * Extract reasoning (why this person matters) from provenance
 * Returns text before "Source:" or first sentence
 */
export function extractReasoning(provenance: string): string {
	const parts = provenance.split(/Source:|Email format verified/);
	const reasoning = parts[0].trim();

	// Return first sentence or first 150 chars
	const firstSentence = reasoning.match(/^[^.!?]+[.!?]/);
	if (firstSentence) {
		return firstSentence[0];
	}

	return reasoning.substring(0, 150) + (reasoning.length > 150 ? '...' : '');
}

/**
 * Extract verification URL from provenance
 */
export function extractSource(provenance: string): string | undefined {
	const urlMatch = provenance.match(/https?:\/\/[^\s)]+/);
	return urlMatch?.[0];
}

/**
 * Infer power level from job title
 */
export function inferPowerLevel(
	title: string
): 'primary' | 'secondary' | 'supporting' {
	const titleLower = title.toLowerCase();

	if (
		titleLower.includes('ceo') ||
		titleLower.includes('president') ||
		titleLower.includes('chief')
	) {
		return 'primary';
	}

	if (
		titleLower.includes('vice president') ||
		titleLower.includes('director') ||
		titleLower.includes('head of')
	) {
		return 'secondary';
	}

	return 'supporting';
}

/**
 * Convert decision-makers to recipient emails for template
 */
export function extractRecipientEmails(
	decisionMakers: ProcessedDecisionMaker[],
	customRecipients: CustomRecipient[],
	includesCongress: boolean
): string[] {
	const emails: string[] = [];

	// AI-resolved decision-makers
	decisionMakers.forEach((dm) => {
		if (dm.email) emails.push(dm.email);
	});

	// Custom recipients
	customRecipients.forEach((cr) => {
		emails.push(cr.email);
	});

	// Congressional marker
	if (includesCongress) {
		emails.push('__CONGRESSIONAL__');
	}

	return emails;
}
```

### 4. Component Architecture

**Components to create:**

1. **`DecisionMakerResolver.svelte`** - Main orchestrator
   - Handles two-stage flow (structuring → resolution)
   - Shows AnticipationBuilder during wait
   - Shows DecisionMakerResults after completion
   - Integrates with TemplateCreator step flow

2. **`AnticipationBuilder.svelte`** - Loading experience
   - Cycling phase indicators
   - Educational context
   - Organic animation (no fake progress)

3. **`DecisionMakerResults.svelte`** - Results display
   - List of DecisionMakerCard components
   - Add custom decision-maker button
   - Congressional checkbox
   - Next button

4. **`DecisionMakerCard.svelte`** - Individual contact card
   - Compact view: name, title, org, checkmark
   - Expanded view: + reasoning, email, source link
   - Provenance popover on email click
   - Remove button

5. **`CustomDecisionMakerForm.svelte`** - Manual entry
   - Name, title, organization, email inputs
   - Validation
   - Add/Cancel actions

6. **`ProvenancePopover.svelte`** - Contact details + verification
   - Full contact info
   - Provenance explanation
   - Source link
   - Copy email button

**Integration point:**
- `src/lib/components/template/creator/DecisionMakerResolver.svelte`
- Imported into `TemplateCreator.svelte` as step 2

---

## Implementation Checklist

### Phase 1: Backend & Data Flow
- [ ] Create API endpoint `/api/toolhouse/resolve-decision-makers/+server.ts`
- [ ] Add type definitions to `src/lib/types/template.ts`
- [ ] Create helper functions in `src/lib/utils/decision-maker-processing.ts`
- [ ] Test API endpoint with real Toolhouse agent
- [ ] Verify response parsing (handle streaming JSON)

### Phase 2: Core Components
- [ ] Build `AnticipationBuilder.svelte`
  - Phase cycling logic (3-5s intervals)
  - Educational context rotation
  - Visual animation (organic, not mechanical)
- [ ] Build `DecisionMakerCard.svelte`
  - Compact view
  - Expanded view (reasoning, email, source)
  - Provenance popover trigger
  - Remove functionality
- [ ] Build `ProvenancePopover.svelte`
  - Contact details display
  - Provenance text formatting
  - Source link
  - Copy email action
- [ ] Build `CustomDecisionMakerForm.svelte`
  - Input fields with validation
  - Add/Cancel actions
  - Integration with parent state

### Phase 3: Main Orchestrator
- [ ] Build `DecisionMakerResolver.svelte`
  - Two-stage flow handling (structuring → resolution)
  - AnticipationBuilder integration
  - DecisionMakerResults integration
  - State management (stage transitions)
- [ ] Build `DecisionMakerResults.svelte`
  - List rendering
  - Custom recipient management
  - Congressional checkbox
  - Email extraction logic
  - Next button integration

### Phase 4: Template Creator Integration
- [ ] Update `TemplateCreator.svelte`
  - Add DecisionMakerResolver as step 2
  - Update step progression logic
  - Handle formData.audience population
  - Update validation for audience step
- [ ] Update navigation
  - "Next" from Objective → triggers resolution
  - "Back" from Content → returns to DecisionMakerResults
  - Preserve state across navigation
- [ ] Update formData initialization
  - Ensure audience object exists
  - Set default values

### Phase 5: Edge Cases & Polish
- [ ] Handle AI-generated vs manual subject lines
  - Test both paths
  - Ensure seamless UX for manual entries
- [ ] Handle empty results (agent finds no decision-makers)
  - Show helpful message
  - Allow manual entry only
- [ ] Handle API failures
  - Show error message
  - Allow retry or manual entry
- [ ] Handle congressional checkbox edge cases
  - Persists across editing
  - Integrates with recipient list
- [ ] Test decision-maker removal
  - Doesn't break recipient list
  - Can re-add manually
- [ ] Test custom recipient addition
  - Validates email format
  - Prevents duplicates

### Phase 6: Testing & QA
- [ ] Unit tests for helper functions
  - `extractReasoning()`
  - `extractSource()`
  - `inferPowerLevel()`
  - `extractRecipientEmails()`
- [ ] Integration tests for API endpoint
  - Successful resolution
  - Streaming response parsing
  - Error handling
- [ ] E2E tests for full flow
  - AI-generated subject → resolution → results
  - Manual subject → structuring → resolution → results
  - Add/remove decision-makers
  - Congressional checkbox
- [ ] Manual QA
  - Test with real Toolhouse agent
  - Verify provenance popover UX
  - Test progressive disclosure
  - Mobile responsiveness

### Phase 7: Documentation & Cleanup
- [ ] Update `docs/hackathon/toolhouse-integration.md` (or create new doc)
- [ ] Add inline code comments
- [ ] Update `CLAUDE.md` with new flow
- [ ] Clean up console logs (keep meaningful ones)
- [ ] Update `.env.example` if needed

---

## Success Criteria

### Functional Requirements
- ✅ User can proceed from Objective to Decision-Maker Resolution
- ✅ Agent resolves decision-makers in 10-30 seconds
- ✅ Results display with name, title, organization, verified badge
- ✅ User can expand cards to see reasoning and contact details
- ✅ User can view full provenance in popover
- ✅ User can add custom decision-makers manually
- ✅ User can remove AI-resolved or custom decision-makers
- ✅ User can include congressional representatives via checkbox
- ✅ Recipient list correctly reflects all selections
- ✅ Flow handles both AI-generated and manual subject lines

### UX Requirements
- ✅ Wait experience is educational and engaging (not anxious)
- ✅ Progressive disclosure builds trust without overwhelming
- ✅ Provenance is accessible but not intrusive
- ✅ Manual additions are easy and intuitive
- ✅ Congressional integration is clear and optional
- ✅ Mobile-responsive across all breakpoints

### Technical Requirements
- ✅ API endpoint handles streaming responses correctly
- ✅ Type safety throughout (no `any` types)
- ✅ Error handling for API failures
- ✅ State management preserves data across navigation
- ✅ No console errors or warnings
- ✅ Performance: resolution completes in < 30 seconds

---

## Design Assets Needed

### Icons
- Search (analyzing)
- Building (power structures)
- Users (authority)
- CheckCircle (validation)
- Mail (email)
- ExternalLink (source)
- Plus (add recipient)
- X (remove recipient)

### Illustrations (Optional)
- Network graph animation for AnticipationBuilder
- Nodes connecting organically
- Not required, can launch with icon-based phases

### Copy
- Educational context phrases (4-5 variations)
- Error messages
- Empty state messages
- Help text / tooltips

---

## Open Questions

### 1. Re-running the agent
**Q**: Can user re-run the agent if results are bad?
**A**: No. One-time only. Must manually edit after that.
**Reasoning**: Prevents API abuse, encourages thoughtful input.

### 2. Minimum decision-makers
**Q**: What if agent returns 0 results?
**A**: Show message: "We couldn't find verified decision-makers for this issue. Add contacts manually."
**Fallback**: Allow manual entry only.

### 3. Maximum decision-makers
**Q**: Cap on how many decision-makers to show?
**A**: No hard cap. Display all results from agent.
**UX**: If > 10 results, consider "Show more" pattern.

### 4. Duplicate email detection
**Q**: Prevent duplicate emails?
**A**: Yes. When adding custom recipient, check against existing emails.
**UX**: Show message: "This email is already in your recipient list."

### 5. Email validation
**Q**: Validate email format for custom recipients?
**A**: Yes. Basic regex validation.
**Pattern**: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### 6. Power level display
**Q**: Show power level indicator (primary/secondary/supporting)?
**A**: Optional. Could show with badge color or icon.
**Decision**: Start without, add if user testing shows need.

### 7. Source link trust
**Q**: How to handle broken or suspicious source URLs?
**A**: Display as-is. User can verify independently.
**Security**: Open in new tab (`target="_blank" rel="noopener noreferrer"`).

---

## Future Enhancements (Post-Hackathon)

### 1. Re-run Agent
- Allow user to re-run with modified input
- Track number of runs (rate limit)

### 2. Decision-Maker Profiles
- Cache verified decision-makers in database
- Auto-suggest from cache for similar issues
- Build institutional knowledge graph

### 3. Confidence Scores
- Agent returns confidence per decision-maker
- Display with visual indicator
- Filter by minimum confidence

### 4. Contact Verification
- Ping email addresses to verify deliverability
- Flag bounced/invalid emails
- Suggest corrections

### 5. Impact Tracking
- Track which decision-makers respond
- Surface highest-impact contacts
- Recommend based on response rates

### 6. Multi-language Support
- Agent resolves decision-makers in user's language
- Provenance translated
- International contact resolution

---

## Appendix: Example Data

### Input (from Objective step)
```json
{
  "subject_line": "Amazon Drivers Forced to Piss in Bottles While Bezos Makes $2.5M/Hour",
  "core_issue": "Amazon drivers forced to piss in bottles. Warehouse workers collapsing from heat. Bezos making $2.5M/hour while this happens.",
  "domain": "corporate",
  "url_slug": "amazon-driver-conditions"
}
```

### Output (from Toolhouse agent)
```json
{
  "decision_makers": [
    {
      "name": "Udit Madan",
      "title": "Vice President, Worldwide Operations",
      "organization": "Amazon",
      "email": "uditmadan@amazon.com",
      "provenance": "Udit Madan is the current VP of Worldwide Operations at Amazon, directly responsible for logistics, delivery, and driver operations. His role and contact are confirmed via Amazon's S-team leadership page and multiple leadership updates. Email format verified via Amazon executive conventions and public disclosures. Source: https://www.aboutamazon.com/news/workplace/amazon-s-team-members"
    },
    {
      "name": "Beth Galetti",
      "title": "Senior Vice President, People eXperience and Technology (PXT)",
      "organization": "Amazon",
      "email": "bgaletti@amazon.com",
      "provenance": "Beth Galetti leads Amazon's global HR and workforce development, including workplace safety and labor conditions. Her role is confirmed on Amazon's S-team page. Email format verified via Amazon executive conventions and public disclosures. Source: https://www.aboutamazon.com/news/workplace/amazon-s-team-members"
    },
    {
      "name": "Drew Herdener",
      "title": "Senior Vice President, Communications & Corporate Responsibility",
      "organization": "Amazon",
      "email": "dherdene@amazon.com",
      "provenance": "Drew Herdener oversees Amazon's global communications, including labor and workplace issues. His role is confirmed on Amazon's S-team page. Email format verified via Amazon executive conventions and public disclosures. Source: https://www.aboutamazon.com/news/workplace/amazon-s-team-members"
    },
    {
      "name": "Amazon Press Office",
      "title": "Corporate Press Contact",
      "organization": "Amazon",
      "email": "amazon-pr@amazon.com",
      "provenance": "This is the official Amazon press office email for corporate and labor-related media inquiries, as listed on the Amazon Press Center. Source: https://press.aboutamazon.com/contact-us"
    },
    {
      "name": "Chelsea Connor",
      "title": "Communications Director",
      "organization": "BAmazon Union (RWDSU)",
      "email": "cconnor@rwdsu.org",
      "provenance": "Chelsea Connor is the press contact for the BAmazon Union, which represents Amazon warehouse workers and advocates for labor rights. Email listed on the official union contact page. Source: https://bamazonunion.org/contact"
    },
    {
      "name": "Amazon Labor Union",
      "title": "Worker Support and Organizing",
      "organization": "Amazon Labor Union",
      "email": "info@amazonlaborunion.org",
      "provenance": "This is the direct contact for the Amazon Labor Union, which organizes and supports Amazon delivery and warehouse workers. Email listed on the official union resources page. Source: https://www.amazonlaborunion.org/resources"
    }
  ]
}
```

### Processed (for frontend)
```typescript
const processed: ProcessedDecisionMaker[] = [
  {
    name: "Udit Madan",
    title: "Vice President, Worldwide Operations",
    organization: "Amazon",
    email: "uditmadan@amazon.com",
    provenance: "Udit Madan is the current VP of Worldwide Operations at Amazon...",
    reasoning: "Directly responsible for logistics, delivery, and driver operations.",
    source: "https://www.aboutamazon.com/news/workplace/amazon-s-team-members",
    powerLevel: "secondary",
    isAiResolved: true
  },
  // ... rest
];
```

---

## End of Specification

**Next Steps**: Begin implementation with Phase 1 (Backend & Data Flow)

**Questions**: Ping Elizabeth or check implementation notes in this doc.

**Status Updates**: Update checklist as tasks complete.
