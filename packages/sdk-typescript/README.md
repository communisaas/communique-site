# @commons-platform/sdk

Official TypeScript SDK for the Commons Public API. Zero dependencies, full type safety, auto-paginating async iterators.

## Install

```bash
npm install @commons-platform/sdk
```

## Quick start

```typescript
import { Commons } from '@commons-platform/sdk';

const client = new Commons({
  apiKey: 'ck_live_...',
  baseUrl: 'https://commons.so/api/v1' // optional, this is the default
});

// Get your organization
const org = await client.org.get();
console.log(org.name, org.counts.supporters);
```

## Resources

| Resource | Methods |
|---|---|
| `client.org` | `.get()` |
| `client.supporters` | `.list()`, `.get(id)`, `.create(input)`, `.update(id, input)`, `.delete(id)` |
| `client.campaigns` | `.list()`, `.get(id)`, `.create(input)`, `.update(id, input)`, `.actions(id)` |
| `client.tags` | `.list()`, `.create(name)`, `.update(id, name)`, `.delete(id)` |
| `client.events` | `.list()`, `.get(id)` |
| `client.donations` | `.list()`, `.get(id)` |
| `client.workflows` | `.list()`, `.get(id)` |
| `client.sms` | `.list()` |
| `client.calls` | `.list()` |
| `client.representatives` | `.list()` |
| `client.usage` | `.get()` |
| `client.keys` | `.create(input)`, `.rename(id, orgSlug, name)`, `.revoke(id, orgSlug)` |

## Pagination

List methods return a `CursorPage<T>` that implements `AsyncIterable<T>`:

```typescript
// Iterate through all supporters automatically
for await (const supporter of client.supporters.list()) {
  console.log(supporter.email);
}

// Or work with a single page
const page = await client.supporters.list({ limit: 10 });
console.log(page.data);        // Supporter[]
console.log(page.meta.total);  // total count
console.log(page.hasMore);     // boolean

// Manually fetch next page
const next = await page.nextPage();
```

### Filtering

```typescript
// Filter supporters
const verified = await client.supporters.list({ verified: true, email_status: 'subscribed' });

// Filter campaigns
const active = await client.campaigns.list({ status: 'ACTIVE', type: 'LETTER' });

// Filter donations
const completed = await client.donations.list({ status: 'completed', campaignId: 'camp_123' });
```

## Error handling

The SDK throws typed errors for different HTTP status codes:

```typescript
import { Commons, NotFoundError, RateLimitError, AuthenticationError } from '@commons-platform/sdk';

try {
  const supporter = await client.supporters.get('nonexistent');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Not found:', err.message);
  } else if (err instanceof RateLimitError) {
    console.log('Rate limited:', err.message);
  } else if (err instanceof AuthenticationError) {
    console.log('Auth failed:', err.message);
  }
}
```

## Error classes

| Class | HTTP Status | When |
|---|---|---|
| `AuthenticationError` | 401 | Missing/invalid API key |
| `ForbiddenError` | 403 | Key lacks required scope |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Too many requests |
| `CommonsError` | other | Base class for all errors |

## Requirements

- Node.js 18+ or any runtime with native `fetch`
- ESM only
