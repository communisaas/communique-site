# TEE Systems Overview

**VOTER Protocol uses TEE for message delivery ONLY, not for zero-knowledge proof generation.**

---

## What TEE IS Used For: Message Delivery ✅

**Purpose**: Decrypt congressional messages for CWC API delivery

**Why TEE is Required**:
- Congressional offices receive messages via CWC API (plaintext required)
- End-to-end encryption requires trusted intermediary
- TEE provides hardware-isolated decryption environment

**Implementation**: Week 13 Complete (October 22, 2025)
- Files: `tee-workload/` - Universal TEE container
- Cloud provider: AWS Nitro Enclaves (current target, mock/Phase 2)
- Cost: ~$350-400/month

**Flow**:
1. Browser encrypts message with XChaCha20-Poly1305
2. TEE decrypts message in hardware-isolated memory
3. TEE forwards plaintext to CWC API
4. Plaintext cleared from memory after delivery

---

## What TEE IS NOT Used For: ZK Proof Generation ❌

**Zero-knowledge proofs are generated entirely in browser** using WebAssembly-compiled Noir circuits (UltraHonk backend via Barretenberg).

**Why Browser WASM, Not TEE**:
- ✅ **Absolute Privacy**: Address never leaves browser (not even encrypted)
- ✅ **Trustless**: No hardware trust assumptions required
- ✅ **Decentralized**: No centralized proving service
- ✅ **Regulatory Clarity**: No address transmission = no PII compliance burden

**Implementation**: Week 9-10 (Browser WASM Integration)
- Shadow Atlas loaded from IPFS (progressive loading, IndexedDB caching)
- Web Workers for parallel Poseidon hashing
- Noir proof generation in browser (600ms-10s device-dependent)
- Address never sent to any server

**See**: `docs/architecture/ARCHITECTURE-DECISION-RECORD.md` for detailed rationale.

---

## Infrastructure Summary

| System | Purpose | Status | Cost |
|--------|---------|--------|------|
| **Message Delivery TEE** | Decrypt messages for CWC delivery | ✅ Implemented | $350-400/month |
| **ZK Proving (Browser WASM)** | Generate district membership proofs | ⏳ Week 9-10 | $0/month |

**Total Monthly Cost**: $350-400 (message delivery TEE only)

---

*Two separate systems, two different purposes. TEE for message delivery, browser WASM for privacy-preserving ZK proofs.*
