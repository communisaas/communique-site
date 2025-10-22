# SDK Implementation Analysis: self.xyz + Didit.me

**Status:** ⚠️ Implementation requires updates to match SDK requirements
**Reviewed:** self.xyz docs + Didit.me API reference
**Your Credentials:**

- Didit API Key: `1NzVqRqXKNkv1f07XAO_-OfWt7kNfmDxtNr82xKAUEA`
- Didit App ID: `3b95ade6-cf55-4b92-bb81-b21aaf3aea86`

---

## Summary of Findings

### ✅ What We Got Right

1. **Database Schema**: Our Prisma schema aligns well with SDK requirements
   - ✅ `identity_hash` for Sybil resistance (matches SDK passport data)
   - ✅ `birth_year` for age verification (SDK provides DOB)
   - ✅ `verification_method` field ('self.xyz' | 'didit')
   - ✅ `VerificationAudit` table for compliance (SDK provides detailed results)

2. **Identity Hashing**: Approach is sound but needs SDK data extraction
   - ✅ SHA-256 with platform salt (correct security approach)
   - ✅ Normalization logic (case, whitespace)
   - ⚠️ Need to map SDK response fields to our `IdentityProof` structure

3. **Session Management**: Good foundation, needs SDK integration
   - ✅ Database-backed sessions (correct approach)
   - ✅ 5-minute expiration (matches best practices)
   - ⚠️ Nonce generation is our own (SDK has its own challenge system)

### ❌ What We Need to Fix/Add

1. **Missing SDK Packages**: Need to install actual SDKs
2. **Environment Variables**: Incomplete configuration
3. **Verification Endpoints**: Need to implement SDK-specific callbacks
4. **Frontend Integration**: Missing QR code generation components
5. **Webhook Handling**: ✅ **Using Didit-recommended webhook approach** (event-driven)

### 🔄 **Implementation Approach (Revised After Didit Documentation Review)**

**After reviewing Didit Quick Start documentation:**

- **self.xyz**: Synchronous frontend-initiated flow (NO webhook needed)
- **Didit.me**: **Webhook-based** (explicitly recommended by Didit over polling)

**Rationale for webhooks:**

- ✅ Explicitly recommended by Didit documentation
- ✅ Event-driven architecture (no polling overhead)
- ✅ Real-time status updates
- ✅ Industry standard pattern for async verification

**Development approach:**

- Use webhook endpoint for both dev and production
- For local development: Use ngrok or similar tunneling service
- HMAC signature verification ensures webhook security

---

## 1. self.xyz Implementation Gaps

### ❌ **Missing: NPM Package Installation**

**Required packages:**

```bash
npm install @selfxyz/qrcode @selfxyz/core ethers
```

**Current state:** NOT INSTALLED

---

### ⚠️ **Environment Variables: Incomplete**

**SDK requires:**

```bash
# Frontend (QR code generation)
NEXT_PUBLIC_SELF_APP_NAME=Communiqué
NEXT_PUBLIC_SELF_SCOPE=communique-congressional
NEXT_PUBLIC_SELF_ENDPOINT=https://communi.email/api/identity/verify

# Backend (verification)
SELF_MOCK_PASSPORT=false  # true for testnet, false for mainnet
```

**Our current `.env.example`:**

```bash
SELF_XYZ_API_KEY=your-self-xyz-api-key-here  # ❌ SDK doesn't use API keys
SELF_XYZ_ENVIRONMENT=sandbox                  # ❌ Wrong variable name
```

**What we actually need:**

- **NO API KEY** - self.xyz uses on-chain verification (no centralized auth)
- `SELF_MOCK_PASSPORT` - Controls testnet vs mainnet
- `NEXT_PUBLIC_SELF_*` variables for frontend QR generation

---

### ❌ **Missing: QR Code Generation (Frontend)**

**SDK approach:**

```typescript
import { SelfAppBuilder } from '@selfxyz/qrcode';

const app = new SelfAppBuilder()
	.setVersion(2)
	.setAppName('Communiqué')
	.setScope('communique-congressional')
	.setUserId(userId, 'uuid')
	.setEndpoint('staging_https', 'https://communi.email/api/identity/verify')
	.setDisclosures({
		nationality: true,
		minimumAge: 18,
		ofac: true
	})
	.build();

const qrCodeData = app.getUniversalLink();
```

