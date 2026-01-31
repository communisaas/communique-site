# Firecrawl + MongoDB Atlas Integration Plan

> **Version:** 2.1.0
> **Date:** 2026-01-31
> **Status:** Wave 4 Complete — Agent-First Experience Implemented
> **Author:** Distinguished Engineering Team

---

## Paradigm Shift: Agent-First with Progressive Disclosure

**Previous trajectory:** Build search infrastructure for users to browse sources
**Revised trajectory:** Build agent augmentation with depth affordances for curious users

### The Core Insight

We were building "search" when we should be building "agent memory." The value isn't in surfacing sources—it's in agents *using* those sources to reason better, while enabling users to dive deeper when they want.

### The Experience Model

```
┌─────────────────────────────────────────────────────────────────┐
│  DEFAULT: Agent reasoning flows, user observes                  │
│                                                                 │
│  "Researching Apple's sustainability leadership..."             │
│                    └─ [clickable: see trace]                    │
│                                                                 │
│  "Lisa Jackson leads Environmental Policy. According to their   │
│   2025 report, Scope 3 emissions increased 12%."                │
│        │                      │                                 │
│        └─ [expand: bio]       └─ [expand: source]               │
│                                                                 │
│  DIVE-IN: User clicks affordance → Detail appears alongside    │
└─────────────────────────────────────────────────────────────────┘
```

### Depth Layers

| Layer | Content | Source | Access |
|-------|---------|--------|--------|
| Surface | Agent synthesis | Gemini reasoning | Always visible |
| L1 | Citations/excerpts | MongoDB cache | Click inline citation |
| L2 | Research trace | Firecrawl results | Click action segment |
| L3 | Full documents | Reducto parse | "View full document" |

---

## Implementation Progress

### Wave 1 (Completed) — Foundation
- [x] **MongoDB Atlas Infrastructure** - `src/lib/server/mongodb/`
  - Client singleton, schemas, TTL indexes, query builders, service layer
  - ✓ Valid as agent memory foundation
- [x] **Provider Architecture** - `src/lib/core/agents/providers/`
  - DecisionMakerProvider interface, GeminiProvider, Router
  - ✓ Valid as agent tool architecture

### Wave 2 (Completed) — Core Capabilities
- [x] **FirecrawlDecisionMakerProvider** - `src/lib/core/agents/providers/firecrawl-*.ts`
  - Autonomous web research, MongoDB caching, relevance filtering
  - ✓ Valid — becomes agent research tool
- [x] **TargetTypeSelector UI** - `src/lib/components/targets/`
  - ⚠️ **Reframe**: Keep as optional explicit control, but agent can infer target type
- [x] **Intelligence Orchestrator** - `src/lib/core/intelligence/`
  - ✓ Valid — powers agent context retrieval (RAG)

### Wave 3 (Completed) — Infrastructure
- [x] **IntelligencePanel UI** - `src/lib/components/intelligence/`
  - ⚠️ **Deprecate as primary UI** — wall of sources is wrong pattern
  - ✓ **Repurpose**: Components become DetailDrawer content
- [x] **Vector Search** - `src/lib/server/embeddings/`
  - ✓ Valid — powers agent RAG, not user-facing search

### Wave 4 (Completed) — Agent-First Experience
- [x] **ThoughtSegment Types** - `src/lib/core/thoughts/types.ts`
- [x] **ThoughtEmitter Service** - `src/lib/core/thoughts/emitter.ts`
- [x] **AgentMemoryService** - `src/lib/server/agent-memory/service.ts`
- [x] **ThoughtStream 2.0 UI** - `src/lib/components/thoughts/` (10 components)
  - ThoughtStream, PhaseContainer, ThoughtSegment, ActionSegment
  - InlineCitation, StreamControls, KeyMoments, DetailDrawer
  - CitationDetail, ActionDetail
- [x] **Gemini Integration** - `src/lib/core/agents/agents/decision-maker-v2.ts`
  - SSE endpoint supports v1/v2 formats
  - AgentMemoryService retrieval before reasoning
  - Structured thought emission with citations

### Phase 2A (Next) — Document Tool

> **Perceptual Goal**: Documents are evidence to trust, not content to read. L3 depth exists for verification when users need it, but the default path remains streamlined agent reasoning with L1 citation markers.

- [ ] **Reducto Integration** - `src/lib/server/reducto/` + `src/lib/core/tools/`
  - ReductoClient (API wrapper for parse/extract)
  - DocumentTool (agent-invocable analysis)
  - MongoDB caching for parsed documents
  - Integration with ThoughtEmitter (document findings as insights)
  - L3 depth layer in DetailDrawer

#### Phase 2A File Scope (~350 lines total)

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/server/reducto/client.ts` | API wrapper with chunked parsing | ~100 |
| `src/lib/server/reducto/types.ts` | ParsedDocument, Section, Entity types | ~50 |
| `src/lib/core/tools/document.ts` | Agent-invocable tool definition | ~100 |
| `src/lib/components/thoughts/DocumentDetail.svelte` | L3 focal immersion view | ~100 |

#### Perceptual Requirements

1. **L1 Integration**: Document citations appear inline with type-colored markers
   - `[📜1]` for legislative, `[📊2]` for reports, etc.
   - Minimal weight, flows with text, peripheral registration

2. **L2 Preview**: Hover shows recognition card (300ms delay)
   - Title, source, date
   - Query-relevant excerpt (why agent cited this)
   - "View Full Analysis" affordance → L3

3. **L3 Document Detail**: Slide-in drawer with structure
   - Section navigation (from Reducto structure extraction)
   - Key entities highlighted (amounts, dates, names)
   - Query-relevant sections prioritized
   - Stream de-emphasized (40% opacity) but visible

4. **Temporal**: When user is in L3, Key Moments captures stream
   - User can return and catch up via footer
   - Pause auto-engaged when L3 opens

**Scope:** Agent can analyze documents when user provides them or when relevant. On-demand parsing, cached results, cited in messages.

**Not in Phase 2A:** Proactive ingestion, legislative feeds, cross-document comparison, vote history extraction. Those remain aspirational for Phase 2B+.

---

## What Changes: Surgical Detail

### Components to Deprecate (Wrong Pattern)

| Component | Issue | Replacement |
|-----------|-------|-------------|
| `IntelligencePanel` | Wall of sources, user synthesizes | Agent synthesizes, DetailDrawer for depth |
| `CategoryFilter` | User browses categories | Agent decides relevance |
| `IntelligenceSkeleton` | Loading for source list | Phase container loading states |

### Components to Keep (Valid Foundation)

| Component | Role in New Paradigm |
|-----------|---------------------|
| `IntelligenceItem` | Repurpose as DetailDrawer content |
| `TargetCard` | Optional explicit control (agent can also infer) |
| `TargetTypeSelector` | Keep for power users who want explicit control |

### Components Built (Wave 4 Complete)

| Component | Location | Status |
|-----------|----------|--------|
| `ThoughtSegment` | `src/lib/components/thoughts/ThoughtSegment.svelte` | ✓ |
| `PhaseContainer` | `src/lib/components/thoughts/PhaseContainer.svelte` | ✓ |
| `ActionSegment` | `src/lib/components/thoughts/ActionSegment.svelte` | ✓ |
| `InlineCitation` | `src/lib/components/thoughts/InlineCitation.svelte` | ✓ |
| `KeyMoments` | `src/lib/components/thoughts/KeyMoments.svelte` | ✓ |
| `DetailDrawer` | `src/lib/components/thoughts/DetailDrawer.svelte` | ✓ |
| `StreamControls` | `src/lib/components/thoughts/StreamControls.svelte` | ✓ |
| `CitationDetail` | `src/lib/components/thoughts/CitationDetail.svelte` | ✓ |
| `ActionDetail` | `src/lib/components/thoughts/ActionDetail.svelte` | ✓ |
| `ThoughtStream` | `src/lib/components/thoughts/ThoughtStream.svelte` | ✓ |

### Backend Services Built (Wave 4 Complete)

| Service | Location | Status |
|---------|----------|--------|
| `ThoughtEmitter` | `src/lib/core/thoughts/emitter.ts` | ✓ |
| `ThoughtSegment types` | `src/lib/core/thoughts/types.ts` | ✓ |
| `AgentMemoryService` | `src/lib/server/agent-memory/service.ts` | ✓ |
| `decision-maker-v2` | `src/lib/core/agents/agents/decision-maker-v2.ts` | ✓ |

### Phase 2A Components to Build

| Component | Location | Purpose | Perceptual Role |
|-----------|----------|---------|-----------------|
| `ReductoClient` | `src/lib/server/reducto/client.ts` | API wrapper | Enables structured extraction for L3 |
| `reducto/types.ts` | `src/lib/server/reducto/types.ts` | ParsedDocument types | Structure for section nav |
| `DocumentTool` | `src/lib/core/tools/document.ts` | Agent-invocable | Triggers L1 citations with doc refs |
| `DocumentDetail` | `src/lib/components/thoughts/DocumentDetail.svelte` | L3 depth layer | Focal immersion with structure nav |
| `DocumentPreview` | `src/lib/components/thoughts/DocumentPreview.svelte` | L2 hover card | Recognition layer (300ms delay) |

---

## Perceptual Architecture

> **Meta-Principle**: The interface IS the computational substrate experienced through human perception. Data structures, rendering, timing, and interaction are all expressions of how humans actually perceive, predict, and cognize.

### Cognitive Invariants

These constraints are non-negotiable — violating them creates friction regardless of visual polish:

| Invariant | Constraint | Implication |
|-----------|------------|-------------|
| **Working Memory** | 4±1 chunks active | User tracks ≤4 changing things |
| **Attention** | Serial for focal, parallel for peripheral | L3 depth requires mode switch |
| **Causality** | >100ms feels disconnected | Action-response within frame budget |
| **Prediction** | Brain minimizes prediction error | Consistency = low cognitive load |
| **Habituation** | Repeated stimuli become invisible | Motion only for salience |

### The Three Perceptual Channels

```
L1: CITATION MARKS     → Peripheral channel (parallel, preconscious)
L2: RESEARCH TRACES    → Transition channel (triggered by attention)
L3: DOCUMENT CONTENT   → Focal channel (serial, deliberate)
```

Each layer maps to different cognitive bandwidth:

| Layer | Perceptual Mode | User Capacity | Design Treatment |
|-------|-----------------|---------------|------------------|
| **L1** | Peripheral (parallel) | High — registers without reading | Minimal weight, inline, muted color |
| **L2** | Transitional | Medium — recognition task | Near-citation popup, 1-2 chunks |
| **L3** | Focal (serial) | Low — full attention required | Mode switch, drawer/modal, navigation |

**Key Insight**: Most users never reach L3. Citations (L1) provide *ambient trust* — "this is grounded." The depth exists for verification, but the default path is streamlined reasoning.

### Temporal Design: Pace & Flow

#### The Speed Problem

```
Agent tempo:     ████████████████████████████████████ (500+ wpm)
Human reading:   ██      ██      ██      ██           (250 wpm)
Document depth:  ████████████████████████████████████████████████████
```

#### Temporal Fixes

1. **Chunked streaming** — Emit complete thought units, not characters
   - Natural ~300ms pause between thoughts
   - User perceives rhythm, not flood

2. **Phase containers** — Visual grouping with state
   - `active`: Expanded, streaming
   - `complete`: Soft-collapsed (70% opacity), hover to expand
   - No jarring auto-advance

3. **Key Moments footer** — Persistent affordance capture
   - Important items "pin" to footer as they appear
   - Never scroll away — solves temporal displacement
   - Click to jump back in stream

4. **User controls** — Agency over pace
   - Hover pauses (implicit)
   - Pause button (explicit)
   - Scroll up enters "review mode"

#### Timing Constants

```typescript
const PERCEPTUAL_TIMING = {
  // Causality budget
  INSTANT: 0,           // Direct state changes (user-caused)
  CAUSALITY_MAX: 100,   // Action must feel connected to response

  // Transitions
  SNAP: 150,            // UI reorganization
  TRANSITION: 300,      // View changes, drawer slide

  // L2 Preview behavior
  L2_HOVER_DELAY: 300,  // Prevent accidental triggers
  L2_LINGER: 150,       // Grace period when leaving

  // Streaming rhythm
  THOUGHT_PAUSE: 300,   // Between thought chunks
  PHASE_PAUSE: 500,     // Between phase transitions

  // Loading thresholds
  LOADING_THRESHOLD: 1000,  // Show progress indicator
};
```

### Document Disclosure Architecture

Documents (PDFs, bills, reports) are dense artifacts. The perceptual challenge:

> **Documents are evidence to trust, not content to read.**

The disclosure architecture serves this hierarchy:
1. **Agent reasoning** → Primary cognitive engagement
2. **Citation presence** (L1) → Peripheral trust signal ("grounded")
3. **Document preview** (L2) → Recognition ("what is this?")
4. **Document content** (L3) → Verification ("is this correct?")

#### Document Disclosure State Machine

```
                    ┌─────────────┐
                    │  STREAMING  │ ← Default: following agent
                    └──────┬──────┘
                           │
              hover L1     │
                           ▼
                    ┌─────────────┐
                    │  L2 PREVIEW │ ← Recognition layer
                    └──────┬──────┘
                           │
              click "View" │     escape/click-away
                           ▼            │
                    ┌─────────────┐     │
                    │  L3 DRAWER  │ ────┘
                    │  (document) │ ← Focal immersion
                    └─────────────┘
                           │
              close drawer │
                           ▼
                    ┌─────────────┐
                    │  STREAMING  │ ← Return with Key Moments catch-up
                    └─────────────┘
