# Legislative Integration (APIs and Certified Forms)

User‑centric legislative delivery across jurisdictions. The user interaction is always the same: we open the user’s mail client with a prepared message. Behind the scenes, adapters can translate that content for legislatures that require certified APIs/forms, or send directly when public emails exist.

## Overview

1. Resolution (SSR): detect country/region → determine adapter policy
2. Onboarding (if required by target): collect address or other jurisdictional fields
3. Advocacy (single UX): open `mailto:` with prepared content and routing recipients
4. Backend: adapter consumes routed emails to complete certified submissions (when required) and records verification/attestations

### Distribution model (clarification)

- Sharing propagates deep links to template slugs.
- On open, we always open the mail client; adapter policy decides routing/translation on the backend.
- “Social” is amplification, not a delivery method.

## Components

- Address/region lookup (if required): `src/lib/congress/address-lookup.ts` (Census primary, ZIP→district fallback)
- Representative/target directory (pluggable per country)
- Mail routing service (ingest mailbox / webhook)
- Submission adapters (pluggable, backend):
  - US: CWC generator `src/lib/congress/cwc-generator.ts`
  - Others: implement adapter interface (payload mapping, rate limits, captcha policy)

## API

- POST `/api/address/lookup` → representatives/targets (when required)
- POST `/api/user/representatives` → persist mapping (when used)
- POST `/api/legislative/submit` → route via adapter (e.g., CWC); accepts payload + jurisdiction (used by router/ingest)

### Request/Response examples

Address lookup
```http
POST /api/address/lookup
Content-Type: application/json

{
  "street": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "zip": "94102"
}
```

Store representatives (optional)
```http
POST /api/user/representatives
Content-Type: application/json

{
  "userId": "user_123",
  "representatives": { /* output of lookup */ },
  "userAddress": { "street": "123 Main St", "city": "SF", "state": "CA", "zip": "94102" }
}
```

Fetch representatives
```http
GET /api/user/representatives?userId=user_123
```

## Database mapping

- `representative` / `user_representatives` (US) or country‑specific equivalents
- Address fields on `User`

See `prisma/schema.prisma` models for current US implementation; other jurisdictions add adapters without schema coupling when emails are used.

## Usage in advocacy (US adapter example)

```ts
import { CWCGenerator } from '$lib/core/congress/cwc-generator';

const xml = CWCGenerator.generateUserAdvocacyXML({
  template,
  user,
  targetRep: representatives.house
});
```

## Notes

- Lookup once at onboarding; advocacy is fast and cached when targets are static
- Adapters may impose rate limits/captcha; queue/retry at the orchestrator layer

## Env

```bash
SUPABASE_DATABASE_URL=...
# Adapter‑specific keys (optional)
CWC_API_KEY=...
LEGISLATIVE_API_BASE_URL=...
```


