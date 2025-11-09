# Architecture Documentation

**Cryptographic and infrastructure architecture decisions for Communiqué.**

---

## Core Architecture Documents

### 1. [decision-record.md](decision-record.md) - Architecture Decision Record

**What it documents**: Browser-native WASM proving vs server-side TEE proving decision.

**Key decision**: Zero-knowledge proofs generated entirely client-side (WebAssembly Halo2 circuits).

**Why important**: Defines entire cryptographic privacy model - user addresses never leave browser.

**Read this if**: Understanding why Communiqué uses browser-native proving instead of server-side TEE.

---

### 2. [tee-systems.md](tee-systems.md) - TEE Systems Overview

**What it documents**: Trusted Execution Environment (TEE) options for message delivery.

**Key systems**:
- AWS Nitro Enclaves (ARM Graviton, no Intel ME/AMD PSP)
- Google Confidential VMs (AMD SEV-SNP)
- Azure Confidential Computing (Intel SGX, Intel TDX)

**Why important**: Congressional message delivery requires TEE for encrypted witness processing.

**Read this if**: Implementing TEE infrastructure for message delivery (Phase 1).

---

### 3. [cloud-tee.md](cloud-tee.md) - Cloud-Agnostic TEE Abstraction

**What it documents**: Multi-cloud TEE deployment strategy and abstraction layer.

**Key insight**: Abstraction layer allows switching between AWS/GCP/Azure without code changes.

**Why important**: Avoids vendor lock-in, enables cost optimization across providers.

**Read this if**: Building cloud-agnostic TEE infrastructure or evaluating provider costs.

---

## Architecture Philosophy

**Privacy-first**: All architectural decisions prioritize user privacy over developer convenience.

**Browser-native proving**: District verification happens in user's browser (WASM Halo2), not server.

**TEE for delivery**: Congressional message delivery uses TEE (encrypted witness processing).

**Separation of concerns**:
- **voter-protocol**: ZK circuits, Shadow Atlas, blockchain contracts
- **Communiqué**: Thin client, UI, TEE message delivery

---

## Cross-References

**VOTER Protocol integration** → See `/docs/INTEGRATION-GUIDE.md`

**Congressional delivery TEE** → See `/docs/congressional/delivery.md`

**Email verification TEE** → See `/docs/features/verification.md`

**Cypherpunk philosophy** → See `/docs/CYPHERPUNK-ARCHITECTURE.md`

**Frontend architecture** → See `/docs/FRONTEND-ARCHITECTURE.md`

---

## Decision Timeline

**October 2025**: Browser-native WASM proving chosen (decision-record.md)

**October 2025**: AWS Nitro Enclaves chosen for message delivery TEE (tee-systems.md)

**October 2025**: Cloud-agnostic abstraction layer designed (cloud-tee.md)

---

## For Developers

**Understanding privacy model**: Start with decision-record.md

**Implementing TEE delivery**: Start with tee-systems.md → congressional/delivery.md

**Multi-cloud deployment**: Start with cloud-tee.md

**Integration with voter-protocol**: Start with INTEGRATION-GUIDE.md

---

## For Security Auditors

**Privacy guarantees**: decision-record.md (browser-native proving = address never leaves client)

**TEE security**: tee-systems.md (ARM Graviton = no Intel ME/AMD PSP)

**Attack surface**: cloud-tee.md (multi-cloud reduces single-vendor compromise risk)

**Cryptographic primitives**: See voter-protocol repository (Halo2 circuits, Shadow Atlas)
