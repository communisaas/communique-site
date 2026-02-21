# Database Documentation

**Status:** Authoritative database reference for Phase 1
**Updated:** 2026-01-15

---

## Overview

Communiqué uses **privacy-first database architecture** with Neon Postgres via Prisma ORM.

**Core Principle:** Store only what is cryptographically necessary. Everything else is a liability.

---

## Quick Commands

```bash
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes (development)
npm run db:migrate       # Create/run migrations (production)
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed sample data
```

---

## Schema Organization

### Schema Files

#### `schema.prisma` (Current Production)

The main schema file with all production models. **Location:** `/Users/noot/Documents/communique/prisma/schema.prisma`

**Models:** 9 core production models
- User authentication & sessions
- Template creation & delivery
- Congressional routing
- Legislative channels (beta)

#### `features.prisma` (Feature-Flagged Models)

Models for features that can be enabled/disabled via environment variables.

**Models:** 12 feature-flagged models
- AI suggestions (ROADMAP)
- Template personalization (ROADMAP)
- User activation tracking (BETA)
- Variable resolution (ROADMAP)
- Advanced analytics (BETA)

**Environment Variables:**
```bash
ENABLE_BETA=true        # Enable beta features
ENABLE_RESEARCH=true    # Enable research features (dev only)
```

#### `experimental.prisma` (Research Models)

Research and experimental models for academic exploration.

**Models:** 12+ research models
- Political field theory
- Community intersection analysis
- Sheaf fusion theory
- Template morphisms

### Feature Flag Usage

```typescript
import { isFeatureEnabled } from '$lib/features/config';

// Check if model is available
if (isFeatureEnabled('AI_SUGGESTIONS')) {
  const suggestions = await db.ai_suggestions.findMany({...});
}
```

### Schema Validation

```bash
# Validate production schema
npx prisma validate --schema=prisma/schema.prisma

# Validate features schema
npx prisma validate --schema=prisma/features.prisma

# Validate experimental schema
npx prisma validate --schema=prisma/experimental.prisma
```

---

## Privacy-Preserving Architecture

### The Privacy Firewall Principle

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
│ - Generates Noir zero-knowledge proof                       │
│ - Computes district hash (salted)                           │
│ - DESTROYS address after use                                │
│ - Returns only: district hash + ZK proof                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  (District Hash + Proof)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ DATABASE (Neon Postgres - What We Store)                   │
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

### What We NEVER Store

- Personally Identifiable Information (PII)
- Location data that enables de-anonymization
- Behavioral profiling data
- Device fingerprints or tracking identifiers
- Individual action history (only aggregates)

---

## Model Categories

### Core Production (Always Available)

- `User` - User accounts and profiles (pseudonymous)
- `Session` - Authentication sessions
- `account` - OAuth account linking
- `Template` - Template definitions
- `template_campaign` - Template usage tracking
- `representative` - Congressional representatives
- `user_representatives` - User-representative relationships
- `congressional_office` - Congressional office data
- `legislative_channel` - Multi-country delivery channels

### Beta Features (ENABLE_BETA=true)

- `user_activation` - Viral cascade tracking
- `user_coordinates` - User location data
- `cascade_event` - Cascade analytics events

### Roadmap Features (Planned Implementation)

- `ai_suggestions` - AI-powered template suggestions
- `user_writing_style` - User writing style analysis
- `template_analytics` - Template performance analytics
- `template_personalization` - User template customizations
- `template_adaptation` - Location-based adaptations
- `resolved_variable` - Variable resolution cache
- `data_source_config` - External data source configs

### Research Models (ENABLE_RESEARCH=true)

- `political_field_state` - Political field vector states
- `political_flow` - Information flow modeling
- `political_uncertainty` - Uncertainty quantification
- `political_dead_end` - Engagement dead ends
- `community_intersection` - Community overlap analysis
- `local_political_bubble` - Political bubble detection
- `community_lifecycle` - Community evolution tracking
- `template_morphism` - Template transformation mappings
- `user_context_stack` - Contextual information stacks
- `research_experiment` - Research experiment metadata

---

## Core Models

### User (Minimal Identity)

```prisma
model User {
  // Pseudonymous identifier (deterministic from passkey)
  id                      String    @id @default(cuid())

  // Verification status
  verification_method     String?   // 'self_xyz' | 'didit'
  verification_status     String    @default("pending")
  verification_completed_at DateTime?
  verification_expires_at DateTime?

  // On-chain reputation (pseudonymous)
  reputation_score        Int       @default(0)
  blockchain_address      String?   // Deterministic from passkey

  // District verification (hash only, computed in TEE)
  district_hash           String?   // SHA-256(district + user_salt)

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
- `id`: Unique identifier, generated from passkey (not linkable to real identity)
- `verification_method`: Track which identity provider used (for debugging)
- `verification_status`: Enable/disable message sending based on verification
- `reputation_score`: On-chain reputation cache (verifiable via blockchain)
- `blockchain_address`: Deterministic from passkey (pseudonymous)
- `district_hash`: Salted hash for verification, computed in TEE, not reversible

**Explicitly forbidden fields:**
```prisma
// ❌ NEVER ADD THESE:
city                    String?    // Enables de-anonymization
state                   String?    // Enables de-anonymization
zip                     String?    // Enables de-anonymization
congressional_district  String?    // Stored in plaintext = privacy violation
latitude                Float?     // Geographic tracking
longitude               Float?     // Geographic tracking
street_address          String?    // PII
full_name               String?    // PII
phone_number            String?    // PII
trust_score             Int?       // Behavioral profiling
```

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

**No PII stored in session data. Sessions tied to pseudonymous user ID only.**

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
  response_rate     Float?

  // Content moderation
  moderation_status String   @default("pending")
  moderation_agents Json?    // Multi-agent consensus results

  // Relations
  aggregate_impacts AggregateImpact[]

  @@index([category])
  @@index([moderation_status])
}
```

