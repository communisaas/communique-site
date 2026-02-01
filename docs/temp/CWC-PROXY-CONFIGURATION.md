# CWC Proxy Configuration Update

## Current Status

The proxy server at `34.171.151.252` (house.communi.email) needs to be updated to forward requests to the actual House CWC endpoints.

## Required Configuration Changes

### Proxy Routes (proxy.js)

Update the TARGET URLs in the proxy configuration:

```javascript
// For /cwc-house-test (test environment)
const HOUSE_UAT_TARGET = 'https://uat-cwc.house.gov/v2/message';
const HOUSE_UAT_API_KEY = 'ad4f26050db94a6bed25ace5f5400c837f7e6fb414d3f18895e04751d8a19ab2'; // DEV_TOKEN

// For /cwc-house (production environment)
const HOUSE_PROD_TARGET = 'https://cwc.house.gov/v2/message';
const HOUSE_PROD_API_KEY = '7f814313e927d68eb38af01cebdff36cd28a005f0afb2657a1dbcb4828bba35d'; // PROD_TOKEN
```

### Expected Proxy Behavior

1. **Test endpoint** (`/cwc-house-test`):
   - Receive XML POST from client
   - Forward to: `https://uat-cwc.house.gov/v2/message?apikey=${HOUSE_UAT_API_KEY}`
   - Headers: `Content-Type: application/xml`
   - Return House CWC response to client

2. **Production endpoint** (`/cwc-house`):
   - Receive XML POST from client
   - Forward to: `https://cwc.house.gov/v2/message?apikey=${HOUSE_PROD_API_KEY}`
   - Headers: `Content-Type: application/xml`
   - Return House CWC response to client

### Example Proxy Handler

```javascript
app.post('/cwc-house-test', async (req, res) => {
  try {
    const response = await fetch(
      `${HOUSE_UAT_TARGET}?apikey=${HOUSE_UAT_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Communique-CWC-Proxy/1.0'
        },
        body: req.body // Raw XML
      }
    );

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/cwc-house', async (req, res) => {
  try {
    const response = await fetch(
      `${HOUSE_PROD_TARGET}?apikey=${HOUSE_PROD_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'Communique-CWC-Proxy/1.0'
        },
        body: req.body // Raw XML
      }
    );

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## SSH Access

Connect to the proxy server:
```bash
ssh -i ~/.ssh/gcp-key 34.171.151.252
```

Or via gcloud (if IAP is configured):
```bash
gcloud compute ssh --zone "us-central1-a" "cwch-proxy-server" --project "communicating-with-congress"
```

## Client-Side Configuration (Done)

The following environment variables have been configured in `.env.local`:

```
CWC_ENVIRONMENT=test
CWC_API_KEY=c40d2f891a4a5e3b21c3580fef76f4b9ce6d8495
HOUSE_CWC_API_KEY=113a7ef7e1151325f11ad846db13bd42795fb799
GCP_PROXY_URL=https://house.communi.email
```

## Switching to Production

To switch from test to production endpoints, update:

```bash
CWC_ENVIRONMENT=production
```

This will automatically:
- Senate: Use `/production-messages/` instead of `/testing-messages/`
- House: Use `/cwc-house` proxy route instead of `/cwc-house-test`

## Summary of Changes Made

### cwc-client.ts
- Added `CWC_ENVIRONMENT` support for test/production switching
- Added `HOUSE_CWC_API_KEY` for House-specific API key
- Fixed Senate to handle HTTP 201 as success
- Changed House submission to use XML (via CWCGenerator) instead of JSON
- Changed House endpoint from `/api/house/submit` to `/cwc-house` or `/cwc-house-test`
- Removed Bearer token auth (proxy handles API key forwarding)

### cwc-generator.ts
- Fixed extra whitespace in `<Address>` tag
- Added phone number formatting to House XML
- Added Phone element to Senate Constituent block

### .env.example
- Updated CWC section with new variables
- Documented test/production endpoint behavior
- Removed obsolete `GCP_PROXY_AUTH_TOKEN`
