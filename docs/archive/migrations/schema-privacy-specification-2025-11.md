# Data Model Specification: Privacy-Preserving Architecture

**Status:** Authoritative data model for Phase 1
**Replaces:** Current Prisma schema privacy violations
**Updated:** 2025-11-01

---

## Core Principle: Minimal Data Collection

**We store only what is cryptographically necessary to:**
1. Enable zero-knowledge proof verification
2. Track on-chain reputation (pseudonymous)
3. Aggregate collective impact (no individual tracking)
4. Deliver messages to congressional offices (via TEE decryption, not storage)

**We NEVER store:**
- Personally Identifiable Information (PII)
- Location data that enables de-anonymization
- Behavioral profiling data
- Device fingerprints or tracking identifiers
- Individual action history (only aggregates)

---

## The Privacy Firewall Principle

```
┌─────────────────────────────────────────────────────────────┐
│ USER'S BROWSER (Client-Side Only)                           │
├─────────────────────────────────────────────────────────────┤
│ - Actual address (during verification)                      │
│ - Passport/ID data (self.xyz or Didit.me)                  │
│ - Personally identifiable information                        │
│ - Encrypted immediately with XChaCha20-Poly1305             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (Encrypted Payload)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TEE (AWS Nitro Enclave - Isolated Memory Only)             │
├─────────────────────────────────────────────────────────────┤
│ - Decrypts address                                           │
│ - Geocodes to congressional district                        │
│ - Generates Halo2 zero-knowledge proof                      │
│ - Computes district hash (salted)                           │
│ - DESTROYS address after use                                │
│ - Returns only: district hash + ZK proof                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  (District Hash + Proof)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ DATABASE (Supabase Postgres - What We Store)               │
├─────────────────────────────────────────────────────────────┤
│ - User ID (deterministic from passkey, pseudonymous)        │
│ - District hash (salted, not reversible)                    │
│ - Reputation score (on-chain verifiable)                    │
│ - Verification status (boolean)                             │
│ - Template aggregates (no individual tracking)              │
│ - Collective impact metrics (anonymous)                     │
└─────────────────────────────────────────────────────────────┘

PRIVACY GUARANTEE:
→ Database contains ZERO data that can reconstruct real-world identity
→ Congressional district lookup requires TEE decryption
→ Platform operators cannot de-anonymize users
→ Even with database access, identity reconstruction impossible
```

---

## Allowed Data Models

### User (Minimal Identity)

```prisma
model User {
  // Pseudonymous identifier (deterministic from passkey)
  id                      String    @id @default(cuid())

  // Verification status
  verification_method     String?   // 'self_xyz' | 'didit'
  verification_status     String    @default("pending") // 'pending' | 'verified' | 'expired'
  verification_completed_at DateTime?
  verification_expires_at DateTime?

  // On-chain reputation (pseudonymous)
  reputation_score        Int       @default(0)
  blockchain_address      String?   // Deterministic from passkey, not linked to real identity

  // District verification (hash only, computed in TEE)
  district_hash           String?   // SHA-256(district + user_salt), not reversible

  // Session management
  created_at              DateTime  @default(now())
  updated_at              DateTime  @updatedAt

  // Relations
  sessions                Session[]
  reputation_events       ReputationEvent[]

  @@index([verification_status])
  @@index([district_hash])
}
```

**Why these fields exist:**

- `id`: Unique identifier, generated from passkey (not random, but not linkable to real identity)
- `verification_method`: Track which identity provider used (for debugging, not tracking)
- `verification_status`: Enable/disable message sending based on verification
- `verification_expires_at`: NFC passports expire, need re-verification
- `reputation_score`: On-chain reputation cache (verifiable via blockchain)
- `blockchain_address`: Deterministic from passkey (pseudonymous, like Bitcoin addresses)
- `district_hash`: Salted hash for verification, computed in TEE, not reversible
- `sessions`: Standard authentication (no PII in session data)
- `reputation_events`: On-chain event tracking (pseudonymous)

**What's explicitly forbidden:**

