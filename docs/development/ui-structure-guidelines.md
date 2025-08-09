# UI Structure and Page Header Guidelines

Keep a clear, single header hierarchy to prevent UI regressions across pages. This generalizes prior header-specific guidance and applies to all user-facing routes.

## Page composition

- Layout header (`src/routes/[slug]/+layout.svelte` and peers):
  - Navigation (e.g., “← All Templates”)
  - User status (e.g., “Hi [name]!”, auth controls)
  - Global actions (e.g., Share)

- Page content header (inside page `+page.svelte`):
  - Title (H1)
  - Description
  - Contextual metadata (badges, stats)
  - Primary CTA that adapts to template type (congressional vs direct outreach)

- Body content:
  - Core components (e.g., `TemplatePreview` shows message content only)
  - Contextual modals via `modalSystem` (auth, address, email loading)

## Never do this

- Multiple stacked headers competing for attention
- Generic quick-action buttons without page context
- Duplicated title/metadata in both layout and page areas
- Embedding header UI inside content components (e.g., header inside `TemplatePreview`)

## Proper structure

```
Layout Header (sticky navigation + user + share)
├── Page Content Header (title + description + contextual CTA)
├── Main Content (e.g., TemplatePreview: message content only)
└── Contextual Modals (opened via modalSystem)
```

## Visual semantics

- Congressional templates: green CTA (e.g., #16a34a), appropriate iconography
- Direct outreach: blue CTA (e.g., #2563eb)
- Authenticated user indicator: subtle, non-competing badges

## Rationale

1. Single, predictable header hierarchy reduces layout bugs
2. Template-aware CTAs clarify next actions
3. Avoids spacing/margin conflicts across components
4. Keeps content components focused on content, not header UI


