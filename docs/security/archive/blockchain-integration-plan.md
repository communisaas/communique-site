# Blockchain Integration Security Remediation Plan

**Status**: Week 1 In Progress (3/4 Critical Tasks Complete)
**Started**: October 13, 2025
**Target Completion**: 5 Weeks

## Executive Summary

Following a comprehensive security audit by AI critics using the Brutalist methodology, we identified critical vulnerabilities in our initial blockchain integration. This document outlines the complete remediation plan to address every security concern before launching with real users.

**Critical Finding**: The initial implementation used server-side private key signing (custodial) while claiming to be "non-custodial." This has been completely redesigned.

---

## Week 1: CRITICAL Security Fixes (Current Week)

### ✅ COMPLETED: Critical #1 - Eliminate Hot Wallet Architecture

**Problem Identified:**
- Server held `CERTIFIER_PRIVATE_KEY` environment variable
- All transactions signed server-side
- Single private key compromise would affect all users
- Custodial architecture masquerading as non-custodial

**Solution Implemented:**
1. **Removed all server-side signing**
   - Deleted `CERTIFIER_PRIVATE_KEY` from `voter-client.ts`
   - Converted all signing methods to preparation methods
   - Server now returns unsigned transaction data only

2. **Created client-side signing module**
   - `src/lib/core/blockchain/client-signing.ts`
   - Implements NEAR passkey wallet with WebAuthn/FIDO2
   - All signing happens on user's device with biometric auth

3. **New secure flow**:
   ```
   Before (INSECURE):
   User action → Server signs with hot wallet → Submit

   After (SECURE):
   User action → Server prepares unsigned tx →
   Client displays tx to user → User signs with passkey →
   Client submits → Server listens for confirmation
   ```

**Files Modified:**
- `src/lib/core/blockchain/voter-client.ts` (now READ-ONLY)
- `src/lib/core/blockchain/client-signing.ts` (NEW)
- `.env.example` (removed CERTIFIER_PRIVATE_KEY)

**Verification:**
- ✅ `certifyAction()` now throws error explaining it's deprecated
- ✅ `registerUser()` now throws error explaining it's deprecated
- ✅ No `signer` or `wallet` initialized server-side
- ✅ `isConfigured()` checks only READ-ONLY contracts

---

### ✅ COMPLETED: Critical #2 - Fix Privacy-Leaking Account IDs

**Problem Identified:**
- Account IDs: `google-abc123.communique.testnet`
- Revealed OAuth provider in account name
- Used unsalted SHA256 hash of OAuth user ID
- Trivially linkable to real identities via rainbow tables

**Solution Implemented:**
1. **Added deployment-wide secret salt**
   - `NEAR_ACCOUNT_SALT` environment variable (256-bit)
   - Must be generated with: `openssl rand -hex 32`
   - Kept secret, never committed to repo

2. **Added per-user random entropy**
   - New field: `near_account_entropy` (128-bit random)
   - Stored in database alongside account ID
   - Generated once per user using `crypto.getRandomValues()`

3. **New privacy-safe format**:
   ```
   Before: google-abc123.communique.testnet
   After:  random-a3f2d9c8.communique.testnet
   ```

4. **Account ID generation algorithm**:
   ```typescript
   hash = SHA256(
     deployment_salt +
     oauth_provider +
     oauth_user_id +
     per_user_entropy
   ).slice(0, 12)

   accountId = `random-${hash}.communique.testnet`
   ```

**Security Properties:**
- ✅ Impossible to reverse-engineer OAuth identity without both salt AND entropy
- ✅ No OAuth provider name visible
- ✅ Deterministic for same user (can regenerate with entropy)
- ✅ Each user has unique random component

**Files Modified:**
- `src/lib/core/blockchain/oauth-near.ts` (privacy-safe generation)
- `prisma/schema.prisma` (added `near_account_entropy` field)
- `.env.example` (added `NEAR_ACCOUNT_SALT` requirement)
- `src/lib/core/auth/oauth-callback-handler.ts` (updated types)

**Verification:**
- ✅ Throws error if `NEAR_ACCOUNT_SALT` not set
- ✅ Generates new entropy for new users
- ✅ Preserves existing entropy for existing users
- ✅ Account IDs contain no identifiable information

---

### ✅ COMPLETED: Critical #3 - Implement NEAR Passkey Authentication

**Problem Identified:**
- No actual wallet implementation
- Placeholder methods that threw "not yet implemented"
- No client-side signing capability

**Solution Implemented:**
1. **Installed NEAR passkey dependencies**:
   - `@near-js/biometric-ed25519@^2.3.3` - WebAuthn/passkey support
   - `@near-js/accounts@^2.3.3` - NEAR account management
   - `@near-js/keystores-browser@^2.3.3` - Browser key storage
   - `@near-js/crypto@^2.3.3` - Cryptographic operations

