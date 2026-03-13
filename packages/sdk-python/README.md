# Commons Python SDK

Python SDK for the [Commons](https://commons.email) Public API. Supports both synchronous and asynchronous usage.

## Installation

```bash
pip install commons-sdk
```

## Quick Start

### Synchronous

```python
from commons import Commons

client = Commons(api_key="ck_live_...")

# Get organization info
org = client.org.get()
print(org["name"])

# List supporters (auto-paginates)
for supporter in client.supporters.list():
    print(supporter["email"])

# Create a supporter
new = client.supporters.create({
    "email": "jane@example.com",
    "name": "Jane Doe",
    "tags": ["tag-id-1"],
})
print(new["id"])

# Get a single supporter
supporter = client.supporters.get("supporter-id")

# Update a supporter
client.supporters.update("supporter-id", {"name": "Jane Smith"})

# Delete a supporter
client.supporters.delete("supporter-id")

# Close when done
client.close()
```

### Context Manager

```python
from commons import Commons

with Commons(api_key="ck_live_...") as client:
    tags = client.tags.list()
    for tag in tags:
        print(tag["name"], tag["supporterCount"])
```

### Async

```python
import asyncio
from commons import AsyncCommons

async def main():
    async with AsyncCommons(api_key="ck_live_...") as client:
        # Auto-paginating async iteration
        async for supporter in await client.supporters.list():
            print(supporter["email"])

        # Get campaign details
        campaign = await client.campaigns.get("campaign-id")
        print(campaign["title"])

asyncio.run(main())
```

## Resources

| Resource | Methods |
|---|---|
| `client.supporters` | `list()`, `get(id)`, `create(data)`, `update(id, data)`, `delete(id)` |
| `client.campaigns` | `list()`, `get(id)`, `create(data)`, `update(id, data)`, `list_actions(id)` |
| `client.events` | `list()`, `get(id)` |
| `client.donations` | `list()`, `get(id)` |
| `client.workflows` | `list()`, `get(id)` |
| `client.sms` | `list()` |
| `client.calls` | `list()` |
| `client.tags` | `list()`, `create(name)`, `update(id, name)`, `delete(id)` |
| `client.representatives` | `list()` |
| `client.usage` | `get()` |
| `client.org` | `get()` |
| `client.keys` | `create(data)`, `update(id, name, org_slug)`, `revoke(id, org_slug)` |

## Pagination

List methods return a `CursorPage` (or `AsyncCursorPage`) that auto-fetches subsequent pages when iterated:

```python
# Iterate through all pages automatically
for supporter in client.supporters.list():
    print(supporter["email"])

# Access a single page
page = client.supporters.list(limit=10)
print(page.data)       # list of items on this page
print(page.has_more)   # whether more pages exist
print(page.total)      # total count of matching records

# Filter with query parameters
page = client.supporters.list(verified="true", tag="tag-id")
page = client.campaigns.list(status="ACTIVE")
page = client.events.list(eventType="VIRTUAL")
page = client.donations.list(status="completed", campaignId="cmp-id")
```

## Error Handling

```python
from commons import Commons, NotFoundError, RateLimitError, AuthenticationError

client = Commons(api_key="ck_live_...")

try:
    supporter = client.supporters.get("nonexistent")
except NotFoundError:
    print("Supporter not found")
except RateLimitError:
    print("Rate limit exceeded, slow down")
except AuthenticationError:
    print("Invalid API key")
```

All errors extend `CommonsError` which has `code`, `message`, and `status` attributes:

| Exception | HTTP Status |
|---|---|
| `BadRequestError` | 400 |
| `AuthenticationError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `RateLimitError` | 429 |

## Configuration

```python
client = Commons(
    api_key="ck_live_...",
    base_url="https://commons.email/api/v1",  # default
    timeout=30.0,  # seconds, default
)
```

## Requirements

- Python 3.9+
- [httpx](https://www.python-httpx.org/) >= 0.24
