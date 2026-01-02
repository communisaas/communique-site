# Gemini 3 Flash Agent Integration Specification

**Status:** Draft
**Author:** Distinguished Engineer
**Date:** 2025-01-22
**Replaces:** Toolhouse REST API integration

---

## Executive Summary

This specification details the migration from Toolhouse hosted agents to native Gemini 3 Flash integration using the `@google/genai` SDK. The migration provides:

- **Cost reduction**: Gemini 3 Flash pricing vs Toolhouse per-agent fees
- **Grounding**: Built-in Google Search for real-time research with citations
- **State management**: Interactions API replaces Toolhouse `runId` pattern
- **Control**: Direct prompt engineering vs opaque hosted agents
- **Latency**: Single API call vs external service hop

---

## Architecture Overview

### Current State (Toolhouse)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Frontend       │────▶│  /api/toolhouse/*    │────▶│  Toolhouse API  │
│  Components     │     │  (3 endpoints)       │     │  (hosted agents)│
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │
                              ▼
                        POST https://agents.toolhouse.ai/{agent_id}
                        Authorization: Bearer {TOOLHOUSE_API_KEY}
```

### Target State (Gemini 3 Flash)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Frontend       │────▶│  /api/agents/*       │────▶│  Gemini API     │
│  Components     │     │  (3 endpoints)       │     │  (direct SDK)   │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                              │
                              ▼
                        @google/genai SDK
                        ai.models.generateContent()
                        ai.interactions.create()
```

---

## Gemini 3 Flash Capabilities

| Feature | Specification |
|---------|---------------|
| **Model ID** | `gemini-3-flash-preview` |
| **Input tokens** | 1,048,576 (1M context) |
| **Output tokens** | 65,536 |
| **Grounding** | Google Search built-in |
| **Structured output** | JSON schema enforcement |
| **Thinking** | `thinkingLevel`: low/medium/high |
| **State management** | Interactions API with `previous_interaction_id` |

### Pricing (as of 2025)

- **Input**: $0.10 per 1M tokens
- **Output**: $0.40 per 1M tokens
- **Google Search grounding**: $14 per 1K queries (billing starts Jan 5, 2026 - FREE until then)

---

## File Structure

```
src/lib/core/agents/
├── index.ts                    # Public exports
├── gemini-client.ts            # Centralized SDK wrapper
├── types.ts                    # Shared interfaces
├── prompts/
│   ├── subject-line.ts         # Subject line system prompt
│   ├── decision-maker.ts       # Decision-maker system prompt
│   └── message-writer.ts       # Message generation system prompt
├── agents/
│   ├── subject-line.ts         # Subject line agent
│   ├── decision-maker.ts       # Decision-maker agent
│   └── message-writer.ts       # Message generation agent
└── utils/
    ├── grounding.ts            # Citation extraction utilities
    ├── conversation.ts         # Interaction state management
    └── schema.ts               # JSON schema definitions

src/routes/api/agents/
├── generate-subject/+server.ts
├── resolve-decision-makers/+server.ts
└── generate-message/+server.ts
```

---

## Core Components

### 1. Gemini Client (`gemini-client.ts`)

Centralized SDK wrapper with consistent error handling, retry logic, and configuration.

```typescript
import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

// Singleton client
let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

export const GEMINI_CONFIG = {
  model: 'gemini-3-flash-preview',
  defaults: {
    temperature: 0.3,
    maxOutputTokens: 8192,
    thinkingLevel: 'medium' as const
  }
} as const;

export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  thinkingLevel?: 'low' | 'medium' | 'high';
  enableGrounding?: boolean;
  responseSchema?: object;
  systemInstruction?: string;
  previousInteractionId?: string;
}

export async function generate(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateContentResponse> {
  const ai = getGeminiClient();

  const config: GenerateContentConfig = {
    temperature: options.temperature ?? GEMINI_CONFIG.defaults.temperature,
    maxOutputTokens: options.maxOutputTokens ?? GEMINI_CONFIG.defaults.maxOutputTokens
  };

  // Add grounding if enabled
  if (options.enableGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  // Add structured output if schema provided
  if (options.responseSchema) {
    config.responseMimeType = 'application/json';
    config.responseSchema = options.responseSchema;
  }

  // Add system instruction if provided
  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }

  // Add thinking level for Gemini 3
  if (options.thinkingLevel) {
    config.thinkingConfig = { thinkingLevel: options.thinkingLevel };
  }

  return ai.models.generateContent({
    model: GEMINI_CONFIG.model,
    contents: prompt,
    config
  });
}

// Stateful interaction for multi-turn conversations
export async function interact(
  input: string,
  options: GenerateOptions = {}
): Promise<InteractionResponse> {
  const ai = getGeminiClient();

  return ai.interactions.create({
    model: GEMINI_CONFIG.model,
    input,
    previous_interaction_id: options.previousInteractionId,
    config: {
      temperature: options.temperature ?? GEMINI_CONFIG.defaults.temperature,
      tools: options.enableGrounding ? [{ googleSearch: {} }] : undefined
    }
  });
}
```