```prisma
// ❌ NEVER ADD THESE FIELDS:
city                    String?    // Enables de-anonymization
state                   String?    // Enables de-anonymization
zip                     String?    // Enables de-anonymization
congressional_district  String?    // Stored in plaintext = privacy violation
latitude                Float?     // Geographic tracking
longitude               Float?     // Geographic tracking
street_address          String?    // PII
full_name               String?    // PII (use OAuth email only for auth)
phone_number            String?    // PII
trust_score             Int?       // Behavioral profiling
civic_score             Int?       // Behavioral profiling
discourse_score         Int?       // Behavioral profiling
```

---

### Session (Authentication Only)

```prisma
model Session {
  id             String   @id
  user_id        String
  user           User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  expires_at     DateTime
  created_at     DateTime @default(now())

  @@index([user_id])
}
```

**Why these fields exist:**

- Standard Oslo session management
- No PII stored in session data
- Sessions tied to pseudonymous user ID only

**What's explicitly forbidden:**

```prisma
// ❌ NEVER ADD THESE FIELDS:
ip_address      String?    // Tracking identifier
user_agent      String?    // Device fingerprinting
device_data     Json?      // Device fingerprinting
last_active     DateTime?  // Behavioral tracking
```

---

### Template (Public Templates)

```prisma
model Template {
  id                String   @id @default(cuid())
  title             String
  content           String   // Message template with {{variables}}
  category          String
  subcategory       String?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Aggregate statistics ONLY (no individual tracking)
  verified_sends    Int      @default(0)
  districts_reached Int      @default(0)
  response_rate     Float?   // If we have congressional office data

  // Content moderation
  moderation_status String   @default("pending") // 'pending' | 'approved' | 'rejected'
  moderation_agents Json?    // Multi-agent consensus results

  // Relations
  aggregate_impacts AggregateImpact[]

  @@index([category])
  @@index([moderation_status])
}
```

**Why these fields exist:**

- `title`, `content`: The actual template
- `verified_sends`: Aggregate count (not linked to individuals)
- `districts_reached`: Unique district count (for momentum visualization)
- `response_rate`: If congressional offices provide data
- `moderation_status`: 3-agent consensus for quality control

**What's explicitly forbidden:**

```prisma
// ❌ NEVER ADD THESE FIELDS:
user_id              String?    // Can't link template to creator
sends                Send[]     // Can't track individual sends
user_engagement      Json?      // Behavioral tracking
view_count           Int?       // Individual tracking
favorite_count       Int?       // Social metrics
share_count          Int?       // Tracking who shared
```

**Critical distinction:**
- We track AGGREGATE sends (how many total)
- We NEVER track INDIVIDUAL sends (who sent what)
- Template creator is NEVER stored

---

### AggregateImpact (Collective Outcomes)

```prisma
model AggregateImpact {
  id                           String   @id @default(cuid())
  template_id                  String
  template                     Template @relation(fields: [template_id], references: [id])

  // Congressional action (public record)
  congressional_action         String   // "Rep. Fletcher co-sponsored HR 1234"
  action_date                  DateTime
  representative_name          String?
  representative_district      String?

  // Correlation data (proves causation through timing)
  verified_sends_before_action Int
  days_between_send_and_action Int
  districts_that_sent          Json?    // Array of districts (no user linkage)

  // Verification
  source_url                   String?  // Link to public congressional record
  verified_by                  String?  // Who verified this outcome

  created_at                   DateTime @default(now())

  @@index([template_id])
  @@index([action_date])
}
```

**Why this model exists:**

Prove that verified constituent blocs create policy outcomes WITHOUT revealing individual participants.

Example:
```json
{
  "template_id": "climate-action-2025",
  "congressional_action": "Rep. Fletcher (TX-07) co-sponsored HR 1234 (Green Infrastructure Act)",
  "action_date": "2025-01-15",
  "verified_sends_before_action": 247,
  "days_between_send_and_action": 14,
  "districts_that_sent": ["TX-07", "TX-02", "CA-12"], // No user linkage
  "source_url": "https://www.congress.gov/bill/119th-congress/house-bill/1234/cosponsors"
}
```

**What's explicitly forbidden:**