```

#### L2 Preview Card (Recognition Layer)

Appears on hover, 300ms delay. Shows just enough for recognition:

```
┌─────────────────────────────────────────┐
│ 📜 H.R. 4521: CHIPS and Science Act     │  ← Title (recognition)
│ Congress.gov • Enacted 2022-08-09       │  ← Source + temporal
├─────────────────────────────────────────┤
│ "...establishes a $52 billion fund      │  ← Relevance snippet
│ for domestic semiconductor manufac..."  │     (why agent cited)
├─────────────────────────────────────────┤
│ [View Full Analysis]                    │  ← L3 affordance
└─────────────────────────────────────────┘
```

#### L3 Document Detail (Focal Immersion)

When user enters L3, they're in the document, not following the agent:

```
┌────────────────────────────────────────────────────────────────────┐
│  Agent Stream (de-emphasized)           │  Document Analysis       │
│  ─────────────────────────────          │  ═══════════════════     │
│  The CHIPS Act provides $52B[¹]...      │                          │
│                                         │  H.R. 4521               │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░            │  CHIPS and Science Act   │
│  (stream continues, 40% opacity)        │                          │
│                                         │  ┌─ Key Sections ──────┐ │
│                                         │  │ § 102: Funding       │ │
│                                         │  │ § 103: Allocations   │ │
│                                         │  │ § 201: Workforce     │ │
│                                         │  └─────────────────────┘ │
├─────────────────────────────────────────┴──────────────────────────┤
│ 🎯 KEY MOMENTS                                        [⏸️ Paused]  │
└────────────────────────────────────────────────────────────────────┘
```

#### Document Type Visual Encoding

Peripheral color recognition (no text parsing needed):

| Type | Color Token | Example Sources |
|------|-------------|-----------------|
| Legislative | `--doc-legislative` (amber) | Bills, resolutions, amendments |
| Official | `--doc-official` (slate) | Agency reports, filings |
| Media | `--doc-media` (blue) | News articles, analysis |
| Corporate | `--doc-corporate` (emerald) | SEC filings, announcements |
| Academic | `--doc-academic` (purple) | Research papers, studies |

### Visual Hierarchy as Perceptual Priority

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   AGENT STREAM (primary attention)                               │
│   ─────────────────────────────────                              │
│   Text with inline citations[¹] that signal                      │
│   evidence without interrupting flow[²]...                       │
│                      ↑                                           │
│              L1: Peripheral markers                              │
│                                                                  │
│        ┌─────────────────────┐                                   │
│        │ L2 PREVIEW (hover)  │  ← Transition channel             │
│        │ Recognition layer   │     (triggered, not forced)       │
│        └─────────────────────┘                                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   L3 DRAWER (slide-in, focal mode)                               │
│   ═══════════════════════════════                                │
│   Full document with structure,                                  │
│   entities, cross-references...                                  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ 🎯 KEY MOMENTS (sticky)              [1] [2] [3]       [⏸️ ▶️]  │
└──────────────────────────────────────────────────────────────────┘
```

### Implementation Checklist (Perceptual)

Before shipping any interface change:

- [ ] **Working Memory**: User holds ≤4 chunks at any moment?
- [ ] **Causality**: Action-response within 100ms budget?
- [ ] **Consistency**: Timing constants used (not ad-hoc durations)?
- [ ] **Peripheral**: Critical state visible without focal attention?
- [ ] **Recognition > Recall**: Clickable options over text input?
- [ ] **Reversibility**: Every action undoable or clearly destructive?
- [ ] **Mode Clarity**: User knows which layer they're in (L1/L2/L3)?

---

## Executive Summary (Revised)

This document details the implementation of **agent-augmented civic engagement** for Communique:

1. **Universal Decision-Maker Discovery** — Agents research and identify optimal recipients using Firecrawl, with research traces available for curious users.

2. **Contextual Intelligence** — Agents retrieve and synthesize relevant context (news, legislative activity, announcements) into their reasoning, with citations expandable for verification.

3. **Progressive Disclosure** — Default flow shows agent thinking; depth layers (L1-L3) available via inline affordances for users who want to dive deeper.

All capabilities backed by **MongoDB Atlas** as agent memory, **Voyage AI** for semantic retrieval, **Firecrawl** for research, and **Reducto** for document analysis.

---

## Table of Contents