2. **Implemented full passkey wallet**:
   - `ClientPasskeyWallet` class with complete functionality
   - `createPasskeyWallet()` - Creates WebAuthn credential
   - `signMessage()` - Signs with biometric authentication
   - `signTransaction()` - Signs transactions for blockchain
   - `getAvailablePasskeys()` - Lists user's passkeys
   - `logout()` - Clears wallet data

3. **Created onboarding UI**:
   - `src/lib/components/blockchain/PasskeySetup.svelte`
   - Professional multi-state interface (intro, setup, success, error)
   - Platform-specific messaging (Touch ID, Face ID, Windows Hello)
   - Error handling and retry logic
   - Technical details disclosure (public key, account ID)

**User Experience:**
1. OAuth signup → Immediate platform access (no blockchain required)
2. First civic action → Prompt for passkey setup
3. User approves with biometric → 30-second one-time setup
4. All future transactions → Sign with Touch ID/Face ID
5. Keys never leave device secure enclave

**Files Created:**
- `src/lib/core/blockchain/client-signing.ts` (complete implementation)
- `src/lib/components/blockchain/PasskeySetup.svelte` (UI component)

**Verification:**
- ✅ `isPasskeySupported()` checks browser compatibility
- ✅ `createPasskeyWallet()` creates WebAuthn credential
- ✅ Public key stored locally, private key in secure enclave
- ✅ Signing requires biometric authentication each time

---

### 🔄 IN PROGRESS: Critical #4 - User Sovereignty & Recovery

**Problem Identified:**
- Users cannot export keys from MPC networks
- No recovery mechanism if device is lost
- Cannot migrate to other wallets (MetaMask, etc.)
- If Communique shuts down, accounts are orphaned

**Solution Plan:**

#### Part A: Social Recovery (2-of-3 Guardians)
1. **Guardian selection**:
   - User nominates 3 trusted contacts as guardians
   - Guardians can be email addresses or existing NEAR accounts
   - Each guardian receives encrypted share of recovery data

2. **Recovery process**:
   - If user loses device, contacts 2 of 3 guardians
   - Guardians approve recovery request
   - New passkey created on new device
   - Account control transferred to new passkey

3. **Implementation**:
   - NEAR social recovery contracts (existing on mainnet)
   - Recovery UI component for guardian management
   - Guardian invitation/approval flow
   - Recovery request interface

**Files to Create:**
- `src/lib/core/blockchain/social-recovery.ts` - Guardian management
- `src/lib/components/blockchain/RecoverySetup.svelte` - Guardian setup UI
- `src/lib/components/blockchain/RecoveryRequest.svelte` - Request recovery UI

#### Part B: Account Export & Portability
1. **Export functionality**:
   - Export account ID + guardian contacts
   - Export recovery instructions
   - Document how to import into any NEAR wallet

2. **Migration documentation**:
   - Step-by-step guide for using other NEAR wallets
   - Scroll address derivation remains consistent (Chain Signatures)
   - Instructions for worst-case scenario (Communique shutdown)

**Files to Create:**
- `src/lib/components/blockchain/WalletExport.svelte` - Export UI
- `docs/migration.md` - Migration/recovery guide

**Success Criteria:**
- ✅ User can set up 2-of-3 guardian recovery
- ✅ User can recover account on new device
- ✅ User can export all account information
- ✅ User can migrate to standard NEAR wallet
- ✅ Documentation exists for Communique shutdown scenario

---

## Week 2: HIGH Priority Infrastructure

### HIGH #5 - Implement RPC Failover

**Problem Identified:**
- Single RPC endpoint: `rpc.testnet.near.org`
- If RPC goes down, entire application fails
- No failover or redundancy

**Solution Plan:**
1. **Multiple RPC providers**:
   ```typescript
   const RPC_ENDPOINTS = [
     'https://rpc.testnet.near.org',           // Primary
     'https://near-testnet.lava.build',        // Fallback 1
     'https://testnet.rpc.fastnear.com',       // Fallback 2
     process.env.SELF_HOSTED_NEAR_RPC          // Optional self-hosted
   ];
   ```

2. **Automatic failover logic**:
   - Try primary endpoint
   - If fails, try next endpoint in list
   - Remove unhealthy endpoints temporarily
   - Restore after cooldown period (5 minutes)

3. **Health monitoring**:
   - Ping endpoints every 30 seconds
   - Track response times and error rates
   - Automatically rotate to fastest endpoint

**Files to Create:**
- `src/lib/core/blockchain/rpc-manager.ts` - RPC failover logic
- Update all files using `NEAR_NODE_URL` to use RPC manager

---

### HIGH #6 - Move Metadata to IPFS

