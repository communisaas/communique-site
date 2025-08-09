# Congressional Integration

User-centric congressional delivery with address→representative mapping during onboarding and CWC generation during advocacy.

## Overview

1. Onboarding: collect address, map to House + Senate
2. Advocacy: use stored reps for delivery
3. Simplicity: right-sized for the primary use case

## Components

- Address lookup: `src/lib/congress/address-lookup.ts` (Census primary, ZIP→district fallback)
- Rep storage: Prisma models `representative` and `user_representatives` in `prisma/schema.prisma`
- CWC generator: `src/lib/congress/cwc-generator.ts`

## API

- POST `/api/address/lookup` → reps
- POST `/api/user/representatives` → persist
- GET `/api/user/representatives?userId=...` → fetch

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

Store representatives
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

- `representative` stores Congress.gov identifiers and office codes
- `user_representatives` links a user to their House and Senate members

See `prisma/schema.prisma` models: `representative`, `user_representatives`, and address fields on `User`.

## Usage in advocacy

```ts
import { CWCGenerator } from '$lib/congress/cwc-generator';

const xml = CWCGenerator.generateUserAdvocacyXML({
  template,
  user,
  targetRep: representatives.house
});
```

## Notes

- Lookup once at onboarding; advocacy is fast and cached
- Senate delivery implemented; House requires proxy and is simulated where needed

## Env

```bash
SUPABASE_DATABASE_URL=...
CONGRESS_API_KEY=...
```