**Critical distinction:**
- Track AGGREGATE sends (how many total)
- NEVER track INDIVIDUAL sends (who sent what)
- Template creator is NEVER stored

### AggregateImpact (Collective Outcomes)

```prisma
model AggregateImpact {
  id                           String   @id @default(cuid())
  template_id                  String
  template                     Template @relation(fields: [template_id], references: [id])

  // Congressional action (public record)
  congressional_action         String
  action_date                  DateTime
  representative_name          String?
  representative_district      String?

  // Correlation data (proves causation through timing)
  verified_sends_before_action Int
  days_between_send_and_action Int
  districts_that_sent          Json?    // Array of districts (no user linkage)

  // Verification
  source_url                   String?
  verified_by                  String?

  created_at                   DateTime @default(now())

  @@index([template_id])
  @@index([action_date])
}
```

**Proves that verified constituent blocs create policy outcomes WITHOUT revealing individual participants.**

### ReputationEvent (On-Chain Tracking)

```prisma
model ReputationEvent {
  id                 String   @id @default(cuid())
  user_id            String
  user               User     @relation(fields: [user_id], references: [id])

  // Event type
  event_type         String   // 'verified_send' | 'congressional_response'
  reputation_delta   Int      // +10 for verified send, etc.

  // On-chain verification
  tx_hash            String   // Scroll zkEVM transaction hash
  block_number       Int?
  timestamp          DateTime @default(now())

  @@index([user_id])
  @@index([tx_hash])
}
```

**Privacy guarantee:** NO linkage to template, content, or district. Blockchain observers see: "Address 0xABC gained 10 reputation" (not why).

---

## District Verification Flow (TEE-Only)

**Critical design:** Congressional district is NEVER stored in database.

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

  // Generate Noir zero-knowledge proof
  const zkProof = await generateProof({
    claim: "User is verified constituent in a congressional district",
    witness: address,
    publicOutputs: ["verified_constituent"]
  });

  // Compute district hash (for database storage)
  const districtHash = SHA256(district + USER_SALT);

  // DESTROY sensitive data
  overwriteMemory(address);
  overwriteMemory(district);

  return { districtHash, zkProof };
}

// 4. Store only hash in database
await db.user.update({
  where: { id: userId },
  data: { district_hash: districtHash }
});
```

**Key insight:** Database stores `district_hash` (not reversible). District plaintext exists ONLY in TEE memory during operations.

---

## Aggregate Statistics (Privacy-Preserving)

### Allowed

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
```

### Forbidden

```typescript
// ❌ Individual user stats
interface UserStats {
  sends_count: number;           // Would track individual
  percentile_rank: number;       // Would rank individual
  streak_days: number;           // Would track behavior
}

// ❌ Leaderboards
interface Leaderboard {
  user_id: string;               // Would reveal identity
  rank: number;                  // Would create competition
}
```

---

## Data Retention Policy

**Keep Forever:**
- On-chain reputation events (immutable blockchain records)
- Aggregate impact data (proves platform efficacy)
- Template library (public templates)

**Delete:**
- Verification data after expiration
- Session data after logout
- Any accidentally collected PII (immediate deletion)

**Never Collect:**
- IP addresses (no server logging)
- Device fingerprints (no analytics tracking)
- Behavioral patterns (no profiling)

---

## Migrations

### Creating Migrations

```bash
# Development (prototype schema changes)
npm run db:push

# Production (versioned migrations)
npx prisma migrate dev --name descriptive-name
```

### Applying Migrations

```bash
# Production deployment
npx prisma migrate deploy
```

See: `/Users/noot/Documents/communique/docs/archive/migrations/` for historical migration records.

---

## Seeding

```bash
npm run db:seed          # Seed sample data
npm run db:seed:core     # Same as db:seed (alias)
```

**What gets seeded:**
- Users (12) - Mix of verified/unverified
- Templates (13) - Federal (9) + SF Municipal (4)
- Representatives (4) - CA-11, CA-3, Senators

See: `/Users/noot/Documents/communique/docs/development/seeding.md` for details.

---

## Performance Considerations

### Production Benefits
- **Smaller client**: Only core models compiled
- **Faster queries**: Fewer indexes and relations
- **Better caching**: Focused on high-traffic queries
- **Cleaner migrations**: No experimental schema changes

### Development Benefits
- **Clear boundaries**: Know what's production vs research
- **Safe experimentation**: Research won't break production
- **Progressive rollout**: Beta → Production pathway

---

## Development Workflow

1. **Production features**: Add to `schema.prisma`
2. **Beta features**: Add to `features.prisma` with feature flag
3. **Research**: Add to `experimental.prisma` with ENABLE_RESEARCH guard
4. **Testing**: Use separate test database with all schemas enabled

---

## Enforcement

### Pre-Commit Hooks

```bash
# .husky/pre-commit
# Detect forbidden field additions to schema
if git diff --cached prisma/schema.prisma | grep -E "(city|state|zip|latitude|longitude|ip_address|user_agent|trust_score|civic_score)"; then
  echo "❌ Forbidden field detected in schema!"
  echo "See docs/development/database.md for allowed fields"
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

---

## Conclusion

This database architecture enables:

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

*This document is the authoritative reference for all database decisions. Any field additions must be justified against these privacy principles.*