**Problem Identified:**
- Metadata stored as data URI in transaction
- Contains PII: `personalConnection`, `templateId`
- Publicly visible on blockchain forever

**Solution Plan:**
1. **IPFS for public metadata**:
   - Use Pinata or NFT.Storage for immutable storage
   - Store non-sensitive data: `templateId`, `timestamp`, `actionType`

2. **NEAR CipherVault for private data**:
   - Encrypt sensitive fields: `personalConnection`, `deliveryConfirmation`
   - Use NEAR's encrypted storage with user's passkey as encryption key
   - Only user can decrypt their private data

3. **On-chain storage**:
   - Only store IPFS CID or CipherVault pointer
   - No raw PII on public blockchain

**Dependencies to Install:**
- `@pinata/sdk` or `nft.storage` for IPFS
- NEAR CipherVault SDK for encrypted storage

**Files to Create:**
- `src/lib/core/blockchain/metadata-storage.ts` - IPFS + encryption logic
- Update `voter-client.ts` to use new metadata storage

---

## Week 3: Transparency & Documentation

### WEEK 3 #7 - Document Trust Assumptions

**Create comprehensive security documentation**:

**Files to Create:**
- `docs/security/trust-model.md` - Complete trust assumptions
- `docs/security/threat-model.md` - Threat analysis
- `docs/security/failure-modes.md` - What can go wrong

**Trust Model Documentation:**
1. **Web3Auth MPC Network**:
   - 5-of-9 nodes required for signing
   - Nodes operated by independent entities
   - Risk: Collusion of 5 nodes could compromise keys
   - Mitigation: Geographic + organizational distribution

2. **NEAR MPC Network (Chain Signatures)**:
   - 8 independent validator nodes
   - Threshold signature scheme
   - Risk: If 5+ nodes collude, could sign unauthorized transactions
   - Mitigation: NEAR validators secured by staking + slashing

3. **RPC Endpoints**:
   - Must trust RPC providers for accurate data
   - Risk: Malicious RPC could show false balances
   - Mitigation: Multi-RPC verification, run own node

4. **OAuth Providers**:
   - User identity tied to Google/Facebook/Twitter account
   - Risk: If user loses OAuth account, loses identity
   - Mitigation: Social recovery with guardians

5. **Communique Server**:
   - Prepares unsigned transaction data
   - Risk: Could prepare malicious transaction for user to sign
   - Mitigation: User reviews transaction before signing

---

### WEEK 3 #8 - Update User-Facing Language

**Problem Identified:**
- Current messaging uses "non-custodial", "self-sovereign", "trustless"
- These are misleading with MPC-based key management

**Solution**:
1. **Update all marketing copy**:
   - ❌ Remove: "Non-custodial", "Self-sovereign", "Trustless"
   - ✅ Add: "Distributed custody", "Biometric-secured", "MPC-protected"

2. **Create honest explainer page**:
   - `/security` route explaining exactly how keys are managed
   - Diagrams of MPC architecture
   - Clear explanation of trade-offs

3. **Onboarding transparency**:
   - During passkey setup, explain where keys are stored
   - Link to security documentation
   - Disclose MPC trust assumptions

**Files to Update:**
- All components with blockchain/wallet messaging
- Landing page copy
- Create `src/routes/security/+page.svelte` - Security explainer page

---

## Week 4: Privacy Features

### WEEK 4 #9 - Implement Privacy Mode

**Solution Plan:**
1. **Pseudonymous by default**:
   - Users choose display name unlinked to real identity
   - Optional: Link verified identity for "Verified" badge

2. **ZK proof for district verification**:
   - Prove congressional district without revealing full address
   - Use Groth16 ZK-SNARK circuits
   - Verification via Self.xyz NFC passport scan

3. **Transaction privacy**:
   - Batch multiple users' transactions together
   - Obscure individual transaction patterns
   - Optional: Use tornado-style privacy mixer

**Files to Create:**
- `src/lib/core/blockchain/zk-proof.ts` - ZK proof generation
- `src/lib/components/blockchain/DistrictVerification.svelte` - ZK verification UI
- Settings toggle for privacy mode (on by default)

---

### WEEK 4 #10 - Implement ZK District Verification

**Solution Plan:**
1. **Self.xyz NFC passport verification**:
   - Install `@selfxyz/core` SDK
   - 30-second NFC scan of passport
   - Extracts congressional district from passport address
   - Cost: $0.50 per verification

2. **Groth16 ZK circuit**:
   - Use `snarkjs` for proof generation
   - Circuit proves: "I live in district X" without revealing address
   - Trusted setup from VOTER Protocol repository
   - Proof verification on-chain via `DistrictGate` contract

3. **Fallback: Didit.me KYC**:
   - For users without NFC-enabled passports
   - Government ID + face scan + liveness check
   - Address verification via utility bill
   - Cost: FREE forever