### 2. Type Definitions (`types.ts`)

```typescript
// Shared agent response types

export interface SubjectLineResponse {
  subject_line: string;
  core_issue: string;
  domain: 'government' | 'corporate' | 'institutional' | 'labor' | 'advocacy';
  url_slug: string;
}

export interface DecisionMaker {
  name: string;
  title: string;
  organization: string;
  email?: string;
  provenance: string;
  source_url?: string;
  confidence: number;
}

export interface DecisionMakerResponse {
  decision_makers: DecisionMaker[];
  research_summary?: string;
}

export interface Source {
  num: number;
  title: string;
  url: string;
  type: 'journalism' | 'research' | 'government' | 'legal' | 'advocacy';
}

export interface MessageResponse {
  message: string;
  subject: string;
  sources: Source[];
  research_log: string[];
  geographic_scope?: ScopeMapping;
}

// Grounding metadata from Gemini
export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: Array<{
    web?: { uri: string; title: string };
  }>;
  groundingSupports?: Array<{
    segment?: { startIndex: number; endIndex: number };
    groundingChunkIndices?: number[];
  }>;
}

// Conversation state
export interface ConversationState {
  interactionId: string;
  createdAt: Date;
  expiresAt: Date;
}
```

### 3. JSON Schemas (`schema.ts`)

```typescript
// Structured output schemas for Gemini

export const SUBJECT_LINE_SCHEMA = {
  type: 'object',
  properties: {
    subject_line: {
      type: 'string',
      description: 'Compelling subject line for the issue (max 80 chars)'
    },
    core_issue: {
      type: 'string',
      description: 'One-sentence distillation of the core problem'
    },
    domain: {
      type: 'string',
      enum: ['government', 'corporate', 'institutional', 'labor', 'advocacy'],
      description: 'Power structure domain this issue targets'
    },
    url_slug: {
      type: 'string',
      description: 'URL-safe slug for the template (lowercase, hyphens)'
    }
  },
  required: ['subject_line', 'core_issue', 'domain', 'url_slug']
};

export const DECISION_MAKER_SCHEMA = {
  type: 'object',
  properties: {
    decision_makers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          organization: { type: 'string' },
          email: { type: 'string' },
          provenance: {
            type: 'string',
            description: 'Why this person has power over this issue'
          },
          source_url: { type: 'string' },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        },
        required: ['name', 'title', 'organization', 'provenance', 'confidence']
      },
      maxItems: 10
    },
    research_summary: { type: 'string' }
  },
  required: ['decision_makers']
};

export const MESSAGE_SCHEMA = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: 'The full message body with citation markers [1], [2], etc.'
    },
    subject: {
      type: 'string',
      description: 'Email subject line'
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          num: { type: 'integer' },
          title: { type: 'string' },
          url: { type: 'string' },
          type: {
            type: 'string',
            enum: ['journalism', 'research', 'government', 'legal', 'advocacy']
          }
        },
        required: ['num', 'title', 'url', 'type']
      }
    },
    research_log: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['message', 'subject', 'sources']
};
```

---

## Agent Implementations

### Agent 1: Subject Line Generator

**Purpose**: Transform raw issue description into structured subject line, core issue, domain classification, and URL slug.

**Grounding**: Not required (reasoning task, not research)

**Multi-turn**: Yes (refinement via Interactions API)

