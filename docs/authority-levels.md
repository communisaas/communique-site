# Authority Level System

The voter-protocol uses a 5-tier authority system to balance Sybil resistance with accessibility.

**Cross-Repository References:**
- Circuit integration: [UNIFIED-PROOF-ARCHITECTURE.md](/Users/noot/Documents/voter-protocol/specs/UNIFIED-PROOF-ARCHITECTURE.md)
- Specification: See `authorityLevel` in DISTRICT-MEMBERSHIP-CIRCUIT-SPEC.md

## Tiers

| Level | Name | Verification | Use Cases | Sybil Risk |
|-------|------|--------------|-----------|------------|
| 1 | Self-claimed | None | View public content | HIGH |
| 2 | Location-hinted | IP/GPS correlation | Community discussion | MEDIUM |
| 3 | Socially vouched | Peer attestations | Basic constituent features | LOW |
| 4 | Document-verified | self.xyz/Didit.me KYC | Full constituent messaging | VERY LOW |
| 5 | Government-issued | State ID + liveness | Official petitions | MINIMAL |

## Implementation

Authority level is:
- Stored as `authorityLevel` in circuit inputs (1-5)
- Validated by circuit: `assert(authority_level >= 1 && authority_level <= 5)`
- Returned as public output for contract-side tier enforcement

## Upgrading Tiers

Users start at Tier 1 and can upgrade by:
- Tier 2: Completing location verification
- Tier 3: Receiving peer attestations
- Tier 4: Completing identity verification (self.xyz or Didit.me)
- Tier 5: Government ID verification (future)
