# Alien Protocol Integration Research

**Created:** 2026-02-02
**Status:** RESEARCH - Do not implement without further investigation
**Author:** Identity Engineering Research
**Purpose:** Evaluate Alien as alternative identity provider alongside Didit.me

---

## Executive Summary

**Alien** (alien.org) is a privacy-first decentralized identity protocol that enables "proof of unique humanity" without storing biometrics or government IDs. Founded by Kirill Avery (YC W21 alum), it launched in early 2025 on iOS and Android.

**Key Finding:** Alien is a nascent project with **no publicly available developer SDK or API documentation** as of February 2026. Integration is not feasible until they release developer tools.

**Recommendation:** Monitor Alien's developer program. In the meantime, continue with Didit.me as primary identity provider and consider Humanity Protocol as a backup decentralized identity option.

---

## 1. SDK/API Overview

### Current State: No Public Developer Tools

After extensive research across:
- Official website (alien.org)
- npm registry
- GitHub
- Developer documentation sites
- Technical blogs and announcements

**Finding:** Alien does not currently offer:
- Public REST API
- SDK (JavaScript, iOS, Android, or other)
- npm packages
- Developer documentation
- Integration guides
- Webhook specifications

### What We Found

**Official Resources:**
- Main website: https://alien.org
- Blog: https://alien.org/blog/introducing-alien
- Legal/Terms: https://alien.org/legal/terms
- User profiles: https://alien.id/[username]

**Apps:**
- iOS: Available on App Store
- Android: Available on Google Play

**Native Token:**
- Aliencoin (ALIEN) - distributed to verified users
- Supports Alien blockchain and Solana blockchain

### Comparison: Didit.me Developer Experience

| Feature | Alien | Didit.me |
|---------|-------|----------|
| REST API | Not available | Full REST API |
| SDK (iOS) | Not available | Native SDK |
| SDK (Android) | Not available | Native SDK |
| SDK (Web) | Not available | JavaScript SDK |
| SDK (React Native) | Not available | Supported |
| SDK (Flutter) | Not available | Supported |
| Documentation | Not available | Comprehensive (docs.didit.me) |
| Sandbox/Test Mode | Not available | Instant sandbox access |
| Webhooks | Not available | Real-time webhooks |
| npm Package | Not available | Not confirmed |