**Our current implementation** (`/api/identity/init/+server.ts`):

```typescript
const builtConfig = {
	...appConfig,
	sessionId: userId,
	version: appConfig.version || 2,
	userIdType: 'uuid'
};

const qrCodeData = JSON.stringify(builtConfig); // ❌ Wrong format
```

**Problem:** We're manually constructing QR data instead of using `SelfAppBuilder`.

**Fix required:** Use `@selfxyz/qrcode` SDK properly.

---

### ❌ **Missing: Backend Verification Logic**

**SDK approach:**

```typescript
import { SelfBackendVerifier, DefaultConfigStore, AllIds } from '@selfxyz/core';

const verifier = new SelfBackendVerifier(
	'communique-congressional', // scope (must match frontend)
	'https://communi.email/api/identity/verify',
	false, // mockPassport (false = mainnet)
	AllIds, // allowed attestation types
	new DefaultConfigStore({
		minimumAge: 18,
		excludedCountries: ['IRN', 'PRK', 'RUS', 'SYR'],
		ofac: true
	}),
	'uuid' // user ID type
);

// Verification endpoint
const result = await verifier.verify(attestationId, proof, publicSignals, userContextData);

// Extract passport data
const { discloseOutput } = result;
const passportData = discloseOutput.credentialSubject;
// Contains: nationality, dateOfBirth, documentNumber, etc.
```

**Our current implementation:** ❌ **DOES NOT EXIST**

We have skeleton endpoint (`/api/identity/init`) but no actual verification callback.

---

### ⚠️ **Data Extraction Mapping**

**SDK provides** (in `discloseOutput.credentialSubject`):

- `nationality` (ISO 3166-1 alpha-2, e.g., "US")
- `dateOfBirth` (full date, need to extract year)
- `documentNumber` (passport number)
- `documentType` (e.g., "P" for passport)

**Our `IdentityProof` interface expects:**

```typescript
interface IdentityProof {
	passportNumber: string; // ← documentNumber
	nationality: string; // ← nationality (already correct format)
	birthYear: number; // ← extract from dateOfBirth
	documentType: 'passport' | 'drivers_license' | 'national_id' | 'state_id';
}
```

**Mapping function needed:**

```typescript
function extractIdentityProof(credentialSubject: any): IdentityProof {
	const birthDate = new Date(credentialSubject.dateOfBirth);
	const birthYear = birthDate.getFullYear();

	return {
		passportNumber: credentialSubject.documentNumber,
		nationality: credentialSubject.nationality,
		birthYear,
		documentType: credentialSubject.documentType === 'P' ? 'passport' : 'national_id'
	};
}
```

---

## 2. Didit.me Implementation Gaps

### ✅ **Credentials: Correct**

You provided:

- ✅ API Key: `1NzVqRqXKNkv1f07XAO_-OfWt7kNfmDxtNr82xKAUEA`
- ✅ App ID: `3b95ade6-cf55-4b92-bb81-b21aaf3aea86`

---

### ⚠️ **Environment Variables: Need Update**

**Our current `.env.example`:**

```bash
DIDIT_API_KEY=your-didit-api-key-here
DIDIT_WEBHOOK_SECRET=your-didit-webhook-secret
```

**Correct configuration:**

```bash
DIDIT_API_KEY=1NzVqRqXKNkv1f07XAO_-OfWt7kNfmDxtNr82xKAUEA
DIDIT_APP_ID=3b95ade6-cf55-4b92-bb81-b21aaf3aea86
DIDIT_WEBHOOK_SECRET=<get-from-didit-console>  # From Verifications > Settings
```

**Missing:** Need to retrieve webhook secret from Didit Console.

---

### ❌ **Missing: Session Creation API**

**Didit API approach:**

