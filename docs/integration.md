# Integration Guide: External Services & voter-protocol

**How Communique integrates with external services and voter-protocol backend**

---

## Table of Contents

1. [voter-protocol Integration](#voter-protocol-integration)
2. [CWC API (Congressional Delivery)](#cwc-api-congressional-delivery)
3. [OAuth Providers](#oauth-providers)
4. [Identity Verification (self.xyz + Didit.me)](#identity-verification)
5. [TEE Encrypted Delivery](#tee-encrypted-delivery)

---

## voter-protocol Integration

### Separation of Concerns

**Communique handles:**
- UI/UX for address collection
- Browser-side encryption (XChaCha20-Poly1305)
- Calling voter-protocol APIs
- Displaying verification status

**voter-protocol handles:**
- Geocoding (Census Bureau + Geocodio)
- District resolution (city council + congressional)
- ZK proof generation (Halo2 WASM prover)
- TEE deployment (AWS Nitro Enclaves)
- ReputationAgent (Gemini 2.5 Flash credential verification)

### voter-protocol API Endpoints

```typescript
// ReputationAgent API (credential verification)
POST https://reputation.voter.workers.dev/reputation/verify
Headers:
  Authorization: Bearer ${VOTER_API_KEY}
  X-User-ID: ${userId}
  X-Domain: ${domain}
Body:
  {
    user_id: string,
    domain: string,
    organization_type: string,
    professional_role: string,
    experience_description: string,
    credentials_claim: string
  }
Response:
  {
    verification_status: 'state_api_verified' | 'peer_endorsed' | 'agent_verified' | 'unverified',
    credential_multiplier: number,  // 2.0x → 1.0x
    verified_by_agent: string,
    verification_evidence: {...}
  }
```

**Communique proxy implementation:**
```typescript
// src/routes/api/expertise/verify/+server.ts
export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;
  if (!session?.userId) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Proxy to voter-protocol ReputationAgent
  const verifyResponse = await fetch(`${VOTER_PROTOCOL_API_URL}/reputation/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOTER_API_KEY}`,
      'X-User-ID': session.userId,
      'X-Domain': body.domain
    },
    body: JSON.stringify(body)
  });

  const verificationResult = await verifyResponse.json();

  // Store result in Communique database
  await db.userExpertise.create({
    data: {
      user_id: session.userId,
      domain: body.domain,
      verification_status: verificationResult.verification_status,
      credential_multiplier: verificationResult.credential_multiplier,
      ...
    }
  });

  return json({ success: true, data: { expertise: ... } });
};
```

---

## Congressional Submit Endpoint (IMPLEMENTED)

**Status:** ✅ Complete (Wave 2.4)
**Implementation:** `src/routes/api/congressional/submit/+server.ts`
**Documentation:** `CONGRESSIONAL-SUBMIT-IMPLEMENTATION.md`

### Endpoint

```typescript
POST /api/congressional/submit
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "proof": "0x...",           // Serialized Noir proof
  "publicInputs": [           // 7 public inputs
    "nullifier",
    "merkleRoot",
    "authorityLevel",
    "actionDomain",
    "districtId",
    "timestamp",
    "templateHash"
  ],
  "encryptedWitness": "...",  // TEE-encrypted address
  "encryptedMessage": "...",  // TEE-encrypted message content
  "templateId": "template-123"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "submissionId": "sub_abc123",
    "status": "pending",
    "nullifier": "0x..."
  }
}
```

**Duplicate (409):**
```json
{
  "error": "This proof has already been submitted"
}
```

### Flow

```
1. Validate proof structure and public inputs
2. Check nullifier uniqueness (prevent double-voting)
3. Store submission in Postgres (encrypted blobs)
4. Queue blockchain submission (async, non-blocking)
5. Return submission ID immediately
6. Background: Submit to DistrictGateV2 on Scroll
7. Background: Forward encrypted blobs to TEE for delivery
```

### Security Invariants

1. Nullifier uniqueness MUST be enforced before blockchain submission
2. All submissions MUST be logged for audit trail
3. Blockchain submission MUST be async (don't block response)
4. Encrypted data stored but NEVER decrypted in Communique

---

## CWC API (Congressional Delivery)

**CWC (Communicating With Congress)** - Official API for delivering constituent messages to congressional offices.

### Configuration

```bash
# .env
CWC_API_KEY=your-cwc-api-key
CWC_CAMPAIGN_ID=communique-2025
CWC_DELIVERY_AGENT_ID=COMMUNIQUE_PBC
CWC_DELIVERY_AGENT_NAME="Communiqué PBC"
CWC_DELIVERY_AGENT_CONTACT=contact@communi.email
```

### Delivery Flow (Inside TEE)

**Critical:** CWC API called INSIDE AWS Nitro Enclave (not from Communique directly)

```
1. User browser encrypts address to TEE public key
2. Encrypted blob stored in Postgres
3. Message delivery triggered
4. TEE fetches encrypted blob
5. TEE decrypts address (exists only in TEE memory)
6. TEE calls CWC API with plaintext address
7. CWC delivers to congressional office
8. TEE returns confirmation
9. Address DESTROYED (zeroed from TEE memory)
```

### CWC API Client (Inside TEE)

```typescript
// voter-protocol TEE code (NOT in Communique)
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

async function submitToCWC(submission: CWCSubmission): Promise<{ success: boolean; submission_id?: string }> {
  const response = await fetch(`${CWC_API_BASE_URL}/submit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CWC_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(submission)
  });

  return await response.json();
}
```

### Rate Limiting

**CWC API limits:**
- 10 requests per hour per user
- 100 requests per hour per delivery agent

**Communique enforces rate limits BEFORE calling TEE.**

---

## OAuth Providers

**5 OAuth providers for user authentication:**
- Google
- Facebook
- Twitter (X)
- LinkedIn
- Discord

### Configuration

```bash
# .env
OAUTH_REDIRECT_BASE_URL=https://communi.email  # Production
# or http://localhost:5173 for development

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...

TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

### OAuth Flow (Example: Google)

```typescript
// src/routes/auth/google/+server.ts
import { Google } from 'arctic';

export async function GET({ cookies }) {
  const google = new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.OAUTH_REDIRECT_BASE_URL}/auth/google/callback`
  );

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store in HTTP-only cookies (CSRF protection)
  cookies.set('oauth_state', state, { httpOnly: true, secure: true, maxAge: 600 });
  cookies.set('oauth_code_verifier', codeVerifier, { httpOnly: true, secure: true, maxAge: 600 });

  const authUrl = google.createAuthorizationURL(state, codeVerifier, ['profile', 'email']);

  return new Response(null, {
    status: 302,
    headers: { Location: authUrl.toString() }
  });
}
```

```typescript
// src/routes/auth/google/callback/+server.ts
export async function GET({ url, cookies }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('oauth_state');
  const codeVerifier = cookies.get('oauth_code_verifier');

  // CSRF protection
  if (!state || !storedState || state !== storedState) {
    return new Response('Invalid state', { status: 400 });
  }

  const google = new Google(...);
  const tokens = await google.validateAuthorizationCode(code, codeVerifier);
  const accessToken = tokens.accessToken();

  // Fetch user info
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const googleUser = await response.json();

  // Create or update user
  const user = await db.user.upsert({
    where: { email: googleUser.email },
    update: { name: googleUser.name, avatar: googleUser.picture },
    create: { email: googleUser.email, name: googleUser.name, avatar: googleUser.picture }
  });

  // Create session
  const sessionToken = await createSession(user.id);
  cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30  // 30 days
  });

  return new Response(null, { status: 302, headers: { Location: '/' } });
}
```

---

## Identity Verification

**Two providers (both FREE):**
- **self.xyz** (70%) - NFC passport, 30 seconds
- **Didit.me** (30%) - Government ID + biometric, 2 minutes

### self.xyz Integration

**Configuration:**
```bash
NEXT_PUBLIC_SELF_APP_NAME=Communiqué
NEXT_PUBLIC_SELF_SCOPE=communique-congressional
NEXT_PUBLIC_SELF_ENDPOINT=https://communi.email/api/identity/verify
SELF_MOCK_PASSPORT=false  # Set to 'true' for development
```

**Flow:**
```typescript
// Frontend component
import { SelfSDK } from '@self-id/sdk';