1. [Infrastructure: MongoDB Atlas](#1-infrastructure-mongodb-atlas)
2. [Feature 1: Universal Decision-Maker Discovery](#2-feature-1-universal-decision-maker-discovery)
3. [Feature 2: Real-Time Issue Intelligence](#3-feature-2-real-time-issue-intelligence)
4. [Feature 3: Semantic Capabilities (MongoDB + Voyage AI)](#4-feature-3-semantic-capabilities-mongodb--voyage-ai)
5. [Feature 4: Deep Document Intelligence (Reducto)](#5-feature-4-deep-document-intelligence-reducto)
6. [**NEW: Wave 4 — Agent-First Experience**](#6-wave-4--agent-first-experience)
7. [Implementation Phases](#7-implementation-phases)
8. [Cost Analysis](#8-cost-analysis)
9. [Architecture Diagrams](#9-architecture-diagrams)

---

## 0. Wave 4: Agent-First Experience (Detailed Specs)

This section details the new paradigm implementation — agent-first reasoning with progressive disclosure for user dive-ins.

### 0.1 ThoughtSegment Data Model

```typescript
// src/lib/core/thoughts/types.ts

/**
 * A structured thought unit emitted by the agent.
 * Replaces raw text streaming with rich, expandable content.
 */
interface ThoughtSegment {
  id: string;
  timestamp: number;

  // Segment classification
  type: 'reasoning' | 'action' | 'citation' | 'insight' | 'recommendation';
  phase: string;  // e.g., 'research', 'context', 'drafting'

  // What the user sees by default
  content: string;

  // Progressive disclosure layers
  expandable: boolean;
  expansion?: {
    summary: string;           // L1: Brief expansion
    details?: StructuredData;  // L2: Research trace, source metadata
    raw?: string;              // L3: Full content (Reducto parse, full article)
  };

  // Inline citations within content
  citations?: Citation[];

  // For action segments (research, retrieval)
  action?: ActionTrace;

  // Visual treatment hints
  emphasis?: 'normal' | 'highlight' | 'muted';
  pinToKeyMoments?: boolean;
}

interface Citation {
  id: string;
  startOffset: number;      // Position in content string
  endOffset: number;
  label: string;            // "Apple's 2025 Report"
  url?: string;
  excerpt: string;          // Relevant snippet
  mongoId?: string;         // Reference to MongoDB intelligence item
  documentId?: string;      // Reference to Reducto-parsed doc
}

interface ActionTrace {
  type: 'research' | 'retrieve' | 'analyze' | 'search';
  target: string;           // What was researched/retrieved
  status: 'pending' | 'complete' | 'error';
  startTime: number;
  endTime?: number;

  // For research actions (Firecrawl)
  pagesVisited?: { url: string; title: string; relevant: boolean }[];
  findings?: string[];

  // For retrieval actions (MongoDB/Vector Search)
  query?: string;
  resultsCount?: number;
  topResults?: { id: string; title: string; score: number }[];
}

interface StructuredData {
  type: 'research_trace' | 'source_metadata' | 'document_excerpt' | 'entity_details';
  data: Record<string, unknown>;
}
```

### 0.2 ThoughtStream Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  ThoughtStream                                                  │
│  ├── StreamHeader (phase indicator, pause/resume)               │
│  ├── PhaseContainer[] (collapsible phase groups)                │
│  │   ├── PhaseHeader (title, status, collapse toggle)           │
│  │   └── ThoughtSegment[] (individual thoughts)                 │
│  │       ├── ReasoningSegment (plain text with citations)       │
│  │       ├── ActionSegment (expandable research/retrieval)      │
│  │       ├── InsightSegment (highlighted findings)              │
│  │       └── InlineCitation (clickable source refs)             │
│  └── KeyMoments (sticky footer with pinned affordances)         │
│                                                                 │
│  DetailDrawer (slides in on affordance click)                   │
│  ├── SourceDetail (L1: excerpt + metadata)                      │
│  ├── ResearchDetail (L2: full trace)                            │
│  └── DocumentDetail (L3: Reducto parse)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 0.3 Component Specifications

#### ThoughtSegment.svelte
```svelte
<!-- Core expandable thought unit -->
<script lang="ts">
  import type { ThoughtSegment } from '$lib/core/thoughts/types';
  import InlineCitation from './InlineCitation.svelte';
  import ActionSegment from './ActionSegment.svelte';

  interface Props {
    segment: ThoughtSegment;
    onCitationClick: (citation: Citation) => void;
    onActionExpand: (action: ActionTrace) => void;
  }

  let { segment, onCitationClick, onActionExpand }: Props = $props();
</script>

<div
  class="thought-segment"
  class:highlight={segment.emphasis === 'highlight'}
  class:muted={segment.emphasis === 'muted'}
>
  {#if segment.type === 'action'}
    <ActionSegment
      action={segment.action}
      onexpand={onActionExpand}
    />
  {:else}
    <p class="thought-content">
      <!-- Render content with inline citations -->
      {@html renderWithCitations(segment.content, segment.citations, onCitationClick)}
    </p>
  {/if}
</div>
```

#### PhaseContainer.svelte
```svelte
<!-- Visual grouping of related thoughts -->
<script lang="ts">
  interface Props {
    phase: string;
    status: 'pending' | 'active' | 'complete';
    children: Snippet;
  }

  let { phase, status, children }: Props = $props();
  let collapsed = $state(status === 'complete');
</script>

<section
  class="phase-container"
  class:active={status === 'active'}
  class:complete={status === 'complete'}
  class:collapsed
>
  <header class="phase-header" onclick={() => collapsed = !collapsed}>
    <span class="phase-name">{phase}</span>
    <span class="phase-status">
      {#if status === 'active'}
        <span class="pulse">●</span> In progress
      {:else if status === 'complete'}
        ✓ Complete
      {/if}
    </span>
    <button class="collapse-toggle" aria-expanded={!collapsed}>
      {collapsed ? '▶' : '▼'}
    </button>
  </header>

  {#if !collapsed}
    <div class="phase-content" transition:slide>
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .phase-container.complete {
    opacity: 0.7;
    transform: scale(0.98);
    transition: all 200ms ease;
  }
  .phase-container.complete:hover {
    opacity: 1;
    transform: scale(1);
  }
  .phase-container.active {
    border-left: 3px solid var(--color-primary);
  }
</style>
```

#### KeyMoments.svelte
```svelte
<!-- Sticky footer capturing important affordances -->
<script lang="ts">
  import type { Citation, ActionTrace } from '$lib/core/thoughts/types';

  interface KeyMoment {
    id: string;
    type: 'citation' | 'action' | 'insight';
    label: string;
    icon: string;
    data: Citation | ActionTrace | string;
  }

  interface Props {
    moments: KeyMoment[];
    onmomentclick: (moment: KeyMoment) => void;
  }

  let { moments, onmomentclick }: Props = $props();
</script>

<footer class="key-moments" aria-label="Key moments for exploration">
  <span class="label">Key Moments</span>
  <div class="moments-row">
    {#each moments as moment (moment.id)}
      <button
        class="moment-chip"
        onclick={() => onmomentclick(moment)}
      >
        <span class="icon">{moment.icon}</span>
        <span class="text">{moment.label}</span>
      </button>
    {/each}
  </div>
</footer>

<style>
  .key-moments {
    position: sticky;
    bottom: 0;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .moments-row {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
  }
  .moment-chip {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    background: var(--color-muted);
    border: 1px solid var(--color-border);
    font-size: 0.8125rem;
    cursor: pointer;
    white-space: nowrap;
    transition: all 150ms ease;
  }
  .moment-chip:hover {
    background: var(--color-primary-muted);
    border-color: var(--color-primary);
  }
</style>
```

### 0.4 AgentMemoryService

```typescript
// src/lib/server/agent-memory/service.ts

import { getDb } from '$lib/server/mongodb';
import { createEmbedding } from '$lib/server/embeddings';

/**
 * Retrieval-Augmented Generation layer for agent context.
 * Agents query this before reasoning to get relevant context.
 */
export class AgentMemoryService {

  /**
   * Retrieve relevant context for agent reasoning.
   * Combines semantic search with recency and relevance scoring.
   */
  static async retrieveContext(params: {
    topic: string;
    targetType?: string;
    targetEntity?: string;
    limit?: number;
  }): Promise<AgentContext> {
    const db = await getDb();
    const embedding = await createEmbedding(params.topic, 'query');

    // Parallel retrieval from multiple sources
    const [intelligence, orgContext, recentActivity] = await Promise.all([
      this.searchIntelligence(db, embedding, params),
      params.targetEntity ? this.getOrgContext(db, params.targetEntity) : null,
      this.getRecentActivity(db, params.topic)
    ]);

    return {
      intelligence: intelligence.slice(0, params.limit || 5),
      organization: orgContext,
      recentActivity,
      synthesizedContext: this.synthesize(intelligence, orgContext, recentActivity)
    };
  }

  /**
   * Synthesize retrieved context into a prompt-ready summary.
   */
  private static synthesize(
    intelligence: IntelligenceItem[],
    org: OrganizationContext | null,
    activity: ActivityItem[]
  ): string {
    const parts: string[] = [];

    if (org) {
      parts.push(`Target organization: ${org.name}`);
      parts.push(`Key leadership: ${org.leadership.map(l => `${l.name} (${l.title})`).join(', ')}`);
    }

    if (intelligence.length > 0) {
      parts.push(`\nRecent relevant intelligence:`);
      intelligence.forEach((item, i) => {
        parts.push(`${i + 1}. [${item.category}] ${item.title} (${item.sourceName}, ${formatRelativeTime(item.publishedAt)})`);
      });
    }

    if (activity.length > 0) {
      parts.push(`\nRecent activity:`);
      activity.forEach(a => parts.push(`- ${a.summary}`));
    }

    return parts.join('\n');
  }
}

interface AgentContext {
  intelligence: IntelligenceItem[];
  organization: OrganizationContext | null;
  recentActivity: ActivityItem[];
  synthesizedContext: string;  // Ready for prompt injection
}
```

### 0.5 ThoughtEmitter (Agent-Side)

```typescript
// src/lib/core/thoughts/emitter.ts

/**
 * Structured thought emission for agents.
 * Replaces raw text streaming with rich ThoughtSegments.
 */
export class ThoughtEmitter {
  private segments: ThoughtSegment[] = [];
  private currentPhase: string = 'init';
  private keyMoments: KeyMoment[] = [];
  private onEmit: (segment: ThoughtSegment) => void;

  constructor(onEmit: (segment: ThoughtSegment) => void) {
    this.onEmit = onEmit;
  }

  /**
   * Start a new phase (e.g., 'research', 'context', 'drafting')
   */
  startPhase(phase: string): void {
    this.currentPhase = phase;
    this.emit({
      type: 'reasoning',
      phase,
      content: '', // Phase start marker
      emphasis: 'normal'
    });
  }

  /**
   * Emit a reasoning thought
   */
  think(content: string, options?: {
    citations?: Citation[];
    emphasis?: 'normal' | 'highlight' | 'muted';
    pin?: boolean;
  }): void {
    const segment = this.emit({
      type: 'reasoning',
      phase: this.currentPhase,
      content,
      citations: options?.citations,
      emphasis: options?.emphasis || 'normal',
      expandable: !!options?.citations?.length,
      pinToKeyMoments: options?.pin
    });

    if (options?.pin) {
      this.keyMoments.push({
        id: segment.id,
        type: 'insight',
        label: content.slice(0, 30) + '...',
        icon: '💡',
        data: content
      });
    }
  }

  /**
   * Start a research action
   */
  startResearch(target: string): ActionHandle {
    const actionId = crypto.randomUUID();
    const action: ActionTrace = {
      type: 'research',
      target,
      status: 'pending',
      startTime: Date.now(),
      pagesVisited: [],
      findings: []
    };

    this.emit({
      type: 'action',
      phase: this.currentPhase,
      content: `Researching ${target}...`,
      action,
      expandable: true,
      pinToKeyMoments: true
    });

    return {
      addPage: (url: string, title: string, relevant: boolean) => {
        action.pagesVisited?.push({ url, title, relevant });
      },
      addFinding: (finding: string) => {
        action.findings?.push(finding);
      },
      complete: (summary: string) => {
        action.status = 'complete';
        action.endTime = Date.now();
        this.think(summary, { pin: true });
      },
      error: (message: string) => {
        action.status = 'error';
        action.endTime = Date.now();
        this.think(`Research failed: ${message}`, { emphasis: 'muted' });
      }
    };
  }

  /**
   * Cite a source inline
   */
  cite(label: string, source: {
    url?: string;
    excerpt: string;
    mongoId?: string;
  }): Citation {
    const citation: Citation = {
      id: crypto.randomUUID(),
      startOffset: 0, // Will be set by think()
      endOffset: 0,
      label,
      ...source
    };

    this.keyMoments.push({
      id: citation.id,
      type: 'citation',
      label,
      icon: '📄',
      data: citation
    });

    return citation;
  }

  private emit(partial: Partial<ThoughtSegment>): ThoughtSegment {
    const segment: ThoughtSegment = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'reasoning',
      phase: this.currentPhase,
      content: '',
      expandable: false,
      ...partial
    };

    this.segments.push(segment);
    this.onEmit(segment);
    return segment;
  }

  getKeyMoments(): KeyMoment[] {
    return this.keyMoments;
  }
}

interface ActionHandle {
  addPage: (url: string, title: string, relevant: boolean) => void;
  addFinding: (finding: string) => void;
  complete: (summary: string) => void;
  error: (message: string) => void;
}
```

### 0.6 Integration with Existing Gemini Flow

```typescript
// Example: Enhanced decision-maker resolution

async function resolveDecisionMaker(
  context: ResolveContext,
  emitter: ThoughtEmitter
): Promise<DecisionMakerResult> {

  emitter.startPhase('understanding');
  emitter.think(`Understanding your intent: ${context.subjectLine}`);

  // Retrieve relevant context from agent memory
  emitter.startPhase('context');
  const memory = await AgentMemoryService.retrieveContext({
    topic: context.coreMessage,
    targetType: context.targetType,
    targetEntity: context.targetEntity
  });

  if (memory.intelligence.length > 0) {
    const topItem = memory.intelligence[0];
    const citation = emitter.cite(topItem.title, {
      url: topItem.sourceUrl,
      excerpt: topItem.snippet,
      mongoId: topItem.id
    });
    emitter.think(
      `Recent development: ${topItem.title}. This is relevant to your message.`,
      { citations: [citation], pin: true }
    );
  }

  // Research target if needed
  if (context.targetType !== 'congress' && context.targetEntity) {
    emitter.startPhase('research');
    const research = emitter.startResearch(`${context.targetEntity} leadership`);

    try {
      const result = await firecrawlProvider.resolve(context);
      research.addFinding(`Found ${result.decisionMakers.length} decision-makers`);
      research.complete(
        `Identified ${result.decisionMakers[0].name} as optimal recipient`
      );
      return result;
    } catch (e) {
      research.error(e.message);
      // Fallback to Gemini
    }
  }

  // Standard Gemini flow
  emitter.startPhase('resolution');
  return geminiProvider.resolve(context, emitter);
}
```

---

## 1. Infrastructure: MongoDB Atlas

### 1.1 Why MongoDB Atlas Over Redis

| Aspect | Redis | MongoDB Atlas |
|--------|-------|---------------|
| **Data Model** | Key-value (flat) | Documents (hierarchical) |
| **Org Profiles** | Serialize to JSON string | Native document storage |
| **Querying** | Key lookup only | Rich queries across cached data |
| **TTL Expiration** | Per-key TTL | TTL indexes on any field |
| **Vector Search** | Requires separate service | Built-in Atlas Vector Search |
| **Semantic Features** | ❌ | Voyage AI embeddings, reranking |
| **Hybrid Search** | ❌ | Full-text + semantic combined |
| **Infrastructure** | Separate service | Already provisioned |

**Decision:** MongoDB Atlas is the better choice because:
- Cached data is structured (org profiles with nested leadership, intelligence items)
- We need queryability across cached items (e.g., "find all orgs in healthcare sector")
- Vector search enables semantic features without additional infrastructure
- Single database for operational data AND intelligence/cache layer

### 1.2 Connection Configuration

```typescript
// src/lib/server/mongodb.ts

import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
// mongodb+srv://communique:***REMOVED***@cluster0.udtiui.mongodb.net/?appName=Cluster0

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable to preserve connection across HMR
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI!, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(MONGODB_URI!, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  clientPromise = client.connect();
}

export async function getMongoClient(): Promise<MongoClient> {
  return clientPromise;
}

export async function getDatabase(name: string = 'communique') {
  const client = await getMongoClient();
  return client.db(name);
}
```

### 1.3 Database Schema

```typescript
// src/lib/server/mongodb/schema.ts

// Database: communique
// Collections:

/**
 * organizations - Cached organization profiles from Firecrawl
 * TTL: 30 days for profiles, 7 days for leadership
 */
interface OrganizationDocument {
  _id: string;                          // Normalized org name as ID
  name: string;                         // Official name
  normalizedName: string;               // Lowercase, trimmed for matching
  website?: string;                     // Primary URL
  about?: string;                       // Mission/description
  industry?: string;                    // Sector classification
  headquarters?: string;                // Location
  employeeCount?: string;               // Size range

  // Leadership (refreshed more frequently)
  leadership: LeaderDocument[];
  leadershipUpdatedAt: Date;

  // Policy positions
  policyPositions: PolicyPositionDocument[];

  // Contact info
  contacts: {
    general?: string;
    press?: string;
    stakeholder?: string;
    phone?: string;
  };

  // Embeddings for semantic search
  embedding?: number[];                 // Voyage AI embedding of about + policy
  embeddingModel?: string;              // e.g., 'voyage-3-large'

  // Metadata
  source: 'firecrawl' | 'manual' | 'enriched';
  firecrawlJobId?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;                      // TTL index target
}

interface LeaderDocument {
  name: string;
  title: string;
  email?: string;
  linkedin?: string;
  department?: string;
  isVerified: boolean;
  verifiedAt?: Date;
  sourceUrl?: string;
}

interface PolicyPositionDocument {
  topic: string;
  position: string;
  sourceUrl?: string;
  extractedAt: Date;
}

/**
 * intelligence_items - Cached news, legislative activity, etc.
 * TTL: 1-7 days depending on category
 */
interface IntelligenceItemDocument {
  _id: string;                          // Hash of URL + category
  category: 'news' | 'legislative' | 'regulatory' | 'corporate' | 'social';

  title: string;
  source: string;                       // Publication name
  sourceUrl: string;
  publishedAt: Date;
  snippet: string;
  fullContent?: string;                 // For RAG if available

  // Semantic indexing
  topics: string[];                     // Extracted topics
  entities: string[];                   // Named entities
  embedding?: number[];                 // For semantic search

  // Relevance metadata
  relevanceScore?: number;              // Firecrawl's assessment
  sentiment?: 'positive' | 'negative' | 'neutral';

  // Geographic scope
  geographicScope?: {
    country?: string;
    subdivision?: string;
    locality?: string;
  };

  // Metadata
  source: 'firecrawl' | 'congress_api' | 'rss';
  createdAt: Date;
  expiresAt: Date;                      // TTL index
}

/**
 * decision_maker_cache - Cached decision-maker lookups
 * TTL: 7 days
 */
interface DecisionMakerCacheDocument {
  _id: string;                          // Hash of query params
  queryHash: string;

  // Query parameters (for cache key matching)
  targetType: string;
  targetEntity?: string;
  topics: string[];

  // Results
  decisionMakers: DecisionMakerDocument[];
  provider: 'gemini' | 'firecrawl' | 'hybrid';

  // Metadata
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;                     // For analytics
  lastHitAt: Date;
}

/**
 * template_embeddings - Semantic index of published templates
 * For "similar templates" and semantic search
 */
interface TemplateEmbeddingDocument {
  _id: string;                          // Template ID from Postgres
  templateId: string;

  // Searchable content
  title: string;
  description: string;
  messageBody: string;                  // Without variable placeholders
  topics: string[];

  // Embedding
  embedding: number[];                  // Voyage AI embedding
  embeddingModel: string;

  // Metadata for filtering
  targetType?: string;
  jurisdictionLevel?: string;
  category: string;

  // Stats for ranking
  sendCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### 1.4 Index Definitions

```javascript
// MongoDB Atlas Index Definitions (run via Atlas UI or mongosh)

// TTL Indexes for automatic expiration
db.organizations.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });
db.intelligence_items.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });
db.decision_maker_cache.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

// Query indexes
db.organizations.createIndex({ "normalizedName": 1 });
db.organizations.createIndex({ "industry": 1, "updatedAt": -1 });
db.intelligence_items.createIndex({ "category": 1, "publishedAt": -1 });
db.intelligence_items.createIndex({ "topics": 1, "publishedAt": -1 });

// Vector Search Index (via Atlas UI)
// Name: org_embedding_index
// Collection: organizations
// Definition:
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "dotProduct"
    },
    {
      "type": "filter",
      "path": "industry"
    }
  ]
}

// Vector Search Index for templates
// Name: template_embedding_index
// Collection: template_embeddings
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "dotProduct"
    },
    {
      "type": "filter",
      "path": "category"
    },
    {
      "type": "filter",
      "path": "targetType"
    }
  ]
}

