# Low‑Friction Civic Action Funnel

## Overview

Reduce the effort required to take meaningful civic action. People land on a template, understand the value instantly, authenticate with one tap, and we open a ready‑to‑send email using on‑device capabilities.

## Flow architecture

### New visitor (guest → action)

```
Link → Template page → Auth prompt → OAuth → Template modal → mailto open → Done
```

### Returning visitor (instant action)

```
Link → Recognized session → Template modal → mailto open → Done
```

## UX principles

- Show value first: preview before auth
- Progressive disclosure: short, focused steps
- Social proof: transparent send/usage counts
- Completion bias: start the action, make finishing easy
- OAuth only: no passwords

## Implementation components

- Guest state: `src/lib/stores/guestState.ts`
  - Persists template context up to 7 days in `localStorage`
  - Tracks `source` (`social-link` | `direct-link` | `share`) and `viewCount`

- Auth/onboarding: `src/lib/components/auth/OnboardingModal.svelte`
  - Progressive copy that adapts to traffic source and template type
  - Stores pending intent in `sessionStorage` for post‑OAuth return

- Quick action modal: `src/lib/components/template/TemplateModal.svelte`
  - For authenticated users, auto‑generates and opens `mailto:`
  - Success state with share options; copy link + platform share

- Extended sessions: `src/lib/server/auth.ts` + OAuth callbacks
  - 90‑day sessions when returning from `template-modal` or `auth=required`
  - 30‑day sessions otherwise
  - See callbacks under `src/routes/auth/*/callback/+server.ts`

- Analytics hooks: `src/lib/analytics/funnel.ts` and inline `gtag` events
  - Event model supports: `template_viewed`, `onboarding_started`, `auth_completed`, `template_used`, `template_shared`
  - Server endpoint increments per‑template counters under `src/routes/api/civic/analytics/+server.ts`
  - Template modal usage/sharing instrumented; add view/onboarding/auth events in `/{slug}` as needed

## Deep links and routing

- Landing: `/{slug}` (template page)
- Direct modal: `/template-modal/{slug}` (requires auth; otherwise redirects to `/{slug}?auth=required&source=modal`)
- URL parameters:
  - `?auth=required` → prompt auth on landing
  - `?source=social-link` | `?source=share` → attribution stored in guest state

## Personalization

- Source‑aware messages in onboarding (`social-link`/`direct-link`/`share`)
- Template‑type awareness (e.g., congressional vs direct outreach)
- Context‑aware CTAs for guests vs signed‑in users
- Address-aware prompts for congressional templates

## Return experience

- Extended session recognition (per device)
- Fast path: open template modal and launch `mailto` for signed‑in users
- Restore guest intent when returning from OAuth

## Metrics

- Tracked events (implemented):
  - `template_used` (on mailto open)
  - `template_shared` (on share)
- Tracked events (available in API/model; instrument where needed):
  - `template_viewed`, `onboarding_started`, `auth_completed`
- Server stores counters (views, modal_views, sent, shares). Client can compute funnel ratios from events.

## Technical notes

- State: Svelte stores + `localStorage`/`sessionStorage`
- Auth: OAuth providers only; session length determined by source context
- Performance: modal lazy‑loading, client‑side email generation

## Current status

- Guest state, quick action modal, extended sessions, sharing: implemented
- Event model and API exist; some events use inline `gtag` today; broader adoption can wire through `funnelAnalytics`
- Claims are grounded in shipped code; additional analytics visualization and A/B testing are optional follow‑ups


