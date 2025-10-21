# Template System: Variables, Editor, Moderation, Share Flows

**How templates work in Communiqué. From creation to delivery.**

Templates are the core unit of civic action in Communiqué. This document covers variable extraction, the CodeMirror editor, 3-layer content moderation, and share flows.

---

## Table of Contents

1. [Template Lifecycle](#template-lifecycle)
2. [Variable System](#variable-system)
3. [Template Creator](#template-creator)
4. [Content Moderation](#content-moderation)
5. [Share Flows](#share-flows)
6. [Template Resolution](#template-resolution)
7. [Database Schema](#database-schema)

---

## Template Lifecycle

```
1. CREATION
   User writes template in CodeMirror editor
   → Variables auto-detected: [Name], [Representative Name], [Personal Connection]
   → Preview updates in real-time

2. SUBMISSION
   User submits for review
   → 3-layer moderation: OpenAI + Gemini/Claude + human
   → Grammar/clarity/toxicity scoring
   → Approval/rejection/correction

3. PUBLICATION
   Approved template becomes public
   → Listed in template catalog (/templates)
   → Accessible via shareable URL (/s/[slug])
   → Search-indexed by category, topic

4. CUSTOMIZATION
   User selects template
   → Fills variables: [Personal Connection], custom fields
   → Real-time preview with their data
   → Address validation → congressional district lookup

5. DELIVERY
   User sends message
   → Template resolved with user context (name, address, representatives)
   → Encrypted via XChaCha20-Poly1305
   → Delivered via CWC API through GCP Confidential Space TEE
   → On-chain reputation tracking (Phase 1)
```

---

## Variable System

### Variable Types

**Auto-Resolved (System Variables):**
- `[Name]`, `[Your Name]` → User's full name
- `[Address]`, `[Your Address]` → Full street address
- `[City]`, `[State]`, `[ZIP]` → Address components
- `[Representative Name]`, `[Rep Name]` → House member name
- `[Senator Name]`, `[Senator]` → First senator
- `[Senior Senator]`, `[Junior Senator]` → Both senators

**Manual-Fill (User Variables):**
- `[Personal Connection]` → Personal story/connection block
- `[Phone]`, `[Phone Number]` → User's phone (optional)
- `[Your Story]`, `[Personal Story]` → Personal experience block

**Usage in templates:**

```
Subject: Tell [Representative Name] to support the [Issue] Act

Dear [Representative],

As your constituent from [City], I'm writing about [Issue].

[Personal Connection]

I urge you to support this legislation.

Sincerely,
[Name]
[Address]
```

### Variable Extraction

**Client-side variable detection:**

```typescript
// Regex pattern for block variables
const VARIABLE_PATTERN = /\[([^\]]+)\]/g;

function extractVariables(text: string): string[] {
  const matches = text.matchAll(VARIABLE_PATTERN);
  return [...new Set([...matches].map(m => `[${m[1]}]`))];
}

// Example usage
const template = "Dear [Representative Name], I'm [Name] from [City]...";
const variables = extractVariables(template);
// → ['[Representative Name]', '[Name]', '[City]']
```

**Variable classification:**

```typescript
const SYSTEM_VARIABLES = [
  '[Name]', '[Your Name]',
  '[Address]', '[Your Address]',
  '[City]', '[State]', '[ZIP]',
  '[Representative Name]', '[Rep Name]', '[Representative]',
  '[Senator Name]', '[Senator]',
  '[Senior Senator]', '[Junior Senator]'
];

const MANUAL_VARIABLES = [
  '[Personal Connection]',
  '[Phone]', '[Phone Number]', '[Your Phone]',
  '[Your Story]', '[Personal Story]', '[Your Experience]'
];

function isSystemVariable(variable: string): boolean {
  return SYSTEM_VARIABLES.includes(variable);
}

function isManualVariable(variable: string): boolean {
  return MANUAL_VARIABLES.includes(variable);
}
```

---

## Template Creator

### CodeMirror 6 Editor

**Features:**
- Syntax highlighting for variables (`[Name]` highlighted differently than body text)
- Auto-completion for variables
- Real-time preview with live variable resolution
- Character count (CWC API has 10,000 char limit)
- Auto-save to draft store

**Implementation:**

```svelte
<script lang="ts">
  import { EditorView, basicSetup } from 'codemirror';
  import { Decoration, DecorationSet } from '@codemirror/view';
  import { StateField, StateEffect } from '@codemirror/state';

  let editorView: EditorView;
  let messageBody = $state('');

  // Variable highlighting extension
  const variableHighlighter = StateField.define({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      const text = tr.state.doc.toString();
      const regex = /\[([^\]]+)\]/g;
      const decs: Range<Decoration>[] = [];

      let match;
      while ((match = regex.exec(text)) !== null) {
        decs.push({
          from: match.index,
          to: match.index + match[0].length,
          value: Decoration.mark({
            class: 'cm-variable'
          })
        });
      }

      return Decoration.set(decs);
    }
  });

  onMount(() => {
    editorView = new EditorView({
      doc: messageBody,
      extensions: [
        basicSetup,
        variableHighlighter,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            messageBody = update.state.doc.toString();
          }
        })
      ],
      parent: editorElement
    });
  });
</script>

<div bind:this={editorElement} class="codemirror-editor"></div>

<style>
  :global(.cm-variable) {
    background: #e0f2fe;
    color: #0369a1;
    font-weight: 500;
    padding: 2px 4px;
    border-radius: 3px;
  }
</style>
```

### Real-Time Preview

**Live variable resolution as user types:**

```svelte
<script lang="ts">
  import { resolveTemplate } from '$lib/utils/templateResolver';

  let messageBody = $state('');
  let userContext = $state({
    name: 'Jane Doe',
    city: 'San Francisco',
    representatives: [
      { name: 'Nancy Pelosi', chamber: 'house' }
    ]
  });

  // Reactive preview
  let preview = $derived.by(() => {
    const template = {
      id: 'draft',
      title: 'Draft Template',
      message_body: messageBody,
      deliveryMethod: 'cwc'
    };

    return resolveTemplate(template, userContext, {
      preserveVariables: true  // Keep unfilled variables in preview
    });
  });
</script>

<div class="split-editor">
  <div class="editor">
    <CodeMirrorEditor bind:value={messageBody} />
  </div>

  <div class="preview">
    <h3>Preview</h3>
    <div class="message-preview">
      {@html preview.body.replace(/\n/g, '<br>')}
    </div>
  </div>
</div>
```

### Draft Store

**Auto-save to local storage:**

```typescript
// stores/templateDraft.ts
interface TemplateDraft {
  title: string;
  description: string;
  message_body: string;
  category: string;
  lastSaved: Date;
}

function createDraftStore() {
  const STORAGE_KEY = 'communique-template-draft';

  const state = $state<TemplateDraft>({
    title: '',
    description: '',
    message_body: '',
    category: 'general',
    lastSaved: new Date()
  });

  // Load from localStorage on init
  if (browser) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      Object.assign(state, JSON.parse(saved));
    }
  }

  // Auto-save on changes
  $effect(() => {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      state.lastSaved = new Date();
    }
  });

  return {
    get draft() {
      return state;
    },

    update(field: keyof TemplateDraft, value: string) {
      state[field] = value;
    },

    reset() {
      Object.assign(state, {
        title: '',
        description: '',
        message_body: '',
        category: 'general'
      });
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };
}

export const draftStore = createDraftStore();
```

---

## Content Moderation

### 3-Layer Consensus System

**Phase 1 (active now):** 3 AI agents vote on template quality:

```
Layer 1: OpenAI GPT-4
Layer 2: Google Gemini 2.5 Flash OR Anthropic Claude 3.5 Haiku
Layer 3: Human review (if consensus < 67%)
```

**Consensus mechanism:**

```typescript
interface AgentVote {
  agent: 'openai' | 'gemini' | 'claude';
  approved: boolean;
  confidence: number;
  reasoning: string;
  toxicity_score?: number;
  grammar_score?: number;
  clarity_score?: number;
}

interface ConsensusResult {
  approval: boolean;
  consensusType: 'unanimous' | 'majority' | 'split';
  confidence: number;
  votes: AgentVote[];
  corrections?: {
    corrected_subject?: string;
    corrected_body?: string;
  };
}

async function getAgentConsensus(
  template: Template
): Promise<ConsensusResult> {
  // Parallel agent calls
  const [openai, gemini, claude] = await Promise.all([
    callOpenAI(template),
    callGemini(template),
    callClaude(template)
  ]);

  const votes = [openai, gemini, claude];
  const approvalCount = votes.filter(v => v.approved).length;

  // Consensus threshold: 67% (2 out of 3)
  const approval = approvalCount >= 2;
  const consensusType =
    approvalCount === 3 ? 'unanimous' :
    approvalCount === 2 ? 'majority' :
    'split';

  return {
    approval,
    consensusType,
    confidence: approvalCount / 3,
    votes
  };
}
```

### Moderation Criteria

**Auto-reject if:**
- Toxicity score > 0.7 (hate speech, threats, harassment)
- Grammar score < 0.4 (incomprehensible)
- Contains forbidden words (profanity, slurs)
- Spam patterns detected

**Auto-approve if:**
- All 3 agents approve unanimously
- Toxicity score < 0.2
- Grammar score > 0.8
- Clarity score > 0.7

**Human review if:**
- Split decision (1-2 or 2-1 vote)
- Confidence < 0.67
- Borderline toxicity (0.4-0.7)
- Complex policy questions

### AI Corrections

**Grammar and clarity improvements:**

```typescript
interface CorrectionLog {
  original_subject: string;
  corrected_subject: string;
  original_body: string;
  corrected_body: string;
  changes: {
    type: 'grammar' | 'clarity' | 'tone';
    description: string;
    location: { line: number; column: number };
  }[];
}

// AI can suggest corrections without changing intent
const result = await agentConsensus.processTemplate(template);

if (result.corrections) {
  // Show user corrections with diff view
  showCorrectionsDiff({
    original: template.message_body,
    corrected: result.corrections.corrected_body,
    changes: result.corrections.changes
  });
}
```

---

## Share Flows

### Template URLs

**Shareable URL structure:**

```
https://communi.email/s/[slug]
```

**Example:**
```
https://communi.email/s/support-healthcare-reform
```

**Slug generation:**

```typescript
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// "Support the Healthcare Reform Act" → "support-the-healthcare-reform-act"
```

### Social Sharing

**Open Graph tags (SSR):**

```typescript
// +page.ts
export const load: PageLoad = async ({ params, fetch }) => {
  const template = await fetch(`/api/templates/${params.slug}`).then(r => r.json());

  return {
    template,
    meta: {
      title: `Take Action: ${template.title}`,
      description: template.description,
      image: `/og-images/template-${template.id}.png`,
      url: `https://communi.email/s/${template.slug}`
    }
  };
};
```

```svelte
<!-- +page.svelte -->
<svelte:head>
  <title>{data.meta.title}</title>
  <meta property="og:title" content={data.meta.title} />
  <meta property="og:description" content={data.meta.description} />
  <meta property="og:image" content={data.meta.image} />
  <meta property="og:url" content={data.meta.url} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
```

### Share Button Component

**One-click sharing to social platforms:**

```svelte
<script lang="ts">
  let { template }: { template: Template } = $props();

  const shareUrl = `https://communi.email/s/${template.slug}`;
  const shareText = `Take action: ${template.title}`;

  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  }

  function shareFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  }

  async function shareNative() {
    if (navigator.share) {
      await navigator.share({
        title: template.title,
        text: template.description,
        url: shareUrl
      });
    }
  }
</script>

<div class="share-buttons">
  {#if navigator.share}
    <button onclick={shareNative}>
      <ShareIcon /> Share
    </button>
  {:else}
    <button onclick={shareTwitter}>
      <TwitterIcon /> Twitter
    </button>
    <button onclick={shareFacebook}>
      <FacebookIcon /> Facebook
    </button>
  {/if}
</div>
```

---

## Template Resolution

**The core engine that transforms templates into personalized messages.**

### Resolution Phases

**1. Variable Extraction**

```typescript
const variables = extractVariables(template.message_body);
// → ['[Name]', '[Representative Name]', '[Personal Connection]']
```

**2. User Context Gathering**

```typescript
const userContext = {
  name: user.name,
  street: user.street,
  city: user.city,
  state: user.state,
  zip: user.zip,
  representatives: user.representatives // From Census Bureau + CWC lookup
};
```

**3. Variable Resolution**

```typescript
const resolved = resolveTemplate(template, userContext, {
  preserveVariables: false // Remove unfilled variables
});

// Input:
// "Dear [Representative Name], I'm [Name] from [City]. [Personal Connection]"

// Output (with user context):
// "Dear Nancy Pelosi, I'm Jane Doe from San Francisco."
// (Personal Connection removed if not filled)
```

### Resolution Rules

**System variables** (auto-resolved):
- If data available: Replace with actual value
- If data missing: Remove variable + surrounding context

**Manual variables** (user-filled):
- If filled: Replace with user's text
- If not filled: Remove entire line/paragraph

**Smart context removal:**

```typescript
// Input: "I live at [Address] in [City]."
// If address missing but city present:
// → "I live in San Francisco."

// Input: "from [Address]"
// If address missing:
// → "" (remove "from" + placeholder)
```

### Preview vs Send Mode

```typescript
// PREVIEW MODE (preserveVariables: true)
resolveTemplate(template, user, { preserveVariables: true });
// → Keeps unfilled variables: "[Personal Connection]" → interactive button

// SEND MODE (preserveVariables: false)
resolveTemplate(template, user, { preserveVariables: false });
// → Removes unfilled variables completely
```

---

## Database Schema

**Template model (Prisma):**

```prisma
model Template {
  id                  String   @id @default(cuid())
  slug                String   @unique
  title               String
  description         String
  category            String
  type                String
  deliveryMethod      String   // 'cwc' | 'email'
  subject             String?
  preview             String
  message_body        String
  delivery_config     Json
  cwc_config          Json?
  recipient_config    Json
  metrics             Json

  // Status & moderation
  status              String   @default("draft")  // 'draft', 'pending', 'approved', 'rejected'
  is_public           Boolean  @default(false)

  verification_status String   @default("pending") // 'pending', 'approved', 'rejected'
  quality_score       Int?
  grammar_score       Int?
  clarity_score       Int?
  toxicity_classification Int?

  // Agent consensus data
  agent_votes         Json?
  consensus_score     Float?
  corrected_subject   String?
  corrected_body      String?

  // Usage tracking
  send_count          Int      @default(0)
  last_sent_at        DateTime?

  // Geographic scope
  applicable_countries String[] @default([])
  jurisdiction_level   String?  // 'federal', 'state', 'municipal'
  specific_locations   String[] @default([])

  // Timestamps
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  submitted_at        DateTime?
  reviewed_at         DateTime?

  // Relations
  userId              String?
  user                User?    @relation(fields: [userId], references: [id])
  civic_actions       CivicAction[]

  @@index([verification_status])
  @@index([quality_score])
  @@index([userId])
}
```

---

## Key Design Decisions

### Why Block Variables?

**Alternative considered:** Rich text editor with structured fields.

**Chosen approach:** Simple `[Variable]` syntax in plain text editor.

**Reasoning:**
- Lower barrier to entry (no complex UI)
- Easy to understand (`[Name]` is self-documenting)
- Copy-paste friendly (share template text anywhere)
- Migration-friendly (can export/import easily)

### Why 3-Layer Moderation?

**Alternative considered:** Single AI agent + human review.

**Chosen approach:** 3 AI agents + consensus threshold + human escalation.

**Reasoning:**
- Single agent can have biases or hallucinations
- Consensus (2 out of 3) reduces false positives/negatives
- Human review only for edge cases (saves cost)
- Different models catch different issues (toxicity vs grammar)

### Why CodeMirror over Monaco/Quill?

**Chosen:** CodeMirror 6

**Reasoning:**
- Lightweight (40KB vs 500KB for Monaco)
- Extensible (easy custom syntax highlighting)
- Mobile-friendly (touch support)
- Open source (MIT license)

---

## Next Steps

- **Frontend Architecture**: See `FRONTEND-ARCHITECTURE.md` for SvelteKit 5 patterns
- **Integrations**: See `INTEGRATION-GUIDE.md` for CWC API, OAuth, geocoding
- **Development**: See `DEVELOPMENT.md` for testing, deployment

---

*Communiqué PBC | Frontend for VOTER Protocol | 2025*
