# Feature Flags

Compile-time boolean/string constants that gate unreleased features. Svelte's dead-code elimination strips gated UI from the production bundle when a flag is `false` or unused.

**Source file:** `src/lib/config/features.ts`

## Current Flags

| Flag | Type | Default | What it gates |
|------|------|---------|---------------|
| `DEBATE` | `boolean` | `false` | Deliberation surfaces, argument submission, LMSR market, resolution/appeal (~52 KB of UI) |
| `CONGRESSIONAL` | `boolean` | `false` | CWC delivery, district officials lookup, congressional template routing, CWC-specific decision-maker UI |
| `WALLET` | `boolean` | `false` | Wallet connect, balance display, on-chain identity strip |
| `STANCE_POSITIONS` | `boolean` | `false` | Stance registration (support/oppose), verified position display, TrustJourney signal strength |
| `ADDRESS_SPECIFICITY` | `AddressSpecificity` | `'region'` | `'off'` = no location features; `'region'` = state/city inference + template filtering; `'district'` = full street-address collection + congressional district credential issuance |

## Where Each Flag Is Checked

**DEBATE** -- Template detail page (stance badge, debate tab, market widget), debate sub-route redirect, modal registry (debate modals).

**CONGRESSIONAL** -- Browse/home page server loaders (filters out `cwc` templates), template detail layout loader (404s CWC templates), template detail page (CWC delivery flow, proof generation, trust-tier gate), decision-maker results component (congressional rep section).

**WALLET** -- Header avatar (wallet badge), identity strip (wallet connection UI), modal registry (wallet modals).

**STANCE_POSITIONS** -- Template detail page (stance selector, verified-position panel, skip-stance logic on creator arrival).

**ADDRESS_SPECIFICITY** -- Template detail page (address-verification prompt at `'district'`), modal registry (address collection form at `'district'`).

## Usage

Import the `FEATURES` object and check the flag directly:

```typescript
import { FEATURES } from '$lib/config/features';

// Boolean flags
if (FEATURES.DEBATE) {
  // render debate UI
}

// String flags
if (FEATURES.ADDRESS_SPECIFICITY === 'district') {
  // render address collection form
}
```

In Svelte templates:

```svelte
{#if FEATURES.CONGRESSIONAL}
  <CwcDeliveryPanel />
{/if}
```

On the server (loaders and API routes), use the same import to exclude data before it reaches the client:

```typescript
// +page.server.ts
where: {
  ...(!FEATURES.CONGRESSIONAL ? { deliveryMethod: { not: 'cwc' } } : {}),
}
```

## Adding a New Flag

1. Add the flag to the `FEATURES` object in `src/lib/config/features.ts`:

```typescript
export const FEATURES = {
  // ...existing flags
  MY_FEATURE: false,
} as const;
```

2. Gate UI and server logic behind `FEATURES.MY_FEATURE`.
3. When the feature ships, flip to `true`. After it has been `true` for a full release cycle, remove the flag and its conditionals.

## Enabling a Flag for Local Development

Edit `src/lib/config/features.ts` directly and set the flag to `true` (or the desired string value). These are compile-time constants -- there is no env-var override mechanism. Do not commit the change.

```typescript
DEBATE: true,  // temporarily enable for local testing
```

## Key Files

- `src/lib/config/features.ts` -- flag definitions and `AddressSpecificity` type
- `src/lib/components/modals/ModalRegistry.svelte` -- gates debate, wallet, and address modals
- `src/routes/s/[slug]/+page.svelte` -- primary consumer; checks all five flags
- `src/routes/browse/+page.server.ts`, `src/routes/+page.server.ts` -- server-side CWC filtering
