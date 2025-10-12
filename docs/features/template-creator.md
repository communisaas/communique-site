# Template Creator

**Status**: ✅ IMPLEMENTED | Multi-Step Template Authoring System

---

**Guided template creation workflow that helps users craft effective civic messages.**

## Overview

The Template Creator is a progressive disclosure interface that guides users through creating reusable civic action templates. Templates created here become shareable links that viral-spread through social networks.

**Flow**: Objective → Audience → Message → Slug → Review → Publish

**Location**: `src/lib/components/template/creator/`

## Architecture

### Multi-Step Components (1,679 total lines)

1. **ObjectiveDefiner.svelte** (71 lines)
   - Define template purpose and goal
   - Free-text input with guidance
   - Sets context for subsequent steps

2. **AudienceSelector.svelte** (137 lines)
   - Choose target representatives (House, Senate, Both)
   - Select delivery channel (Congressional, Direct Email, Both)
   - Audience influences available variables

3. **MessageEditor.svelte** (628 lines)
   - Core message composition interface
   - Variable auto-insertion system
   - Real-time preview and variable extraction
   - Personal connection tips
   - Address inclusion toggle

4. **CodeMirrorEditor.svelte** (509 lines)
   - Syntax-highlighted markdown editing
   - Variable highlighting with custom styling
   - Auto-completion for variables
   - Line numbers and formatting helpers

5. **SlugCustomizer.svelte** (275 lines)
   - URL slug generation and validation
   - Real-time availability checking
   - Auto-generation from template objective
   - Manual override capability

6. **SmartReview.svelte** (59 lines)
   - Final template preview
   - Variable validation
   - Publish confirmation

## Key Features

### 1. Smart Variable System

**Core Variables** (always included):
```
[Name] - User's name
[Personal Connection] - User's personalized story
[Address] - User's residential address (for verification)
```

**Congressional Variables** (when channel is "certified"):
```
[Representative] - Target representative's name
[District] - Congressional district
```

**Variable Auto-Insertion**:
- Automatically adds `[Name]` to signature
- Inserts `[Personal Connection]` before closing
- Adds `[Address]` when toggle enabled
- Intelligently places variables in appropriate locations

**Variable Tips**:
```typescript
const variableTips = {
  '[Personal Connection]': 'Share a specific story or experience that makes this issue personal',
  '[Name]': 'Will be filled with the sender\'s name',
  '[Address]': 'Verifies you as a constituent',
  '[Representative]': 'Dynamically filled with the recipient\'s name'
};
```

### 2. CodeMirror Integration

**Syntax Highlighting**:
- Markdown formatting
- Variable highlighting (distinct color)
- Bracket matching
- Line numbers

**Editor Extensions**:
- Autocomplete for variables
- Real-time variable detection
- Cursor position tracking
- Multi-line editing support

**Variable Insertion API**:
```typescript
interface CodeMirrorEditor {
  insertVariable: (variable: string) => void;
  appendToDocument: (text: string, preserveCursor?: boolean) => void;
  getValue: () => string;
  setValue: (text: string) => void;
}
```

### 3. Template Variable Detection

Automatically extracts variables from message text:

```typescript
function extractVariables(messageText: string): string[] {
  const variablePattern = /\[([^\]]+)\]/g;
  const matches = messageText.matchAll(variablePattern);
  return Array.from(new Set(Array.from(matches).map(m => m[0])));
}
```

**Variable Classification**:
- **System variables**: `[Name]`, `[Address]`, `[Representative]`
- **User variables**: Everything else (e.g., `[Your City]`, `[Company Name]`)

### 4. Real-Time Preview

**Preview Generation**:
```typescript
import { resolveTemplate } from '$lib/utils/templateResolver';

const previewContent = resolveTemplate({
  template: messageText,
  values: {
    '[Name]': 'John Doe',
    '[Personal Connection]': '[Your personal story goes here...]',
    '[Representative]': 'Rep. Smith'
  }
});
```

**Preview Features**:
- Live updates as user types
- Sample data for all variables
- Full message rendering
- Character count and readability metrics

### 5. Slug Generation & Validation

**Auto-Generation**:
```typescript
function generateSlug(objective: string): string {
  return objective
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}
```

**Availability Check**:
```typescript
// POST /api/templates/check-slug
const response = await fetch('/api/templates/check-slug', {
  method: 'POST',
  body: JSON.stringify({ slug: candidateSlug })
});

const { available } = await response.json();
```

**Validation Rules**:
- Lowercase letters, numbers, hyphens only
- No consecutive hyphens
- No leading/trailing hyphens
- 3-50 characters long
- Must be unique across all templates

### 6. Progressive Enhancement

**Spring Animations**:
```typescript
import { spring } from 'svelte/motion';

const buttonScale = spring(1, { stiffness: 0.4, damping: 0.7 });
const tipScale = spring(0, { stiffness: 0.3, damping: 0.6 });

// Apply scale on hover/interaction
function handleHover() {
  buttonScale.set(1.05);
}
```

