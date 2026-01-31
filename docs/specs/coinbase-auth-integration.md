# Coinbase Authentication Integration Specification

**Status**: PLANNED | **Priority**: P1 | **Author**: Distinguished Engineering Review
**Date**: 2026-01-31 | **Related**: `docs/features/oauth.md`, `IMPLEMENTATION-GAP-ANALYSIS.md`

---

## Executive Summary

Integrate Coinbase OAuth2 as the highest-trust authentication provider for Communique. Coinbase offers **KYC-verified identity** (government ID + biometric verification) with 100M+ verified users, providing superior Sybil resistance compared to all current OAuth providers.

### Why Coinbase?

| Provider | KYC | Gov ID | Biometric | Sybil Score | Status |
|----------|-----|--------|-----------|-------------|--------|
| **Coinbase** | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ | **PLANNED** |
| Google | ❌ | ❌ | ❌ | ⭐⭐⭐⭐ | Active |
| LinkedIn | ❌ | ❌ | ❌ | ⭐⭐⭐⭐ | Active |
| Facebook | ❌ | ❌ | ❌ | ⭐⭐⭐ | Active |
| X/Twitter | ❌ | ❌ | ❌ | ⭐⭐ | Active (scope fixed) |
| Discord | ❌ | ❌ | ❌ | ⭐⭐ | **DISABLED** |

---

## Architecture Overview

### Two Integration Layers

```
┌────────────────────────────────────────────────────────────────────┐
│                     COINBASE INTEGRATION                            │
├─────────────────────────────┬──────────────────────────────────────┤
│    LAYER 1: OAuth2          │    LAYER 2: On-Chain Verifications   │
│    (Phase 1 - THIS SPEC)    │    (Phase 2 - FUTURE)                │
├─────────────────────────────┼──────────────────────────────────────┤
│ • Traditional OAuth flow    │ • EAS attestations on Base L2        │
│ • User info via API         │ • Wallet-connected verification      │
│ • KYC-backed identity       │ • Cryptographic proof of KYC         │
│ • trust_score: 90           │ • trust_score: 100                   │
├─────────────────────────────┼──────────────────────────────────────┤
│ Complexity: LOW             │ Complexity: MEDIUM                   │
│ Time: 1-2 days              │ Time: 3-5 days                       │
└─────────────────────────────┴──────────────────────────────────────┘
```

### OAuth2 Flow Diagram

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  communique │────▶│ login.coinbase.com  │────▶│ api.coinbase.com    │
│   frontend  │     │    /oauth2/auth     │     │      /v2/user       │
└─────────────┘     └─────────────────────┘     └─────────────────────┘
       │                      │                          │
       │  1. Generate state   │  2. User authorizes      │  3. Fetch profile
       │     + PKCE verifier  │     (Coinbase UI)        │     (email, name,
       │                      │                          │      country)
       ▼                      ▼                          ▼
   /auth/coinbase        Code returned            Create/update user
   sets cookies          to callback              with trust_score: 90
```

---

## Technical Specification

### 1. OAuth2 Endpoints

| Purpose | URL |
|---------|-----|
| Authorization | `https://login.coinbase.com/oauth2/auth` |
| Token Exchange | `https://login.coinbase.com/oauth2/token` |
| User Info | `https://api.coinbase.com/v2/user` |

### 2. Required OAuth Scopes

```typescript
const COINBASE_SCOPES = [
  'wallet:user:read',    // User profile data (name, country, timezone)
  'wallet:user:email',   // Email address (REQUIRED for identity)
  'offline_access'       // Refresh tokens for long sessions
];
```

### 3. User Response Structure

```typescript
interface CoinbaseUserResponse {
  data: {
    id: string;                    // UUID (stable identifier)
    name: string;                  // Full name from KYC
    username: string | null;       // Optional username
    email?: string;                // Requires wallet:user:email scope
    avatar_url: string;            // Profile picture URL
    profile_location: string | null;
    profile_bio: string | null;
    profile_url: string;
    resource: 'user';
    resource_path: '/v2/user';
    country: {
      code: string;                // ISO 3166-1 alpha-2 (e.g., "US")
      name: string;                // Full country name
    };
    nationality: {
      code: string;
      name: string;
    } | null;
    time_zone: string;             // e.g., "America/Los_Angeles"
    native_currency: string;       // e.g., "USD"
    bitcoin_unit: string;          // e.g., "BTC"
    state: string | null;          // Account state
    created_at: string;            // ISO 8601 timestamp
    sends_disabled?: boolean;      // If sending is disabled
  };
}
```

