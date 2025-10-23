# Integration Guide: CWC, OAuth, Geocoding, self.xyz, TEE

🔌 **Implementation Guide** - How communiqué integrates with external services

**For blockchain architecture and cryptography specs:** See [voter-protocol/ARCHITECTURE.md](https://github.com/communisaas/voter-protocol/blob/main/ARCHITECTURE.md) and [voter-protocol/ECONOMICS.md](https://github.com/communisaas/voter-protocol/blob/main/docs/ECONOMICS.md)

**This document covers:** Congressional Web Contact (CWC) API, OAuth providers, Census Bureau geocoding, identity verification (self.xyz + Didit.me), and AWS Nitro Enclaves (TEE) encrypted delivery.

This document covers Congressional Web Contact (CWC) API, OAuth providers (Google/Facebook/Twitter/LinkedIn/Discord), Census Bureau geocoding, self.xyz + Didit.me identity verification, and AWS Nitro Enclaves (TEE) encrypted delivery.

---

## Table of Contents

1. [CWC API Integration](#cwc-api-integration)
2. [OAuth Providers](#oauth-providers)
3. [Geocoding & District Lookup](#geocoding--district-lookup)
4. [Identity Verification](#identity-verification)
5. [TEE Encrypted Delivery](#tee-encrypted-delivery)
6. [Error Handling](#error-handling)

---

## CWC API Integration

**CWC (Communicating With Congress)** is the official API for delivering constituent messages to congressional offices.

### API Configuration

**Environment variables:**

```bash
CWC_API_KEY=your-cwc-api-key
CWC_CAMPAIGN_ID=communique-2025
CWC_API_BASE_URL=https://soapbox.senate.gov/api  # Default

# Delivery agent identification
CWC_DELIVERY_AGENT_ID=COMMUNIQUE_PBC
CWC_DELIVERY_AGENT_NAME="Communiqué PBC"
CWC_DELIVERY_AGENT_CONTACT=contact@communi.email
CWC_DELIVERY_AGENT_ACKNOWLEDGEMENT_EMAIL=noreply@communi.email
CWC_DELIVERY_AGENT_ACK=Y
```

### Message Submission Flow

**1. User fills template + provides address**
**2. Address validated via Census Bureau geocoding**
**3. Congressional district resolved**
**4. Message encrypted client-side (XChaCha20-Poly1305)**
**5. Encrypted message sent to AWS Nitro Enclaves TEE**
**6. TEE decrypts + submits to CWC API**
**7. CWC delivers to congressional office**

### CWC API Client

```typescript
// lib/core/congress/cwc-client.ts
import { env } from '$env/dynamic/private';

interface CWCSubmission {
  campaign_id: string;
  delivery_agent_id: string;
  constituent: {
    prefix: string;
    first_name: string;
    last_name: string;
    email: string;
    address1: string;
    city: string;
    state_abbreviation: string;
    postal_code: string;
  };
  message: {
    subject: string;
    message: string;
    organization: string;
  };
  offices: string[];  // Congressional office codes
}

interface CWCResponse {
  success: boolean;
  submission_id?: string;
  errors?: string[];
}

export async function submitToCWC(
  submission: CWCSubmission
): Promise<CWCResponse> {
  const response = await fetch(`${env.CWC_API_BASE_URL}/submit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CWC_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(submission)
  });

  if (!response.ok) {
    throw new Error(`CWC API error: ${response.statusText}`);
  }

  return await response.json();
}
```

### Office Code Lookup

**CWC requires office codes, not just district info:**

```typescript
interface CongressionalOffice {
  bioguide_id: string;  // e.g., "P000197" for Nancy Pelosi
  office_code: string;   // e.g., "CA13-01"
  name: string;
  party: string;
  state: string;
  district: string;
  chamber: 'house' | 'senate';
}

export async function getOfficesForDistrict(
  state: string,
  district: string
): Promise<CongressionalOffice[]> {
  // Query Prisma database (seeded from Congress.gov API)
  const representatives = await db.representative.findMany({
    where: {
      state,
      district,
      is_active: true
    }
  });

  return representatives.map(rep => ({
    bioguide_id: rep.bioguide_id,
    office_code: rep.office_code,
    name: rep.name,
    party: rep.party,
    state: rep.state,
    district: rep.district,
    chamber: rep.chamber
  }));
}
```

### Rate Limiting

**CWC API has strict rate limits:**
- 10 requests per hour per user
- 100 requests per hour per delivery agent

**Implementation:**

```typescript
// Rate limiting via DynamoDB
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

export async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; remainingRequests: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 3600; // 1 hour window

  const result = await dynamodb.send(new UpdateItemCommand({
    TableName: process.env.DYNAMO_TABLE_NAME,
    Key: { userId: { S: userId } },
    UpdateExpression: 'SET requestCount = if_not_exists(requestCount, :zero) + :inc, lastRequest = :now',
    ConditionExpression: 'attribute_not_exists(lastRequest) OR lastRequest < :windowStart',
    ExpressionAttributeValues: {
      ':inc': { N: '1' },
      ':zero': { N: '0' },
      ':now': { N: now.toString() },
      ':windowStart': { N: windowStart.toString() }
    },
    ReturnValues: 'ALL_NEW'
  }));

  const requestCount = parseInt(result.Attributes?.requestCount.N || '0');
  const allowed = requestCount <= 10;

  return {
    allowed,
    remainingRequests: Math.max(0, 10 - requestCount)
  };
}
```

---

## OAuth Providers

**5 OAuth providers for user authentication:**
- Google
- Facebook
- Twitter (X)
- LinkedIn
- Discord

### Provider Configuration

**Environment variables:**

```bash
# Base URL for OAuth callbacks
OAUTH_REDIRECT_BASE_URL=http://localhost:5173  # Dev
OAUTH_REDIRECT_BASE_URL=https://communi.email  # Production

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret

# Twitter OAuth
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

### OAuth Flow

**Standard OAuth 2.0 flow with PKCE (where supported):**

```
1. User clicks "Sign in with Google"
2. Generate code_verifier + code_challenge (PKCE)
3. Store state + code_verifier in session
4. Redirect to provider's authorization URL
5. User authorizes on provider's site
6. Provider redirects back to /auth/[provider]/callback?code=...&state=...
7. Validate state matches (CSRF protection)
8. Exchange code for access_token (with code_verifier)
9. Fetch user info from provider's API
10. Create/update user in database
11. Create session with @oslojs/crypto
12. Redirect to app
```

### Implementation Example (Google)

```typescript
// routes/auth/google/+server.ts
import { generateState, generateCodeVerifier } from 'arctic';
import { Google } from 'arctic';

export async function GET({ cookies, url }) {
  const google = new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/google/callback`
  );

  // PKCE security
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store in secure HTTP-only cookies
  cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600  // 10 minutes
  });

  cookies.set('oauth_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  });

  const authUrl = google.createAuthorizationURL(
    state,
    codeVerifier,
    ['profile', 'email']
  );

  return new Response(null, {
    status: 302,
    headers: { Location: authUrl.toString() }
  });
}
```

```typescript
// routes/auth/google/callback/+server.ts
import { Google } from 'arctic';
import { db } from '$lib/core/db';
import { createSession } from '$lib/core/auth/auth';

