# Frontend Architecture: SvelteKit 5 + Runes

**Communiqué's frontend implementation guide. Not blockchain—that's in [voter-protocol](https://github.com/communisaas/voter-protocol).**

This document covers SvelteKit 5 patterns, state management with runes, component architecture, and frontend-specific decisions. For blockchain integration, see `INTEGRATION-GUIDE.md`.

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [SvelteKit 5 Architecture](#sveltekit-5-architecture)
3. [Runes-Based State Management](#runes-based-state-management)
4. [Component Patterns](#component-patterns)
5. [Routing & SSR](#routing--ssr)
6. [Form Handling](#form-handling)
7. [Type Safety](#type-safety)
8. [Performance Patterns](#performance-patterns)

---

## Technology Stack

**Core Framework:**
- **SvelteKit 5**: Meta-framework with SSR, routing, API routes
- **Svelte 5**: Component framework with runes (replacing stores)
- **TypeScript**: Strict type checking, zero `any` tolerance
- **Vite**: Build tool and dev server

**Styling:**
- **Tailwind CSS**: Utility-first CSS framework
- **Design System**: See `docs/design-system.md` for comprehensive design tokens

**Database & Backend:**
- **Supabase Postgres**: Database (accessed via Prisma ORM)
- **Prisma**: Type-safe database client
- **@oslojs/crypto**: Cryptographic session management

**Key Libraries:**
- **lucide-svelte**: Icon system
- **libsodium-wrappers**: Client-side XChaCha20-Poly1305 encryption
- **CodeMirror 6**: Template editor with variable highlighting

---

## SvelteKit 5 Architecture

### Directory Structure

```
src/
├── routes/              # SvelteKit file-based routing
│   ├── +page.svelte     # Landing page (/)
│   ├── +layout.svelte   # Root layout (auth state, global modals)
│   ├── s/               # Templates (/s/[slug])
│   │   └── [slug]/
│   │       ├── +page.ts       # Load template data
│   │       └── +page.svelte   # Template customization UI
│   ├── create/          # Template creator
│   └── api/             # API endpoints (+server.ts files)
│       ├── templates/
│       ├── auth/
│       └── cwc/
│
├── lib/
│   ├── components/      # Svelte components
│   │   ├── ui/          # Reusable UI primitives
│   │   ├── template/    # Template-specific components
│   │   ├── auth/        # OAuth & authentication UI
│   │   ├── landing/     # Landing page sections
│   │   └── layout/      # Layout components (Header, Footer)
│   │
│   ├── stores/          # Svelte 5 runes-based stores
│   │   ├── templates.svelte.ts    # Template catalog state
│   │   ├── modalSystem.svelte.ts  # Modal orchestration
│   │   └── toast.svelte.ts        # Toast notifications
│   │
│   ├── core/            # Production core logic
│   │   ├── auth/        # Session management, OAuth
│   │   ├── analytics/   # Funnel tracking
│   │   └── api/         # Unified API client
│   │
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   └── actions/         # Svelte actions
│
└── app.html             # HTML shell
```

### SSR vs Client-Side Rendering

**Server-Side Rendered (SSR):**
- Landing page (`/`) - SEO, fast initial paint
- Template pages (`/s/[slug]`) - Pre-fetch template data, meta tags
- OAuth callbacks - Server-side session creation

**Client-Side Rendered (CSR):**
- Template editor (`/create`) - Rich interactive UI
- Address collection modal - Client-side validation
- Witness encryption - Browser-only cryptography (XChaCha20-Poly1305 to TEE)
- ZK proof request - Proof Service API client (proof generated in TEE, not browser)

**Progressive Enhancement Pattern:**

```typescript
// +page.ts (SSR data loading)
export async function load({ params, fetch }) {
  const response = await fetch(`/api/templates/${params.slug}`);
  const template = await response.json();

  return {
    template // Available immediately on page load
  };
}
```

```svelte
<!-- +page.svelte (hydrates with SSR data) -->
<script lang="ts">
  let { data } = $props(); // SSR data passed from load()

  // Client-side state
  let customizations = $state<Record<string, string>>({});
</script>

<TemplateEditor template={data.template} bind:customizations />
```

---

## Runes-Based State Management

**Svelte 5 runes replace Svelte 4 stores.** Runes provide reactive state without subscriptions.

### Core Runes

**`$state`** - Reactive state primitive:

```typescript
// ❌ Svelte 4 pattern (deprecated)
import { writable } from 'svelte/store';
const count = writable(0);

// ✅ Svelte 5 runes pattern
let count = $state(0);
```

**`$derived`** - Computed values:

```typescript
let templates = $state<Template[]>([]);
let publicTemplates = $derived(templates.filter(t => t.is_public));
```

**`$effect`** - Side effects:

```typescript
let searchQuery = $state('');

$effect(() => {
  // Runs whenever searchQuery changes
  console.log('Searching for:', searchQuery);
});
```

### Store Pattern (Svelte 5)

**Example: `stores/templates.svelte.ts`**

```typescript
interface TemplateState {
  templates: Template[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}

function createTemplateStore() {
  const state = $state<TemplateState>({
    templates: [],
    selectedId: null,
    loading: false,
    error: null
  });

  return {
    // Getters (reactive)
    get templates() {
      return state.templates;
    },
    get loading() {
      return state.loading;
    },

    // Actions
    selectTemplate(id: string) {
      state.selectedId = id;
    },

    async fetchTemplates() {
      state.loading = true;
      try {
        const result = await templatesApi.list();
        state.templates = result.data;
        state.error = null;
      } catch (error) {
        state.error = 'Failed to fetch templates';
      } finally {
        state.loading = false;
      }
    }
  };
}

export const templateStore = createTemplateStore();
```

**Usage in components:**

```svelte
<script lang="ts">
  import { templateStore } from '$lib/stores/templates.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    templateStore.fetchTemplates();
  });
</script>

{#if templateStore.loading}
  <LoadingSpinner />
{:else}
  {#each templateStore.templates as template}
    <TemplateCard {template} />
  {/each}
{/if}
```

### Modal System (Advanced Pattern)

**Centralized modal orchestration:**

```typescript
// stores/modalSystem.svelte.ts
function createModalSystem() {
  const state = $state({
    activeModal: null as string | null,
    modalProps: {} as Record<string, unknown>
  });

  return {
    get activeModal() {
      return state.activeModal;
    },

    openModal(id: string, props?: Record<string, unknown>) {
      state.activeModal = id;
      state.modalProps = props || {};
    },

    closeModal() {
      state.activeModal = null;
      state.modalProps = {};
    }
  };
}

export const modalSystem = createModalSystem();
```

**Usage:**

```svelte
<script lang="ts">
  import { modalSystem } from '$lib/stores/modalSystem.svelte';

  function openAuth() {
    modalSystem.openModal('auth', {
      initialView: 'login'
    });
  }
</script>

<button onclick={openAuth}>Sign In</button>

<!-- Root layout manages modals -->
{#if modalSystem.activeModal === 'auth'}
  <AuthModal onClose={() => modalSystem.closeModal()} />
{/if}
```

---

## Component Patterns

### Props with Runes

**Svelte 5 props syntax:**

```svelte
<script lang="ts">
  import type { Template } from '$lib/types/template';

  // ✅ Svelte 5 pattern
  let {
    template,
    onSave = () => {},
    disabled = false
  }: {
    template: Template;
    onSave?: (data: CustomizationData) => void;
    disabled?: boolean;
  } = $props();

  // Reactive local state
  let customizations = $state<Record<string, string>>({});
</script>

<form onsubmit={() => onSave(customizations)}>
  <!-- Form fields -->
</form>
```

### Event Dispatch Pattern

**Svelte 5 uses callback props instead of `createEventDispatcher`:**

```svelte
<!-- ❌ Svelte 4 pattern (deprecated) -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('click', { data: 'value' });
  }
</script>

<!-- ✅ Svelte 5 pattern -->
<script lang="ts">
  let { onClick }: { onClick: (data: string) => void } = $props();
</script>

<button onclick={() => onClick('value')}>Click</button>
```

### Component Composition

**Slot pattern for flexible composition:**

```svelte
<!-- Card.svelte -->
<script lang="ts">
  let {
    title,
    children
  }: {
    title: string;
    children: Snippet;
  } = $props();
</script>

<div class="card">
  <h2>{title}</h2>
  {@render children()}
</div>
```

**Usage:**

```svelte
<Card title="Template Stats">
  <p>Sent: {template.send_count}</p>
  <p>Last sent: {template.last_sent_at}</p>
</Card>
```

---

## Routing & SSR

### Load Functions

**+page.ts (universal load):**

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const template = await fetch(`/api/templates/${params.slug}`).then(r => r.json());

  return {
    template,
    meta: {
      title: template.title,
      description: template.description
    }
  };
};
```

**+page.server.ts (server-only load):**

```typescript
import type { PageServerLoad } from './$types';
import { db } from '$lib/core/db';

export const load: PageServerLoad = async ({ locals }) => {
  // Access server-only resources
  const user = locals.user;

  const templates = await db.template.findMany({
    where: { userId: user?.id }
  });

  return { templates };
};
```

### API Routes

**+server.ts pattern:**

```typescript
// src/routes/api/templates/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/core/db';

export const GET: RequestHandler = async () => {
  const templates = await db.template.findMany({
    where: { is_public: true }
  });

  return json({ templates });
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();

  const template = await db.template.create({
    data: {
      ...data,
      status: 'draft'
    }
  });

  return json({ template }, { status: 201 });
};
```

---

## Form Handling

### Progressive Enhancement

**Form with client-side enhancement:**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let submitting = $state(false);
  let error = $state<string | null>(null);
</script>

<form
  method="POST"
  action="/api/auth/login"
  use:enhance={() => {
    submitting = true;

    return async ({ result, update }) => {
      if (result.type === 'failure') {
        error = result.data?.message || 'Login failed';
      } else {
        await update();
      }
      submitting = false;
    };
  }}
>
  <input type="email" name="email" required />
  <button disabled={submitting}>
    {submitting ? 'Logging in...' : 'Log in'}
  </button>

  {#if error}
    <p class="error">{error}</p>
  {/if}
</form>
```

### Client-Side Validation

**Real-time validation pattern:**

```svelte
<script lang="ts">
  let email = $state('');
  let emailError = $derived(
    email && !email.includes('@')
      ? 'Invalid email'
      : null
  );
</script>

<input
  type="email"
  bind:value={email}
  class:error={emailError}
/>
{#if emailError}
  <p class="error-message">{emailError}</p>
{/if}
```

---

## Type Safety

### Strict TypeScript Configuration

**Zero tolerance for type violations:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Violations that cause instant PR rejection:**

- ❌ `any` type usage
- ❌ `@ts-ignore` comments
- ❌ `@ts-nocheck` comments
- ❌ Loose object casting (`data as SomeType`)

### Component Type Safety

**Typed props:**

```svelte
<script lang="ts">
  import type { Template } from '$lib/types/template';

  let {
    template,
    onComplete
  }: {
    template: Template;
    onComplete: (data: CompletionData) => void;
  } = $props();
</script>
```

**Typed stores:**

```typescript
const state = $state<TemplateState>({
  templates: [],
  selectedId: null,
  loading: false,
  error: null
});
```

---

## Performance Patterns

### Code Splitting

**Dynamic imports for heavy components:**

```svelte
<script lang="ts">
  import { browser } from '$app/environment';

  let CodeMirrorEditor: any;

  onMount(async () => {
    if (browser) {
      const module = await import('$lib/components/CodeMirrorEditor.svelte');
      CodeMirrorEditor = module.default;
    }
  });
</script>

{#if CodeMirrorEditor}
  <svelte:component this={CodeMirrorEditor} />
{/if}
```

### Lazy Loading

**Intersection Observer for images:**

```svelte
<script lang="ts">
  import { lazyLoad } from '$lib/actions/lazyLoad';
</script>

<img
  use:lazyLoad={{ src: template.imageUrl }}
  alt={template.title}
/>
```

### Debouncing

**Search input debouncing:**

```svelte
<script lang="ts">
  import { debounce } from '$lib/utils/debounce';

  let searchQuery = $state('');

  const performSearch = debounce((query: string) => {
    // API call
  }, 300);

  $effect(() => {
    performSearch(searchQuery);
  });
</script>

<input bind:value={searchQuery} placeholder="Search templates..." />
```

---

## Key Architectural Decisions

### Why Svelte 5 Runes?

**Previous (Svelte 4):** Stores with `subscribe()` pattern required manual cleanup, verbose boilerplate.

**Current (Svelte 5):** Runes provide automatic reactivity without subscriptions. Cleaner code, better TypeScript support, automatic cleanup.

**Migration:** We migrated all Svelte 4 stores to runes pattern in September 2024.

### Why SvelteKit?

- **File-based routing**: Intuitive, scales well
- **SSR + API routes**: Single codebase for frontend and backend
- **Progressive enhancement**: Forms work without JS
- **Type safety**: Full TypeScript integration with `$types`

### State Management Philosophy

**Local state first:** Use component `$state` for UI state (form inputs, toggles, etc.)

**Global stores for shared concerns:**
- `templateStore`: Template catalog (used across multiple routes)
- `modalSystem`: Modal orchestration (accessed from any component)
- `toast`: Notification system (global notifications)

**Server state via SvelteKit:** Authentication state, user session, database queries—handled by SvelteKit load functions, not client-side stores.

---

## Next Steps

- **Template System**: See `TEMPLATE-SYSTEM.md` for variable extraction, editor, moderation
- **Integrations**: See `INTEGRATION-GUIDE.md` for CWC API, OAuth, geocoding, self.xyz
- **Development**: See `DEVELOPMENT.md` for testing, seeding, deployment
- **Design System**: See `design-system.md` for comprehensive component library

---

*Communiqué PBC | Frontend for VOTER Protocol | 2025*