**Sources:**
- [Didit Developer Portal](https://didit.me/developers)
- [Didit Documentation](https://docs.didit.me/reference/introduction)
- [Didit GitHub Demo](https://github.com/didit-protocol/didit-full-demo)

---

## 2. Authentication Requirements

### Alien (Inferred from Consumer App)

Based on news coverage and app functionality:

1. **Invitation-Only Onboarding**
   - New users require invitation from existing verified user
   - Creates social graph for Sybil resistance
   - No self-registration available

2. **Biometric Verification**
   - Face scan processed on-device
   - Encrypted biometric data never leaves device
   - Multi-party computation in secure enclaves
   - Only anonymized hash stored on-chain

3. **No Government ID Required**
   - Purely biometric-based verification
   - Privacy-preserving by design

### Didit.me (Documented API)

```typescript
// Authentication: Header-based API key
headers: {
  'x-api-key': process.env.DIDIT_API_KEY,
  'Content-Type': 'application/json'
}

// Webhook validation: HMAC-SHA256 signatures
const expectedSignature = HMAC_SHA256(webhookSecret, requestBody);
// Headers: x-signature-v2, x-timestamp
// Reject requests older than 5 minutes
```

**Didit Authentication Methods:**
- API Key (header-based)
- Webhook secrets (HMAC-SHA256)
- Session tokens (JWT for SDK initialization)

---

## 3. Verification Flow

### Alien Flow (Inferred)

```
User Flow (Consumer App Only):
1. Download Alien app (iOS/Android)
2. Receive invitation link from verified user
3. Perform face scan in app
   - Processed in secure enclave
   - Encrypted locally
   - Never leaves device
4. Multi-party computation verification
   - Confirms uniqueness without exposing data
5. Receive Alien ID (alien.id/username)
6. Optionally claim Aliencoin rewards
```

**No Integration Points Identified:**
- No API to initiate verification
- No callback/webhook to receive results
- No session management for third-party apps
- No way to query verification status

### Didit.me Flow (Documented)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Your App   │     │   Didit     │     │   Webhook   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │ POST /v3/session/ │                   │
       │──────────────────>│                   │
       │                   │                   │
       │  session_id,      │                   │
       │  session_token,   │                   │
       │  verification_url │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ Redirect user to  │                   │
       │ verification_url  │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ User completes    │
       │                   │ verification      │
       │                   │                   │
       │                   │ POST webhook      │
       │                   │──────────────────>│
       │                   │                   │
       │ GET /v3/session/  │                   │
       │ {session_id}/     │                   │
       │ decision/         │                   │
       │──────────────────>│                   │
       │                   │                   │
       │ Verification      │                   │
       │ results           │                   │
       │<──────────────────│                   │
```

**Didit Session Lifecycle:**
- `Not Started` -> `In Progress` -> `Approved` / `Declined` / `In Review`
- Sessions expire after 7 days (configurable)

---

## 4. Data Model (Claims Available)

### Alien Claims (Inferred)

Based on public information, Alien provides:

| Claim | Type | Privacy Level |
|-------|------|---------------|
| Unique human status | Boolean | Public (on-chain hash) |
| Verification timestamp | DateTime | Public |
| Social graph position | Implicit | Private |
| Wallet address | Address | User-controlled |

**What Alien Does NOT Provide:**
- Name
- Address
- Date of birth
- Government ID data
- Nationality/citizenship

**Alien's Design Philosophy:**
> "Proving humanity in the age of AI" - Verify that a user is a unique human, nothing more.

### Didit.me Claims (Documented)

```typescript
interface DiditVerificationResult {
  session_id: string;
  status: "Approved" | "Declined" | "In Review";

  decision: {
    status: string;

    id_verifications: [{
      document_type: string;       // "passport", "drivers_license", etc.
      document_number: string;     // Extracted ID number
      first_name: string;
      last_name: string;
      date_of_birth: string;       // ISO 8601
      expiry_date: string;
      nationality: string;
      issuing_country: string;
      mrz_verified: boolean;
      document_front_url?: string;
      document_back_url?: string;
    }];

    liveness_checks: [{
      passed: boolean;
      type: "passive" | "active";
      confidence_score: number;
    }];

    face_matches: [{
      similarity_score: number;    // 0.0 - 1.0
      passed: boolean;
    }];

    aml_screening?: {
      matches: [];
      risk_score: string;
    };
  };

  vendor_data: string;             // Your custom reference
  metadata: object;
}
```

---

## 5. Integration Architecture Proposal

### Option A: Direct Integration (NOT CURRENTLY POSSIBLE)

```
┌─────────────────────────────────────────────────────────┐
│                      Communique                          │
├─────────────────────────────────────────────────────────┤
│                 IdentityVerificationFlow                 │
│  ┌─────────────────┐        ┌─────────────────┐         │
│  │ AlienVerification│        │ DiditVerification│        │
│  │   (BLOCKED)      │        │   (WORKING)      │        │
│  └────────┬─────────┘        └────────┬────────┘        │
│           │                           │                  │
│           ▼                           ▼                  │
│     ┌──────────┐               ┌──────────┐             │
│     │ Alien API│               │ Didit API│             │
│     │ (N/A)    │               │ (v3)     │             │
│     └──────────┘               └──────────┘             │
└─────────────────────────────────────────────────────────┘

Status: BLOCKED - Alien has no API
```

### Option B: Hybrid with Humanity Protocol (ALTERNATIVE)

If decentralized identity is required before Alien releases SDK:

```
┌─────────────────────────────────────────────────────────┐
│                      Communique                          │
├─────────────────────────────────────────────────────────┤
│                 IdentityVerificationFlow                 │
│  ┌───────────────────┐    ┌─────────────────┐           │
│  │HumanityVerification│    │DiditVerification│           │
│  │   (Palm Biometric) │    │  (Gov ID + Face)│           │
│  └─────────┬──────────┘    └────────┬────────┘          │
│            │                        │                    │
│            ▼                        ▼                    │
│     ┌──────────────┐         ┌──────────┐               │
│     │Humanity API  │         │Didit API │               │
│     │docs.humanity │         │  (v3)    │               │
│     └──────────────┘         └──────────┘               │
└─────────────────────────────────────────────────────────┘

Status: POSSIBLE - Humanity Protocol has public APIs
```

**Humanity Protocol Resources:**
- Documentation: https://docs.humanity.org/
- Developer Portal: https://www.humanity.org/developers
- SDK + APIs available

### Option C: Future Alien Integration (WHEN SDK AVAILABLE)

```
┌─────────────────────────────────────────────────────────┐
│                      Communique                          │
├─────────────────────────────────────────────────────────┤
│           IdentityProviderAbstraction Layer              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  interface IdentityProvider {                     │   │
│  │    initSession(): Promise<Session>                │   │
│  │    getVerificationUrl(): string                   │   │
│  │    handleWebhook(payload): VerificationResult     │   │
│  │    getClaims(): IdentityClaims                    │   │
│  │  }                                                │   │
│  └──────────────────────────────────────────────────┘   │
│           │              │              │                │
│           ▼              ▼              ▼                │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│    │   Alien   │  │   Didit   │  │ Humanity  │          │
│    │  Provider │  │  Provider │  │ Provider  │          │
│    └───────────┘  └───────────┘  └───────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Comparison with Didit.me

| Dimension | Alien | Didit.me |
|-----------|-------|----------|
| **Philosophy** | Privacy-maximalist, no PII | KYC/AML compliant, full PII |
| **Verification Method** | Face biometric only | Gov ID + Face + Liveness |
| **Data Storage** | On-device, hash on-chain | Cloud (GDPR compliant) |
| **Government ID** | Not required | Required |
| **Address Extraction** | Not possible | From document OCR |
| **Age Verification** | Not possible | Date of birth from ID |
| **AML Screening** | Not included | Available |
| **Integration Effort** | Not possible (no SDK) | Low (well-documented) |
| **Cost** | Unknown (free consumer app) | Usage-based credits |
| **Sybil Resistance** | Strong (biometric + social graph) | Strong (document + liveness) |
| **Privacy** | Maximum (no PII stored) | Standard (encrypted PII) |
| **Regulatory Compliance** | Unclear | GDPR, SOC 2, etc. |

### For Communique's Use Case (Congressional Delivery)

| Requirement | Alien | Didit.me |
|-------------|-------|----------|
| Verify constituent is human | Yes | Yes |
| Extract mailing address | No | Yes (from ID) |
| Verify district membership | No (no address) | Yes (address extraction) |
| Generate identity commitment | Possibly (on-chain hash) | Yes (via our ZK proofs) |
| Meet congressional credibility standards | Unclear | Yes |

**Conclusion:** Didit.me is more suitable for congressional delivery because it provides address extraction needed for district verification. Alien is better suited for purely Sybil-resistant applications where no PII is needed.

---

## 7. Cryptographic Identity Commitments

### Can Alien Generate ZK-Compatible Commitments?

**What We Know:**
- Alien stores "anonymized hash-like vector" on-chain
- Uses multi-party computation in secure enclaves
- Raw biometric never reconstructable

**What We Don't Know:**
- Hash algorithm used
- On-chain contract addresses
- Whether hash is suitable for ZK circuits
- Whether external apps can query verification status

**Theoretical Integration:**
```typescript
// IF Alien provides an API (hypothetical)
interface AlienVerificationResult {
  alienId: string;              // alien.id/username
  uniquenessHash: string;       // On-chain biometric hash
  verifiedAt: number;           // Timestamp
  chainId: number;              // Alien chain or Solana
  contractAddress: string;      // Where hash is stored
}

// Could potentially use as identity commitment
const identityCommitment = poseidon([
  BigInt(alienResult.uniquenessHash),
  BigInt(alienResult.verifiedAt)
]);
```

**Current Reality:** Without API access, we cannot verify on-chain status or extract the uniqueness hash for our ZK proofs.

### Didit.me ZK Integration (Current Implementation)

```typescript
// Current Communique implementation
// See: /docs/design/patterns/identity-verification.md

// From Didit verification result
const address = diditResult.decision.id_verifications[0];

// Generate identity commitment for ZK proofs
const identityCommitment = poseidon([
  hashAddress(address.street, address.city, address.state, address.zip),
  BigInt(diditResult.session_id.slice(0, 16), 16)
]);
```

---

## 8. Authority Level Mapping (Tier 1-5)

### Communique Authority Tiers (Reference)

From existing architecture:
- **Tier 1:** Unverified (anonymous)
- **Tier 2:** Email verified
- **Tier 3:** Phone verified
- **Tier 4:** Government ID verified (Didit.me)
- **Tier 5:** NFC Passport verified (Self.xyz)

### Hypothetical Alien Mapping

| Alien Claim | Authority Tier | Rationale |
|-------------|----------------|-----------|
| Verified human | Tier 3 | Proves humanity, no identity details |
| + Social endorsements | Tier 3.5 | Community validation adds trust |
| + Government ID (not supported) | N/A | Alien doesn't collect this |

**Conclusion:** Alien cannot reach Tier 4-5 because it intentionally doesn't collect government ID or address. It would be a **parallel track** for Sybil resistance, not a replacement for identity verification.

### Proposed Dual-Track Model

```
Traditional Identity Track (Didit.me / Self.xyz):
  Email → Phone → Gov ID → Passport
  Tier 1   Tier 2  Tier 4   Tier 5

Decentralized Humanity Track (Alien / Humanity Protocol):
  Unverified → Biometric Human → Socially Endorsed Human
  Tier 1        Tier 3 (alt)      Tier 3.5 (alt)
```

---

## 9. Multi-Provider Composition Strategy

### Design Principles

1. **Provider Independence**
   - Each provider should work standalone
   - Failure of one doesn't block verification
   - User can choose preferred method

2. **Claim Aggregation**
   - Combine claims from multiple providers
   - Higher trust from more providers
   - No single point of failure

3. **Privacy Preservation**
   - Minimal data sharing between providers
   - User controls which claims to combine
   - Support both KYC and privacy-preserving options

### Proposed Provider Interface

```typescript
// Abstract interface for identity providers
interface IdentityProvider {
  id: string;
  name: string;
  type: 'kyc' | 'biometric' | 'social' | 'passport';

  // Session management
  createSession(userId: string, options?: SessionOptions): Promise<Session>;
  getSessionStatus(sessionId: string): Promise<SessionStatus>;

  // Verification
  getVerificationUrl(session: Session): string;
  handleWebhook(payload: unknown): Promise<VerificationResult>;

  // Claims
  extractClaims(result: VerificationResult): IdentityClaims;

  // Cryptographic
  generateCommitment?(claims: IdentityClaims): Promise<string>;
}

// Provider-specific implementations
class DiditProvider implements IdentityProvider { /* ... */ }
class SelfXyzProvider implements IdentityProvider { /* ... */ }
// class AlienProvider implements IdentityProvider { /* Future */ }
class HumanityProvider implements IdentityProvider { /* Alternative */ }
```

### User Account Linking

```typescript
// Database model for multi-provider identity
model UserIdentity {
  id              String   @id @default(cuid())
  user_id         String

  // Provider info
  provider        String   // "didit" | "self_xyz" | "alien" | "humanity"
  provider_user_id String? // Provider's internal user ID

  // Verification
  verified_at     DateTime?
  expires_at      DateTime?

  // Claims (provider-specific)
  claims          Json     // { address?, nationality?, uniqueness_hash?, etc. }

  // Cryptographic
  identity_commitment String?

  @@unique([user_id, provider])
}
```

### Fallback Strategy

```typescript
async function getVerifiedIdentity(userId: string): Promise<Identity | null> {
  const providers = ['self_xyz', 'didit', 'humanity', 'alien'];

  for (const providerId of providers) {
    const identity = await db.userIdentity.findUnique({
      where: { user_id_provider: { user_id: userId, provider: providerId } }
    });

    if (identity?.verified_at && !isExpired(identity.expires_at)) {
      return {
        provider: providerId,
        claims: identity.claims,
        commitment: identity.identity_commitment,
        tier: getAuthorityTier(providerId, identity.claims)
      };
    }
  }

  return null; // No verified identity found
}
```

---

## 10. Open Questions for Future Implementation

### Technical Questions

1. **API Availability**
   - When will Alien release a public API/SDK?
   - Will they offer enterprise/developer tier?
   - What authentication will be required?

2. **On-Chain Integration**
   - What chain is the uniqueness hash stored on?
   - What's the contract address?
   - Can we verify hash without Alien's infrastructure?

3. **Webhook/Callback Pattern**
   - Will they support OAuth 2.0 / OIDC?
   - What webhook format will they use?
   - Real-time or polling-based status updates?

### Business Questions

1. **Pricing Model**
   - Will verification be free (subsidized by Aliencoin)?
   - Per-verification pricing?
   - Enterprise contracts?

2. **Compliance**
   - What regulatory certifications (SOC 2, GDPR)?
   - Can they sign BAAs for HIPAA?
   - Data residency options?

3. **Support**
   - Developer support availability?
   - SLA guarantees?
   - Sandbox/test environment?

### Architectural Questions

1. **Data Portability**
   - Can users export their Alien verification?
   - Is verification portable to other apps?
   - How does revocation work?

2. **Interoperability**
   - Will they support W3C DID standards?
   - W3C Verifiable Credentials format?
   - Integration with other identity providers?

---

## 11. Recommended Next Steps

### Immediate Actions

1. **Monitor Alien Development**
   - Follow @kirillzzy (founder) on X/Twitter
   - Subscribe to alien.org blog updates
   - Check GitHub for any public repos

2. **Engage with Alien Team**
   - Contact through website for developer access
   - Request early access to SDK/API program
   - Ask about enterprise integration timeline

3. **Continue with Current Architecture**
   - Didit.me for government ID verification
   - Self.xyz for NFC passport verification
   - Both have robust SDKs and documentation

### Medium-Term Actions (3-6 months)

4. **Evaluate Humanity Protocol**
   - Has public APIs and documentation
   - Similar privacy-preserving philosophy to Alien
   - Could serve as interim decentralized option

5. **Build Provider Abstraction Layer**
   - Abstract current Didit.me integration
   - Prepare for multi-provider support
   - Design flexible claims aggregation

### Long-Term Actions (6-12 months)

6. **Integrate Alien (When Available)**
   - Implement AlienProvider once SDK released
   - Test invitation-based flow in sandbox
   - Determine appropriate authority tier

7. **Evaluate Multi-Provider UX**
   - User research on provider choice
   - A/B test verification flows
   - Measure conversion by provider

---

## 12. References and Sources

### Alien Protocol
- [Privacy-First 'Alien' Identity System Aims to Prove Users Are Human in the Age of AI - Decrypt](https://decrypt.co/350974/privacy-first-alien-identity-system-prove-users-human-age-ai)
- [Kirill Avery - Crunchbase](https://www.crunchbase.com/person/kirill-averianov)
- [Kirill Avery Personal Site](https://kirill.cc/)
- [Alien Main Website](https://alien.org/)

### Didit.me
- [Didit Developer Portal](https://didit.me/developers)
- [Didit Documentation](https://docs.didit.me/reference/introduction)
- [Didit API Full Flow](https://docs.didit.me/reference/api-full-flow)
- [Didit Quick Start](https://docs.didit.me/reference/quick-start)
- [Didit GitHub Demo](https://github.com/didit-protocol/didit-full-demo)

### Humanity Protocol (Alternative)
- [Humanity Protocol Documentation](https://docs.humanity.org/)
- [Humanity Protocol Developer Portal](https://www.humanity.org/developers)

### Communique Internal References
- `/docs/design/patterns/identity-verification.md` - Current UI components
- `/docs/specs/portable-identity.md` - IPFS + on-chain identity architecture
- `/docs/specs/universal-credibility.md` - Authority tier system

### Decentralized Identity Landscape
- [Web3 Identity Solutions - 101 Blockchains](https://101blockchains.com/web3-identity-solutions/)
- [Decentralized Identity Tools - Alchemy](https://www.alchemy.com/dapps/best/decentralized-identity-tools)
- [Identity Protocols - Gitcoin](https://www.gitcoin.co/blog/identity-protocols)

---

## Appendix A: Competitive Landscape

| Protocol | Type | Biometric | Gov ID | API Available | ZK-Compatible |
|----------|------|-----------|--------|---------------|---------------|
| **Alien** | Decentralized | Face | No | No | Unknown |
| **Didit.me** | KYC | Face + Liveness | Yes | Yes | Via our proofs |
| **Self.xyz** | Passport | No | NFC Passport | Yes | Yes |
| **Humanity Protocol** | Decentralized | Palm | No | Yes | Unknown |
| **Worldcoin** | Decentralized | Iris | No | Yes | Yes |
| **Gitcoin Passport** | Aggregator | No | No | Yes | Unknown |
| **Proof of Humanity** | Decentralized | Video | No | Limited | Unknown |

---

## Appendix B: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Alien never releases SDK | Medium | Low | Continue with Didit.me + Self.xyz |
| Alien SDK incompatible with our needs | Low | Medium | Use provider abstraction layer |
| Alien shuts down | Low | Low | Decentralized backup via Humanity |
| Regulatory issues with biometric-only verification | Medium | Medium | Maintain gov ID option (Didit) |
| User confusion with multiple providers | Medium | Medium | Clear UX guidance on trade-offs |

---

**Document Status:** Research Complete
**Last Updated:** 2026-02-02
**Next Review:** When Alien announces developer program

---

*This document represents research findings as of February 2026. Alien Protocol is actively developing and may release developer tools in the future. Re-evaluate this analysis when new information becomes available.*
