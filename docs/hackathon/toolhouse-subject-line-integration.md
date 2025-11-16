# Toolhouse Subject Line Generator Integration

**Status**: 🎯 Planning
**Last Updated**: 2025-11-15
**Goal**: LLM-assisted subject line generation using Toolhouse AI agents

---

## **Overview**

Integrate Toolhouse AI's subject line generator agent to help users create compelling, action-oriented subject lines for advocacy templates. The agent analyzes user input and generates:
- **subject_line**: Punchy, emotionally resonant subject line
- **core_issue**: Clear 1-2 sentence summary of the problem
- **domain**: Target power structure (government/corporate/institutional/labor/advocacy)
- **url_slug**: URL-friendly slug for the template

---

## **Toolhouse API Integration**

### **Endpoint**
```
POST https://agents.toolhouse.ai/762e6108-9164-4c7b-852b-d6a740ccfd22
```

### **Request Format**
```typescript
// Initial request (POST)
fetch('https://agents.toolhouse.ai/762e6108-9164-4c7b-852b-d6a740ccfd22', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // If agent is private (public: false):
    // 'Authorization': 'Bearer YOUR_TOOLHOUSE_API_KEY'
  },
  body: JSON.stringify({
    message: userInput // User's description of the issue
  })
});

// Continue conversation (PUT)
fetch(`https://agents.toolhouse.ai/762e6108-9164-4c7b-852b-d6a740ccfd22/${runId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: refinementRequest
  })
});
```

### **Response Format**
```typescript
interface ToolhouseSubjectLineResponse {
  subject_line: string; // "Amazon Drivers Forced to Pee in Bottles—This Is Not Okay"
  core_issue: string;   // "Amazon delivery drivers are being pushed so hard..."
  domain: 'government' | 'corporate' | 'institutional' | 'labor' | 'advocacy';
  url_slug: string;     // "amazon-bottle-shame"
}

// Response headers
headers: {
  'X-Toolhouse-Run-ID': string; // For conversation continuity
}
```

### **Authentication**
- **Public agent** (`public: true`): No auth required
- **Private agent** (`public: false`): Requires `TOOLHOUSE_API_KEY` env var

---

## **Data Flow Architecture**

### **Flow Diagram**
```
User (ObjectiveDefiner)
    ↓
    [User types description of issue]
    ↓
    Click "Generate Smart Subject Line" button
    ↓
API Endpoint: /api/toolhouse/generate-subject
    ↓
    POST https://agents.toolhouse.ai/{AGENT_ID}
    ↓
    Streaming response with structured JSON
    ↓
    Parse response + extract Run ID from headers
    ↓
Return to frontend:
    {
      subject_line,
      core_issue,
      domain,
      url_slug,
      runId // For refinement
    }
    ↓
User reviews suggestions
    ↓
    [Accept] → Fill into form fields
    OR
    [Refine] → PUT request with feedback
```

---

## **Code Path Integration**

### **1. API Endpoint** (NEW)

**File**: `src/routes/api/toolhouse/generate-subject/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TOOLHOUSE_AGENT_ID = '762e6108-9164-4c7b-852b-d6a740ccfd22';
const TOOLHOUSE_API_BASE = 'https://agents.toolhouse.ai';

interface ToolhouseRequest {
  message: string;
  runId?: string; // For refinement requests
}

interface ToolhouseResponse {
  subject_line: string;
  core_issue: string;
  domain: 'government' | 'corporate' | 'institutional' | 'labor' | 'advocacy';
  url_slug: string;
}

