# Message Generation Integration Spec

**Agent**: Toolhouse Message Generator
**Agent ID**: `fb9e5f19-cb4d-4a0d-8e6f-31337c253893`
**Endpoint**: `https://toolhouse.app/fb9e5f19-cb4d-4a0d-8e6f-31337c253893`
**Status**: Design → Implementation
**Last Updated**: 2025-01-16

---

## Executive Summary

The Message Generator agent writes the actual message content—the thing that gets sent. This is the third step in template creation, inserted AFTER decision-maker resolution and BEFORE review.

**Why this matters:**
- Most people freeze when staring at a blank text box
- Research takes 20-60 minutes (finding sources, citations, formatting)
- AI can synthesize issue description + decision-makers into actionable message
- Sources provide credibility and verifiability

**User Experience:**
- User completes decision-makers (Step 2)
- Clicks "Next" → Agent generates message (15-30s wait)
- User sees formatted message with inline citations
- Can edit, regenerate sections, or write from scratch
- Sources preserved and displayed

---

## System Architecture

### Flow Integration

```
Template Creator Flow:
Step 1: Objective → Step 2: Decision-Makers → Step 3: Message Generation → Step 4: Review
```

**Step 3: Message Generation (NEW)**
- Automatic: Agent generates message based on Steps 1 & 2
- User review: Can edit, regenerate, or start fresh
- Citations: Inline source references with expandable details
- One-time generation: Agent runs once, then user edits manually

### Data Flow

```typescript
// Input to Message Generation Agent
interface MessageGenerationRequest {
  subject_line: string;           // From formData.objective.title
  core_issue: string;              // From formData.objective.description
  decision_makers: Array<{         // From formData.audience.decisionMakers
    name: string;
    title: string;
    organization: string;
  }>;
  includes_congress: boolean;      // From formData.audience.includesCongress
}

// Output from Message Generation Agent
interface MessageGenerationResponse {
  message: string;                 // Full formatted message with [1][2] citations
  subject: string;                 // Refined subject line (may differ from input)
  sources: Array<{
    num: number;                   // Citation number [1], [2], etc.
    title: string;                 // Article/document title
    url: string;                   // Source URL
    type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy';
  }>;
  research_log: string[];          // Agent's research process (for transparency)
}

// Processed for frontend
interface ProcessedMessage {
  content: string;                 // Message with citations preserved
  sources: Source[];               // Structured source list
  researchLog: string[];           // How agent found sources
  generatedAt: number;             // Timestamp
  edited: boolean;                 // Has user manually edited?
}

// Stored in formData
interface ContentFormData {
  preview: string;                 // Full message content
  variables: string[];             // Template variables (optional)
  sources: Source[];               // Citation sources
  researchLog: string[];           // Research transparency
  generatedAt?: number;            // When message was generated
  edited: boolean;                 // Manual edit flag
}
```

### Agent Input Construction

The agent needs context from previous steps:

```typescript
function buildMessageRequest(formData: TemplateFormData): MessageGenerationRequest {
  return {
    subject_line: formData.objective.title,
    core_issue: formData.objective.description,
    decision_makers: formData.audience.decisionMakers.map(dm => ({
      name: dm.name,
      title: dm.title,
      organization: dm.organization
    })),
    includes_congress: formData.audience.includesCongress
  };
}
```

---

## UX Design Specifications

### 1. Anticipation Builder (During Generation)

**Challenge**: 15-30 second wait for agent to research + write

**Solution**: Show what the agent is actually doing (research log streams)

**Design Pattern**: Real-time research transparency

```
┌─────────────────────────────────────────────┐
│                                             │
│   Researching and writing your message     │
│                                             │
│   [●] Searching for recent sources         │
│   [●] Verifying facts and citations        │
│   [○] Drafting message structure           │
│   [○] Finalizing with sources              │
│                                             │
│   Research log:                             │
│   • Searched for 'Amazon drivers forced    │
│     to pee in bottles 2024'                │
│   • Fetched LAist, Metro UK, Forbes        │
│   • Extracted quotes and lawsuit details   │
│                                             │
│   This takes 15-30 seconds. Worth it.      │
│                                             │
└─────────────────────────────────────────────┘
```

**Phases (cycle every 5 seconds, OR stream research_log in real-time if available):**