const selfSDK = new SelfSDK({
  appId: process.env.SELF_APP_ID,
  environment: 'production'
});

async function verifySelfIdentity(userId: string) {
  // User scans passport NFC chip with phone
  const result = await selfSDK.verifyPassport({
    userId,
    requiredFields: ['name', 'dateOfBirth', 'nationality']
  });

  if (result.verified) {
    // Send to backend to store verification
    await fetch('/api/identity/verify', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'self.xyz',
        verificationData: result.data
      })
    });
  }
}
```

### Didit.me Integration (IMPLEMENTED)

**Status:** ✅ Complete (Wave 2.2)
**Implementation:** `src/lib/core/identity/didit-client.ts`
**Documentation:** `DIDIT-IMPLEMENTATION-SUMMARY.md`

**Configuration:**
```bash
# Get credentials from: https://dashboard.didit.me/
DIDIT_API_KEY=your-didit-api-key
DIDIT_WORKFLOW_ID=your-didit-workflow-id
DIDIT_WEBHOOK_SECRET=your-webhook-secret
```

**API Endpoints:**

```typescript
// 1. Initialize verification session
POST /api/identity/didit/init
// Returns: { verificationUrl, sessionId, status }

// 2. Webhook callback (server-to-server)
POST /api/identity/didit/webhook
// Headers: x-didit-signature, x-didit-timestamp
// Validates HMAC, updates user verification status
```

**Client Usage:**
```typescript
import {
  createVerificationSession,
  validateWebhook,
  parseVerificationResult
} from '$lib/core/identity/didit-client';

// Create session
const session = await createVerificationSession(
  { userId: 'user123', templateSlug: 'kyc-lite' },
  'https://communi.email/api/identity/didit/webhook'
);

// Redirect user to Didit
window.location.href = session.sessionUrl;

// Validate webhook (in webhook handler)
const isValid = validateWebhook(rawBody, signature, timestamp);
if (!isValid) return { status: 401 };