export async function GET({ url, cookies }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('oauth_state');
  const codeVerifier = cookies.get('oauth_code_verifier');

  // CSRF protection
  if (!state || !storedState || state !== storedState) {
    return new Response('Invalid state', { status: 400 });
  }

  if (!code || !codeVerifier) {
    return new Response('Missing code or verifier', { status: 400 });
  }

  const google = new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/google/callback`
  );

  try {
    // Exchange code for tokens
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const accessToken = tokens.accessToken();

    // Fetch user info
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const googleUser = await response.json();

    // Create or update user in database
    const user = await db.user.upsert({
      where: { email: googleUser.email },
      update: {
        name: googleUser.name,
        avatar: googleUser.picture
      },
      create: {
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture
      }
    });

    // Create session
    const sessionToken = await createSession(user.id);

    // Set session cookie
    cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30  // 30 days
    });

    // Redirect to app
    return new Response(null, {
      status: 302,
      headers: { Location: '/' }
    });
  } catch (error) {
    console.error('OAuth error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
}
```

### Provider-Specific Quirks

**Twitter:**
- May not provide email (use `username@twitter.local` as placeholder)
- Requires `offline.access` scope for refresh tokens

**Facebook:**
- Requires `appsecret_proof` for enhanced security
- Avatar URL nested: `picture.data.url`

**LinkedIn:**
- Uses `sub` field instead of `id`
- Requires `openid profile email` scopes

**Discord:**
- Supports animated avatars (`.gif` vs `.png`)
- Uses `global_name` or `username#discriminator`

---

## Geocoding & District Lookup

**Two-step process:**
1. Geocode address → lat/lng coordinates
2. Reverse geocode coordinates → congressional district

### Census Bureau Geocoding API

**Free, official API from US Census Bureau:**

```typescript
interface GeocodeResult {
  latitude: number;
  longitude: number;
  matched_address: string;
  congressional_district: string;  // e.g., "13" for CA-13
}

export async function geocodeAddress(
  street: string,
  city: string,
  state: string,
  zip: string
): Promise<GeocodeResult> {
  const address = `${street}, ${city}, ${state} ${zip}`;

  const response = await fetch(
    `https://geocoding.geo.census.gov/geocoder/geographies/address?` +
    `street=${encodeURIComponent(street)}&` +
    `city=${encodeURIComponent(city)}&` +
    `state=${encodeURIComponent(state)}&` +
    `zip=${encodeURIComponent(zip)}&` +
    `benchmark=Public_AR_Current&` +
    `vintage=Current_Current&` +
    `layers=all&` +
    `format=json`
  );

  if (!response.ok) {
    throw new Error('Geocoding failed');
  }

  const data = await response.json();

  if (!data.result?.addressMatches?.length) {
    throw new Error('No address matches found');
  }

  const match = data.result.addressMatches[0];

  return {
    latitude: match.coordinates.y,
    longitude: match.coordinates.x,
    matched_address: match.matchedAddress,
    congressional_district: match.geographies['118th Congress']?.[0]?.BASENAME || ''
  };
}
```

### Client-Side Validation

**Real-time address validation as user types:**

```svelte
<script lang="ts">
  import { debounce } from '$lib/utils/debounce';

  let street = $state('');
  let city = $state('');
  let state = $state('');
  let zip = $state('');

  let validationStatus = $state<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  let district = $state<string | null>(null);

  const validateAddress = debounce(async () => {
    if (!street || !city || !state || !zip) return;

    validationStatus = 'validating';

    try {
      const response = await fetch('/api/address/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street, city, state, zip })
      });

      const result = await response.json();

      if (result.success) {
        validationStatus = 'valid';
        district = result.district;
      } else {
        validationStatus = 'invalid';
        district = null;
      }
    } catch (error) {
      validationStatus = 'invalid';
      district = null;
    }
  }, 500);

  $effect(() => {
    validateAddress();
  });