/**
 * Generate subject line using Toolhouse AI agent
 *
 * POST /api/toolhouse/generate-subject
 * Body: { message: string, runId?: string }
 *
 * Returns:
 * {
 *   subject_line: string,
 *   core_issue: string,
 *   domain: string,
 *   url_slug: string,
 *   runId: string
 * }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Optional: Require authentication
    const session = locals.session;
    if (!session?.userId) {
      throw error(401, 'Authentication required');
    }

    const body = await request.json() as ToolhouseRequest;
    const { message, runId } = body;

    if (!message?.trim()) {
      throw error(400, 'Message is required');
    }

    console.log('[Toolhouse] Generating subject line:', {
      userId: session.userId,
      messageLength: message.length,
      isRefinement: !!runId
    });

    // Determine request method and URL
    const method = runId ? 'PUT' : 'POST';
    const url = runId
      ? `${TOOLHOUSE_API_BASE}/${TOOLHOUSE_AGENT_ID}/${runId}`
      : `${TOOLHOUSE_API_BASE}/${TOOLHOUSE_AGENT_ID}`;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add auth if agent is private
    if (process.env.TOOLHOUSE_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.TOOLHOUSE_API_KEY}`;
    }

    // Call Toolhouse agent
    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      console.error('[Toolhouse] Agent call failed:', {
        status: response.status,
        statusText: response.statusText
      });
      throw error(500, 'Failed to generate subject line');
    }

    // Extract Run ID from headers for conversation continuity
    const newRunId = response.headers.get('X-Toolhouse-Run-ID') || runId;

    // Parse streaming response (assuming JSON chunks)
    // Note: Toolhouse returns streaming responses, may need to handle SSE
    const text = await response.text();

    let result: ToolhouseResponse;
    try {
      // Attempt to parse as JSON
      result = JSON.parse(text);
    } catch {
      // If streaming, extract last complete JSON object
      const jsonMatches = text.match(/\{[^}]+\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        result = JSON.parse(jsonMatches[jsonMatches.length - 1]);
      } else {
        throw error(500, 'Failed to parse agent response');
      }
    }

    console.log('[Toolhouse] Subject line generated:', {
      userId: session.userId,
      subject_line: result.subject_line,
      domain: result.domain,
      runId: newRunId
    });

    // Track usage for analytics
    // TODO: Log to analytics system

    return json({
      ...result,
      runId: newRunId
    });

  } catch (err) {
    console.error('[Toolhouse] Error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err; // Re-throw SvelteKit errors
    }

    throw error(500, 'Failed to generate subject line');
  }
};
```

### **2. Frontend Component** (MODIFY)

**File**: `src/lib/components/template/creator/ObjectiveDefiner.svelte`

**Changes needed**:

```svelte
<script lang="ts">
  import { Lightbulb, Sparkles } from '@lucide/svelte';
  import type { TemplateCreationContext } from '$lib/types/template';
  import { templateValidationRules } from '$lib/utils/validation';
  import ValidatedInput from '$lib/components/ui/ValidatedInput.svelte';
  import SlugCustomizer from './SlugCustomizer.svelte';
  import SubjectLineGenerator from './SubjectLineGenerator.svelte'; // NEW

  interface Props {
    data: {
      title: string;
      description: string;
      category: string;
      slug?: string;
    };
    context: TemplateCreationContext;
  }

  let { data = $bindable(), context }: Props = $props();

  // State for AI suggestion
  let showGenerator = $state(false);
  let userIssueDescription = $state('');

  // Handle suggestion acceptance
  function handleSuggestionAccept(suggestion: {
    subject_line: string;
    core_issue: string;
    domain: string;
    url_slug: string;
  }) {
    data.title = suggestion.subject_line;
    data.description = suggestion.core_issue;
    data.slug = suggestion.url_slug;
    data.category = mapDomainToCategory(suggestion.domain);
    showGenerator = false;
  }

  function mapDomainToCategory(domain: string): string {
    const mapping: Record<string, string> = {
      government: 'Government',
      corporate: 'Corporate',
      institutional: 'Institutional',
      labor: 'Labor',
      advocacy: 'Advocacy'
    };
    return mapping[domain] || 'General';
  }

  // Initialize data if empty
  $effect(() => {
    if (!data.title) data.title = '';
    if (!data.description) data.description = '';
    if (!data.slug) data.slug = '';
  });

  const _isTitleValid = $derived(data.title.trim().length > 0);
</script>

<div class="space-y-4 md:space-y-6">
  <!-- AI-Assisted Subject Line Generator (NEW) -->
  {#if !data.title}
    <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div class="flex items-start gap-3">
        <Sparkles class="h-5 w-5 text-blue-600 mt-0.5" />
        <div class="flex-1">
          <h4 class="font-medium text-blue-900 text-sm md:text-base">
            Need help crafting a subject line?
          </h4>
          <p class="mt-1 text-xs text-blue-700 md:text-sm">
            Describe the issue and our AI will suggest a compelling subject line.
          </p>

          {#if !showGenerator}
            <button
              type="button"
              onclick={() => showGenerator = true}
              class="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 md:text-sm"
            >
              <Sparkles class="h-4 w-4" />
              Generate Smart Subject Line
            </button>
          {/if}
        </div>
      </div>

      {#if showGenerator}
        <div class="mt-4 border-t border-blue-200 pt-4">
          <SubjectLineGenerator
            bind:description={userIssueDescription}
            onaccept={handleSuggestionAccept}
            oncancel={() => showGenerator = false}
          />
        </div>
      {/if}
    </div>
  {/if}

  <!-- Hero Focus: Main Action -->
  <div class="space-y-3 md:space-y-4">
    <div class="space-y-2">
      <ValidatedInput
        bind:value={data.title}
        label="Issue Title (will be the subject line when sent)"
        placeholder="e.g., Update City Park Hours"
        rules={templateValidationRules.title}
      />
    </div>
  </div>

  <!-- Live Template Link Generation -->
  <div class="space-y-3">
    <SlugCustomizer title={data.title} bind:slug={data.slug} {context} />
  </div>

  <!-- Reference Tips - Available When Needed -->
  <div class="space-y-3 border-t border-slate-100 pt-4">
    <details class="group">
      <summary
        class="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        <Lightbulb
          class="h-4 w-4 text-participation-primary-600 group-open:text-participation-primary-700"
        />
        Tips for Effective Advocacy
        <span class="ml-auto text-xs text-slate-500 group-open:hidden">Click to expand</span>
      </summary>
      <div
        class="mt-3 rounded-lg border border-participation-primary-100 bg-participation-primary-50 p-3"
      >
        <ul class="space-y-1.5 text-xs leading-relaxed text-participation-primary-700 md:text-sm">
          <li>• Be specific about the issue or bill you're addressing</li>
          <li>• Clear subject lines get opened - save emotion for the message</li>
          <li>• Officials need to quickly understand what action you want</li>
        </ul>
      </div>
    </details>
  </div>
</div>
```

### **3. Subject Line Generator Component** (NEW)

**File**: `src/lib/components/template/creator/SubjectLineGenerator.svelte`

```svelte
<script lang="ts">
  import { Sparkles, RefreshCw, Check, X } from '@lucide/svelte';
  import { api } from '$lib/core/api/client';

  let {
    description = $bindable(''),
    onaccept,
    oncancel
  }: {
    description: string;
    onaccept: (suggestion: {
      subject_line: string;
      core_issue: string;
      domain: string;
      url_slug: string;
    }) => void;
    oncancel: () => void;
  } = $props();

  // State
  let isGenerating = $state(false);
  let suggestion = $state<{
    subject_line: string;
    core_issue: string;
    domain: string;
    url_slug: string;
    runId?: string;
  } | null>(null);
  let error = $state<string | null>(null);

  async function generate() {
    if (!description.trim()) {
      error = 'Please describe the issue first';
      return;
    }

    isGenerating = true;
    error = null;

    try {
      const response = await api.post('/toolhouse/generate-subject', {
        message: description,
        runId: suggestion?.runId // For refinement
      });

      suggestion = response;
      error = null;

    } catch (err) {
      console.error('[SubjectLineGenerator] Error:', err);
      error = 'Failed to generate subject line. Please try again.';
      suggestion = null;

    } finally {
      isGenerating = false;
    }
  }

  async function refine(feedback: string) {
    if (!suggestion?.runId) {
      error = 'Cannot refine without an existing suggestion';
      return;
    }

    isGenerating = true;
    error = null;

    try {
      const response = await api.post('/toolhouse/generate-subject', {
        message: `${description}\n\nFeedback: ${feedback}`,
        runId: suggestion.runId
      });

      suggestion = response;
      error = null;

    } catch (err) {
      console.error('[SubjectLineGenerator] Refinement error:', err);
      error = 'Failed to refine subject line. Please try again.';

    } finally {
      isGenerating = false;
    }
  }
</script>

<div class="space-y-3">
  <!-- Issue Description Input -->
  <div>
    <label for="issue-description" class="block text-xs font-medium text-slate-700 md:text-sm">
      Describe the issue
    </label>
    <textarea
      id="issue-description"
      bind:value={description}
      placeholder="e.g., Amazon delivery drivers are being forced to urinate in bottles because they can't take bathroom breaks..."
      rows="3"
      class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      disabled={isGenerating}
    ></textarea>
  </div>

  <!-- Generate Button -->
  {#if !suggestion}
    <button
      type="button"
      onclick={generate}
      disabled={isGenerating || !description.trim()}
      class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {#if isGenerating}
        <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
        Generating...
      {:else}
        <Sparkles class="h-4 w-4" />
        Generate Subject Line
      {/if}
    </button>
  {/if}

  <!-- Error Display -->
  {#if error}
    <div class="rounded-lg border border-red-200 bg-red-50 p-3">
      <p class="text-xs text-red-700 md:text-sm">{error}</p>
    </div>
  {/if}

  <!-- Suggestion Display -->
  {#if suggestion}
    <div class="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
      <div>
        <div class="mb-1 flex items-center gap-2">
          <Sparkles class="h-4 w-4 text-green-600" />
          <span class="text-xs font-medium text-green-900 md:text-sm">AI Suggestion</span>
        </div>

        <div class="space-y-2">
          <div>
            <label class="text-xs font-medium text-green-700">Subject Line:</label>
            <p class="mt-0.5 text-sm font-semibold text-green-900 md:text-base">
              {suggestion.subject_line}
            </p>
          </div>

          <div>
            <label class="text-xs font-medium text-green-700">Core Issue:</label>
            <p class="mt-0.5 text-xs text-green-800 md:text-sm">
              {suggestion.core_issue}
            </p>
          </div>

          <div class="flex gap-2 text-xs text-green-700">
            <span>Domain: <strong>{suggestion.domain}</strong></span>
            <span>•</span>
            <span>Slug: <strong>{suggestion.url_slug}</strong></span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2 border-t border-green-200 pt-3">
        <button
          type="button"
          onclick={() => onaccept(suggestion)}
          class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 md:text-sm"
        >
          <Check class="h-4 w-4" />
          Use This
        </button>

        <button
          type="button"
          onclick={() => refine('Make it more compelling')}
          disabled={isGenerating}
          class="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 md:text-sm"
        >
          <RefreshCw class="h-4 w-4" />
          Refine
        </button>

        <button
          type="button"
          onclick={oncancel}
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 md:text-sm"
        >
          <X class="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>
```

---

## **UX Flow**

### **User Journey**

1. **User enters Template Creator** → ObjectiveDefiner step
2. **Empty title field** → Shows blue prompt card:
   - "Need help crafting a subject line?"
   - "Describe the issue and our AI will suggest a compelling subject line."
   - [Generate Smart Subject Line] button

3. **User clicks button** → Expands inline generator:
   - Textarea: "Describe the issue"
   - Placeholder: "e.g., Amazon delivery drivers are being forced to urinate in bottles..."
   - [Generate Subject Line] button

4. **User types description + clicks Generate**:
   - Loading state: "Generating..." with spinner
   - API call to `/api/toolhouse/generate-subject`
   - ~2-5 seconds wait (streaming response)

5. **AI returns suggestion** → Shows green success card:
   - **Subject Line**: "Amazon Drivers Forced to Pee in Bottles—This Is Not Okay"
   - **Core Issue**: "Amazon delivery drivers are being pushed so hard..."
   - **Domain**: corporate
   - **Slug**: amazon-bottle-shame
   - Action buttons: [Use This] [Refine] [Cancel]

6. **User clicks "Use This"**:
   - Auto-fills all fields:
     - `data.title` ← subject_line
     - `data.description` ← core_issue
     - `data.slug` ← url_slug
     - `data.category` ← domain (mapped to category)
   - Hides generator
   - User continues to next step

7. **User clicks "Refine"**:
   - PUT request to same agent with Run ID
   - Maintains conversation context
   - Returns updated suggestion
   - User can refine multiple times

8. **User clicks "Cancel"**:
   - Hides generator
   - User can manually enter subject line

---

## **Data Model Changes**

No database changes needed! The AI suggestions are ephemeral and only populate the form state.

However, we might want to track usage:

### **Optional: Analytics Tracking**

```typescript
// Track in analytics system
await prisma.analyticsEvent.create({
  data: {
    event_type: 'ai_subject_line_generated',
    user_id: userId,
    template_id: null, // Not created yet
    metadata: {
      suggestion_accepted: true,
      refinement_count: 2,
      domain: 'corporate',
      original_description_length: 150
    }
  }
});
```

---

## **Environment Variables**

Add to `.env`:

```bash
# Toolhouse AI
TOOLHOUSE_API_KEY=your_api_key_here  # Only needed if agent is private
TOOLHOUSE_AGENT_ID=762e6108-9164-4c7b-852b-d6a740ccfd22
```

---

## **Error Handling**

### **Frontend Error States**

1. **Network error** → "Failed to generate subject line. Please try again."
2. **Empty description** → "Please describe the issue first"
3. **Rate limit** → "Too many requests. Please wait a moment."
4. **Invalid response** → "Received invalid response. Please try again."

### **Graceful Degradation**

- If Toolhouse is down → Hide generator button entirely
- If user isn't authenticated → Show generator but require login
- If API key is missing → Log warning, disable feature

---

## **Performance Considerations**

### **Streaming Response Handling**

Toolhouse returns streaming responses. Options:

**Option A: Wait for complete response**
```typescript
const text = await response.text();
const result = JSON.parse(text);
```

**Option B: Stream chunks to frontend (real-time)**
```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Send chunk to frontend via SSE or WebSocket
}
```

**Recommendation**: Start with Option A (simpler), upgrade to Option B if needed.

### **Caching Strategy**

- Cache responses by description hash for 5 minutes
- Avoid re-generating for same input
- Store in Redis or in-memory LRU cache

```typescript
const cacheKey = `toolhouse:${hashDescription(message)}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return json(JSON.parse(cached));
}

// ... call Toolhouse ...

await redis.setex(cacheKey, 300, JSON.stringify(result));
```

---

## **Testing Strategy**

### **Unit Tests**

```typescript
// tests/unit/toolhouse-subject-line.test.ts
describe('Toolhouse Subject Line Generator', () => {
  it('should generate subject line from description', async () => {
    const response = await api.post('/toolhouse/generate-subject', {
      message: 'Amazon drivers forced to pee in bottles'
    });

    expect(response.subject_line).toBeTruthy();
    expect(response.domain).toBe('corporate');
    expect(response.url_slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('should refine subject line with feedback', async () => {
    const initial = await api.post('/toolhouse/generate-subject', {
      message: 'Amazon drivers forced to pee in bottles'
    });

    const refined = await api.post('/toolhouse/generate-subject', {
      message: 'Make it more urgent',
      runId: initial.runId
    });

    expect(refined.runId).toBe(initial.runId);
    expect(refined.subject_line).not.toBe(initial.subject_line);
  });
});
```

### **Integration Tests**

```typescript
// tests/integration/template-creator-ai.test.ts
describe('Template Creator AI Integration', () => {
  it('should auto-fill form with AI suggestion', async () => {
    const { component } = render(ObjectiveDefiner, {
      props: { data: { title: '', description: '', category: '', slug: '' } }
    });

    // Expand generator
    await fireEvent.click(screen.getByText('Generate Smart Subject Line'));

    // Enter description
    const textarea = screen.getByPlaceholderText(/Amazon delivery drivers/);
    await fireEvent.input(textarea, {
      target: { value: 'Amazon drivers forced to pee in bottles' }
    });

    // Generate
    await fireEvent.click(screen.getByText('Generate Subject Line'));

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText(/Amazon Drivers Forced/)).toBeInTheDocument();
    });

    // Accept suggestion
    await fireEvent.click(screen.getByText('Use This'));

    // Verify form fields populated
    expect(component.data.title).toContain('Amazon Drivers');
    expect(component.data.slug).toBe('amazon-bottle-shame');
  });
});
```

---

## **Feature Flags**

Control rollout with feature flag:

```typescript
// src/lib/features/config.ts
export const featureFlags = {
  aiSubjectLineGenerator: process.env.ENABLE_AI_SUBJECT_LINE === 'true'
};
```

```svelte
<!-- ObjectiveDefiner.svelte -->
{#if featureFlags.aiSubjectLineGenerator && !data.title}
  <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
    <!-- AI generator prompt -->
  </div>
{/if}
```

---

## **System Prompt Analysis**

The Toolhouse agent uses this system prompt:

```
You are an advanced agent for civic and organizational action. Your sole task is to:

1. Receive a raw, informal, or emotional issue title or email header from the user
2. Instantly transform it into a punchy, direct, and impactful subject line that will be taken seriously by decision-makers

The subject line should:
- Be clear, concise, and specific
- Avoid excessive formality or corporate-speak
- Retain urgency and real-world impact, but not be unprofessional or off-putting
- Demand attention and provoke a visceral reaction—make the issue impossible to ignore
- Compete with the most crass, sensational, or viral content online
- Avoid sanitized, generic, or overly "professional" language
- Reflect the real-world energy and frustration of users, but in a way that commands respect and action

3. Output structured JSON: { subject_line, core_issue, domain, url_slug }
```

**Key insights:**
- Agent is trained to **cut through bullshit** and generate attention-grabbing subject lines
- Transforms "amazon drivers are pissing in bottles. wtf" → "Amazon Drivers Forced to Pee in Bottles—This Is Not Okay"
- Balances **urgency** with **professionalism** (viral-worthy but decision-maker ready)
- Domain detection works across government/corporate/institutional/labor/advocacy

## **Implementation Checklist**

### **Phase 1: Core Integration** ✅ COMPLETE

- [x] Create `/api/toolhouse/generate-subject` endpoint
- [x] Add `TOOLHOUSE_API_KEY` and `TOOLHOUSE_AGENT_ID` to env vars
- [x] Test basic POST request to Toolhouse agent
- [x] Verify structured response parsing

### **Phase 2: Frontend Component** ✅ COMPLETE

- [x] Create `SubjectLineGenerator.svelte` component
- [x] Integrate into `ObjectiveDefiner.svelte`
- [x] Add Sparkles icon to prompt card
- [x] Implement loading states and error handling
- [x] **5-try carousel system** with navigation
- [x] **Editable description** between generations
- [x] **Copy that vibes**: "Stuck on the subject line? Describe what's pissing you off."

### **Phase 3: Refinement Flow** ✅ COMPLETE

- [x] Implement PUT request for refinement (via runId)
- [x] Store Run ID in component state
- [x] "Try again" button with edited description
- [x] Test conversation continuity
- [x] Carousel navigation (Previous/Next)

### **Phase 4: UX Polish** ✅ COMPLETE

- [x] Mobile-responsive design (text-xs/md:text-sm throughout)
- [x] Smooth expand/collapse (conditional rendering)
- [x] Clean suggestion display (white card with border)
- [x] Error states ("Tell us what pisses you off first")
- [x] Attempt counter ("X tries left")

### **Phase 5: Testing & Launch** (IN PROGRESS)

- [ ] Manual QA: Test with real Toolhouse API
- [ ] Verify error handling (network failures, malformed JSON)
- [ ] Test edge cases (empty description, max attempts)
- [ ] Monitor console logs for debugging
- [ ] Track analytics (acceptance rate, refinement count)

---

## **Success Metrics**

**Adoption**:
- % of templates created using AI generator
- Acceptance rate (used vs. canceled)
- Refinement rate (how many users refine)

**Quality**:
- User feedback on suggestions
- Template completion rate (with AI vs. without)
- Subject line open rates (if trackable)

**Performance**:
- Response time (p50, p95, p99)
- Error rate
- Cache hit rate

---

## **Open Questions**

1. **Should we require authentication?**
   - Pro: Prevent abuse, track usage per user
   - Con: Friction for anonymous template creators
   - **Recommendation**: Require auth (align with "no guest users" policy)

2. **Should we show AI attribution?**
   - "Subject line generated by AI"
   - Legal/ethical consideration
   - **Recommendation**: Show small "✨ AI-assisted" badge

3. **Should we allow editing after acceptance?**
   - User clicks "Use This" → fields are editable
   - OR fields are locked?
   - **Recommendation**: Always editable (AI is a suggestion, not final)

4. **Should we cache responses?**
   - Same description → same suggestion
   - OR always call agent for freshness?
   - **Recommendation**: Cache for 5 minutes (balance performance + freshness)

5. **Should we support multiple languages?**
   - Detect user locale
   - Pass to agent as context
   - **Recommendation**: Phase 2 feature

---

**Last Updated**: 2025-11-15
**Next Update**: After Phase 1 implementation