// Parse result
const result = parseVerificationResult(webhookEvent);
// Returns: { userId, authorityLevel, credentialHash, ... }
```

**Authority Level Mapping:**
| Document Type | Authority Level | Trust |
|--------------|-----------------|-------|
| Passport | 4 | Highest |
| Driver's License | 3 | High |
| National ID | 3 | High |

**Security Features:**
- ✅ HMAC-SHA256 webhook signature validation (constant-time)
- ✅ No raw PII storage (only hashed credentials)
- ✅ Age verification (18+ enforcement)
- ✅ Sybil resistance (identity_hash prevents duplicates)
- ✅ Cross-provider identity linking (identity_commitment)

**Three-Layer Identity Binding:**
1. `identity_hash` - Sybil resistance (prevents duplicate accounts)
2. `identity_commitment` - Cross-provider linking (merges OAuth accounts)
3. `shadowAtlasCommitment` - Poseidon2 hash for ZK proofs

**See:** `DIDIT-IMPLEMENTATION-SUMMARY.md` for comprehensive implementation details.

---

## TEE Encrypted Delivery

**AWS Nitro Enclaves (voter-protocol deployment, NOT Communique)**

### Flow Overview

```
1. Browser encrypts address (XChaCha20-Poly1305 to TEE public key)
2. Encrypted blob stored in Postgres
3. Message delivery triggered
4. Communique fetches encrypted blob from database
5. Communique sends encrypted blob to voter-protocol TEE endpoint
6. TEE decrypts inside hardware enclave (ARM Graviton)
7. TEE calls CWC API with plaintext address
8. TEE returns delivery confirmation
9. Address DESTROYED (zeroed from TEE memory)
10. Communique creates Message record (PUBLIC content + verification proof)
```

### Browser-Side Encryption (Communique)

```typescript
// src/lib/core/identity/blob-encryption.ts
import sodium from 'libsodium-wrappers';

export async function encryptAddressBlob(
  address: Address,
  teePublicKey: Uint8Array
): Promise<EncryptedBlob> {
  await sodium.ready;

  // Generate ephemeral keypair (perfect forward secrecy)
  const ephemeralKeys = sodium.crypto_box_keypair();

  // Shared secret via X25519 key exchange
  const sharedSecret = sodium.crypto_box_beforenm(teePublicKey, ephemeralKeys.privateKey);

  // Encrypt with XChaCha20-Poly1305
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(
    JSON.stringify(address),
    nonce,
    sharedSecret
  );

  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce),
    ephemeralPublicKey: sodium.to_base64(ephemeralKeys.publicKey),
    version: '1.0.0',
    timestamp: Date.now()
  };
}
```

### TEE Decryption (voter-protocol, NOT Communique)

```rust
// voter-protocol TEE code (Rust inside AWS Nitro Enclave)
async fn decrypt_and_deliver(encrypted_blob: EncryptedBlob) -> Result<()> {
  // 1. Decrypt using TEE private key (exists ONLY in enclave)
  let identity_blob = decrypt_blob(encrypted_blob, TEE_PRIVATE_KEY)?;

  // 2. Parse address (plaintext exists ONLY in TEE memory)
  let address = identity_blob.address;

  // 3. Call CWC API with plaintext address
  cwc_submit_message(&address, &message_content).await?;

  // 4. ZERO all secrets (address never leaves enclave)
  zero_memory(&address);
  zero_memory(&identity_blob);

  Ok(())
}
```

**See:** `docs/ARCHITECTURE.md` for full TEE architecture and privacy guarantees.

---

## Error Handling

### Retry Logic (CWC API)

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
    if (error.message.includes('CWC')) {
      return 'Message delivery temporarily unavailable. We'll retry automatically.';
    }
    if (error.message.includes('voter-protocol')) {
      return 'Verification service unavailable. Your credentials will be verified as soon as possible.';
    }
  }

  return 'Something went wrong. Please try again.';
}
```

---

## Environment Variables (Complete List)

```bash
# voter-protocol API
VOTER_PROTOCOL_API_URL=https://reputation.voter.workers.dev
VOTER_API_KEY=your-voter-protocol-api-key

# CWC API
CWC_API_KEY=your-cwc-api-key
CWC_CAMPAIGN_ID=communique-2025
CWC_DELIVERY_AGENT_ID=COMMUNIQUE_PBC

# OAuth
OAUTH_REDIRECT_BASE_URL=https://communi.email
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# ... other OAuth providers

# Identity Verification
NEXT_PUBLIC_SELF_APP_NAME=Communiqué
DIDIT_API_KEY=...
DIDIT_APP_ID=...

# TEE
TEE_PUBLIC_KEY=<base64-encoded-X25519-public-key>
```

---

## Next Steps

- **Architecture:** See `docs/ARCHITECTURE.md` for Communique/voter-protocol separation
- **Frontend:** See `docs/FRONTEND.md` for SvelteKit 5 patterns
- **Identity Verification:** See `docs/features/identity-verification.md` for verification tiers and flows

---

*Communiqué PBC | Integration Guide | Last Updated: 2026-02-02*