```typescript
// POST https://verification.didit.me/v2/session/
const response = await fetch('https://verification.didit.me/v2/session/', {
	method: 'POST',
	headers: {
		'x-api-key': process.env.DIDIT_API_KEY,
		accept: 'application/json',
		'content-type': 'application/json'
	},
	body: JSON.stringify({
		workflow_id: process.env.DIDIT_APP_ID,
		metadata: {
			user_id: userId,
			template_slug: templateSlug
		},
		// Optional: Configure verification requirements
		vendor_data: userId
	})
});

const { session_id, verification_url } = await response.json();
// verification_url is what user opens (like QR code for self.xyz)
```

**Our current implementation:** ❌ **DOES NOT EXIST**

We have no Didit integration at all.

---

### ✅ **Webhook Implementation (Didit Recommended Approach)**

**Decision:** Use webhooks as recommended by Didit documentation

**Webhook setup:**

1. Configure webhook URL in Didit Console
2. Implement HMAC signature verification
3. Process verification events asynchronously

**Webhook handler implementation:**

```typescript
import { createHmac } from 'crypto';

// Verify Didit webhook signature
function verifyWebhookSignature(
	body: string,
	signature: string,
	timestamp: string,
	secret: string
): boolean {
	const payload = `${timestamp}.${body}`;
	const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

	return signature === expectedSignature;
}

// Process webhook event
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const signature = request.headers.get('x-didit-signature');
	const timestamp = request.headers.get('x-didit-timestamp');

	// Verify webhook authenticity
	if (!verifyWebhookSignature(body, signature, timestamp, process.env.DIDIT_WEBHOOK_SECRET)) {
		throw error(401, 'Invalid webhook signature');
	}

	const event = JSON.parse(body);

	// Process status updates
	if (event.type === 'status.updated' && event.data.status === 'Approved') {
		await processDiditVerification(event.data.decision);
	}

	return json({ received: true });
};
```

**Benefits over polling:**

- ✅ Real-time event delivery (no delay)
- ✅ No continuous API polling (lower server load)
- ✅ Industry standard async pattern
- ✅ Explicitly recommended by Didit

---

### ⚠️ **Data Extraction Mapping**

**Didit webhook provides** (in `decision.id_verification`):

- `document_number` (passport number)
- `issuing_state` (ISO 3166-1 alpha-2 country code)
- `date_of_birth` (YYYY-MM-DD format)
- `document_type` (e.g., "passport", "id_card", "drivers_license")

**Our `IdentityProof` interface expects:**

```typescript
interface IdentityProof {
	passportNumber: string; // ← document_number
	nationality: string; // ← issuing_state
	birthYear: number; // ← extract from date_of_birth
	documentType: 'passport' | 'drivers_license' | 'national_id' | 'state_id';
}
```

**Mapping function needed:**

```typescript
function extractDiditIdentityProof(verification: any): IdentityProof {
	const birthDate = new Date(verification.date_of_birth);
	const birthYear = birthDate.getFullYear();

	// Map Didit document types to our enum
	const documentTypeMap: Record<string, IdentityProof['documentType']> = {
		passport: 'passport',
		drivers_license: 'drivers_license',
		id_card: 'national_id'
	};

	return {
		passportNumber: verification.document_number,
		nationality: verification.issuing_state,
		birthYear,
		documentType: documentTypeMap[verification.document_type] || 'national_id'
	};
}
```

---

## 3. Required Implementation Changes

### **Phase 1B: Priority Updates (Before Continuing)**

#### **Task 1: Update Environment Variables**

**File:** `.env.example`

**Remove incorrect variables:**

```bash
# ❌ DELETE THESE:
SELF_XYZ_API_KEY=your-self-xyz-api-key-here
SELF_XYZ_ENVIRONMENT=sandbox
```

**Add correct variables:**

```bash
# ====================================
# IDENTITY VERIFICATION (Phase 1A/1B)
# ====================================

# 🔒 CRITICAL: Identity Hash Salt (Sybil Resistance)
IDENTITY_HASH_SALT=your-64-char-hex-salt-here-keep-secret-never-regenerate
IP_HASH_SALT=your-64-char-hex-salt-here-keep-secret-safe-to-regenerate

# === self.xyz Configuration (NO API KEY) ===
# Frontend QR code generation
NEXT_PUBLIC_SELF_APP_NAME=Communiqué
NEXT_PUBLIC_SELF_SCOPE=communique-congressional
NEXT_PUBLIC_SELF_ENDPOINT=https://communi.email/api/identity/verify

# Backend verification
SELF_MOCK_PASSPORT=false  # false=mainnet, true=testnet

# === Didit.me Configuration ===
DIDIT_API_KEY=1NzVqRqXKNkv1f07XAO_-OfWt7kNfmDxtNr82xKAUEA
DIDIT_APP_ID=3b95ade6-cf55-4b92-bb81-b21aaf3aea86
DIDIT_WEBHOOK_SECRET=<get-from-didit-console>
```

