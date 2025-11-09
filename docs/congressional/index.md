# Message Delivery Documentation

**How users contact decision-makers at all levels with cryptographic verification.**

---

## Overview

**What this covers**: Message delivery to ANY decision-maker - from congressional offices (via campaign delivery APIs) to corporations, HOAs, universities, hospitals, nonprofits (via direct email).

**Two delivery methods**:
1. **Campaign delivery APIs** (large legislatures where email campaigns don't work at scale)
2. **Direct email** (everyone else - OPEN to any entity with community impact)

**User perspective**: "Who am I contacting?" not "Which backend delivery method?"

---

## Core Documentation

### 1. [delivery.md](delivery.md) - User-Facing Delivery Paradigm

**Read this first**. Explains who users can contact and how delivery works from the user perspective.

**Key insight**: Users care about WHO they're contacting (Senator vs city council vs corporate CEO), not HOW the backend delivers it (API vs email).

**Covers**:
- Large legislatures (campaign delivery APIs for scale)
- Everyone else (direct email - open to any decision-maker)
- User mental models
- Privacy guarantees by delivery method
- Template creator guidance
- Roadmap (Phase 1-4)

**Start here**: [delivery.md](delivery.md)

---

### 2. [cwc.md](cwc.md) - Communicating With Congress API Integration

Technical integration with CWC API for US congressional message delivery.

**What it does**: Delivers verified constituent messages through CWC campaign delivery API.

**Scope**: US Congress only (House + Senate, 535 members)

**Why CWC API exists**: You can't email 535 members of Congress at campaign scale (spam filters break, volume overwhelms staff). CWC is the campaign delivery infrastructure they built to handle verified constituent messages at scale.

**Flow**:
1. User customizes template for congressional message
2. Address verified via zero-knowledge proof
3. Message encrypted (XChaCha20-Poly1305)
4. Sent through TEE → CWC API → congressional office
5. Delivery receipt stored

**API endpoints**:
- `POST /api/cwc/submit` - Submit congressional message
- `GET /api/cwc/status/:id` - Check delivery status
- `POST /api/cwc/verify` - Verify delivery receipt

---

### 3. [dashboard.md](dashboard.md) - Congressional Office Dashboard

Dashboard for congressional offices to view verified constituent messages.

**What it provides**:
- Message inbox (verified constituents only)
- District verification badges
- Aggregate constituent sentiment
- Issue tracking by volume

**Privacy**: Offices see district verification proof, not plaintext addresses.

**Scope**: US Congress (CWC API messages only)

---

## Delivery Methods Comparison

### Campaign Delivery APIs (Large Legislatures)

**Who**: US Congress, state legislatures, European Parliament (planned), UK Parliament (planned)

**Why APIs exist**: You can't run email campaigns to 535+ members effectively (spam filters fail, staff overwhelmed, constituent verification breaks). Large legislatures built campaign delivery APIs (CWC for US Congress) to handle verified constituent messages at scale.

**User experience**:
- User clicks "Send Message"
- Communiqué delivers through their campaign API
- User gets confirmation: "✓ Message delivered to Senator Warren"

**Technical flow**:
```
1. User customizes template
2. Address encrypted in browser (XChaCha20-Poly1305)
3. TEE generates zero-knowledge district proof (2-5s)
4. Message + proof → CWC API → congressional office
5. Delivery receipt stored
```

**Privacy**: Zero-knowledge proof reveals district membership, not address

---

### Direct Email (Everyone Else)

**Who**: Local gov, corporations, HOAs, universities, hospitals, nonprofits, ANY decision-maker with community impact

**Why email**: These entities don't have centralized APIs, but have email contact info (public/semi-public)

**User experience**:
- User clicks "Send Message"
- Email client opens with pre-filled message
- User reviews and sends from their own email
- Communiqué verifies delivery via OAuth (Sent folder check)

**Technical flow**:
```
1. User customizes template
2. Email client opens with mailto: URL
3. User sends from Gmail/Outlook/etc.
4. OAuth verification (read Sent folder)
5. Delivery verification badge appears
```

**Privacy**: OAuth access is read-only (Sent folder only), user can revoke anytime

---

## Privacy Architecture (Campaign APIs Only)

**What congressional offices see**:
- ✅ Zero-knowledge proof of district membership
- ✅ Message content
- ✅ Timestamp
- ✅ Template category

**What congressional offices DON'T see**:
- ❌ Plaintext address
- ❌ User's email address (unless user includes it in message)
- ❌ User's identity (unless user includes name in message)

**Privacy guarantees**:
- Address encrypted in browser using witness encryption
- TEE decrypts only during proving (2-5s window)
- Address never persists in TEE memory
- Proof is zero-knowledge (reveals district, not address)
- CWC API receives proof + message, not address

**For direct email privacy**, see `/docs/strategy/delivery-verification.md`

---

## CWC API Integration Details

**Authentication**:
```env
CWC_API_KEY=... # Set in .env
CWC_API_BASE_URL=https://soapbox.senate.gov/api
```

**Rate limits**:
- 10 submissions per hour per user (prevents spam)
- Tracked in DynamoDB (server-side)
- User sees: "Rate limit reached, try again in X minutes"

**Error handling**:
- Delivery failures → automatic retry (max 3 attempts)
- Invalid address → user prompted to verify
- CWC API down → queue message for later delivery

---

## Deployment Requirements

**Environment variables**:
```env
# CWC API
CWC_API_KEY=... # Required
CWC_API_BASE_URL=... # Optional (defaults to production)

# TEE Configuration
AWS_NITRO_ENCLAVE_ENABLED=true # Production only
TEE_PUBLIC_KEY=... # TEE enclave public key

# Rate Limiting
DYNAMO_TABLE_NAME=... # DynamoDB table for rate limits
RATE_LIMIT_WINDOW_SECONDS=3600 # 1 hour window
RATE_LIMIT_COUNT=10 # 10 messages per hour
```

**Infrastructure**:
- AWS Nitro Enclaves (ARM Graviton, hypervisor-isolated)
- DynamoDB (rate limiting state)
- SQS (message queue for retry logic)

---

## Testing

**Integration tests**:
```bash
npm run test:integration -- congressional-delivery.test.ts
```

**What's tested**:
- CWC API submission flow
- Rate limiting enforcement
- Delivery receipt verification
- Error handling and retries
- TEE proof generation (mocked in tests)

**Mocking**:
- CWC API responses mocked
- TEE proving mocked (use deterministic test proofs)
- DynamoDB mocked (in-memory rate limit tracking)

---

## Troubleshooting

**Message delivery failed**:
1. Check CWC API status
2. Verify API key is valid
3. Check rate limits (user may have hit limit)
4. Check TEE enclave health
5. Review error logs in Fly.io

**Proof generation failed**:
1. Check TEE enclave is running
2. Verify address is valid (geocoding succeeded)
3. Check Halo2 proving timeout (should be <10s)
4. Review TEE logs

**Congressional office reports message not received**:
1. Check delivery receipt in database
2. Verify CWC API returned success
3. Check message wasn't spam filtered by office
4. Provide delivery receipt as proof

---

## For Congressional Staff

**Setting up dashboard access**:
1. Contact Communiqué team for dashboard credentials
2. Navigate to `/congressional/dashboard`
3. View verified constituent messages
4. Filter by issue category, date range
5. Export messages as CSV

**Understanding verification badges**:
- ✅ Green badge: Zero-knowledge district proof verified
- ⏳ Yellow badge: Verification pending
- ❌ Red badge: Verification failed (likely spam)

**Privacy questions**:
- "Can you see constituent addresses?" → No, we store only commitment hashes
- "How do you verify district?" → Zero-knowledge proof (Halo2 circuit)
- "Can constituents fake verification?" → No, proof is cryptographically secure

---

## Cross-References

**TEE architecture** → See `/docs/architecture/tee.md`

**Zero-knowledge proofs** → See `/docs/architecture/zk-proofs.md`

**VOTER Protocol integration** → See `/docs/INTEGRATION-GUIDE.md`

**Message templates** → See `/docs/features/templates.md`