// Vector Search Index for intelligence
// Name: intelligence_embedding_index
// Collection: intelligence_items
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "dotProduct"
    },
    {
      "type": "filter",
      "path": "category"
    },
    {
      "type": "filter",
      "path": "topics"
    }
  ]
}
```

---

## 2. Feature 1: Universal Decision-Maker Discovery

### 2.1 Problem Statement

Current decision-maker resolution works well for government targets (Congress, state legislatures) via Gemini's Google Search grounding. However, it struggles with:

- **Corporations** — Complex leadership structures, investor relations pages
- **Nonprofits** — Varied website structures, board pages
- **Educational institutions** — Administration hierarchies, school boards
- **Healthcare** — Hospital systems, regulatory bodies
- **Labor unions** — Union leadership, local chapters

### 2.2 Solution: Provider-Based Architecture

```typescript
// src/lib/core/agents/providers/types.ts

export type TargetType =
  | 'congress'           // Federal legislators (CWC API)
  | 'state_legislature'  // State legislators
  | 'local_government'   // City/county officials, school boards
  | 'corporate'          // Companies
  | 'nonprofit'          // NGOs, foundations
  | 'education'          // Schools, universities
  | 'healthcare'         // Hospitals, health systems
  | 'labor'              // Unions
  | 'media';             // News organizations

export interface DecisionMakerProvider {
  readonly name: string;
  readonly supportedTargetTypes: TargetType[];

  canResolve(context: ResolveContext): boolean;
  resolve(context: ResolveContext): Promise<DecisionMakerResult>;
}

export interface ResolveContext {
  targetType: TargetType;
  targetEntity?: string;        // "Amazon", "NYC City Council"
  targetUrl?: string;           // https://amazon.com
  subjectLine: string;
  coreMessage: string;
  topics: string[];
  geographicScope?: GeographicScope;
  voiceSample?: string;
}

export interface DecisionMakerResult {
  decisionMakers: ProcessedDecisionMaker[];
  provider: string;
  orgProfile?: OrganizationProfile;     // For org targets
  cacheHit: boolean;
  latencyMs: number;
}
```

### 2.3 Firecrawl Provider Implementation

```typescript
// src/lib/core/agents/providers/firecrawl-provider.ts

import FirecrawlApp from '@mendable/firecrawl-js';
import { getDatabase } from '$lib/server/mongodb';
import type {
  DecisionMakerProvider,
  ResolveContext,
  DecisionMakerResult,
  TargetType
} from './types';

export class FirecrawlDecisionMakerProvider implements DecisionMakerProvider {
  readonly name = 'firecrawl';
  readonly supportedTargetTypes: TargetType[] = [
    'corporate',
    'nonprofit',
    'education',
    'healthcare',
    'labor',
    'media'
  ];

  private firecrawl: FirecrawlApp;

  constructor() {
    this.firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY!
    });
  }

  canResolve(context: ResolveContext): boolean {
    return this.supportedTargetTypes.includes(context.targetType);
  }

  async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
    const startTime = Date.now();
    const { targetEntity, targetUrl, subjectLine, topics } = context;

    if (!targetEntity) {
      throw new Error('Target entity required for organization lookup');
    }

    // Phase 1: Check MongoDB cache
    const cached = await this.checkCache(targetEntity);
    if (cached && !this.isStale(cached)) {
      const relevant = await this.filterByRelevance(
        cached.leadership,
        subjectLine,
        topics
      );
      return {
        decisionMakers: relevant,
        provider: this.name,
        orgProfile: cached,
        cacheHit: true,
        latencyMs: Date.now() - startTime
      };
    }

    // Phase 2: Discover via Firecrawl Agent
    const orgProfile = await this.discoverOrganization(
      targetEntity,
      targetUrl,
      topics
    );

    // Phase 3: Cache to MongoDB
    await this.cacheOrganization(orgProfile);

    // Phase 4: Filter to relevant decision-makers
    const relevant = await this.filterByRelevance(
      orgProfile.leadership,
      subjectLine,
      topics
    );

    return {
      decisionMakers: relevant,
      provider: this.name,
      orgProfile,
      cacheHit: false,
      latencyMs: Date.now() - startTime
    };
  }

  private async checkCache(entity: string): Promise<OrganizationDocument | null> {
    const db = await getDatabase();
    const normalizedName = entity.toLowerCase().trim();

    return db.collection('organizations').findOne({
      normalizedName,
      expiresAt: { $gt: new Date() }
    });
  }

  private isStale(org: OrganizationDocument): boolean {
    const leadershipAge = Date.now() - org.leadershipUpdatedAt.getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    return leadershipAge > SEVEN_DAYS;
  }

  private async discoverOrganization(
    entity: string,
    url: string | undefined,
    topics: string[]
  ): Promise<OrganizationProfile> {
    const result = await this.firecrawl.agent({
      prompt: this.buildDiscoveryPrompt(entity, topics),
      schema: OrganizationProfileSchema,
      model: 'spark-1-pro',
      maxCredits: 20
    });

    if (!result.data) {
      throw new Error(`Failed to discover organization: ${entity}`);
    }

    return {
      ...result.data,
      name: entity,
      normalizedName: entity.toLowerCase().trim(),
      source: 'firecrawl',
      firecrawlJobId: result.id
    };
  }

  private buildDiscoveryPrompt(entity: string, topics: string[]): string {
    return `
Research ${entity} to find decision-makers with authority over: ${topics.join(', ')}

## Required Information

### Organization Overview
- Official name and any common aliases
- Mission statement or description
- Industry/sector classification
- Headquarters location
- Approximate employee count

### Leadership Team
For each executive, board member, or department head with potential authority over the topics:
- Full name (as it appears officially)
- Official title
- Email address (CRITICAL - search thoroughly)
- LinkedIn profile URL
- Department or area of responsibility

### Email Discovery Strategy
Search these locations for email addresses:
1. Contact page and footer
2. About/Team/Leadership pages
3. Press/Media contact sections
4. Investor relations (for public companies)
5. Staff directory if available
6. Individual bio pages

If you find any email at the organization, infer the pattern:
- john.doe@company.com → firstname.lastname@company.com
- jdoe@company.com → firstinitiallastname@company.com

### Policy Positions
Any stated positions, commitments, or policies related to: ${topics.join(', ')}
Include source URLs for verification.

### Contact Information
- General inquiries email
- Press/media contact
- Stakeholder relations
- Main phone number

## Output Requirements
- Only include information you can verify from the website
- Mark emails as verified (found directly) or inferred (pattern-based)
- Include source URLs for all leadership entries
- If leadership is not found, return empty array (don't guess)
`.trim();
  }

  private async cacheOrganization(org: OrganizationProfile): Promise<void> {
    const db = await getDatabase();

    // Generate embedding for semantic search
    const textForEmbedding = [
      org.name,
      org.about,
      org.industry,
      ...org.policyPositions.map(p => `${p.topic}: ${p.position}`)
    ].filter(Boolean).join(' ');

    const embedding = await this.generateEmbedding(textForEmbedding);

    const document: OrganizationDocument = {
      _id: org.normalizedName,
      ...org,
      embedding,
      embeddingModel: 'voyage-3-large',
      createdAt: new Date(),
      updatedAt: new Date(),
      leadershipUpdatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };

    await db.collection('organizations').replaceOne(
      { _id: org.normalizedName },
      document,
      { upsert: true }
    );
  }

  private async filterByRelevance(
    leaders: LeaderDocument[],
    subjectLine: string,
    topics: string[]
  ): Promise<ProcessedDecisionMaker[]> {
    // Use Gemini to filter leadership to those relevant to the issue
    const relevant = await generateWithThoughts<{ relevant: string[] }>(
      `Given these leaders and their titles, identify which ones have authority over this issue.

Issue: ${subjectLine}
Topics: ${topics.join(', ')}

Leaders:
${leaders.map(l => `- ${l.name}: ${l.title}`).join('\n')}

Return the names of leaders with direct or indirect authority over this issue.`,
      {
        temperature: 0.2,
        thinkingLevel: 'low'
      }
    );

    const relevantNames = new Set(relevant.data?.relevant || []);

    return leaders
      .filter(l => relevantNames.has(l.name) || this.inferRelevance(l.title, topics))
      .map(l => ({
        name: l.name,
        title: l.title,
        organization: '', // Will be filled by caller
        email: l.email || '',
        reasoning: `Identified via organization research`,
        sourceUrl: l.sourceUrl || '',
        emailSource: l.isVerified ? 'verified' : 'inferred',
        confidence: l.isVerified ? 0.9 : 0.7,
        contactChannel: l.email ? 'email' : 'linkedin',
        isAiResolved: true,
        provenance: `Found via Firecrawl organization discovery`
      }));
  }

  private inferRelevance(title: string, topics: string[]): boolean {
    const titleLower = title.toLowerCase();

    // C-suite always relevant
    if (/\b(ceo|cfo|coo|cto|president|chairman|director)\b/.test(titleLower)) {
      return true;
    }

    // Topic-specific matching
    const topicKeywords = topics.flatMap(t => t.toLowerCase().split(/[\s-]+/));
    return topicKeywords.some(kw => titleLower.includes(kw));
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use MongoDB Atlas Voyage AI API
    const response = await fetch('https://cloud.mongodb.com/api/atlas/v2/groups/{groupId}/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MONGODB_API_KEY}`
      },
      body: JSON.stringify({
        model: 'voyage-3-large',
        input: text
      })
    });

    const result = await response.json();
    return result.embedding;
  }
}
```

### 2.4 Decision-Maker Router

```typescript
// src/lib/core/agents/decision-maker-router.ts