---

#### **Task 2: Install SDK Dependencies**

```bash
# self.xyz SDK
npm install @selfxyz/qrcode @selfxyz/core ethers

# No Didit SDK needed (REST API only)
```

---

#### **Task 3: Create self.xyz Backend Verifier**

**File:** `src/lib/core/server/selfxyz-verifier.ts` (NEW)

```typescript
import { SelfBackendVerifier, DefaultConfigStore, AllIds } from '@selfxyz/core';

export const selfVerifier = new SelfBackendVerifier(
	process.env.NEXT_PUBLIC_SELF_SCOPE || 'communique-congressional',
	process.env.NEXT_PUBLIC_SELF_ENDPOINT || 'https://communi.email/api/identity/verify',
	process.env.SELF_MOCK_PASSPORT === 'true',
	AllIds,
	new DefaultConfigStore({
		minimumAge: 18,
		excludedCountries: ['IRN', 'PRK', 'RUS', 'SYR'], // OFAC sanctioned
		ofac: true
	}),
	'uuid'
);
```

---

#### **Task 4: Update QR Code Generation Endpoint**

**File:** `src/routes/api/identity/init/+server.ts`

**Replace manual JSON construction with SDK:**

```typescript
import { SelfAppBuilder } from '@selfxyz/qrcode';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVerificationSession } from '$lib/core/server/verification-sessions';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, templateSlug, requireAddress } = await request.json();

		if (!userId || !templateSlug) {
			return json({ success: false, error: 'Missing required fields' }, { status: 400 });
		}

		// Build self.xyz app configuration using SDK
		const app = new SelfAppBuilder()
			.setVersion(2)
			.setAppName(process.env.NEXT_PUBLIC_SELF_APP_NAME || 'Communiqué')
			.setScope(process.env.NEXT_PUBLIC_SELF_SCOPE || 'communique-congressional')
			.setUserId(userId, 'uuid')
			.setEndpoint(
				'staging_https',
				process.env.NEXT_PUBLIC_SELF_ENDPOINT || 'https://communi.email/api/identity/verify'
			)
			.setDisclosures({
				nationality: true,
				minimumAge: 18,
				ofac: true
			})
			.build();

		// Get QR code data (universal link format)
		const qrCodeData = app.getUniversalLink();

		// Create database session
		const session = await createVerificationSession({
			userId,
			method: 'self.xyz',
			challenge: qrCodeData
		});

		return json({
			success: true,
			qrCodeData,
			sessionId: session.sessionId,
			nonce: session.nonce,
			expiresAt: session.expiresAt
		});
	} catch (error) {
		console.error('self.xyz initialization error:', error);
		return json({ success: false, error: 'Failed to initialize verification' }, { status: 500 });
	}
};
```

---

#### **Task 5: Create Verification Callback Endpoint**

