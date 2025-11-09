# Congressional Delivery Documentation

**How messages reach congressional offices with cryptographic verification.**

---

## Core Integration

### 1. [cwc.md](cwc.md) - Communicating With Congress API

Integration with CWC API for message delivery to congressional offices.

**What it does**: Delivers verified constituent messages through official congressional contact system.

**Flow**:
1. User customizes template
2. Address verified via zero-knowledge proof
3. Message encrypted (XChaCha20-Poly1305)
4. Sent through TEE → CWC API → congressional office
5. Delivery receipt stored

**API endpoints**:
- `POST /api/cwc/submit` - Submit message
- `GET /api/cwc/status/:id` - Check delivery status
- `POST /api/cwc/verify` - Verify delivery receipt

### 2. [delivery.md](delivery.md) - End-to-End Message Delivery

Complete message delivery flow from template to congressional inbox.

**Architecture**:
- **Browser**: Template customization, address collection
- **TEE (AWS Nitro Enclaves)**: Message encryption, proof generation
- **CWC API**: Congressional office delivery
- **Blockchain**: Reputation update (Phase 2)

**Privacy guarantees**:
- Address encrypted in browser (witness encryption)
- Proof generated in TEE (2-5s Halo2 proving)
- Address exists only in TEE memory during proving
- Message delivered with zero-knowledge district proof

### 3. [dashboard.md](dashboard.md) - Congressional Office Dashboard

Dashboard for congressional offices to view verified constituent messages.

**What it provides**:
- Message inbox (verified constituents only)
- District verification badges
- Aggregate constituent sentiment
- Issue tracking by volume

**Privacy**: Offices see district verification proof, not plaintext addresses.

---

## Message Delivery Flow

```
1. User Flow:
   User customizes template
     → Enters address
     → Address encrypted in browser (XChaCha20-Poly1305)
     → Encrypted address + template sent to server

2. Server Flow:
   Encrypted address → TEE (AWS Nitro Enclave)
     → TEE decrypts witness (address)
     → TEE generates Halo2 proof (2-5s)
     → Proof: "This address is in district X" (no plaintext)
     → TEE deletes address from memory

3. Delivery Flow:
   Proof + message → CWC API
     → CWC delivers to congressional office
     → Delivery receipt returned
     → Receipt stored in database

4. Verification Flow (Congressional Office):
   Office receives message
     → Sees zero-knowledge district proof
     → Verifies proof cryptographically
     → Trusts message is from constituent (no address revealed)
```

---

## Privacy Architecture

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