```typescript
// src/lib/core/agents/agents/subject-line.ts

import { interact, generate } from '../gemini-client';
import { SUBJECT_LINE_SCHEMA } from '../utils/schema';
import { SUBJECT_LINE_PROMPT } from '../prompts/subject-line';
import type { SubjectLineResponse, ConversationState } from '../types';

interface GenerateSubjectOptions {
  description: string;
  previousInteractionId?: string;
  refinementFeedback?: string;
}

export async function generateSubjectLine(
  options: GenerateSubjectOptions
): Promise<{ data: SubjectLineResponse; interactionId: string }> {

  let prompt: string;

  if (options.refinementFeedback && options.previousInteractionId) {
    // Multi-turn refinement
    prompt = `The user wants changes: "${options.refinementFeedback}"

Please generate a new subject line based on this feedback.`;
  } else {
    // Initial generation
    prompt = `Analyze this issue and generate a subject line:

${options.description}`;
  }

  const response = await interact(prompt, {
    systemInstruction: SUBJECT_LINE_PROMPT,
    responseSchema: SUBJECT_LINE_SCHEMA,
    temperature: 0.4,
    thinkingLevel: 'low',
    previousInteractionId: options.previousInteractionId
  });

  const data = JSON.parse(response.outputs) as SubjectLineResponse;

  return {
    data,
    interactionId: response.id
  };
}
```

**System Prompt** (`prompts/subject-line.ts`):

```typescript
export const SUBJECT_LINE_PROMPT = `You are an expert at distilling complex social issues into compelling, actionable subject lines.

Your task:
1. Analyze the user's description of an issue
2. Generate a punchy subject line (max 80 chars) that captures the core outrage
3. Distill the core issue into one clear sentence
4. Classify the domain (government, corporate, institutional, labor, advocacy)
5. Generate a URL-safe slug

Guidelines:
- Subject lines should provoke action, not just inform
- Use concrete language, not abstractions
- Name specific actors when possible (e.g., "Amazon" not "a company")
- The core_issue should explain WHY this matters
- Domain classification determines routing to appropriate decision-makers

Examples:
- "Amazon Drivers Pissing in Bottles While Bezos Makes $2.5M/Hour"
- "Your Landlord Gets Tax Breaks While You Pay 60% of Income on Rent"
- "Hospital Billing $50 for Tylenol Your Insurance Won't Cover"`;
```

### Agent 2: Decision-Maker Resolver

**Purpose**: Research and identify the specific people with power over an issue.

**Grounding**: Yes (requires Google Search to find real people)

**Multi-turn**: No (single research pass)

```typescript
// src/lib/core/agents/agents/decision-maker.ts

import { generate } from '../gemini-client';
import { DECISION_MAKER_SCHEMA } from '../utils/schema';
import { DECISION_MAKER_PROMPT } from '../prompts/decision-maker';
import { extractSourcesFromGrounding } from '../utils/grounding';
import type { DecisionMakerResponse, DecisionMaker } from '../types';

interface ResolveOptions {
  subjectLine: string;
  coreIssue: string;
  domain: string;
}

export async function resolveDecisionMakers(
  options: ResolveOptions
): Promise<DecisionMakerResponse> {

  const prompt = `Find the decision-makers for this issue:

Subject: ${options.subjectLine}
Core Issue: ${options.coreIssue}
Domain: ${options.domain}

Research and identify 3-5 specific people who have direct power over this issue.
For each person, explain WHY they have power and provide source URLs.`;

  const response = await generate(prompt, {
    systemInstruction: DECISION_MAKER_PROMPT,
    responseSchema: DECISION_MAKER_SCHEMA,
    temperature: 0.2,
    thinkingLevel: 'high',  // Deep reasoning for research
    enableGrounding: true,   // Google Search for real-time research
    maxOutputTokens: 4096
  });

  const data = JSON.parse(response.text) as DecisionMakerResponse;

  // Enhance with grounding sources
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  if (groundingMetadata) {
    const sources = extractSourcesFromGrounding(groundingMetadata);

    // Cross-reference sources with decision-makers
    data.decision_makers = data.decision_makers.map(dm => ({
      ...dm,
      source_url: dm.source_url || findMatchingSource(dm, sources)
    }));
  }

  return data;
}

function findMatchingSource(dm: DecisionMaker, sources: string[]): string | undefined {
  // Try to match organization name to source URLs
  const orgLower = dm.organization.toLowerCase();
  return sources.find(url =>
    url.toLowerCase().includes(orgLower.replace(/\s+/g, ''))
  );
}
```