**File:** `src/routes/api/identity/verify/+server.ts` (CREATE NEW)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { selfVerifier } from '$lib/core/server/selfxyz-verifier';
import {
	generateIdentityHash,
	validateIdentityProof,
	isAgeEligible,
	type IdentityProof
} from '$lib/core/server/identity-hash';
import { prisma } from '$lib/core/db';
import { hashIPAddress } from '$lib/core/server/security';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { attestationId, proof, publicSignals, userContextData } = await request.json();

		// Validate required fields
		if (!proof || !publicSignals || !attestationId || !userContextData) {
			throw error(400, 'Missing required fields');
		}

		// Verify proof with self.xyz SDK
		const result = await selfVerifier.verify(attestationId, proof, publicSignals, userContextData);

		const { isValid, isMinimumAgeValid, isOfacValid } = result.isValidDetails;

		if (!isValid || !isMinimumAgeValid || !isOfacValid) {
			// Log failed verification
			const userId = Buffer.from(userContextData, 'hex').toString('utf-8');
			await prisma.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'self.xyz',
					status: 'failed',
					failure_reason: !isValid
						? 'invalid_proof'
						: !isMinimumAgeValid
							? 'age_below_18'
							: 'ofac_violation',
					ip_address_hash: hashIPAddress(getClientAddress()),
					metadata: {
						attestation_id: attestationId,
						age_valid: isMinimumAgeValid,
						ofac_valid: isOfacValid
					}
				}
			});

			throw error(403, 'Verification failed');
		}

		// Extract passport data from SDK response
		const { discloseOutput } = result;
		const credentialSubject = discloseOutput.credentialSubject;

		// Map SDK data to our IdentityProof structure
		const birthDate = new Date(credentialSubject.dateOfBirth);
		const birthYear = birthDate.getFullYear();

		const identityProof: IdentityProof = {
			passportNumber: credentialSubject.documentNumber,
			nationality: credentialSubject.nationality,
			birthYear,
			documentType: credentialSubject.documentType === 'P' ? 'passport' : 'national_id'
		};

		// Validate proof structure
		validateIdentityProof(identityProof);

		// Additional age check (redundant but safe)
		if (!isAgeEligible(birthYear)) {
			throw error(403, 'User must be 18 or older');
		}

		// Generate identity hash
		const identityHash = generateIdentityHash(identityProof);

		// Check for duplicate identity (Sybil resistance)
		const userId = Buffer.from(userContextData, 'hex').toString('utf-8');
		const existingUser = await prisma.user.findUnique({
			where: { identity_hash: identityHash }
		});

		if (existingUser && existingUser.id !== userId) {
			// Log duplicate attempt
			await prisma.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'self.xyz',
					status: 'failed',
					failure_reason: 'duplicate_identity',
					identity_hash: identityHash,
					ip_address_hash: hashIPAddress(getClientAddress())
				}
			});

			throw error(409, 'Identity already verified with another account');
		}

		// Update user verification status
		await prisma.user.update({
			where: { id: userId },
			data: {
				is_verified: true,
				verification_method: 'self.xyz',
				verified_at: new Date(),
				identity_hash: identityHash,
				identity_fingerprint: identityHash.substring(0, 16),
				birth_year: birthYear
			}
		});

		// Log successful verification
		await prisma.verificationAudit.create({
			data: {
				user_id: userId,
				method: 'self.xyz',
				status: 'success',
				identity_hash: identityHash,
				identity_fingerprint: identityHash.substring(0, 16),
				ip_address_hash: hashIPAddress(getClientAddress()),
				metadata: {
					attestation_id: attestationId,
					nationality: identityProof.nationality,
					document_type: identityProof.documentType
				}
			}
		});

		return json({
			status: 'success',
			result: true,
			verified: true
		});
	} catch (err) {
		console.error('Verification error:', err);

		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Verification processing failed');
	}
};
```

---

#### **Task 6: Create Didit Session Initialization**

**File:** `src/routes/api/identity/didit/init/+server.ts` (CREATE NEW)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createVerificationSession } from '$lib/core/server/verification-sessions';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userId, templateSlug } = await request.json();

		if (!userId) {
			throw error(400, 'Missing user_id');
		}

		// Create session with Didit API
		const response = await fetch('https://verification.didit.me/v2/session/', {
			method: 'POST',
			headers: {
				'x-api-key': process.env.DIDIT_API_KEY!,
				accept: 'application/json',
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				workflow_id: process.env.DIDIT_APP_ID,
				metadata: {
					user_id: userId,
					template_slug: templateSlug,
					timestamp: Date.now()
				},
				vendor_data: userId,
				// Redirect user back to our app after verification
				redirect_url: `${process.env.ORIGIN || 'http://localhost:5173'}/verify-complete?session_id={session_id}`
			})
		});

		if (!response.ok) {
			const errorData = await response.text();
			console.error('Didit API error:', errorData);
			throw error(500, 'Failed to create Didit session');
		}

		const data = await response.json();
		const { session_id, verification_url } = data;

		// Store session in our database
		await createVerificationSession({
			userId,
			method: 'didit',
			challenge: session_id // Store Didit session ID as challenge
		});

		return json({
			success: true,
			session_id,
			verification_url
		});
	} catch (err) {
		console.error('Didit init error:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, 'Failed to initialize Didit verification');
	}
};
```