**Micro-Interactions**:
- Variable insertion animations
- Tooltip fade-in/fade-out
- Preview slide transitions
- Button hover effects

## Data Flow

```typescript
interface TemplateCreationContext {
  objective: string;
  audience: {
    chamber: 'house' | 'senate' | 'both';
    level: 'federal' | 'state' | 'local';
  };
  channelId: 'certified' | 'direct' | 'both';
  message: {
    preview: string;
    variables: string[];
  };
  slug: string;
  metadata?: {
    category?: string;
    tags?: string[];
    visibility?: 'public' | 'unlisted' | 'private';
  };
}
```

**Step-by-Step State**:
1. **Objective Step**: Populate `context.objective`
2. **Audience Step**: Populate `context.audience` and `context.channelId`
3. **Message Step**: Populate `context.message.preview` and extract `context.message.variables`
4. **Slug Step**: Populate `context.slug` (with validation)
5. **Review Step**: Validate entire context, submit to API

## API Integration

### Template Creation

```typescript
// POST /api/templates/create
const response = await fetch('/api/templates/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: context.objective,
    slug: context.slug,
    message_body: context.message.preview,
    variables: context.message.variables,
    channel: context.channelId,
    audience: context.audience,
    visibility: 'public'
  })
});

const { template_id, url } = await response.json();
// Redirect to /s/{slug} for immediate preview
```

### Slug Availability Check

```typescript
// POST /api/templates/check-slug
const checkAvailability = async (slug: string): Promise<boolean> => {
  const res = await fetch('/api/templates/check-slug', {
    method: 'POST',
    body: JSON.stringify({ slug })
  });
  const data = await res.json();
  return data.available;
};
```

## User Experience Patterns

### Variable Insertion Flow

1. User types message
2. System detects missing core variables (`[Name]`, `[Personal Connection]`)
3. Auto-inserts at appropriate locations:
   - `[Personal Connection]` before signature
   - `[Name]` in signature block
   - `[Address]` after name (if toggled)

### Variable Tip Display

1. User hovers over variable button
2. Tip appears with brief explanation
3. Tip disappears after 3 seconds or on mouse leave
4. Clicking button inserts variable at cursor position

### Preview Toggle

1. User clicks "Preview" button
2. Preview panel slides in from right
3. Shows resolved template with sample data
4. User can edit while preview stays open
5. Preview updates in real-time

## Component Props

### MessageEditor

```typescript
interface MessageEditorProps {
  data: {
    preview: string;       // Current message text
    variables: string[];   // Extracted variable list
  };
  context: TemplateCreationContext;  // Full creation context
}
```

### CodeMirrorEditor

```typescript
interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  highlightVariables?: boolean;
  onVariableInsert?: (variable: string) => void;
}
```

### SlugCustomizer

```typescript
interface SlugCustomizerProps {
  objective: string;      // Used for auto-generation
  currentSlug: string;    // Current slug value
  onSlugChange: (slug: string) => void;
  onValidation: (valid: boolean) => void;
}
```

## Validation Rules

### Message Validation

- **Minimum length**: 50 characters
- **Required variables**: `[Name]`, `[Personal Connection]`
- **Congressional templates**: Must include `[Representative]`
- **No empty variables**: All `[...]` must be recognized

### Slug Validation

```typescript
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const minLength = 3;
const maxLength = 50;

function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (slug.length < minLength) {
    return { valid: false, error: 'Slug must be at least 3 characters' };
  }
  if (slug.length > maxLength) {
    return { valid: false, error: 'Slug must be less than 50 characters' };
  }
  if (!slugRegex.test(slug)) {
    return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }
  return { valid: true };
}
```

## Accessibility

- **Keyboard navigation**: Tab through all form fields
- **Screen reader support**: ARIA labels on all inputs
- **Focus management**: Focus moves logically through steps
- **Error announcements**: Validation errors announced to screen readers

## Testing

```bash
# Integration tests
npm run test:integration -- template-creator-ui.test.ts
npm run test:integration -- template-creator-variables.test.ts

# E2E tests
npm run test:e2e -- template-creator-atomic.spec.ts
```

## Roadmap

### Near Term
- AI-powered message suggestions
- Template quality scoring
- Duplicate template detection
- Collaborative template editing

### Medium Term
- Multi-language template support
- Version history and rollback
- A/B testing for templates
- Template remix/forking

### Long Term
- Visual template builder (drag-and-drop)
- Template marketplace
- Automated personalization ML
- Cross-platform template sharing

## References

- **Components**: `src/lib/components/template/creator/`
- **Template Resolution**: `src/lib/utils/templateResolver.ts`
- **Variable Styling**: `src/lib/utils/variable-styling.ts`
- **Tests**: `tests/integration/template-creator-*.test.ts`

---

The Template Creator transforms complex civic message authoring into a guided, intuitive process that encourages reusability and viral sharing.