1. **Searching for recent sources** (Search icon)
   - What: Finding credible journalism, reports, documents
   - Visual: Pulsing search animation

2. **Verifying facts and citations** (CheckCircle icon)
   - What: Cross-referencing claims, validating sources
   - Visual: Checkmark animations

3. **Drafting message structure** (FileText icon)
   - What: Building argument, organizing citations
   - Visual: Document filling in

4. **Finalizing with sources** (ExternalLink icon)
   - What: Adding inline citations, formatting
   - Visual: Links connecting

**Research Log Stream (if available):**
- Display `research_log` array from agent response
- Real-time updates as agent works
- Shows actual research process (transparency)

### 2. Message Results (After Generation)

**Initial View: Formatted Message with Citations**

```
┌─────────────────────────────────────────────┐
│ Your message is ready                       │
├─────────────────────────────────────────────┤
│                                             │
│ On November 29, 2024, LAist documented     │
│ the daily reality for Amazon delivery      │
│ drivers in Los Angeles: nearly a dozen     │
│ bottles of urine were found outside an     │
│ Amazon warehouse in Atwater Village [1].   │
│                                             │
│ Kelly Chemidlin, a former Amazon driver,   │
│ described peeing in bottles as             │
│ 'incredibly common,' saying, 'It           │
│ definitely made me feel a little like,     │
│ you know, less than—very much just like    │
│ an object' [2].                             │
│                                             │
│ This is a crisis of dignity, health, and   │
│ basic human rights. Amazon must            │
│ immediately:                                │
│ - Guarantee all delivery drivers           │
│   scheduled, protected bathroom breaks     │
│ - Redesign delivery routes to allow for    │
│   safe, regular access to restrooms        │
│ - Publicly report on progress              │
│                                             │
│ Set a 90-day deadline for concrete,        │
│ transparent improvements.                  │
│                                             │
│ [Edit message]  [Start from scratch]       │
└─────────────────────────────────────────────┘

Sources (3):
[1] Amazon drivers in LA say there's rarely...
    https://laist.com/news/amazon-drivers...

[2] Inside the 'never-ending nightmare'...
    https://metro.co.uk/2025/09/24/inside...

[3] Delivery Drivers Sue Amazon For Being...
    https://www.forbes.com/sites/katherine...
```

**Editable Mode:**

```
┌─────────────────────────────────────────────┐
│ Edit your message                           │
├─────────────────────────────────────────────┤
│                                             │
│ [Rich text editor with formatting]          │
│                                             │
│ On November 29, 2024, LAist documented     │
│ the daily reality for Amazon delivery      │
│ drivers in Los Angeles...                  │
│                                             │
│ Toolbar:                                    │
│ [B] [I] [Link] [List] [Quote]              │
│                                             │
│ [Preview]  [Save changes]  [Cancel]        │
└─────────────────────────────────────────────┘
```

### 3. Citation Interaction Pattern

**Inline Citations:**
- `[1]` `[2]` `[3]` as superscript links
- Hover: Show source title in tooltip
- Click: Scroll to source list + highlight

**Source List:**
- Numbered to match inline citations
- Click to expand full details
- "View source ↗" opens in new tab
- Copy URL button

**Source Card (Expanded):**

```
┌─────────────────────────────────────────────┐
│ [1] Amazon drivers in LA say there's       │
│     rarely time to use a bathroom           │
│                                             │
│ Type: Journalism                            │
│ Source: LAist                               │
│                                             │
│ https://laist.com/news/amazon-drivers-in-  │
│ la-time-pressure-bathroom-bottle           │
│                                             │
│ [→ View source]  [Copy URL]                 │
└─────────────────────────────────────────────┘
```

### 4. Research Log Display

**Transparency Panel (Collapsible):**

```
┌─────────────────────────────────────────────┐
│ How we researched this                      │
├─────────────────────────────────────────────┤
│                                             │
│ 1. Searched for 'Amazon drivers forced to  │
│    pee in bottles 2024'                     │
│                                             │
│ 2. Fetched and extracted content from      │
│    LAist, Metro UK, and Forbes articles     │
│                                             │
│ 3. Extracted direct quotes, lawsuit        │
│    details, and Amazon's public statements  │
│                                             │
└─────────────────────────────────────────────┘
```