### 4. Provider Configuration

```typescript
// src/lib/core/auth/oauth-providers.ts

export const coinbaseConfig: OAuthCallbackConfig = {
  provider: 'coinbase',
  clientId: getRequiredEnv('COINBASE_CLIENT_ID', 'Coinbase'),
  clientSecret: getRequiredEnv('COINBASE_CLIENT_SECRET', 'Coinbase'),
  redirectUrl: `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/coinbase/callback`,
  userInfoUrl: 'https://api.coinbase.com/v2/user',
  requiresCodeVerifier: true,  // PKCE required
  scope: 'wallet:user:read wallet:user:email offline_access',

  // Coinbase uses standard OAuth2 with PKCE
  createOAuthClient: () => {
    return new CoinbaseOAuth(
      clientId,
      clientSecret,
      redirectUrl
    );
  },

  exchangeTokens: async (client, code, codeVerifier) => {
    return await client.validateAuthorizationCode(code, codeVerifier);
  },

  getUserInfo: async (accessToken: string): Promise<unknown> => {
    const response = await fetchWithRetry(
      'https://api.coinbase.com/v2/user',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'CB-VERSION': '2024-01-01',  // API version header required
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    return response.json();
  },

  extractUserData: (rawUser: unknown): NormalizedUserData => {
    if (!isCoinbaseUser(rawUser)) {
      throw new Error('Invalid Coinbase user response');
    }

    const user = rawUser.data;

    return {
      id: user.id,
      email: user.email || `${user.id}@coinbase.local`,  // Fallback (rare)
      name: user.name || user.username || 'Coinbase User',
      picture: user.avatar_url,
      emailVerified: !!user.email,  // Coinbase requires verified email
      provider: 'coinbase',
      providerAccountId: user.id,

      // Coinbase-specific fields
      country: user.country?.code,
      createdAt: user.created_at,

      // HIGH trust: KYC-verified accounts
      trustScore: 90,  // Higher than any other OAuth provider
      reputationTier: 'verified'
    };
  }
};
```

### 5. Type Guard

```typescript
interface CoinbaseUser {
  data: {
    id: string;
    name: string;
    email?: string;
    avatar_url: string;
    country?: { code: string; name: string };
    created_at: string;
  };
}

function isCoinbaseUser(user: unknown): user is CoinbaseUser {
  if (typeof user !== 'object' || user === null) return false;
  if (!('data' in user)) return false;

  const data = (user as { data: unknown }).data;
  if (typeof data !== 'object' || data === null) return false;

  return (
    'id' in data &&
    typeof (data as { id: unknown }).id === 'string' &&
    'name' in data &&
    typeof (data as { name: unknown }).name === 'string'
  );
}
```

### 6. Arctic Library Extension

Coinbase is NOT natively supported by Arctic. We need a custom OAuth2 client:

```typescript
// src/lib/core/auth/coinbase-oauth.ts

import { OAuth2Client } from 'arctic';

export class CoinbaseOAuth extends OAuth2Client {
  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ) {
    super(clientId, clientSecret, redirectUri);
  }

  createAuthorizationURL(
    state: string,
    codeVerifier: string,
    scopes: string[]
  ): URL {
    const url = new URL('https://login.coinbase.com/oauth2/auth');

    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scopes.join(' '));

    // PKCE
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return url;
  }

  async validateAuthorizationCode(
    code: string,
    codeVerifier: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const response = await fetch('https://login.coinbase.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    };
  }
}
```

---

## Implementation Plan

### Phase 1: OAuth Integration (This Sprint)

#### Files to Create

```
src/lib/core/auth/
├── coinbase-oauth.ts          # Custom OAuth2 client for Coinbase
└── oauth-providers.ts         # Add coinbaseConfig (MODIFY)

src/routes/auth/coinbase/
├── +server.ts                 # OAuth initiation route
└── callback/
    └── +server.ts             # OAuth callback handler
```