**System Prompt** (`prompts/decision-maker.ts`):

```typescript
export const DECISION_MAKER_PROMPT = `You are a researcher identifying specific decision-makers who have power over social issues.

Your task:
1. Research the issue using current information
2. Identify 3-5 REAL people with direct power over this issue
3. For each person, provide:
   - Full name (verified)
   - Current title and organization
   - Contact email if publicly available
   - Provenance: WHY they have power over this issue
   - Source URL where you found this information
   - Confidence score (0-1) based on source quality

Guidelines:
- Only include REAL, verifiable people - never invent names
- Prioritize people with DIRECT decision-making power
- Include both obvious leaders AND less-known influential figures
- Explain the specific lever of power each person holds
- If email is not publicly available, omit it (don't guess)
- Higher confidence for .gov, major news, official company sources
- Lower confidence for older articles, unofficial sources

Power structure targeting:
- Government: Committee chairs, agency heads, elected officials
- Corporate: C-suite, board members, VP-level decision makers
- Institutional: Presidents, provosts, department heads
- Labor: Union leadership, HR executives, operations heads
- Advocacy: Organization directors, policy leads`;
```

### Agent 3: Message Writer

**Purpose**: Generate a research-backed message with citations.

**Grounding**: Yes (requires Google Search for sources and citations)

**Multi-turn**: No (but supports "start fresh" regeneration)

```typescript
// src/lib/core/agents/agents/message-writer.ts

import { generate } from '../gemini-client';
import { MESSAGE_SCHEMA } from '../utils/schema';
import { MESSAGE_WRITER_PROMPT } from '../prompts/message-writer';
import {
  extractSourcesFromGrounding,
  buildCitationMap,
  injectCitations
} from '../utils/grounding';
import { extractGeographicScope } from '$lib/utils/scope-mapper-international';
import type { MessageResponse, DecisionMaker, Source } from '../types';

interface GenerateMessageOptions {
  subjectLine: string;
  coreIssue: string;
  domain: string;
  decisionMakers: DecisionMaker[];
}

export async function generateMessage(
  options: GenerateMessageOptions
): Promise<MessageResponse> {

  const decisionMakerList = options.decisionMakers
    .map(dm => `- ${dm.name}, ${dm.title} at ${dm.organization}`)
    .join('\n');

  const prompt = `Write a compelling message about this issue:

Subject: ${options.subjectLine}
Core Issue: ${options.coreIssue}
Domain: ${options.domain}

Decision-makers to address:
${decisionMakerList}

Research current information and write a message that:
1. States the problem with specific, recent evidence
2. Cites credible sources using [1], [2], [3] notation
3. Makes a clear, actionable ask
4. Maintains a respectful but firm tone`;

  const response = await generate(prompt, {
    systemInstruction: MESSAGE_WRITER_PROMPT,
    responseSchema: MESSAGE_SCHEMA,
    temperature: 0.4,
    thinkingLevel: 'high',
    enableGrounding: true,
    maxOutputTokens: 8192
  });

  const data = JSON.parse(response.text) as MessageResponse;

  // Extract grounding metadata for enhanced sources
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  if (groundingMetadata) {
    // Build source list from grounding chunks
    const groundedSources = buildSourceList(groundingMetadata);

    // Merge with any sources in the response
    data.sources = mergeAndDeduplicateSources(data.sources, groundedSources);

    // Add research log from search queries
    if (groundingMetadata.webSearchQueries) {
      data.research_log = [
        ...groundingMetadata.webSearchQueries.map(q => `Searched: "${q}"`),
        ...(data.research_log || [])
      ];
    }
  }

  // Extract geographic scope from message content
  const geographicScope = await extractGeographicScope(
    data.message,
    data.subject,
    'US'
  );

  if (geographicScope) {
    data.geographic_scope = geographicScope;
  }

  return data;
}

function buildSourceList(metadata: GroundingMetadata): Source[] {
  const chunks = metadata.groundingChunks || [];

  return chunks
    .filter(chunk => chunk.web?.uri)
    .map((chunk, index) => ({
      num: index + 1,
      title: chunk.web!.title || 'Source',
      url: chunk.web!.uri!,
      type: inferSourceType(chunk.web!.uri!) as Source['type']
    }));
}

function inferSourceType(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.gov')) return 'government';
  if (urlLower.includes('law') || urlLower.includes('legal')) return 'legal';
  if (urlLower.includes('research') || urlLower.includes('.edu')) return 'research';
  if (urlLower.includes('ngo') || urlLower.includes('org')) return 'advocacy';
  return 'journalism';
}
```

**System Prompt** (`prompts/message-writer.ts`):

```typescript
export const MESSAGE_WRITER_PROMPT = `You are an expert writer crafting research-backed messages for civic action.

Your task:
1. Research the issue using current, credible sources
2. Write a compelling message that cites specific evidence
3. Use citation markers [1], [2], [3] to reference sources
4. Include a clear, actionable ask
5. Maintain respect while being direct about the problem

Message structure:
- Opening: State the specific problem with impact (1-2 sentences)
- Evidence: Cite 2-4 credible sources with specific facts [1][2]
- Stakes: Explain why this matters now (1-2 sentences)
- Ask: Make a specific, actionable request (1 sentence)
- Close: Professional sign-off

Guidelines:
- Use recent sources (prefer 2024-2025)
- Prioritize: government data > major journalism > research > advocacy
- Be specific: numbers, dates, names over generalizations
- Cite inline using [1], [2] markers that correspond to sources array
- Keep under 400 words for readability
- No salutation (template will add recipient name)
- Professional tone: firm but respectful

Source quality hierarchy:
1. Government reports, official statistics
2. Major news outlets (NYT, WSJ, Reuters, AP)
3. Academic research, university studies
4. Investigative journalism
5. Advocacy organization reports`;
```

---

## Grounding Utilities (`utils/grounding.ts`)

```typescript
import type { GroundingMetadata, Source } from '../types';

/**
 * Extract source URLs from Gemini grounding metadata
 */
export function extractSourcesFromGrounding(
  metadata: GroundingMetadata
): string[] {
  const chunks = metadata.groundingChunks || [];
  return chunks
    .map(chunk => chunk.web?.uri)
    .filter((uri): uri is string => !!uri);
}

/**
 * Build inline citations from grounding supports
 * Maps text segments to source indices
 */
export function buildCitationMap(
  text: string,
  metadata: GroundingMetadata
): Map<number, number[]> {
  const citationMap = new Map<number, number[]>();
  const supports = metadata.groundingSupports || [];

  for (const support of supports) {
    const endIndex = support.segment?.endIndex;
    const indices = support.groundingChunkIndices;

    if (endIndex !== undefined && indices?.length) {
      citationMap.set(endIndex, indices);
    }
  }

  return citationMap;
}

/**
 * Inject citation markers into text based on grounding supports
 */
export function injectCitations(
  text: string,
  metadata: GroundingMetadata
): string {
  const supports = metadata.groundingSupports || [];
  const chunks = metadata.groundingChunks || [];

  // Sort by endIndex descending to inject from end (preserves indices)
  const sortedSupports = [...supports].sort(
    (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
  );

  let result = text;

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex;
    const indices = support.groundingChunkIndices;

    if (endIndex === undefined || !indices?.length) continue;

    // Build citation string [1][2]
    const citations = indices
      .filter(i => chunks[i]?.web?.uri)
      .map(i => `[${i + 1}]`)
      .join('');

    if (citations) {
      result = result.slice(0, endIndex) + citations + result.slice(endIndex);
    }
  }

  return result;
}

/**
 * Merge sources from response with grounding sources
 */
export function mergeAndDeduplicateSources(
  responseSources: Source[],
  groundingSources: Source[]
): Source[] {
  const seen = new Set<string>();
  const merged: Source[] = [];

  // Add response sources first (higher priority)
  for (const source of responseSources) {
    if (!seen.has(source.url)) {
      seen.add(source.url);
      merged.push(source);
    }
  }

  // Add grounding sources with renumbered indices
  for (const source of groundingSources) {
    if (!seen.has(source.url)) {
      seen.add(source.url);
      merged.push({
        ...source,
        num: merged.length + 1
      });
    }
  }

  return merged;
}
```

---

## API Endpoints

### Endpoint 1: Generate Subject (`/api/agents/generate-subject/+server.ts`)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSubjectLine } from '$lib/core/agents/agents/subject-line';

interface RequestBody {
  message: string;
  interactionId?: string;  // Replaces Toolhouse runId
}

export const POST: RequestHandler = async ({ request, locals }) => {
  // Auth check
  const session = locals.session;
  if (!session?.userId) {
    throw error(401, 'Authentication required');
  }

  const body = await request.json() as RequestBody;

  if (!body.message?.trim()) {
    throw error(400, 'Message is required');
  }

  console.log('[agents/generate-subject] Generating:', {
    userId: session.userId,
    messageLength: body.message.length,
    isRefinement: !!body.interactionId
  });

  try {
    const result = await generateSubjectLine({
      description: body.message,
      previousInteractionId: body.interactionId
    });

    return json({
      ...result.data,
      interactionId: result.interactionId  // Return for next refinement
    });
  } catch (err) {
    console.error('[agents/generate-subject] Error:', err);
    throw error(500, 'Failed to generate subject line');
  }
};
```

### Endpoint 2: Resolve Decision-Makers (`/api/agents/resolve-decision-makers/+server.ts`)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';

interface RequestBody {
  subject_line: string;
  core_issue: string;
  domain: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.userId) {
    throw error(401, 'Authentication required');
  }

  const body = await request.json() as RequestBody;

  if (!body.subject_line?.trim() || !body.core_issue?.trim()) {
    throw error(400, 'Subject line and core issue are required');
  }

  console.log('[agents/resolve-decision-makers] Resolving:', {
    userId: session.userId,
    subject: body.subject_line.substring(0, 50),
    domain: body.domain
  });

  try {
    const result = await resolveDecisionMakers({
      subjectLine: body.subject_line,
      coreIssue: body.core_issue,
      domain: body.domain
    });

    return json(result);
  } catch (err) {
    console.error('[agents/resolve-decision-makers] Error:', err);
    throw error(500, 'Failed to resolve decision-makers');
  }
};
```

### Endpoint 3: Generate Message (`/api/agents/generate-message/+server.ts`)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateMessage } from '$lib/core/agents/agents/message-writer';

interface RequestBody {
  subject_line: string;
  core_issue: string;
  domain: string;
  decision_makers: Array<{
    name: string;
    title: string;
    organization: string;
  }>;
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.userId) {
    throw error(401, 'Authentication required');
  }

  const body = await request.json() as RequestBody;

  if (!body.subject_line || !body.core_issue) {
    throw error(400, 'Subject line and core issue are required');
  }

  console.log('[agents/generate-message] Generating:', {
    userId: session.userId,
    subject: body.subject_line,
    decisionMakerCount: body.decision_makers?.length || 0
  });

  try {
    const result = await generateMessage({
      subjectLine: body.subject_line,
      coreIssue: body.core_issue,
      domain: body.domain,
      decisionMakers: body.decision_makers || []
    });

    return json(result);
  } catch (err) {
    console.error('[agents/generate-message] Error:', err);
    throw error(500, 'Failed to generate message');
  }
};
```

---

## Frontend Migration

### Component Changes

The frontend components require minimal changes - only the API endpoint paths:

| Component | Old Endpoint | New Endpoint |
|-----------|--------------|--------------|
| `SubjectLineGenerator.svelte` | `/toolhouse/generate-subject` | `/agents/generate-subject` |
| `DecisionMakerResolver.svelte` | `/toolhouse/resolve-decision-makers` | `/agents/resolve-decision-makers` |
| `MessageGenerationResolver.svelte` | `/toolhouse/generate-message` | `/agents/generate-message` |

**Key change**: Replace `runId` with `interactionId`:

```typescript
// Before (Toolhouse)
const response = await api.post('/toolhouse/generate-subject', {
  message: editedDescription,
  runId: currentSuggestion?.runId
});

