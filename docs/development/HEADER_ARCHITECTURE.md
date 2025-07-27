# Header Architecture

This document outlines the header structure to prevent UI regressions.

## Template Page Header Structure (SINGLE HEADER ONLY)

**Layout Header** (`/src/routes/[slug]/+layout.svelte`):
- Navigation: "← All Templates" 
- User status: "Hi [name]!" with logout
- Actions: "Share" dropdown only

**Page Content** (`/src/routes/[slug]/+page.svelte`):
- Template title (H1)
- Template description
- Template metadata (badges, stats)  
- **Template-aware CTA button** (congressional: green/Shield, direct: blue/@)

## ❌ NEVER DO THIS:
- Multiple headers competing for space
- Generic "Quick action" buttons without context
- Duplicate template information in both layout and page
- TemplateHeader component inside TemplatePreview

## ✅ PROPER STRUCTURE:
```
Layout Header (sticky navigation + user + share)
├── Template Content Header (title + description + CTA)
├── Template Preview Component (message content only)
└── No duplicate headers
```

## Design System Colors:
- **Congressional templates**: Green (#16a34a) with Shield icon
- **Direct email templates**: Blue (#2563eb) with @ icon
- **User status**: Green dot for authenticated users

This ensures:
1. Single clean header hierarchy
2. Template-aware visual cues  
3. No spacing/margin conflicts
4. Clear action hierarchy