#### Files to Modify

```
src/lib/components/auth/parts/
└── AuthButtons.svelte         # Add Coinbase as PRIMARY tier

.env.example                   # Add COINBASE_CLIENT_ID, COINBASE_CLIENT_SECRET
```

### Phase 2: On-Chain Verification (Future)

```
src/lib/services/
└── coinbase-verifications.ts  # OnchainKit wrapper for EAS attestations

packages/crypto/
└── src/coinbase-attestations.ts  # Smart contract integration
```

---

## Environment Variables

```bash
# .env.example additions

# Coinbase OAuth (KYC-verified identity provider)
# Register at: https://www.coinbase.com/developer-platform
COINBASE_CLIENT_ID=your-coinbase-client-id
COINBASE_CLIENT_SECRET=your-coinbase-client-secret
```

---

## Trust Score Integration

### Current Provider Trust Scores

| Provider | trust_score | Rationale |
|----------|-------------|-----------|
| **Coinbase** | **90** | KYC-verified (gov ID + biometric) |
| Google | 80 | Phone verification common, large scale |
| LinkedIn | 80 | Professional identity, employment |
| Facebook | 70 | Phone verification, but fake accounts |
| X/Twitter | 50 | Phone-only accounts, low verification |
| Discord | — | **DISABLED** (low Sybil resistance) |

### Updated Trust Tier Mapping

```typescript
// oauth-callback-handler.ts

function calculateTrustScore(provider: string, emailVerified: boolean): number {
  const providerScores: Record<string, number> = {
    coinbase: 90,   // KYC-verified
    google: 80,
    linkedin: 80,
    facebook: 70,
    twitter: emailVerified ? 60 : 50
  };

  return providerScores[provider] ?? 50;
}
```

---

## UI Integration

### AuthButtons.svelte Updates

Coinbase should be added as a **PRIMARY** provider (full-width button) due to its high Sybil resistance:

```svelte
<!-- Trust tiers:
  - Primary (full-width): Coinbase ⭐⭐⭐⭐⭐, Google ⭐⭐⭐⭐, LinkedIn ⭐⭐⭐⭐
  - Secondary (half-width): Facebook ⭐⭐⭐, X/Twitter ⭐⭐
-->

const primaryProviders = [
  { provider: 'coinbase', name: 'Coinbase', color: '#0052FF' },  // NEW
  { provider: 'google', name: 'Google', color: '#4285F4' },
  { provider: 'linkedin', name: 'LinkedIn', color: '#0077B5' }
];

const secondaryProviders = [
  { provider: 'facebook', name: 'Facebook', color: '#1877F2' },
  { provider: 'twitter', name: 'X', color: '#000000' }
];
```

### Coinbase Brand Assets

- **Primary Color**: `#0052FF` (Coinbase Blue)
- **Logo**: Use official Coinbase "C" logo mark
- **Button Text**: "Continue with Coinbase"

---

## Security Considerations

### 1. PKCE Required

Coinbase OAuth2 requires PKCE (Proof Key for Code Exchange). This is already implemented in our OAuth infrastructure.

### 2. API Version Header

Coinbase API requires `CB-VERSION` header with a valid date:

```typescript
headers: {
  'CB-VERSION': '2024-01-01'
}
```

### 3. Rate Limiting

Coinbase API has rate limits. Implement exponential backoff:

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '1';
      await sleep(parseInt(retryAfter) * 1000);
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}
```

### 4. Token Refresh

For `offline_access` scope, implement token refresh:

```typescript
async function refreshCoinbaseToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://login.coinbase.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.COINBASE_CLIENT_ID!,
      client_secret: process.env.COINBASE_CLIENT_SECRET!
    })
  });

  const tokens = await response.json();
  return tokens.access_token;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/coinbase-oauth.test.ts