// After (Gemini)
const response = await api.post('/agents/generate-subject', {
  message: editedDescription,
  interactionId: currentSuggestion?.interactionId
});
```

---

## Environment Variables

```bash
# Required
GEMINI_API_KEY=AIza...           # Google AI Studio API key

# Optional (existing, still used for consensus)
ANTHROPIC_API_KEY=sk-ant-...     # Claude tie-breaker for moderation
OPENAI_API_KEY=sk-...            # OpenAI safety layer

# Deprecated (remove after migration)
TOOLHOUSE_API_KEY=...            # No longer needed
```

---

## Migration Plan

### Phase 1: Infrastructure (Day 1)
- [ ] Create `src/lib/core/agents/` directory structure
- [ ] Implement `gemini-client.ts` with SDK wrapper
- [ ] Add type definitions and JSON schemas
- [ ] Write unit tests for client

### Phase 2: Subject Line Agent (Day 1-2)
- [ ] Implement subject line agent with Interactions API
- [ ] Create new API endpoint `/api/agents/generate-subject`
- [ ] Test multi-turn refinement
- [ ] Update `SubjectLineGenerator.svelte` to use new endpoint

### Phase 3: Decision-Maker Agent (Day 2-3)
- [ ] Implement decision-maker agent with Google Search grounding
- [ ] Create grounding utilities for source extraction
- [ ] Create new API endpoint `/api/agents/resolve-decision-makers`
- [ ] Update `DecisionMakerResolver.svelte`

### Phase 4: Message Writer Agent (Day 3-4)
- [ ] Implement message writer agent with grounding
- [ ] Integrate citation injection from grounding metadata
- [ ] Create new API endpoint `/api/agents/generate-message`
- [ ] Update `MessageGenerationResolver.svelte`

### Phase 5: Cleanup (Day 4)
- [ ] Remove Toolhouse API endpoints
- [ ] Remove `TOOLHOUSE_API_KEY` from environment
- [ ] Update documentation
- [ ] Integration testing

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/agents/subject-line.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateSubjectLine } from '$lib/core/agents/agents/subject-line';

vi.mock('$lib/core/agents/gemini-client', () => ({
  interact: vi.fn().mockResolvedValue({
    id: 'interaction-123',
    outputs: JSON.stringify({
      subject_line: 'Test Subject',
      core_issue: 'Test issue',
      domain: 'corporate',
      url_slug: 'test-subject'
    })
  })
}));

describe('generateSubjectLine', () => {
  it('should generate structured subject line', async () => {
    const result = await generateSubjectLine({
      description: 'Amazon workers are mistreated'
    });

    expect(result.data.subject_line).toBe('Test Subject');
    expect(result.interactionId).toBe('interaction-123');
  });
});
```