</script>

<div class="address-form">
  <input bind:value={street} placeholder="Street address" />
  <input bind:value={city} placeholder="City" />
  <input bind:value={state} placeholder="State" maxlength="2" />
  <input bind:value={zip} placeholder="ZIP code" />

  {#if validationStatus === 'validating'}
    <p class="text-gray-500">Validating address...</p>
  {:else if validationStatus === 'valid'}
    <p class="text-green-600">✓ Valid address in district {district}</p>
  {:else if validationStatus === 'invalid'}
    <p class="text-red-600">✗ Address could not be verified</p>
  {/if}
</div>
```

---

## Identity Verification

**Phase 1:** self.xyz (70%) + Didit.me (30%) - both FREE

**Phase 2:** Expand to other providers as needed

### self.xyz Integration

**NFC passport verification (primary method):**

```typescript
// self.xyz provides client-side SDK
import { SelfSDK } from '@self-id/sdk';

const selfSDK = new SelfSDK({
  appId: process.env.SELF_APP_ID,
  environment: 'production'
});

export async function verifySelfIdentity(
  userId: string
): Promise<{ verified: boolean; passportData?: unknown }> {
  try {
    // User scans passport NFC chip with phone
    const result = await selfSDK.verifyPassport({
      userId,
      requiredFields: ['name', 'dateOfBirth', 'nationality']
    });

    if (result.verified) {
      // Store verification in database
      await db.user.update({
        where: { id: userId },
        data: {
          is_verified: true,
          verification_method: 'self.xyz',
          verification_data: result.data,
          verified_at: new Date()
        }
      });

      return { verified: true, passportData: result.data };
    }

    return { verified: false };
  } catch (error) {
    console.error('self.xyz verification error:', error);
    return { verified: false };
  }
}
```

### Didit.me Integration

**Zero-knowledge identity verification (fallback method):**

```typescript
import { DiditSDK } from '@didit/sdk';

const diditSDK = new DiditSDK({
  apiKey: process.env.DIDIT_API_KEY
});

export async function verifyDiditIdentity(
  userId: string
): Promise<{ verified: boolean; zkProof?: string }> {
  try {
    // User completes Didit identity verification flow
    const result = await diditSDK.verify({
      userId,
      verificationType: 'government_id'
    });

    if (result.verified) {
      await db.user.update({
        where: { id: userId },
        data: {
          is_verified: true,
          verification_method: 'didit',
          verification_data: { zkProof: result.proof },
          verified_at: new Date()
        }
      });

      return { verified: true, zkProof: result.proof };
    }

    return { verified: false };
  } catch (error) {
    console.error('Didit verification error:', error);
    return { verified: false };
  }
}
```

---

## TEE Encrypted Delivery

**AWS Nitro Enclaves (hardware-isolated TEE) for encrypted message delivery:**

### Encryption Flow

```
1. User's browser encrypts message with XChaCha20-Poly1305
2. Encrypted message sent to AWS Nitro Enclaves TEE
3. TEE attests integrity (AWS Nitro attestation document)
4. TEE decrypts message inside hardware enclave
5. TEE submits to CWC API
6. TEE returns delivery confirmation
7. Encrypted message deleted from TEE memory
```

### Client-Side Encryption

```typescript
// Using libsodium-wrappers for XChaCha20-Poly1305
import sodium from 'libsodium-wrappers';

export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: Uint8Array
): Promise<{ ciphertext: string; nonce: string }> {
  await sodium.ready;

  // Generate random nonce
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

  // Encrypt with XChaCha20-Poly1305
  const ciphertext = sodium.crypto_secretbox_easy(
    plaintext,
    nonce,
    recipientPublicKey
  );

  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce)
  };
}
```

### Server-Side (TEE) Decryption

```typescript
// Inside AWS Nitro Enclaves TEE
export async function decryptAndDeliver(
  encryptedMessage: { ciphertext: string; nonce: string },
  privateKey: Uint8Array
): Promise<{ success: boolean; submissionId?: string }> {
  await sodium.ready;

  // Decrypt inside hardware enclave
  const ciphertext = sodium.from_base64(encryptedMessage.ciphertext);
  const nonce = sodium.from_base64(encryptedMessage.nonce);

  const plaintext = sodium.crypto_secretbox_open_easy(
    ciphertext,
    nonce,
    privateKey
  );

  if (!plaintext) {
    throw new Error('Decryption failed');
  }

  const message = sodium.to_string(plaintext);

  // Submit to CWC API (plaintext only exists in TEE)
  const result = await submitToCWC({
    message,
    // ... other fields
  });

  // Zero out plaintext from memory
  sodium.memzero(plaintext);

  return result;
}
```

---

## Error Handling

### Retry Logic

**CWC API can be flaky. Implement exponential backoff:**

```typescript
export async function submitWithRetry(
  submission: CWCSubmission,
  maxRetries = 3
): Promise<CWCResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await submitToCWC(submission);
    } catch (error) {
      lastError = error as Error;

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
```

### User-Friendly Error Messages

```typescript
export function formatAPIError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('rate limit')) {
      return 'You've reached the hourly limit. Please try again in 1 hour.';
    }
    if (error.message.includes('geocoding')) {
      return 'We couldn't verify your address. Please check it and try again.';
    }
    if (error.message.includes('CWC')) {
      return 'Message delivery temporarily unavailable. We'll retry automatically.';
    }
  }

  return 'Something went wrong. Please try again.';
}
```

---

## Next Steps

- **Frontend Architecture**: See `FRONTEND-ARCHITECTURE.md` for SvelteKit 5 patterns
- **Template System**: See `TEMPLATE-SYSTEM.md` for variables, editor, moderation
- **Development**: See `DEVELOPMENT.md` for testing, deployment

---

*Communiqué PBC | Frontend for VOTER Protocol | 2025*