**Dependencies to Install:**
- `@selfxyz/core` - NFC passport verification
- `snarkjs` - ZK proof generation
- `circom` - Circuit compilation

**Files to Create:**
- `src/lib/core/blockchain/zk-district.ts` - District proof logic
- `src/lib/components/blockchain/PassportScan.svelte` - NFC UI
- Import circuits from voter-protocol repository

---

## Week 5: Security Audit & Testing

### WEEK 5 #11 - External Security Audit

**Audit Scope:**
1. **Smart contracts**:
   - CommuniqueCoreV2 (Scroll)
   - VOTERToken (ERC-20)
   - DistrictGate (ZK verifier)
   - ReputationRegistry (ERC-8004)

2. **Client-side security**:
   - Passkey implementation
   - Transaction signing flow
   - Key storage mechanisms

3. **Privacy analysis**:
   - Account ID generation
   - Metadata storage
   - On-chain linkability

4. **Infrastructure**:
   - RPC failover logic
   - MPC network assumptions
   - Social recovery mechanisms

**Audit Deliverables:**
- Formal security assessment report
- Identified vulnerabilities with severity ratings
- Remediation recommendations
- Re-audit after fixes

---

### WEEK 5 #12 - Comprehensive Testing

**Test Scenarios:**
1. **Happy path**:
   - New user signs up via OAuth
   - Sets up passkey wallet
   - Takes civic action
   - Signs transaction with biometric
   - Receives rewards

2. **Recovery path**:
   - User loses device
   - Initiates recovery with 2-of-3 guardians
   - Recovers account on new device
   - Continues using platform

3. **Failure scenarios**:
   - Primary RPC fails → Failover works
   - User cancels passkey setup → Can retry later
   - Transaction fails → Error handling works
   - Web3Auth down → Social recovery still works

4. **Security scenarios**:
   - Attempt to link account ID to real identity → Fails
   - Attempt to sign transaction without biometric → Fails
   - Attempt to export private key → Not possible (secure enclave)

5. **Performance testing**:
   - Passkey setup time < 30 seconds
   - Transaction signing time < 5 seconds
   - RPC failover time < 2 seconds

---

## Success Criteria (Before Mainnet Launch)

### Security Checklist:
- ✅ No private keys stored server-side (zero)
- ✅ Users can export/recover accounts independently
- ✅ Account IDs are not linkable to real identities
- ✅ All transactions signed by users (not server)
- ✅ RPC failover works (tested with simulated failures)
- ✅ Metadata is private (IPFS + encryption)
- ✅ Trust model is documented and honest
- ✅ User can migrate off platform if needed
- ✅ External security audit completed with no critical findings
- ✅ Privacy impact assessment completed
- ✅ Penetration testing completed
- ✅ Social recovery tested end-to-end

### User Experience Checklist:
- ✅ Passkey setup completes in < 30 seconds
- ✅ Transaction signing feels native (Touch ID/Face ID)
- ✅ 95% of users never see "blockchain" terminology
- ✅ Clear error messages and recovery paths
- ✅ Platform works without blockchain (graceful degradation)

### Legal/Compliance Checklist:
- ✅ Privacy policy updated for blockchain data
- ✅ Terms of service clarify MPC custody model
- ✅ GDPR compliance verified (right to erasure)
- ✅ User consent flows for biometric data
- ✅ Security incident response plan documented

---

## Current Status

### Completed (Week 1):
- ✅ **Critical #1**: Hot wallet eliminated
- ✅ **Critical #2**: Privacy-leaking account IDs fixed
- ✅ **Critical #3**: Passkey authentication implemented

### In Progress (Week 1):
- 🔄 **Critical #4**: Social recovery & user sovereignty

### Pending:
- ⏳ Week 2: RPC failover, IPFS metadata
- ⏳ Week 3: Documentation, honest messaging
- ⏳ Week 4: Privacy mode, ZK verification
- ⏳ Week 5: Security audit, testing

---

## References

- **Brutalist Audit Report**: See session with Gemini 2.5 Pro (October 13, 2025)
- **VOTER Protocol Architecture**: `/Users/noot/Documents/voter-protocol/ARCHITECTURE.md`
- **NEAR Chain Signatures**: https://docs.near.org/concepts/abstraction/chain-signatures
- **Self.xyz Documentation**: https://docs.self.xyz
- **Web3Auth MPC**: https://web3auth.io/docs/infrastructure/mpc

---

## Contact

For questions about this security remediation plan:
- **Security Issues**: Create issue with `security` label
- **Implementation Questions**: See `docs/security/` directory
- **Audit Coordination**: Contact team lead

---

**Last Updated**: October 13, 2025
**Next Review**: October 20, 2025 (End of Week 1)