---

#### **Task 7: Create Didit Webhook Handler**

**File:** `src/routes/api/identity/didit/webhook/+server.ts` (CREATE NEW)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createHmac } from 'crypto';
import {
	generateIdentityHash,
	validateIdentityProof,
	isAgeEligible,
	type IdentityProof
} from '$lib/core/server/identity-hash';
import { prisma } from '$lib/core/db';
import { createHash } from 'crypto';

/**
 * Verify Didit webhook HMAC signature
 * Security: Prevents unauthorized webhook events
 */
function verifyWebhookSignature(
	body: string,
	signature: string | null,
	timestamp: string | null,
	secret: string
): boolean {
	if (!signature || !timestamp) {
		return false;
	}

	const payload = `${timestamp}.${body}`;
	const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

	return signature === expectedSignature;
}

/**
 * Didit webhook handler
 * Receives real-time verification status updates
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Read raw body for signature verification
		const body = await request.text();
		const signature = request.headers.get('x-didit-signature');
		const timestamp = request.headers.get('x-didit-timestamp');

		// Verify webhook authenticity
		if (!verifyWebhookSignature(body, signature, timestamp, process.env.DIDIT_WEBHOOK_SECRET!)) {
			console.error('Invalid webhook signature');
			throw error(401, 'Invalid webhook signature');
		}

		// Parse event data
		const event = JSON.parse(body);
		const { type, data } = event;

		// Only process status.updated events
		if (type !== 'status.updated') {
			return json({ received: true, processed: false });
		}

		// Only process approved verifications
		if (data.status !== 'Approved') {
			return json({ received: true, processed: false, status: data.status });
		}

		// Extract user ID from session metadata
		const userId = data.metadata?.user_id;
		if (!userId) {
			console.error('Missing user_id in webhook metadata');
			throw error(400, 'Missing user_id in session metadata');
		}

		// Check if already processed (idempotency)
		const existingUser = await prisma.user.findUnique({
			where: { id: userId },
			select: { is_verified: true, verification_method: true }
		});

		if (existingUser?.is_verified && existingUser.verification_method === 'didit') {
			return json({
				received: true,
				processed: false,
				already_verified: true
			});
		}

		// Process verification result
		const verification = data.decision.id_verification;

		// Map Didit data to our IdentityProof structure
		const birthDate = new Date(verification.date_of_birth);
		const birthYear = birthDate.getFullYear();

		const documentTypeMap: Record<string, IdentityProof['documentType']> = {
			passport: 'passport',
			drivers_license: 'drivers_license',
			id_card: 'national_id'
		};

		const identityProof: IdentityProof = {
			passportNumber: verification.document_number,
			nationality: verification.issuing_state,
			birthYear,
			documentType: documentTypeMap[verification.document_type] || 'national_id'
		};

		// Validate proof structure
		validateIdentityProof(identityProof);

		// Age check
		if (!isAgeEligible(birthYear)) {
			await prisma.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'didit',
					status: 'failed',
					failure_reason: 'age_below_18',
					metadata: { session_id: data.session_id, event_type: type }
				}
			});

			throw error(403, 'User must be 18 or older');
		}

		// Generate identity hash
		const identityHash = generateIdentityHash(identityProof);

		// Check for duplicate identity (Sybil resistance)
		const duplicateUser = await prisma.user.findUnique({
			where: { identity_hash: identityHash }
		});

		if (duplicateUser && duplicateUser.id !== userId) {
			await prisma.verificationAudit.create({
				data: {
					user_id: userId,
					method: 'didit',
					status: 'failed',
					failure_reason: 'duplicate_identity',
					identity_hash: identityHash,
					metadata: { session_id: data.session_id, event_type: type }
				}
			});

			throw error(409, 'Identity already verified with another account');
		}

		// Update user verification status
		await prisma.user.update({
			where: { id: userId },
			data: {
				is_verified: true,
				verification_method: 'didit',
				verified_at: new Date(),
				identity_hash: identityHash,
				identity_fingerprint: identityHash.substring(0, 16),
				birth_year: birthYear
			}
		});

		// Log successful verification
		await prisma.verificationAudit.create({
			data: {
				user_id: userId,
				method: 'didit',
				status: 'success',
				identity_hash: identityHash,
				identity_fingerprint: identityHash.substring(0, 16),
				metadata: {
					session_id: data.session_id,
					event_type: type,
					nationality: identityProof.nationality,
					document_type: identityProof.documentType,
					document_number_hash: createHash('sha256')
						.update(verification.document_number)
						.digest('hex')
						.substring(0, 16) // Store hash, not actual number
				}
			}
		});

		return json({
			received: true,
			processed: true,
			verified: true
		});
	} catch (err) {
		console.error('Didit webhook processing error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Webhook processing failed');
	}
};
```

**Webhook Configuration:**

1. In Didit Console → Verifications → Settings
2. Set webhook URL: `https://communi.email/api/identity/didit/webhook`
3. For development: Use ngrok to tunnel localhost → `https://<your-ngrok-id>.ngrok.io/api/identity/didit/webhook`
4. Copy webhook secret to `.env`

---

## 4. Environment Setup Checklist

### **Production `.env` Configuration**

```bash
# ====================================
# IDENTITY VERIFICATION
# ====================================

# Cryptographic Salts (GENERATE ONCE, NEVER CHANGE)
IDENTITY_HASH_SALT=<openssl rand -hex 32>
IP_HASH_SALT=<openssl rand -hex 32>

# === self.xyz Configuration ===
NEXT_PUBLIC_SELF_APP_NAME=Communiqué
NEXT_PUBLIC_SELF_SCOPE=communique-congressional
NEXT_PUBLIC_SELF_ENDPOINT=https://communi.email/api/identity/verify
SELF_MOCK_PASSPORT=false

# === Didit.me Configuration ===
DIDIT_API_KEY=1NzVqRqXKNkv1f07XAO_-OfWt7kNfmDxtNr82xKAUEA
DIDIT_APP_ID=3b95ade6-cf55-4b92-bb81-b21aaf3aea86
DIDIT_WEBHOOK_SECRET=<get-from-didit-console>
```

### **Actions Required**

1. ✅ **Didit API Key** - Already provided
2. ✅ **Didit App ID** - Already provided
3. ⏳ **Generate Salts** - Run: `openssl rand -hex 32` (twice)
4. ⏳ **Didit Webhook Secret** - Get from Didit Console → Verifications → Settings
5. ⏳ **Configure Webhook URL** - In Didit Console, set webhook URL to production endpoint

---

## 5. Summary: Implementation Changes Required

### **Critical Changes (Before Phase 1B)**

- [x] **Update `.env.example`** - Remove incorrect self.xyz variables, add correct ones ✅
- [x] **Install SDKs** - `npm install @selfxyz/qrcode @selfxyz/core ethers` ✅
- [ ] **Create self.xyz verifier** - `src/lib/core/server/selfxyz-verifier.ts`
- [ ] **Update QR generation** - Use `SelfAppBuilder` instead of manual JSON
- [ ] **Create verification callback** - `src/routes/api/identity/verify/+server.ts`
- [ ] **Create Didit session init** - `src/routes/api/identity/didit/init/+server.ts`
- [ ] **Create Didit webhook handler** - `src/routes/api/identity/didit/webhook/+server.ts` (with HMAC verification)
- [ ] **Retrieve Didit webhook secret** - From Didit Console → Verifications → Settings
- [ ] **Configure webhook URL** - In Didit Console (production + development via ngrok)
- [ ] **Configure production `.env`** - All environment variables including webhook secret

### **What Stays the Same**

- ✅ Database schema (perfect as-is)
- ✅ Identity hashing utility (just needs SDK data mapping)
- ✅ Security utilities (IP hashing, nonce generation)
- ✅ Session management (database-backed approach correct)
- ✅ Test coverage (tests are SDK-agnostic, still valid)

---

**Next Step:** Should I implement these changes now, or do you want to review the approach first?