import { GeminiDecisionMakerProvider } from './providers/gemini-provider';
import { FirecrawlDecisionMakerProvider } from './providers/firecrawl-provider';
import type {
  DecisionMakerProvider,
  ResolveContext,
  DecisionMakerResult,
  TargetType
} from './providers/types';

export class DecisionMakerRouter {
  private providers: Map<TargetType, DecisionMakerProvider>;
  private fallbackProvider: DecisionMakerProvider;

  constructor() {
    const gemini = new GeminiDecisionMakerProvider();
    const firecrawl = new FirecrawlDecisionMakerProvider();

    this.providers = new Map();
    this.fallbackProvider = firecrawl; // Firecrawl Agent can handle unknowns

    // Register Gemini for government
    for (const type of gemini.supportedTargetTypes) {
      this.providers.set(type, gemini);
    }

    // Register Firecrawl for organizations
    for (const type of firecrawl.supportedTargetTypes) {
      this.providers.set(type, firecrawl);
    }
  }

  async resolve(context: ResolveContext): Promise<DecisionMakerResult> {
    const provider = this.providers.get(context.targetType);

    if (!provider || !provider.canResolve(context)) {
      console.log(`[router] No specific provider for ${context.targetType}, using fallback`);
      return this.fallbackProvider.resolve(context);
    }

    try {
      return await provider.resolve(context);
    } catch (error) {
      console.error(`[router] Provider ${provider.name} failed, trying fallback:`, error);

      // Try fallback if primary fails
      if (provider !== this.fallbackProvider) {
        return this.fallbackProvider.resolve(context);
      }

      throw error;
    }
  }

  getProviderForType(type: TargetType): DecisionMakerProvider | undefined {
    return this.providers.get(type);
  }
}

// Singleton export
export const decisionMakerRouter = new DecisionMakerRouter();
```

### 2.5 UI: Target Type Selector

```svelte
<!-- src/lib/components/template/creator/TargetTypeSelector.svelte -->
<script lang="ts">
  import type { TargetType } from '$lib/core/agents/providers/types';
  import { slide, fade } from 'svelte/transition';

  interface Props {
    value: TargetType | null;
    entity: string;
    onSelect: (type: TargetType) => void;
    onEntityChange: (entity: string) => void;
  }

  let { value, entity, onSelect, onEntityChange }: Props = $props();

  const targetTypes = [
    {
      type: 'congress' as const,
      label: 'US Congress',
      icon: '🏛️',
      description: 'Federal legislators',
      requiresEntity: false
    },
    {
      type: 'state_legislature' as const,
      label: 'State Legislature',
      icon: '🏢',
      description: 'State senators and representatives',
      requiresEntity: false
    },
    {
      type: 'local_government' as const,
      label: 'Local Government',
      icon: '🏘️',
      description: 'City council, county supervisors, school boards',
      requiresEntity: false
    },
    {
      type: 'corporate' as const,
      label: 'Corporation',
      icon: '🏢',
      description: 'Company leadership and board',
      requiresEntity: true,
      placeholder: 'Enter company name (e.g., Amazon, ExxonMobil)'
    },
    {
      type: 'nonprofit' as const,
      label: 'Nonprofit',
      icon: '💚',
      description: 'NGO, foundation, or advocacy group',
      requiresEntity: true,
      placeholder: 'Enter organization name'
    },
    {
      type: 'education' as const,
      label: 'Educational Institution',
      icon: '🎓',
      description: 'University, school district, college',
      requiresEntity: true,
      placeholder: 'Enter institution name'
    },
    {
      type: 'healthcare' as const,
      label: 'Healthcare',
      icon: '🏥',
      description: 'Hospital, health system, insurer',
      requiresEntity: true,
      placeholder: 'Enter organization name'
    }
  ];

  const selectedType = $derived(targetTypes.find(t => t.type === value));
  const showEntityInput = $derived(selectedType?.requiresEntity ?? false);
</script>

<div class="target-selector">
  <div class="type-grid">
    {#each targetTypes as target}
      <button
        type="button"
        class="type-card"
        class:selected={value === target.type}
        onclick={() => onSelect(target.type)}
      >
        <span class="type-icon">{target.icon}</span>
        <span class="type-label">{target.label}</span>
        <span class="type-description">{target.description}</span>
      </button>
    {/each}
  </div>

  {#if showEntityInput}
    <div class="entity-input" transition:slide={{ duration: 200 }}>
      <label for="target-entity" class="entity-label">
        Which {selectedType?.label.toLowerCase()}?
      </label>
      <input
        id="target-entity"
        type="text"
        class="entity-field"
        placeholder={selectedType?.placeholder}
        value={entity}
        oninput={(e) => onEntityChange(e.currentTarget.value)}
      />
    </div>
  {/if}
</div>

<style>
  .target-selector {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .type-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-surface);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
  }

  .type-card:hover {
    border-color: var(--color-primary-300);
    background: var(--color-primary-50);
  }

  .type-card.selected {
    border-color: var(--color-primary-500);
    background: var(--color-primary-100);
  }

  .type-icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .type-label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--color-text);
  }

  .type-description {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 0.25rem;
  }

  .entity-input {
    padding: 1rem;
    background: var(--color-surface-elevated);
    border-radius: 0.5rem;
  }

  .entity-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .entity-field {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    font-size: 1rem;
  }

  .entity-field:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 3px var(--color-primary-100);
  }
</style>
```

---

## 3. Feature 2: Real-Time Issue Intelligence

### 3.1 Problem Statement

Template creators manually research issues before writing. The current source discovery (via Gemini grounding) finds URLs, but doesn't surface:

- **What's happening now** — Breaking news, recent developments
- **Legislative context** — Active bills, recent votes, committee activity
- **Stakeholder positions** — Who's saying what about this issue
- **Trend signals** — Is this issue rising or declining in attention?

### 3.2 Solution: Intelligence Orchestration

```typescript
// src/lib/core/intelligence/types.ts

export type IntelligenceCategory =
  | 'news'           // Breaking news, recent coverage
  | 'legislative'    // Bills, votes, committee activity
  | 'regulatory'     // Rules, regulations, agency actions
  | 'corporate'      // Earnings, announcements, filings
  | 'social';        // Public sentiment, trending

export interface IntelligenceProvider {
  readonly name: string;
  readonly category: IntelligenceCategory;

  gather(context: IntelligenceContext): AsyncGenerator<IntelligenceUpdate>;
}

export interface IntelligenceContext {
  topics: string[];
  geographicScope?: GeographicScope;
  targetType?: TargetType;
  targetEntity?: string;
  timeHorizon: 'day' | 'week' | 'month';
}

export interface IntelligenceUpdate {
  type: 'item' | 'summary' | 'complete' | 'error';
  category: IntelligenceCategory;
  data: IntelligenceItem | IntelligenceSummary;
}

export interface IntelligenceItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  publishedAt: Date;
  snippet: string;

  // Semantic metadata
  topics: string[];
  entities: string[];
  relevance: number;
  sentiment?: 'positive' | 'negative' | 'neutral';

  // For UI
  category: IntelligenceCategory;
  isActionable: boolean;  // Can be used as source in message
}

export interface IntelligenceSummary {
  category: IntelligenceCategory;
  headline: string;
  keyPoints: string[];
  trend?: 'rising' | 'stable' | 'declining';
  itemCount: number;
}
```

### 3.3 Firecrawl News Provider

```typescript
// src/lib/core/intelligence/providers/firecrawl-news.ts

import FirecrawlApp from '@mendable/firecrawl-js';
import { getDatabase } from '$lib/server/mongodb';
import type {
  IntelligenceProvider,
  IntelligenceContext,
  IntelligenceUpdate,
  IntelligenceItem
} from '../types';

export class FirecrawlNewsProvider implements IntelligenceProvider {
  readonly name = 'firecrawl-news';
  readonly category = 'news' as const;

  private firecrawl: FirecrawlApp;