```prisma
// ❌ NEVER ADD THESE FIELDS:
user_ids                     Json?      // Can't link to individuals
individual_sends             Send[]     // Can't track who participated
participation_breakdown      Json?      // Demographic tracking
```

---

### ReputationEvent (On-Chain Tracking)

```prisma
model ReputationEvent {
  id                 String   @id @default(cuid())
  user_id            String
  user               User     @relation(fields: [user_id], references: [id])

  // Event type
  event_type         String   // 'verified_send' | 'congressional_response' | 'challenge_win' (Phase 2)
  reputation_delta   Int      // +10 for verified send, +50 for response, etc.

  // On-chain verification
  tx_hash            String   // Scroll zkEVM transaction hash
  block_number       Int?
  timestamp          DateTime @default(now())

  // NO template linkage (can't connect action to reputation)
  // NO content data (can't see what user sent)
  // NO district data (can't geolocate user)

  @@index([user_id])
  @@index([tx_hash])
}
```

**Why this model exists:**

Track on-chain reputation events while maintaining pseudonymity.

**Privacy guarantee:**
- `user_id` links to pseudonymous blockchain address
- `tx_hash` verifiable on Scroll zkEVM
- NO linkage to template, content, or district
- Blockchain observers see: "Address 0xABC gained 10 reputation" (not why)

**What's explicitly forbidden:**

```prisma
// ❌ NEVER ADD THESE FIELDS:
template_id              String?    // Would link reputation to specific action
congressional_district   String?    // Would geolocate user
message_content          String?    // Would reveal what user said
ip_address               String?    // Tracking identifier
```

---

### AmplifierOptIn (Public Sharing - Separate Identity)

```prisma
model AmplifierOptIn {
  id                String   @id @default(cuid())

  // Public identity (user chooses)
  display_name      String
  bio               String?
  social_links      Json?    // { twitter: "@handle", blog: "url" }

  // Metrics (aggregate only)
  referrals         Int      @default(0)
  content_pieces    Int      @default(0)

  // Opt-in tracking
  opted_in_at       DateTime @default(now())

  // CRITICAL: NO link to User table
  // This is a separate, public identity
  // Platform never links amplifier identity to private user account
}
```

**Why this model exists:**

Amplifiers (activists, journalists, influencers) can CHOOSE to share participation publicly.

**Privacy firewall:**
- This is a SEPARATE identity from User model
- User creates amplifier profile IF they want public visibility
- Platform NEVER links amplifier identity to private user account
- Even database admins cannot connect the two

**Example flow:**
```
User completes verification → User ID: abc123 (private)
User opts into amplifier program → Creates separate AmplifierOptIn record
User shares: "I'm @activist using Communiqué"
Platform shows amplifier profile → NO connection to User ID abc123
```

**What's explicitly forbidden:**

```prisma
// ❌ NEVER ADD THESE FIELDS:
user_id              String?    // Would break privacy firewall
private_email        String?    // Would leak PII
verification_status  String?    // Would reveal private account status
```

---

## Forbidden Data Models

### ❌ Analytics Session (DELETED)

```prisma
// This entire model violates privacy principles
// DELETED IN SCHEMA CLEANUP

model analytics_session {
  device_data  Json?      // Contains: ip_address, user_agent, fingerprint
  utm_source   String?    // Tracking parameter
  utm_medium   String?    // Tracking parameter
  utm_campaign String?    // Tracking parameter
  referrer     String?    // Tracking origin
}
```

**Why deleted:**
- Device fingerprinting enables cross-site tracking
- IP addresses are PII
- UTM parameters track user journey
- Violates cypherpunk anti-surveillance principle

**Replacement:**
- Track only aggregate template views (not individual sessions)
- No user journey tracking
- No device identification

---

### ❌ User Writing Style (DELETED)

```prisma
// This entire model violates privacy principles
// DELETED IN SCHEMA CLEANUP

model user_writing_style {
  tone_preference  String?
  personal_themes  Json?
  writing_analysis Json?
}
```

**Why deleted:**
- Behavioral profiling
- Creates psychological profile of user
- Surveillance capitalism pattern
- Not necessary for platform function

---

### ❌ Audit Log with PII (MODIFIED)

