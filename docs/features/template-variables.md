# Template Variables

**Status**: IMPLEMENTED | Bracket Syntax with Auto-Fill and User-Editable Variables

---

**Variables personalize campaign messages with user data, representative names, and personal testimony.**

## Syntax

Variables use bracket notation: `[VariableName]`. They appear inline in template `message_body` text and are parsed at render time via regex `/\[(.*?)\]/g`.

---

## Variable Types

### System Variables (Auto-Filled)

Resolved automatically from user profile and congressional district data. Users see these as green badges with tooltips.

| Variable | Aliases | Source |
|---|---|---|
| `[Name]` | `[Your Name]` | User profile |
| `[Address]` | `[Your Address]` | User profile (requires all components) |
| `[City]` | — | User profile |
| `[State]` | — | User profile |
| `[ZIP]` | `[Zip Code]` | User profile |
| `[Representative Name]` | `[Rep Name]`, `[Representative]` | Congressional district (House) |
| `[Senator Name]` | `[Senator]` | Congressional district (Senate) |
| `[Senior Senator]` | — | Congressional district |
| `[Junior Senator]` | — | Congressional district |

**Address handling**: All four components (street, city, state, zip) must be present. If any is missing, the entire address variable is removed.

**Representative matching**: Primary representative is the first House member found, falling back to first available representative.

### User-Editable Variables (Manual Fill)

Require user input. Displayed as interactive buttons that expand into inline editors.

| Variable | Aliases | UI Behavior |
|---|---|---|
| `[Personal Connection]` | — | Full-width textarea, auto-sizing |
| `[Your Story]` | `[Personal Story]`, `[Your Experience]` | Full-width textarea |
| `[Phone]` | `[Phone Number]`, `[Your Phone]` | Short inline input |

The `[Personal Connection]` variable is the primary personalization point. The message writer agent positions it strategically for maximum impact — typically after the narrative hook and before the ask.

### Citations

Numeric brackets `[1]`, `[2]`, etc. are citation markers linked to verified sources, not personalization variables. They render as superscript links.

---

## For Template Creators

### Adding Variables to Templates

Type the variable name in brackets directly in the message body:

```
Dear [Representative Name],

I'm writing as a constituent in [City], [State] about...

[Personal Connection]

The data shows [1] that this issue affects...

Sincerely,
[Name]
```

### Best Practices

- **Use `[Personal Connection]` once** — it's the emotional anchor of the message
- **Place system variables naturally** — `[Representative Name]` in salutation, `[Name]` in signature
- **Don't overuse variables** — a message with too many blanks feels like a form letter
- **Citation markers `[1]`** are added automatically by the message writer agent — don't add them manually

### What Happens at Send Time

1. System variables are replaced with user data (or removed if data unavailable)
2. User-editable variables the user filled in are substituted
3. Unfilled user-editable variables are removed (send mode)
4. Citations remain as formatted reference markers

---

## Resolution

**Client-side only**. Variable resolution happens in the browser via `resolveTemplate()`.

```typescript
import { resolveTemplate } from '$lib/utils/templateResolver';

// Preview mode: auto-fill system vars, keep user-editable as interactive elements
const preview = resolveTemplate(template, user, { preserveVariables: true });

// Send mode: replace everything, remove unfilled variables
const final = resolveTemplate(template, user, { preserveVariables: false });
```

No server-side variable resolution (except in CWC congressional routing where the server builds the final message).

---

## UI Rendering

Variables render differently based on state:

| State | Appearance | Interaction |
|---|---|---|
| System variable (resolved) | Green badge, subtle underline | Hover tooltip (data source) |
| User-editable (empty) | Warm button with Edit icon | Click to open inline editor |
| User-editable (filled) | Blends into text, subtle underline | Click to re-edit |
| Long-form variable | Expands inline within letter | Full-width textarea, auto-sizing, ESC to close |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/utils/templateResolver.ts` | Variable resolution logic |
| `src/lib/components/template-browser/MessagePreview.svelte` | Variable rendering + inline editing UI |
| `src/lib/components/template-browser/parts/PreviewContent.svelte` | Template content display |
| `src/lib/core/agents/prompts/message-writer.ts` | Agent prompt (generates `[Personal Connection]`) |
| `src/lib/stores/templateDraft.ts` | Draft auto-save with variable preservation |
| `src/routes/api/templates/+server.ts` | Template creation API |