describe('CoinbaseOAuth', () => {
  test('generates valid authorization URL with PKCE', async () => {
    const client = new CoinbaseOAuth(clientId, clientSecret, redirectUri);
    const url = await client.createAuthorizationURL(state, codeVerifier, scopes);

    expect(url.hostname).toBe('login.coinbase.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('wallet:user:email');
  });

  test('extracts user data correctly', () => {
    const rawUser = {
      data: {
        id: 'abc123',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://...',
        country: { code: 'US', name: 'United States' },
        created_at: '2024-01-01T00:00:00Z'
      }
    };

    const userData = coinbaseConfig.extractUserData(rawUser);

    expect(userData.trustScore).toBe(90);
    expect(userData.country).toBe('US');
    expect(userData.emailVerified).toBe(true);
  });
});
```

### Integration Tests

```typescript
// tests/integration/coinbase-oauth-flow.test.ts

describe('Coinbase OAuth Flow', () => {
  test('completes full OAuth flow with mock provider', async () => {
    // Mock Coinbase OAuth endpoints
    // Test state validation
    // Test PKCE verification
    // Test user creation with trust_score: 90
  });
});
```

---

## Rollout Plan

### Step 1: Developer Portal Setup
1. Register OAuth app at [Coinbase Developer Platform](https://www.coinbase.com/developer-platform)
2. Configure redirect URIs:
   - `http://localhost:5173/auth/coinbase/callback` (dev)
   - `https://communique.app/auth/coinbase/callback` (prod)
3. Request scopes: `wallet:user:read`, `wallet:user:email`, `offline_access`
4. Note Client ID and Client Secret

### Step 2: Implementation
1. Create `coinbase-oauth.ts` custom client
2. Add `coinbaseConfig` to oauth-providers.ts
3. Create route handlers
4. Update AuthButtons.svelte

### Step 3: Testing
1. Run unit tests
2. Run integration tests with mock provider
3. Manual E2E testing with real Coinbase account

### Step 4: Production Deployment
1. Add secrets to Fly.io: `flyctl secrets set COINBASE_CLIENT_ID=... COINBASE_CLIENT_SECRET=...`
2. Deploy and monitor
3. Update documentation

---

## Future: On-Chain Verification (Phase 2)

### Coinbase Verifications on Base

After OAuth, users can optionally connect their wallet to claim on-chain verification:

```typescript
import { getAttestations } from '@coinbase/onchainkit/identity';
import { base } from 'viem/chains';

const COINBASE_VERIFIED_ACCOUNT =
  '0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9';

async function checkCoinbaseVerification(walletAddress: `0x${string}`) {
  const attestations = await getAttestations(
    walletAddress,
    base,
    { schemas: [COINBASE_VERIFIED_ACCOUNT] }
  );

  return attestations.length > 0 && !attestations[0].revoked;
}
```

### Trust Score Upgrade Path

```
OAuth only:           trust_score: 90
OAuth + On-Chain:     trust_score: 100 (maximum)
```

---

## References

- [Coinbase Developer Documentation](https://docs.cdp.coinbase.com/)
- [Coinbase OAuth2 Integration Guide](https://docs.cdp.coinbase.com/coinbase-app/authentication-authorization/oauth2/integrations)
- [Coinbase Verifications GitHub](https://github.com/coinbase/verifications)
- [OnchainKit Documentation](https://docs.base.org/builderkits/onchainkit/)
- [EAS (Ethereum Attestation Service)](https://attest.sh/)

---

## Appendix A: Coinbase On-Chain Contract Addresses

### Base Mainnet

| Contract | Address |
|----------|---------|
| EAS | `0x4200000000000000000000000000000000000021` |
| Schema Registry | `0x4200000000000000000000000000000000000020` |
| Coinbase Indexer | `0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C` |
| Coinbase Attester | `0x357458739F90461b99789350868CD7CF330Dd7EE` |
| Coinbase Resolver | `0xD867CbEd445c37b0F95Cc956fe6B539BdEf7F32f` |

### Schema IDs (Base Mainnet)

| Schema | ID |
|--------|-----|
| Verified Account | `0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9` |
| Verified Country | `0x1801901fabd0e6189356b4fb52bb0ab855276d84f7ec140839fbd1f6801ca065` |
| Coinbase One | `0x254bd1b63e0591fefa66818ca054c78627306f253f86be6023725a67ee6bf9f4` |

---

*Specification authored by Distinguished Engineering Review | 2026-01-31*