```prisma
// BEFORE (wrong):
model AuditLog {
  ip_address  String?    // PII
  user_agent  String?    // Fingerprinting
  user_id     String     // Links action to user
  action      String
}

// AFTER (right):
model AuditLog {
  // Security events only (no user tracking)
  event_type  String     // 'failed_login' | 'suspicious_activity'
  severity    String     // 'low' | 'medium' | 'high'
  metadata    Json?      // Generic context (no PII)
  timestamp   DateTime
  // NO user_id (can't link to individual)
  // NO ip_address (no PII)
  // NO user_agent (no fingerprinting)
}
```

**Why modified:**
- Security monitoring still needed
- But no user tracking
- No PII storage
- Aggregate security events only

---

## District Verification (TEE-Only)

**Critical design:** Congressional district is NEVER stored in database.

### The Flow:

```typescript
// 1. User completes verification in browser
const encryptedAddress = await encryptAddress(userAddress, TEE_PUBLIC_KEY);
await api.post('/verify', { encryptedAddress });

// 2. Server forwards to TEE (AWS Nitro Enclave)
const { districtHash, zkProof } = await teeService.verify(encryptedAddress);

// 3. TEE-side operations (isolated memory only):
async function verifyInTEE(encryptedAddress: string) {
  // Decrypt in TEE memory (never persisted)
  const address = decrypt(encryptedAddress, TEE_PRIVATE_KEY);

  // Geocode to congressional district (in-memory only)
  const district = await geocodeToDistrict(address);

  // Generate Halo2 zero-knowledge proof
  const zkProof = await generateProof({
    claim: "User is verified constituent in a congressional district",
    witness: address, // Private input
    publicOutputs: ["verified_constituent"]
  });

  // Compute district hash (for database storage)
  const districtHash = SHA256(district + USER_SALT);

  // DESTROY sensitive data
  overwriteMemory(address);
  overwriteMemory(district);

  // Return only hash + proof
  return { districtHash, zkProof };
}

// 4. Store only hash in database
await db.user.update({
  where: { id: userId },
  data: { district_hash: districtHash }
});

// 5. Later: Message delivery (TEE decrypts district from hash)
async function deliverMessage(userId: string, templateId: string) {
  // Retrieve hash from database
  const { district_hash } = await db.user.findUnique({ where: { id: userId } });

  // TEE-side: Reverse lookup (requires user's address)
  // User re-encrypts address for delivery, TEE decrypts + matches hash
  const district = await teeService.lookupDistrict(district_hash, encryptedAddress);

  // Deliver to congressional office
  await cwcAPI.send({
    district,
    message: templateContent,
    zkProof: verificationProof
  });

  // TEE destroys district after delivery
}
```

**Key insight:**
- Database stores `district_hash` (not reversible)
- District plaintext exists ONLY in TEE memory during operations
- Platform operators cannot determine user's district from database
- Congressional office receives district (not stored by platform)

---

## Aggregate Statistics (Privacy-Preserving)

### What We Can Show (Allowed):

```typescript
// Template-level aggregates
interface TemplateStats {
  verified_sends: number;        // Total count
  districts_reached: number;     // Unique count
  response_rate: number;         // If offices provide data
  momentum: number;              // Today's sends / avg daily
}

// Platform-level aggregates
interface PlatformStats {
  total_verified_constituents: number;
  total_verified_sends: number;
  total_districts_active: number;
  avg_response_time_days: number;
}

// Geographic aggregates (no individual linkage)
interface DistrictStats {
  district: string;              // "TX-07"
  verified_sends: number;        // Total from this district
  last_active: DateTime;         // Most recent send timestamp
  // NO: user_ids, user_count, individual actions
}
```

### What We Cannot Show (Forbidden):

```typescript
// ❌ Individual user stats
interface UserStats {
  sends_count: number;           // Would track individual
  percentile_rank: number;       // Would rank individual
  streak_days: number;           // Would track behavior
  engagement_score: number;      // Would profile individual
}

// ❌ Individual activity feeds
interface ActivityFeed {
  user_id: string;               // Would de-anonymize
  action: string;                // Would track behavior
  timestamp: DateTime;           // Would enable correlation
  district: string;              // Would geolocate
}

// ❌ Leaderboards
interface Leaderboard {
  user_id: string;               // Would reveal identity
  rank: number;                  // Would create competition
  sends: number;                 // Would track individual
}
```