  constructor() {
    this.firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY!
    });
  }

  async *gather(context: IntelligenceContext): AsyncGenerator<IntelligenceUpdate> {
    const { topics, geographicScope, timeHorizon } = context;

    // Check cache first
    const cached = await this.checkCache(topics, timeHorizon);
    if (cached.length > 0) {
      for (const item of cached) {
        yield { type: 'item', category: 'news', data: item };
      }

      const summary = this.generateSummary(cached);
      yield { type: 'summary', category: 'news', data: summary };
      yield { type: 'complete', category: 'news', data: summary };
      return;
    }

    // Use Firecrawl Agent for news discovery
    try {
      const result = await this.firecrawl.agent({
        prompt: this.buildNewsPrompt(topics, geographicScope, timeHorizon),
        schema: NewsDiscoverySchema,
        model: 'spark-1-mini',  // Faster for news
        maxCredits: 10
      });

      const items: IntelligenceItem[] = [];

      for (const article of result.data?.articles || []) {
        const item = this.toIntelligenceItem(article, topics);
        items.push(item);

        // Cache immediately
        await this.cacheItem(item);

        // Yield to stream
        yield { type: 'item', category: 'news', data: item };
      }

      const summary = this.generateSummary(items);
      yield { type: 'summary', category: 'news', data: summary };
      yield { type: 'complete', category: 'news', data: summary };

    } catch (error) {
      yield {
        type: 'error',
        category: 'news',
        data: { message: 'News discovery failed', error: String(error) }
      };
    }
  }

  private buildNewsPrompt(
    topics: string[],
    geo: GeographicScope | undefined,
    horizon: string
  ): string {
    const location = geo?.subdivision
      ? `in ${geo.subdivision}, ${geo.country}`
      : geo?.country
        ? `in ${geo.country}`
        : '';

    const timeframe = horizon === 'day' ? 'last 24 hours' :
                      horizon === 'week' ? 'past 7 days' : 'past 30 days';

    return `
Find recent news coverage about: ${topics.join(', ')} ${location}

## Requirements
- Focus on the ${timeframe}
- Include major news outlets and relevant local sources
- For each article:
  1. Full headline
  2. Publication name
  3. URL (must be accessible)
  4. Publication date
  5. 2-3 sentence summary of key points
  6. Any notable quotes from officials or stakeholders
  7. Sentiment (positive/negative/neutral toward the issue)

## Prioritize
- Breaking news and recent developments
- Policy announcements and legislative activity
- Statements from decision-makers
- Data or research findings
- Local coverage for location-specific issues

## Output
Return up to 10 most relevant and recent articles.
`.trim();
  }

  private async checkCache(
    topics: string[],
    horizon: string
  ): Promise<IntelligenceItem[]> {
    const db = await getDatabase();

    const cutoff = new Date();
    if (horizon === 'day') cutoff.setHours(cutoff.getHours() - 24);
    else if (horizon === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setDate(cutoff.getDate() - 30);

    // Check cache freshness (1 hour for news)
    const cacheCutoff = new Date(Date.now() - 60 * 60 * 1000);

    const items = await db.collection('intelligence_items')
      .find({
        category: 'news',
        topics: { $in: topics },
        publishedAt: { $gte: cutoff },
        createdAt: { $gte: cacheCutoff }
      })
      .sort({ publishedAt: -1 })
      .limit(10)
      .toArray();

    return items as IntelligenceItem[];
  }

  private async cacheItem(item: IntelligenceItem): Promise<void> {
    const db = await getDatabase();

    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(
      `${item.title} ${item.snippet}`
    );

    await db.collection('intelligence_items').updateOne(
      { _id: item.id },
      {
        $set: {
          ...item,
          embedding,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      },
      { upsert: true }
    );
  }

  private generateSummary(items: IntelligenceItem[]): IntelligenceSummary {
    const sentiments = items.map(i => i.sentiment).filter(Boolean);
    const posCount = sentiments.filter(s => s === 'positive').length;
    const negCount = sentiments.filter(s => s === 'negative').length;

    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    if (items.length > 5) trend = 'rising';

    return {
      category: 'news',
      headline: items.length > 0
        ? `${items.length} recent articles found`
        : 'No recent coverage found',
      keyPoints: items.slice(0, 3).map(i => i.title),
      trend,
      itemCount: items.length
    };
  }

  private toIntelligenceItem(
    article: any,
    queryTopics: string[]
  ): IntelligenceItem {
    return {
      id: this.hashUrl(article.url),
      title: article.title,
      source: article.publication,
      sourceUrl: article.url,
      publishedAt: new Date(article.date),
      snippet: article.summary,
      topics: queryTopics,
      entities: article.entities || [],
      relevance: article.relevance || 0.7,
      sentiment: article.sentiment,
      category: 'news',
      isActionable: true
    };
  }

  private hashUrl(url: string): string {
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `news_${Math.abs(hash).toString(16)}`;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use MongoDB Atlas Voyage AI API
    // Implementation same as org provider
    return [];
  }
}
```

### 3.4 Intelligence Orchestrator

```typescript
// src/lib/core/intelligence/orchestrator.ts

import { FirecrawlNewsProvider } from './providers/firecrawl-news';
import { LegislativeProvider } from './providers/legislative';
import { CorporateProvider } from './providers/corporate';
import type {
  IntelligenceProvider,
  IntelligenceContext,
  IntelligenceUpdate
} from './types';

export class IntelligenceOrchestrator {
  private providers: IntelligenceProvider[];

  constructor() {
    this.providers = [
      new FirecrawlNewsProvider(),
      new LegislativeProvider(),
      new CorporateProvider(),
    ];
  }

  async *gather(context: IntelligenceContext): AsyncGenerator<IntelligenceUpdate> {
    // Filter to relevant providers
    const relevant = this.providers.filter(p =>
      this.isRelevant(p, context)
    );

    if (relevant.length === 0) {
      return;
    }

    // Run providers in parallel, merge streams
    const generators = relevant.map(p => p.gather(context));
    yield* this.mergeStreams(generators);
  }

  private isRelevant(provider: IntelligenceProvider, context: IntelligenceContext): boolean {
    // News is always relevant
    if (provider.category === 'news') return true;

    // Legislative relevant for government targets
    if (provider.category === 'legislative') {
      return ['congress', 'state_legislature', 'local_government'].includes(
        context.targetType || ''
      );
    }

    // Corporate relevant for company targets
    if (provider.category === 'corporate') {
      return context.targetType === 'corporate' && !!context.targetEntity;
    }

    return true;
  }

  private async *mergeStreams(
    generators: AsyncGenerator<IntelligenceUpdate>[]
  ): AsyncGenerator<IntelligenceUpdate> {
    // Track active generators
    interface PendingResult {
      result: IteratorResult<IntelligenceUpdate>;
      index: number;
      gen: AsyncGenerator<IntelligenceUpdate>;
    }

    const pending: Promise<PendingResult>[] = generators.map((gen, index) =>
      gen.next().then(result => ({ result, index, gen }))
    );

    const active = new Set(generators.map((_, i) => i));

    while (active.size > 0) {
      const { result, index, gen } = await Promise.race(
        pending.filter((_, i) => active.has(i))
      );

      if (result.done) {
        active.delete(index);
      } else {
        yield result.value;

        // Queue next from this generator
        pending[index] = gen.next().then(r => ({ result: r, index, gen }));
      }
    }
  }
}

// Singleton
export const intelligenceOrchestrator = new IntelligenceOrchestrator();
```

### 3.5 UI: Intelligence Panel

```svelte
<!-- src/lib/components/template/creator/IntelligencePanel.svelte -->
<script lang="ts">
  import type { IntelligenceItem, IntelligenceSummary } from '$lib/core/intelligence/types';
  import IntelligenceItemCard from './IntelligenceItemCard.svelte';
  import IntelligenceSummaryCard from './IntelligenceSummaryCard.svelte';
  import { slide } from 'svelte/transition';

  interface Props {
    items: IntelligenceItem[];
    summaries: IntelligenceSummary[];
    isLoading: boolean;
    onUseSource: (item: IntelligenceItem) => void;
  }

  let { items, summaries, isLoading, onUseSource }: Props = $props();

  let activeCategory = $state<string>('all');
  let isExpanded = $state(true);

  const categories = $derived([...new Set(items.map(i => i.category))]);

  const filteredItems = $derived(
    activeCategory === 'all'
      ? items
      : items.filter(i => i.category === activeCategory)
  );

  const categoryLabels: Record<string, string> = {
    news: 'News',
    legislative: 'Legislative',
    regulatory: 'Regulatory',
    corporate: 'Corporate',
    social: 'Social'
  };
</script>

<aside class="intelligence-panel" class:collapsed={!isExpanded}>
  <header class="panel-header">
    <button
      class="expand-toggle"
      onclick={() => isExpanded = !isExpanded}
      aria-expanded={isExpanded}
    >
      <h3 class="panel-title">
        {#if isLoading}
          <span class="loading-indicator"></span>
          Researching...
        {:else}
          What's Happening
        {/if}
      </h3>
      <span class="toggle-icon">{isExpanded ? '−' : '+'}</span>
    </button>
  </header>

  {#if isExpanded}
    <div class="panel-content" transition:slide={{ duration: 200 }}>
      <!-- Category tabs -->
      {#if categories.length > 1}
        <nav class="category-tabs" role="tablist">
          <button
            role="tab"
            class="tab"
            class:active={activeCategory === 'all'}
            onclick={() => activeCategory = 'all'}
          >
            All ({items.length})
          </button>
          {#each categories as category}
            <button
              role="tab"
              class="tab"
              class:active={activeCategory === category}
              onclick={() => activeCategory = category}
            >
              {categoryLabels[category] || category}
            </button>
          {/each}
        </nav>
      {/if}

      <!-- Summaries -->
      {#if summaries.length > 0}
        <div class="summaries">
          {#each summaries as summary}
            <IntelligenceSummaryCard {summary} />
          {/each}
        </div>
      {/if}

      <!-- Items -->
      <div class="items-list">
        {#each filteredItems as item (item.id)}
          <IntelligenceItemCard
            {item}
            onUse={() => onUseSource(item)}
          />
        {/each}

        {#if filteredItems.length === 0 && !isLoading}
          <p class="empty-state">
            No recent coverage found for this topic.
          </p>
        {/if}
      </div>
    </div>
  {/if}
</aside>

<style>
  .intelligence-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .panel-header {
    padding: 0;
  }

  .expand-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
  }

  .expand-toggle:hover {
    background: var(--color-surface-elevated);
  }

  .panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .loading-indicator {
    width: 0.5rem;
    height: 0.5rem;
    background: var(--color-primary-500);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .panel-content {
    border-top: 1px solid var(--color-border);
  }

  .category-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--color-surface-elevated);
    overflow-x: auto;
  }

  .tab {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    white-space: nowrap;
  }

  .tab:hover {
    background: var(--color-surface);
  }

  .tab.active {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    font-weight: 500;
  }

  .summaries {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .items-list {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 24rem;
    overflow-y: auto;
  }

  .empty-state {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    padding: 2rem 1rem;
  }
</style>
```

---

## 4. Feature 3: Semantic Capabilities (MongoDB + Voyage AI)

### 4.1 High-Impact Semantic Features

Based on MongoDB Atlas + Voyage AI capabilities:

#### 4.1.1 Similar Templates Discovery

Find templates semantically similar to the one being created.

```typescript
// src/lib/core/search/similar-templates.ts

import { getDatabase } from '$lib/server/mongodb';

export async function findSimilarTemplates(
  embedding: number[],
  options: {
    category?: string;
    targetType?: string;
    limit?: number;
    excludeId?: string;
  } = {}
): Promise<SimilarTemplate[]> {
  const db = await getDatabase();

  const pipeline = [
    {
      $vectorSearch: {
        index: 'template_embedding_index',
        path: 'embedding',
        queryVector: embedding,
        numCandidates: 100,
        limit: options.limit || 5,
        filter: {
          ...(options.category && { category: options.category }),
          ...(options.targetType && { targetType: options.targetType }),
          ...(options.excludeId && { templateId: { $ne: options.excludeId } })
        }
      }
    },
    {
      $project: {
        templateId: 1,
        title: 1,
        description: 1,
        topics: 1,
        sendCount: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    }
  ];

  const results = await db.collection('template_embeddings')
    .aggregate(pipeline)
    .toArray();

  return results as SimilarTemplate[];
}
```

**UI Integration:** Show "Similar templates" sidebar when creating a new template.

#### 4.1.2 Semantic Template Search

Search templates by meaning, not just keywords.

```typescript
// src/lib/core/search/semantic-search.ts

export async function semanticTemplateSearch(
  query: string,
  options: {
    category?: string;
    limit?: number;
  } = {}
): Promise<SearchResult[]> {
  // Generate embedding for query
  const embedding = await generateEmbedding(query);

  const db = await getDatabase();

  // Hybrid search: combine vector + full-text
  const pipeline = [
    {
      $vectorSearch: {
        index: 'template_embedding_index',
        path: 'embedding',
        queryVector: embedding,
        numCandidates: 100,
        limit: 50
      }
    },
    {
      $addFields: {
        vectorScore: { $meta: 'vectorSearchScore' }
      }
    },
    // Add full-text search score
    {
      $unionWith: {
        coll: 'template_embeddings',
        pipeline: [
          {
            $search: {
              index: 'template_text_index',
              text: {
                query: query,
                path: ['title', 'description', 'messageBody']
              }
            }
          },
          {
            $addFields: {
              textScore: { $meta: 'searchScore' }
            }
          },
          { $limit: 50 }
        ]
      }
    },
    // Combine scores
    {
      $group: {
        _id: '$templateId',
        doc: { $first: '$$ROOT' },
        vectorScore: { $max: '$vectorScore' },
        textScore: { $max: '$textScore' }
      }
    },
    {
      $addFields: {
        combinedScore: {
          $add: [
            { $multiply: [{ $ifNull: ['$vectorScore', 0] }, 0.6] },
            { $multiply: [{ $ifNull: ['$textScore', 0] }, 0.4] }
          ]
        }
      }
    },
    { $sort: { combinedScore: -1 } },
    { $limit: options.limit || 10 }
  ];

  return db.collection('template_embeddings')
    .aggregate(pipeline)
    .toArray();
}
```

#### 4.1.3 Intelligent Source Matching

Match intelligence items to template topics semantically.

```typescript
// src/lib/core/intelligence/semantic-matching.ts

export async function findRelevantIntelligence(
  templateEmbedding: number[],
  options: {
    categories?: string[];
    timeHorizon?: 'day' | 'week' | 'month';
    limit?: number;
  } = {}
): Promise<IntelligenceItem[]> {
  const db = await getDatabase();

  const cutoff = new Date();
  if (options.timeHorizon === 'day') cutoff.setHours(cutoff.getHours() - 24);
  else if (options.timeHorizon === 'week') cutoff.setDate(cutoff.getDate() - 7);
  else cutoff.setDate(cutoff.getDate() - 30);

  const pipeline = [
    {
      $vectorSearch: {
        index: 'intelligence_embedding_index',
        path: 'embedding',
        queryVector: templateEmbedding,
        numCandidates: 100,
        limit: options.limit || 10,
        filter: {
          ...(options.categories && { category: { $in: options.categories } }),
          publishedAt: { $gte: cutoff }
        }
      }
    },
    {
      $addFields: {
        relevanceScore: { $meta: 'vectorSearchScore' }
      }
    }
  ];

  return db.collection('intelligence_items')
    .aggregate(pipeline)
    .toArray();
}
```

#### 4.1.4 Organization Similarity Clustering

Find organizations with similar policy positions.

```typescript
// src/lib/core/organizations/similar-orgs.ts

export async function findSimilarOrganizations(
  orgId: string,
  options: { limit?: number; industry?: string } = {}
): Promise<SimilarOrg[]> {
  const db = await getDatabase();

  // Get source org embedding
  const sourceOrg = await db.collection('organizations').findOne({ _id: orgId });
  if (!sourceOrg?.embedding) {
    throw new Error('Organization not found or not embedded');
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: 'org_embedding_index',
        path: 'embedding',
        queryVector: sourceOrg.embedding,
        numCandidates: 50,
        limit: (options.limit || 5) + 1, // +1 to exclude self
        filter: {
          _id: { $ne: orgId },
          ...(options.industry && { industry: options.industry })
        }
      }
    },
    {
      $project: {
        name: 1,
        industry: 1,
        about: 1,
        leadershipCount: { $size: '$leadership' },
        similarity: { $meta: 'vectorSearchScore' }
      }
    }
  ];

  return db.collection('organizations')
    .aggregate(pipeline)
    .toArray();
}
```

### 4.2 Reranking for RAG

Use Voyage AI reranking to improve source relevance.

```typescript
// src/lib/core/agents/reranking.ts

export async function rerankSources(
  query: string,
  sources: VerifiedSource[],
  topK: number = 5
): Promise<VerifiedSource[]> {
  // Use MongoDB Atlas Reranking API (Voyage AI)
  const response = await fetch(
    'https://cloud.mongodb.com/api/atlas/v2/groups/{groupId}/rerank',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MONGODB_API_KEY}`
      },
      body: JSON.stringify({
        model: 'rerank-2',
        query: query,
        documents: sources.map(s => ({
          id: s.url,
          text: `${s.title}. ${s.snippet}`
        })),
        top_k: topK
      })
    }
  );

  const result = await response.json();

  // Reorder sources by reranking score
  const scoreMap = new Map(
    result.results.map((r: any) => [r.document.id, r.score])
  );

  return sources
    .filter(s => scoreMap.has(s.url))
    .sort((a, b) => (scoreMap.get(b.url) || 0) - (scoreMap.get(a.url) || 0));
}
```

---

## 5. Feature 4: Deep Document Intelligence (Reducto)

### 5.1 What is Reducto?

[Reducto](https://reducto.ai/) is an AI-powered document processing platform that converts PDFs, images, spreadsheets, and 30+ other formats into structured JSON data. Key capabilities:

- **Vision-first parsing** — Detects layout, structure, and reading order across complex documents
- **Agentic OCR** — VLM agent reviews and corrects OCR errors in real-time
- **Schema-based extraction** — Pull specific fields with precision
- **99.24% accuracy** — Proven in healthcare document processing
- **$108M funded** — Series B, processing ~1 billion pages for enterprises

### 5.2 Analysis: Is Reducto Worth Integrating?

#### Current Gap in Communique

The existing Firecrawl + Gemini stack handles **web content** well but struggles with:

| Document Type | Current Approach | Limitation |
|---------------|------------------|------------|
| **Legislative bills** | Gemini searches web summaries | Can't cite specific sections |
| **SEC filings (10-K, 10-Q)** | Firecrawl extracts from web | Misses detailed data in PDFs |
| **Academic research** | Links to papers | Can't extract methodology/stats |
| **Government reports** | News summaries | Loses nuanced recommendations |

#### What Reducto Unlocks

| Use Case | Value for Communique |
|----------|---------------------|
| **Bill Text Extraction** | Parse full bill PDFs from [Congress.gov](https://www.congress.gov/help/legislation-text) / [GovInfo](https://www.govinfo.gov/features/api), enable citations like "Section 3(a) states..." |
| **SEC Filing Analysis** | Parse 10-K/10-Q for labor practices, environmental data, executive compensation — enrich corporate org profiles |
| **Policy Document Understanding** | Parse GAO reports, CBO analyses — extract verified statistics for templates |
| **Academic Paper Citations** | Extract methodology, findings, sample sizes — more rigorous sourcing |

#### Cost Analysis

| Document Type | Pages | Cost @ $0.015/page |
|---------------|-------|-------------------|
| Congressional bill (average) | 20-50 | $0.30-$0.75 |
| SEC 10-K filing | 80-200 | $1.20-$3.00 |
| GAO report | 30-100 | $0.45-$1.50 |
| Academic paper | 10-30 | $0.15-$0.45 |

**Monthly projection (1K templates, 20% needing document processing):**
- 200 templates × 25 pages average = 5,000 pages
- Cost: **~$75-$150/month**

### 5.3 Recommendation: Phase 2 Feature

**Verdict: Worth including, but as Phase 2 "Deep Research" capability.**

**Rationale:**
1. **Phase 1 can launch without it** — Firecrawl + Gemini covers 90% of use cases
2. **High value for power users** — Legislative advocates, corporate accountability researchers
3. **Clean integration** — Node.js SDK is well-designed, ~1 week effort
4. **Differentiation** — No other civic tech platform offers this depth

### 5.4 Proposed Architecture

```typescript
// src/lib/core/documents/reducto-client.ts

import Reducto from 'reductoai';

export class DocumentIntelligenceService {
  private reducto: Reducto;

  constructor() {
    this.reducto = new Reducto({
      apiKey: process.env.REDUCTO_API_KEY
    });
  }

  /**
   * Parse a legislative bill and extract structured data
   */
  async parseBill(billUrl: string): Promise<ParsedBill> {
    // 1. Download PDF from Congress.gov/GovInfo
    const pdfUrl = this.resolveBillPdfUrl(billUrl);

    // 2. Parse with Reducto
    const parsed = await this.reducto.parse.run({
      input: pdfUrl,
      options: {
        chunking: 'semantic',  // For RAG
        tableMode: 'structured'
      }
    });

    // 3. Extract bill-specific fields
    const extracted = await this.reducto.extract.run({
      input: { jobId: parsed.jobId },
      schema: BillSchema,
      prompt: `Extract bill metadata, sponsors, key provisions, and section summaries`
    });

    // 4. Cache in MongoDB
    await this.cacheParsedDocument('bill', billUrl, {
      parsed: parsed.result,
      extracted: extracted.result
    });

    return extracted.result;
  }

  /**
   * Parse SEC filing for corporate intelligence
   */
  async parseSECFiling(
    ticker: string,
    filingType: '10-K' | '10-Q' | '8-K'
  ): Promise<ParsedSECFiling> {
    // 1. Get filing URL from SEC EDGAR
    const filingUrl = await this.getLatestFilingUrl(ticker, filingType);

    // 2. Parse with Reducto
    const parsed = await this.reducto.parse.run({
      input: filingUrl,
      options: {
        tableMode: 'structured',
        chunkingMode: 'section'  // Preserve document sections
      }
    });

    // 3. Extract specific intelligence
    const extracted = await this.reducto.extract.run({
      input: { jobId: parsed.jobId },
      schema: SECFilingSchema,
      prompt: `Extract:
        - Executive compensation details
        - Labor and workforce disclosures
        - Environmental commitments and liabilities
        - Risk factors related to: ${this.topics.join(', ')}
        - Key financial metrics`
    });

    return extracted.result;
  }

  /**
   * Parse government report (GAO, CBO, agency)
   */
  async parseGovernmentReport(reportUrl: string): Promise<ParsedReport> {
    const parsed = await this.reducto.parse.run({
      input: reportUrl,
      options: {
        chunkingMode: 'semantic',
        extractFigures: true
      }
    });

    const extracted = await this.reducto.extract.run({
      input: { jobId: parsed.jobId },
      schema: GovernmentReportSchema,
      prompt: `Extract:
        - Executive summary key points
        - Recommendations (numbered list)
        - Key statistics and findings
        - Methodology if present
        - Publication date and authoring agency`
    });

    return extracted.result;
  }
}
```

### 5.5 MongoDB Schema for Parsed Documents

```typescript
// Add to schema.ts

/**
 * parsed_documents - Cached Reducto extractions
 * TTL: 30 days (documents don't change once published)
 */
interface ParsedDocumentDocument {
  _id: string;                          // Hash of source URL
  sourceUrl: string;
  documentType: 'bill' | 'sec_filing' | 'government_report' | 'academic_paper';

  // Raw parse result
  rawChunks: {
    text: string;
    page: number;
    boundingBox?: BoundingBox;
    type: 'text' | 'table' | 'figure';
  }[];

  // Structured extraction
  extracted: Record<string, unknown>;   // Schema-specific

  // Embeddings for semantic search
  embedding?: number[];
  embeddingModel?: string;

  // Metadata
  title?: string;
  publishedAt?: Date;
  source: 'congress_gov' | 'sec_edgar' | 'gao' | 'academic';

  // Processing metadata
  reductoJobId: string;
  pagesProcessed: number;
  creditsUsed: number;

  createdAt: Date;
  expiresAt: Date;
}

// Bill-specific extraction schema
interface ParsedBill {
  billNumber: string;                   // e.g., "H.R. 842"
  congress: number;                     // e.g., 117
  title: string;
  shortTitle?: string;
  sponsors: {
    name: string;
    party: string;
    state: string;
    role: 'sponsor' | 'cosponsor';
  }[];

  sections: {
    number: string;                     // e.g., "Sec. 3"
    title: string;
    summary: string;
    fullText: string;
    pageRange: [number, number];
  }[];

  keyProvisions: string[];
  effectiveDate?: string;
  relatedBills?: string[];
}

// SEC filing extraction schema
interface ParsedSECFiling {
  ticker: string;
  companyName: string;
  filingType: string;
  filingDate: Date;
  fiscalYear: number;

  executiveCompensation?: {
    executives: {
      name: string;
      title: string;
      totalCompensation: number;
      salary: number;
      bonus: number;
      stockAwards: number;
    }[];
  };

  laborDisclosures?: {
    employeeCount?: number;
    unionizedPercentage?: number;
    workforceInitiatives?: string[];
    laborRisks?: string[];
  };

  environmentalDisclosures?: {
    emissions?: string;
    commitments?: string[];
    liabilities?: string;
    climateRisks?: string[];
  };

  riskFactors: {
    category: string;
    description: string;
  }[];
}
```

### 5.6 UI Integration: Deep Research Mode

```svelte
<!-- src/lib/components/template/creator/DeepResearchToggle.svelte -->
<script lang="ts">
  interface Props {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    documentSources: DocumentSource[];
    onAddSource: (url: string) => void;
  }

  let { enabled, onToggle, documentSources, onAddSource }: Props = $props();
</script>

<div class="deep-research-section">
  <div class="toggle-row">
    <label class="toggle-label">
      <input
        type="checkbox"
        checked={enabled}
        onchange={(e) => onToggle(e.currentTarget.checked)}
      />
      <span class="toggle-text">
        Deep Research Mode
        <span class="badge">Beta</span>
      </span>
    </label>
    <p class="toggle-description">
      Parse full legislative bills, SEC filings, and government reports for precise citations.
    </p>
  </div>

  {#if enabled}
    <div class="document-sources" transition:slide>
      <h4>Document Sources</h4>

      <div class="source-input">
        <input
          type="url"
          placeholder="Paste Congress.gov bill URL, SEC filing, or report link..."
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              onAddSource(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
        />
      </div>

      {#each documentSources as source}
        <DocumentSourceCard {source} />
      {/each}

      <p class="credit-note">
        Deep research uses ~$0.50-$2.00 per document depending on length.
      </p>
    </div>
  {/if}
</div>
```

### 5.7 Integration with Message Generation

```typescript
// Enhanced message-writer.ts

export async function generateMessage(
  options: GenerateMessageOptions & {
    parsedDocuments?: ParsedDocumentDocument[];  // From Reducto
  }
): Promise<MessageResponse> {
  const { parsedDocuments = [] } = options;

  // Build document context for the prompt
  let documentContext = '';

  if (parsedDocuments.length > 0) {
    documentContext = `
## Primary Source Documents

You have access to the following parsed documents. Cite specific sections when relevant.

${parsedDocuments.map(doc => {
  if (doc.documentType === 'bill') {
    const bill = doc.extracted as ParsedBill;
    return `
### ${bill.billNumber}: ${bill.title}

Key Provisions:
${bill.keyProvisions.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Sections:
${bill.sections.map(s => `- ${s.number} ${s.title}: ${s.summary}`).join('\n')}
`;
  }

  if (doc.documentType === 'sec_filing') {
    const filing = doc.extracted as ParsedSECFiling;
    return `
### ${filing.companyName} ${filing.filingType} (${filing.fiscalYear})

Labor Disclosures:
${filing.laborDisclosures?.workforceInitiatives?.join('\n') || 'None disclosed'}

Environmental Commitments:
${filing.environmentalDisclosures?.commitments?.join('\n') || 'None disclosed'}
`;
  }

  return '';
}).join('\n\n')}
`;
  }

  // Generate message with document context
  const result = await generateWithThoughts<MessageResponse>(
    buildPromptWithDocuments(prompt, documentContext),
    { /* ... */ }
  );

  return result;
}
```

### 5.8 Data Sources for Document Intelligence

| Source | API | Document Types | Cost |
|--------|-----|----------------|------|
| **Congress.gov** | [GovInfo API](https://www.govinfo.gov/features/api) | Bills (PDF, XML) | Free |
| **SEC EDGAR** | [Official API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | 10-K, 10-Q, 8-K (HTML, XML) | Free |
| **SEC-API.io** | [Third-party](https://sec-api.io/) | PDF conversions, XBRL parsing | ~$0.10/filing |
| **GAO Reports** | [gao.gov](https://www.gao.gov/) | Audit reports (PDF) | Free |
| **CBO** | [cbo.gov](https://www.cbo.gov/) | Budget analyses (PDF) | Free |

### 5.9 Phase 2 Implementation Tasks

| Task | Effort | Priority |
|------|--------|----------|
| Set up Reducto client and caching | 1 day | P2 |
| Implement bill parsing pipeline | 2 days | P2 |
| Implement SEC filing parsing | 2 days | P2 |
| Build DeepResearchToggle UI | 1 day | P2 |
| Integrate with message generation | 1 day | P2 |
| Add document sources to intelligence panel | 1 day | P2 |
| **Total** | **8 days** | |

### 5.10 Cost Summary

| Service | Monthly (1K templates, 20% deep research) |
|---------|-------------------------------------------|
| Reducto (5K pages) | ~$75-$150 |
| SEC-API.io (if needed) | ~$20 |
| **Total** | **~$95-$170** |

---

## 6. Implementation Phases

### Phase 1: Infrastructure (Week 1)

| Task | Effort | Owner |
|------|--------|-------|
| Set up MongoDB Atlas connection | 0.5 days | Backend |
| Create database schema and indexes | 1 day | Backend |
| Implement TTL index for cache expiration | 0.5 days | Backend |
| Set up Firecrawl client | 0.5 days | Backend |
| Environment configuration | 0.5 days | DevOps |

### Phase 2: Decision-Maker Discovery (Week 2-3)

| Task | Effort | Owner |
|------|--------|-------|
| Extract `DecisionMakerProvider` interface | 1 day | Backend |
| Refactor existing code to `GeminiProvider` | 1 day | Backend |
| Implement `FirecrawlProvider` | 2 days | Backend |
| Implement `DecisionMakerRouter` | 0.5 days | Backend |
| Add MongoDB caching layer | 1 day | Backend |
| Build `TargetTypeSelector` component | 1 day | Frontend |
| Integrate with `DecisionMakerResolver` | 1 day | Frontend |
| Update API endpoint | 0.5 days | Backend |
| Testing and refinement | 1 day | Full Stack |

### Phase 3: Issue Intelligence (Week 4-5)

| Task | Effort | Owner |
|------|--------|-------|
| Define intelligence types and interfaces | 0.5 days | Backend |
| Implement `FirecrawlNewsProvider` | 2 days | Backend |
| Implement `LegislativeProvider` | 1.5 days | Backend |
| Build `IntelligenceOrchestrator` | 1 day | Backend |
| Create `/api/intelligence/stream` endpoint | 1 day | Backend |
| Build `IntelligencePanel` component | 2 days | Frontend |
| Build `IntelligenceItemCard` component | 1 day | Frontend |
| Integrate with template creation flow | 1 day | Frontend |
| Connect to message generation | 1 day | Backend |

### Phase 4: Semantic Features (Week 6)

| Task | Effort | Owner |
|------|--------|-------|
| Set up Vector Search indexes | 0.5 days | Backend |
| Implement embedding generation | 1 day | Backend |
| Build similar templates feature | 1 day | Full Stack |
| Build semantic search | 1 day | Full Stack |
| Implement reranking for sources | 1 day | Backend |
| Testing and optimization | 1 day | Full Stack |

### Total Timeline: 6 weeks

---

## 7. Cost Analysis

### 6.1 Firecrawl Costs

| Operation | Credits/Call | Frequency | Monthly (1K templates) |
|-----------|--------------|-----------|------------------------|
| Org discovery (Agent) | 15 | 300 (30% of templates) | 4,500 |
| News intelligence (Agent) | 10 | 500 (50% of templates) | 5,000 |
| Legislative intel (Extract) | 5 | 300 (30% of templates) | 1,500 |
| **Total** | | | **11,000 credits** |

**Recommended Plan:** Standard ($83/month = 100,000 credits)

### 6.2 MongoDB Atlas Costs

| Component | Tier | Monthly Cost |
|-----------|------|--------------|
| M10 Cluster | Dedicated | ~$57 |
| Vector Search | Included | $0 |
| Voyage AI Embeddings | Usage-based | ~$10-20 |
| Voyage AI Reranking | Usage-based | ~$5-10 |
| **Total** | | **~$72-87** |

### 6.3 Total New Infrastructure Costs

| Service | Monthly |
|---------|---------|
| Firecrawl Standard | $83 |
| MongoDB Atlas | ~$80 |
| **Total** | **~$163/month** |

---

## 8. Architecture Diagrams

### 7.1 Decision-Maker Resolution Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER INPUT                                      │
│  "I want to contact Amazon about their labor practices"                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      TARGET TYPE SELECTOR                                 │
│  [Congress] [State] [Local] [Corporate ✓] [Nonprofit] [Education]        │
│                                                                           │
│  Entity: [Amazon_____________________________]                            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     DECISION-MAKER ROUTER                                 │
│                                                                           │
│  targetType: 'corporate' → FirecrawlDecisionMakerProvider                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│       MONGODB CACHE           │   │      FIRECRAWL AGENT          │
│                               │   │                               │
│  Check: organizations         │   │  Prompt: "Research Amazon     │
│  Key: amazon                  │   │   leadership for labor..."    │
│                               │   │                               │
│  Cache hit? ─────────┐        │   │  Model: spark-1-pro           │
│                      │        │   │  Credits: ~15                 │
└──────────────────────│────────┘   └───────────────────────────────┘
                       │                            │
                       │        Cache miss          │
                       │        ◄───────────────────┤
                       │                            │
                       ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      ORGANIZATION PROFILE                                 │
│                                                                           │
│  {                                                                        │
│    name: "Amazon",                                                        │
│    leadership: [                                                          │
│      { name: "Andy Jassy", title: "CEO", email: "ajassy@amazon.com" },   │
│      { name: "Beth Galetti", title: "SVP HR", email: "..." },            │
│      ...                                                                  │
│    ],                                                                     │
│    policyPositions: [...],                                               │
│    embedding: [0.123, -0.456, ...]                                       │
│  }                                                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    RELEVANCE FILTERING (Gemini)                           │
│                                                                           │
│  Filter leadership to those with authority over "labor practices"        │
│  → SVP HR, VP Labor Relations, General Counsel                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    DECISION-MAKER RESULTS                                 │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🏢 Amazon (3 decision-makers)                                       │ │
│  │                                                                      │ │
│  │ ✓ Beth Galetti                                                       │ │
│  │   SVP, People Experience and Technology                              │ │
│  │   bgaletti@amazon.com                                                │ │
│  │   "Oversees HR and employee relations"                               │ │
│  │                                                                      │ │
│  │ ✓ David Zapolsky                                                     │ │
│  │   SVP, General Counsel                                               │ │
│  │   ...                                                                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Intelligence Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           TEMPLATE CREATION                               │
│                                                                           │
│  Subject: "Amazon's labor practices harm workers"                        │
│  Topics: ["labor", "worker-rights", "corporate-accountability"]          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Parallel streams
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│   DECISION-MAKER RESOLUTION   │   │   INTELLIGENCE ORCHESTRATOR   │
│                               │   │                               │
│   (runs independently)        │   │   Providers:                  │
│                               │   │   ├─ FirecrawlNewsProvider    │
│                               │   │   ├─ LegislativeProvider      │
│                               │   │   └─ CorporateProvider        │
└───────────────────────────────┘   └───────────────────────────────┘
                                                    │
                            ┌───────────────────────┼───────────────────────┐
                            ▼                       ▼                       ▼
                    ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
                    │ NEWS ITEMS   │        │ LEGISLATIVE  │        │ CORPORATE    │
                    │              │        │              │        │              │
                    │ 5 articles   │        │ 2 bills      │        │ 3 filings    │
                    │ from WSJ,    │        │ PRO Act,     │        │ 10-K labor   │
                    │ NYT, etc.    │        │ NLRA amend   │        │ disclosures  │
                    └──────────────┘        └──────────────┘        └──────────────┘
                            │                       │                       │
                            └───────────────────────┼───────────────────────┘
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENCE PANEL                                 │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ What's Happening                                    [All] [News]  │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ 📰 NEWS: 5 articles found                                        │    │
│  │ Key points:                                                       │    │
│  │ • NLRB ruling on Amazon warehouse organizing                     │    │
│  │ • Senate hearing scheduled for March                              │    │
│  │ • Trend: Rising attention                                         │    │
│  ├──────────────────────────────────────────────────────────────────┤    │
│  │ ┌────────────────────────────────────────────────────────────┐   │    │
│  │ │ Amazon Workers Vote to Unionize Second Warehouse          │   │    │
│  │ │ New York Times · 2 hours ago                               │   │    │
│  │ │ Workers at Amazon's facility in... (truncated)             │   │    │
│  │ │ ●●●○○ Relevance                    [Use as source →]       │   │    │
│  │ └────────────────────────────────────────────────────────────┘   │    │
│  │ ┌────────────────────────────────────────────────────────────┐   │    │
│  │ │ PRO Act Gains Momentum in Senate                           │   │    │
│  │ │ Washington Post · 1 day ago                                 │   │    │
│  │ │ ...                                                         │   │    │
│  │ └────────────────────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Environment Variables

```bash
# .env additions

# MongoDB Atlas
MONGODB_URI=mongodb+srv://communique:***REMOVED***@cluster0.udtiui.mongodb.net/?appName=Cluster0
MONGODB_API_KEY=<atlas-api-key-for-voyage-ai>

# Firecrawl
FIRECRAWL_API_KEY=fc-<your-api-key>
```

---

## References

- [MongoDB Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/)
- [Voyage AI by MongoDB](https://www.mongodb.com/docs/voyageai/)
- [MongoDB Hybrid Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/hybrid-search/vector-search-with-full-text-search/)
- [Firecrawl Agent API](https://www.firecrawl.dev/agent)
- [Firecrawl Documentation](https://docs.firecrawl.dev/)
- [Scaling Vector Search with Voyage AI](https://www.mongodb.com/company/blog/technical/scaling-vector-search-mongodb-atlas-quantization-voyage-ai-embeddings)