**Why show this:**
- Builds trust (user sees agent's actual research)
- Educational (shows how to research issues)
- Verifiable (user can audit agent's process)

### 5. Edit vs Regenerate

**Edit (Recommended):**
- Opens rich text editor
- Preserves citations and sources
- User makes incremental changes
- Marks message as `edited: true`

**Start from Scratch:**
- Clears generated content
- Opens blank editor
- User writes entirely manually
- No sources preserved

**Regenerate (Not Implemented - Future):**
- Could re-run agent with different prompt
- Expensive (costs API call)
- Not included in v1

---

## Technical Implementation

### 1. API Endpoint

**File**: `src/routes/api/toolhouse/generate-message/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TOOLHOUSE_AGENT_ID = 'fb9e5f19-cb4d-4a0d-8e6f-31337c253893';
const TOOLHOUSE_API_BASE = 'https://toolhouse.app';

interface MessageGenerationRequest {
	subject_line: string;
	core_issue: string;
	decision_makers: Array<{
		name: string;
		title: string;
		organization: string;
	}>;
	includes_congress: boolean;
}

interface MessageGenerationResponse {
	message: string;
	subject: string;
	sources: Array<{
		num: number;
		title: string;
		url: string;
		type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy';
	}>;
	research_log: string[];
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Authentication required
		const session = locals.session;
		if (!session?.userId) {
			throw error(401, 'Authentication required');
		}

		const body = (await request.json()) as MessageGenerationRequest;
		const { subject_line, core_issue, decision_makers, includes_congress } = body;

		if (!subject_line?.trim() || !core_issue?.trim()) {
			throw error(400, 'Subject line and core issue are required');
		}

		console.log('[MessageGenerator] Generating message:', {
			userId: session.userId,
			subject_line: subject_line.substring(0, 50),
			decision_makers_count: decision_makers.length,
			includes_congress
		});

		// Build headers with auth
		const apiKey = process.env.TOOLHOUSE_API_KEY;
		if (!apiKey) {
			console.error('[MessageGenerator] TOOLHOUSE_API_KEY not found');
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
					decision_makers,
					includes_congress
				})
			})
		});

		if (!response.ok) {
			console.error('[MessageGenerator] Agent call failed:', {
				status: response.status,
				statusText: response.statusText
			});
			throw error(500, 'Failed to generate message');
		}

		// Parse response (handle streaming)
		const text = await response.text();
		console.log('[MessageGenerator] Raw response length:', text.length);

		let result: MessageGenerationResponse;
		try {
			result = JSON.parse(text);
		} catch {
			// Handle streaming/newline-delimited JSON
			const lines = text.split('\n').filter((line) => line.trim());
			let lastValidJson: MessageGenerationResponse | null = null;

			for (const line of lines) {
				try {
					const parsed = JSON.parse(line);
					if (parsed && typeof parsed === 'object') {
						lastValidJson = parsed as MessageGenerationResponse;
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

		// Validate response structure
		if (!result.message || !result.sources) {
			console.error('[MessageGenerator] Invalid response structure:', result);
			throw error(500, 'Invalid agent response structure');
		}

		console.log('[MessageGenerator] Message generated:', {
			userId: session.userId,
			message_length: result.message.length,
			sources_count: result.sources.length
		});

		return json(result);
	} catch (err) {
		console.error('[MessageGenerator] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Failed to generate message');
	}
};
```

### 2. Type Definitions

**File**: `src/lib/types/template.ts` (extend existing)

```typescript
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
		sources: Source[];
		researchLog: string[];
		generatedAt?: number;
		edited: boolean;
	};
	review: Record<string, never>;
}

/**
 * Source citation with metadata
 */
export interface Source {
	num: number;
	title: string;
	url: string;
	type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy';
}
```

### 3. Helper Functions

**File**: `src/lib/utils/message-processing.ts`

```typescript
import type { Source } from '$lib/types/template';

/**
 * Extract citation numbers from message text
 * Finds all [1], [2], [3] style citations
 */
export function extractCitations(message: string): number[] {
	const matches = message.match(/\[(\d+)\]/g);
	if (!matches) return [];
	return matches.map((m) => parseInt(m.slice(1, -1))).filter((n) => !isNaN(n));
}

/**
 * Validate that all citations have corresponding sources
 */
export function validateCitations(message: string, sources: Source[]): boolean {
	const citations = extractCitations(message);
	const sourceNums = new Set(sources.map((s) => s.num));

	return citations.every((num) => sourceNums.has(num));
}

/**
 * Format source as APA-style citation
 */
export function formatSourceCitation(source: Source): string {
	const typeLabel = {
		journalism: 'News Article',
		research: 'Research Paper',
		government: 'Government Document',
		legal: 'Legal Document',
		advocacy: 'Advocacy Report'
	}[source.type];

	return `[${source.num}] ${source.title}. ${typeLabel}. ${source.url}`;
}

/**
 * Create clickable citation links in message
 * Replaces [1] with <a href="#source-1">[1]</a>
 */
export function linkifyCitations(message: string): string {
	return message.replace(/\[(\d+)\]/g, '<a href="#source-$1" class="citation-link">[$1]</a>');
}

/**
 * Strip HTML from message (for plain text storage)
 */
export function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '');
}
```

### 4. Component Architecture

**Components to create:**

1. **`MessageAnticipationBuilder.svelte`** - Loading experience
   - Shows research phases
   - Streams research_log in real-time
   - Educational context

2. **`MessageResults.svelte`** - Results display
   - Formatted message with citations
   - Source list
   - Research log panel
   - Edit/Start Fresh buttons

3. **`MessageEditor.svelte`** - Rich text editing
   - Markdown or rich text input
   - Citation preservation
   - Preview mode
   - Save/Cancel

4. **`SourceList.svelte`** - Citation sources
   - Numbered source cards
   - Expandable details
   - View source / Copy URL

5. **`ResearchLogPanel.svelte`** - Research transparency
   - Collapsible panel
   - Shows agent's research process
   - Builds trust

6. **`MessageGenerator.svelte`** - Main orchestrator
   - Handles generation flow
   - Shows anticipation builder
   - Shows results
   - Integrates editor

**Integration point:**
- `src/lib/components/template/creator/MessageGenerator.svelte`
- Replaces `MessageEditor.svelte` in `TemplateCreator.svelte`

---

## Implementation Checklist

### Phase 1: Backend & Data Flow
- [ ] Create API endpoint `/api/toolhouse/generate-message/+server.ts`
- [ ] Add type definitions to `src/lib/types/template.ts`
- [ ] Create helper functions in `src/lib/utils/message-processing.ts`
- [ ] Test API endpoint with real Toolhouse agent
- [ ] Verify response parsing (handle streaming JSON)

### Phase 2: Core Components
- [ ] Build `MessageAnticipationBuilder.svelte`
  - Research phase cycling
  - Research log streaming
  - Educational context
- [ ] Build `SourceList.svelte`
  - Numbered source cards
  - Expandable details
  - Click to view source
- [ ] Build `ResearchLogPanel.svelte`
  - Collapsible panel
  - Process display
- [ ] Build `MessageResults.svelte`
  - Message display with citations
  - Source list integration
  - Edit/Start Fresh actions

### Phase 3: Message Editor
- [ ] Build `MessageEditor.svelte`
  - Rich text or markdown editing
  - Citation link preservation
  - Preview mode
  - Character count (optional)
  - Save/Cancel actions

### Phase 4: Main Orchestrator
- [ ] Build `MessageGenerator.svelte`
  - Generation flow handling
  - AnticipationBuilder integration
  - MessageResults integration
  - MessageEditor integration
  - State management (stage transitions)

### Phase 5: Template Creator Integration
- [ ] Update `TemplateCreator.svelte`
  - Replace MessageEditor with MessageGenerator
  - Update step 3 flow
  - Handle formData.content population
  - Update navigation
- [ ] Update formData initialization
  - Add sources array
  - Add researchLog array
  - Add edited flag
- [ ] Test navigation flow
  - Decision-makers → Message generation → Review

### Phase 6: Citation Interaction
- [ ] Implement citation linking
  - Replace [1] with clickable links
  - Scroll to source on click
  - Highlight active source
- [ ] Implement source card expansion
  - Click to expand details
  - View source button
  - Copy URL button
- [ ] Test citation validation
  - All citations have sources
  - No orphaned sources

### Phase 7: Edge Cases & Polish
- [ ] Handle empty message generation
  - Show error
  - Allow manual entry
- [ ] Handle API failures
  - Show error message
  - Allow retry or manual entry
- [ ] Handle edited message state
  - Mark as edited when user changes
  - Preserve citations in edits
- [ ] Test citation preservation
  - Citations survive edits
  - Sources remain linked
- [ ] Test research log display
  - Transparency panel works
  - Log readable and useful

### Phase 8: Testing & QA
- [ ] Unit tests for helper functions
  - `extractCitations()`
  - `validateCitations()`
  - `formatSourceCitation()`
  - `linkifyCitations()`
- [ ] Integration tests for API endpoint
  - Successful generation
  - Streaming response parsing
  - Error handling
- [ ] E2E tests for full flow
  - Auto-generation → results → edit
  - Auto-generation → start fresh
  - Citation clicking
- [ ] Manual QA
  - Test with real Toolhouse agent
  - Verify citation links work
  - Test source card expansion
  - Mobile responsiveness

### Phase 9: Documentation & Cleanup
- [ ] Update integration docs
- [ ] Add inline code comments
- [ ] Update `CLAUDE.md` with new flow
- [ ] Clean up console logs
- [ ] Add to `.env.example` if needed

---

## Success Criteria

### Functional Requirements
- ✅ User can proceed from Decision-Makers to Message Generation
- ✅ Agent generates message in 15-40 seconds
- ✅ Message displays with inline citations [1][2][3]
- ✅ Sources display with title, URL, type
- ✅ Research log shows agent's process
- ✅ User can edit generated message
- ✅ User can start from scratch
- ✅ Citations remain clickable after edits
- ✅ All citations have corresponding sources

### UX Requirements
- ✅ Wait experience shows real research process
- ✅ Research log builds trust and transparency
- ✅ Citations are clear and clickable
- ✅ Source list is easy to navigate
- ✅ Editing preserves formatting and citations
- ✅ Mobile-responsive across all breakpoints

### Technical Requirements
- ✅ API endpoint handles streaming responses correctly
- ✅ Type safety throughout (no `any` types)
- ✅ Error handling for API failures
- ✅ State management preserves data across navigation
- ✅ No console errors or warnings
- ✅ Performance: generation completes in < 40 seconds

---

## Design Assets Needed

### Icons
- Search (researching sources)
- CheckCircle (verifying facts)
- FileText (drafting)
- ExternalLink (sources)
- Edit (edit message)
- RefreshCw (start fresh)
- Copy (copy URL)

### Copy
- Loading messages (4-5 variations)
- Error messages
- Empty state messages
- Help text / tooltips

---

## Open Questions

### 1. Message length limits
**Q**: Should we cap message length?
**A**: No hard cap. Let agent decide based on issue complexity.

### 2. Citation style
**Q**: APA, MLA, or inline [1][2]?
**A**: Inline [1][2] for readability. Full details in source list.

### 3. Edit tracking
**Q**: Track what user changed?
**A**: Just boolean `edited` flag. No diff tracking in v1.

### 4. Regeneration
**Q**: Allow user to regenerate with different prompt?
**A**: Not in v1. Edit only. Too expensive for now.

### 5. Variable injection
**Q**: How do template variables work with generated messages?
**A**: Not in v1. Generated messages are static. Variables are future enhancement.

### 6. Source verification
**Q**: Ping URLs to verify they exist?
**A**: No. Trust agent. User can verify manually.

---

## Future Enhancements (Post-Hackathon)

### 1. Iterative Refinement
- User can provide feedback ("make it shorter", "add more sources")
- Agent regenerates with user's notes
- Conversation-style editing

### 2. Template Variables
- Agent identifies places for personalization
- Inserts {{firstName}}, {{district}}, etc.
- User can customize variable placement

### 3. Tone Adjustment
- Sliders for "professional ↔ urgent" tone
- Agent rewrites with different voice
- Preserve sources and facts

### 4. Multi-language Support
- Generate message in user's language
- Translate sources (where possible)
- International issue support

### 5. Version History
- Save previous versions of message
- Restore earlier drafts
- Compare versions

---

## Appendix: Example Data

### Input (from previous steps)
```json
{
  "subject_line": "Amazon Drivers Forced to Pee in Bottles—This Is Not Okay",
  "core_issue": "Amazon drivers forced to piss in bottles. Warehouse workers collapsing from heat. Bezos making $2.5M/hour while this happens.",
  "decision_makers": [
    {
      "name": "Udit Madan",
      "title": "Vice President, Worldwide Operations",
      "organization": "Amazon"
    },
    {
      "name": "Beth Galetti",
      "title": "Senior Vice President, People eXperience and Technology (PXT)",
      "organization": "Amazon"
    }
  ],
  "includes_congress": false
}
```

### Output (from Toolhouse agent)
```json
{
  "message": "On November 29, 2024, LAist documented the daily reality for Amazon delivery drivers in Los Angeles: nearly a dozen bottles of urine were found outside an Amazon warehouse in Atwater Village, left by drivers who say they are under such severe pressure to make deliveries that they cannot take time to use a restroom [1].\n\nKelly Chemidlin, a former Amazon driver, described peeing in bottles as 'incredibly common,' saying, 'It definitely made me feel a little like, you know, less than—very much just like an object.' Michael Ward, another former driver, said, 'That's just what people do all day, because you're so scrutinized as far as time and where you are' [2].\n\nThis is not an isolated incident. In 2023, three Amazon delivery drivers filed a class action lawsuit in Denver, alleging that Amazon's work policies require drivers to relieve themselves in bottles and defecate in bags, at risk of 'serious health consequences' [3].\n\nAmazon has publicly acknowledged the problem, apologizing in a 2021 blog post for previously denying it and stating, 'Regardless of the fact that this is industry-wide, we would like to solve it... We don't yet know how, but will look for solutions.' Yet, as of late 2024, drivers and advocates report no meaningful change [1].\n\nThis is a crisis of dignity, health, and basic human rights. Amazon must immediately:\n- Guarantee all delivery drivers scheduled, protected bathroom breaks without penalty or surveillance.\n- Redesign delivery routes to allow for safe, regular access to restrooms.\n- Publicly report on progress, with input from drivers and independent labor advocates.\n\nAs leaders responsible for Amazon's operations, workforce, and public reputation, you must act now. The world is watching. Set a 90-day deadline for concrete, transparent improvements—or risk further legal, reputational, and operational consequences.",
  "subject": "Amazon Drivers Forced to Pee in Bottles—This Is Not Okay",
  "sources": [
    {
      "num": 1,
      "title": "Amazon drivers in LA say there's rarely time to use a bathroom. Their solution? Peeing in a bottle",
      "url": "https://laist.com/news/amazon-drivers-in-la-time-pressure-bathroom-bottle",
      "type": "journalism"
    },
    {
      "num": 2,
      "title": "Inside the 'never-ending nightmare' of an Amazon driver forced to pee in bottles to make deadlines",
      "url": "https://metro.co.uk/2025/09/24/inside-never-ending-nightmare-amazon-driver-forced-pee-bottles-make-deadlines-24249555/",
      "type": "journalism"
    },
    {
      "num": 3,
      "title": "Delivery Drivers Sue Amazon For Being Forced To Pee In Bottles",
      "url": "https://www.forbes.com/sites/katherinehamilton/2023/05/24/delivery-drivers-sue-amazon-for-being-forced-to-pee-in-bottles/",
      "type": "journalism"
    }
  ],
  "research_log": [
    "Searched for 'Amazon drivers forced to pee in bottles 2024'",
    "Fetched and extracted content from LAist, Metro UK, and Forbes articles",
    "Extracted direct quotes, lawsuit details, and Amazon's public statements"
  ]
}
```

### Processed (for frontend)
```typescript
const processedContent = {
  preview: response.message, // Full message with [1][2][3] citations
  variables: [], // Empty for now, future enhancement
  sources: response.sources, // Structured source list
  researchLog: response.research_log, // Agent's research process
  generatedAt: Date.now(),
  edited: false
};
```

---

## End of Specification

**Next Steps**: Begin implementation with Phase 1 (Backend & Data Flow)

**Questions**: Reference this doc and decision-maker integration patterns.

**Status Updates**: Update checklist as tasks complete.