---

## Data Retention Policy

### What We Keep Forever:

- On-chain reputation events (immutable blockchain records)
- Aggregate impact data (proves platform efficacy)
- Template library (public templates)

### What We Delete:

- Verification data after expiration (NFC passport expiration)
- Session data after logout
- Any accidentally collected PII (immediate deletion)

### What We Never Collect:

- IP addresses (no server logging)
- Device fingerprints (no analytics tracking)
- Behavioral patterns (no profiling)
- User journey data (no funnel tracking)

---

## Migration Plan

### Phase 1: Schema Cleanup (Week 1)

```bash
# Generate migration to remove forbidden fields
npx prisma migrate dev --name remove-surveillance-fields

# Migration file: prisma/migrations/XXX_remove-surveillance-fields/migration.sql
```

```sql
-- Remove location data from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "city";
ALTER TABLE "User" DROP COLUMN IF EXISTS "state";
ALTER TABLE "User" DROP COLUMN IF EXISTS "zip";
ALTER TABLE "User" DROP COLUMN IF EXISTS "congressional_district";
ALTER TABLE "User" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "User" DROP COLUMN IF EXISTS "longitude";

-- Remove profiling scores
ALTER TABLE "User" DROP COLUMN IF EXISTS "trust_score";
ALTER TABLE "User" DROP COLUMN IF EXISTS "civic_score";
ALTER TABLE "User" DROP COLUMN IF EXISTS "discourse_score";

-- Add privacy-preserving fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "district_hash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blockchain_address" TEXT;

-- Remove behavioral tracking tables
DROP TABLE IF EXISTS "user_writing_style";
DROP TABLE IF EXISTS "analytics_session";

-- Modify AuditLog (remove PII)
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "ip_address";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "user_agent";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "user_id";
```

### Phase 2: Code Updates (Week 1-2)

Remove all code that referenced deleted fields:

```bash
# Find references to deleted fields
rg -i "city|state|zip|latitude|longitude" src/ --type ts --type svelte

# Update verification flow to use district_hash
# Update analytics to remove device fingerprinting
# Update audit logs to remove PII
```

### Phase 3: Documentation (Week 2)

Update all docs to reflect new schema:

```bash
# Update schema documentation
docs/DATA-MODEL.md → This file
docs/PRIVACY-GUARANTEES.md → Explain cryptographic privacy
docs/architecture.md → Update data flow diagrams
```

---

## Enforcement

### Pre-Commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh

# Detect forbidden field additions to schema
if git diff --cached prisma/schema.prisma | grep -E "(city|state|zip|latitude|longitude|ip_address|user_agent|trust_score|civic_score)"; then
  echo "❌ Forbidden field detected in schema!"
  echo "See docs/DATA-MODEL-SPECIFICATION.md for allowed fields"
  exit 1
fi
```

### Code Review Checklist

Before merging any PR:

- [ ] No PII fields added to models
- [ ] No individual user tracking
- [ ] No behavioral profiling
- [ ] No device fingerprinting
- [ ] Aggregates only (no individual data)

### Quarterly Privacy Audits

- [ ] Red team attempt to de-anonymize users from database
- [ ] Verify TEE properly destroys addresses
- [ ] Confirm no new surveillance patterns introduced
- [ ] Review any new fields added to schema

---

## Conclusion

This data model enables:

✅ Zero-knowledge proof verification
✅ On-chain reputation tracking (pseudonymous)
✅ Collective impact measurement
✅ Congressional office delivery

Without enabling:

❌ De-anonymization of users
❌ Behavioral profiling
❌ Surveillance capitalism
❌ Employment discrimination risk

**The principle:** Store only what is cryptographically necessary. Everything else is a liability, not an asset.

---

**End of Data Model Specification**

*This document is the authoritative reference for all database schema decisions. Any field additions must be justified against these privacy principles. If in doubt, don't store it.*