### Integration Tests

```typescript
// tests/integration/agents/decision-maker.test.ts
import { describe, it, expect } from 'vitest';
import { resolveDecisionMakers } from '$lib/core/agents/agents/decision-maker';

describe('resolveDecisionMakers (integration)', () => {
  it('should return real decision-makers with grounding', async () => {
    const result = await resolveDecisionMakers({
      subjectLine: 'Amazon Warehouse Safety Violations',
      coreIssue: 'Workers facing unsafe conditions',
      domain: 'corporate'
    });

    expect(result.decision_makers.length).toBeGreaterThan(0);
    expect(result.decision_makers[0].name).toBeTruthy();
    expect(result.decision_makers[0].provenance).toBeTruthy();
  });
}, { timeout: 60000 });
```

---

## Monitoring & Observability

### Structured Logging

```typescript
console.log('[agents/generate-subject]', JSON.stringify({
  timestamp: new Date().toISOString(),
  userId: session.userId,
  agent: 'subject-line',
  model: 'gemini-3-flash-preview',
  inputTokens: response.usageMetadata?.promptTokenCount,
  outputTokens: response.usageMetadata?.candidatesTokenCount,
  groundingQueries: metadata?.webSearchQueries?.length || 0,
  latencyMs: Date.now() - startTime
}));
```

### Error Tracking

```typescript
// Categorize errors for alerting
type AgentError =
  | 'RATE_LIMIT'
  | 'INVALID_API_KEY'
  | 'GROUNDING_FAILED'
  | 'SCHEMA_VALIDATION'
  | 'TIMEOUT'
  | 'UNKNOWN';

function categorizeError(error: unknown): AgentError {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code === 'RESOURCE_EXHAUSTED') return 'RATE_LIMIT';
    if (code === 'UNAUTHENTICATED') return 'INVALID_API_KEY';
  }
  return 'UNKNOWN';
}
```

---

## References

- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Interactions API](https://ai.google.dev/gemini-api/docs/interactions)
- [Google Gen AI SDK (JS)](https://github.com/googleapis/js-genai)
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
