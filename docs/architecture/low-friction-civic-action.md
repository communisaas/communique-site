# Low-Friction Civic Action

**One-click democracy: From link to sent message in seconds.**

## User Flows

### New Visitor

```
Shared link → Preview template → OAuth login → Send message → Earn rewards
```

### Returning User

```
Shared link → Auto-recognized → Send message → Earn rewards
```

## Core Principles

- **Preview before auth**: Show value immediately
- **OAuth only**: No passwords, instant login
- **Extended sessions**: 90 days for template actions
- **One-click send**: Pre-filled messages via mailto
- **Viral sharing**: Templates spread like memes

## Technical Implementation

### State Management

- Guest state persisted 7 days in localStorage
- Pending intent saved for post-OAuth return
- Source tracking (social/direct/share)

### Components

- **Guest state**: `src/lib/stores/guestState.svelte.ts`
- **Auth modal**: `src/lib/components/auth/OnboardingModal.svelte`
- **Template modal**: `src/lib/components/template/TemplateModal.svelte`
- **Session management**: `src/lib/core/auth/auth.ts`

### Deep Links

- Landing: `/{slug}` - Template preview page
- Direct action: `/template-modal/{slug}` - Requires auth
- Parameters:
  - `?auth=required` - Force auth prompt
  - `?source=social-link` - Attribution tracking

## Analytics

Tracked events:

- `template_viewed` - Landing page view
- `auth_completed` - OAuth success
- `template_used` - Message sent
- `template_shared` - Viral spread

Server-side counters track views, sends, and shares per template.

## Success Metrics

- **Conversion**: Link → Send > 20%
- **Return rate**: 90-day session retention > 60%
- **Viral coefficient**: Shares per send > 1.5
- **Time to action**: < 30 seconds for returning users

The flow is optimized for instant gratification while building long-term engagement through VOTER Protocol rewards.
