# TEE Security & Backdoor Analysis: Choosing the Right Architecture

**Research Date:** October 22, 2025
**Question:** Can we find an economical TEE solution without NSA backdoors (avoiding AMD PSP, Intel ME)?
**Answer:** ✅ **YES - AWS Nitro Enclaves on ARM Graviton processors**

---

## Executive Summary

**RECOMMENDATION: Switch from GCP Confidential Space (AMD SEV-SNP) to AWS Nitro Enclaves on ARM Graviton3/4 processors.**

### Why ARM Graviton + Nitro Enclaves?

1. ✅ **No Intel ME or AMD PSP** - ARM architecture avoids x86 management engines entirely
2. ✅ **Hypervisor-based isolation** - No reliance on proprietary CPU features (SEV-SNP, SGX)
3. ✅ **Independent security audit** - AWS Nitro System received third-party verification (August 2025)
4. ✅ **Open-source components** - Many Nitro components are open-sourced for inspection
5. ✅ **Cost-effective** - ~$400/month (similar to GCP), with 750 hours/month free tier through Dec 2025
6. ✅ **Production-ready** - Used by Coinbase for crypto wallets, proven at scale

---

## Security Threat Model: x86 Management Engines

### Intel Management Engine (ME)

**What it is:**
- 32-bit ARC microprocessor embedded in Intel chipsets since 2006
- Runs independent firmware with full system access
- Has its own network stack and can access system memory

**Backdoor concerns:**
- ❌ **Network access** - Can communicate independently of main CPU
- ❌ **Persistent access** - Survives OS reinstalls, cannot be disabled by user
- ❌ **Closed-source** - Proprietary firmware, no public auditing
- ❌ **NSA collaboration** - Intel received NSA funding for chip development

**Known vulnerabilities:**
- Multiple remote code execution flaws discovered (2017-2020)
- Can be used for persistent rootkits that survive OS reinstalls
- Ring -3 access (below hypervisor, OS, and CPU rings)

### AMD Platform Security Processor (PSP)

**What it is:**
- 32-bit ARM Cortex-A5 core integrated into AMD processors since 2013
- Uses ARM TrustZone technology for isolation
- Similar architecture to Intel ME

**Backdoor concerns:**
- ⚠️ **Limited network access** - PSP does NOT have independent network stack (unlike Intel ME)
- ❌ **Persistent access** - Runs at boot, has full system access
- ❌ **Closed-source** - Proprietary firmware, no public auditing
- ⚠️ **Physical access required** - Attacks require physical access (reduces NSA remote threat)

**Comparison to Intel ME:**
- ✅ **Less dangerous** - No network access = cannot be remotely exploited like Intel ME
- ✅ **Simpler architecture** - ARM Cortex-A5 is well-understood
- ❌ **Still opaque** - Firmware is proprietary, cannot verify no backdoors

### Key Insight: AMD PSP vs Intel ME

**AMD PSP is significantly less risky than Intel ME** because:
1. No independent network access (requires physical attack)
2. Uses standard ARM Cortex-A5 core (not custom microarchitecture)
3. Fewer known vulnerabilities in practice

However, **both are proprietary black boxes** we cannot fully trust.

---

## Alternative Architectures

### Option 1: AWS Nitro Enclaves on ARM Graviton ⭐ RECOMMENDED

**Architecture:**
- **CPU:** ARM Neoverse cores (no PSP, no ME)
- **Isolation:** Nitro Hypervisor (custom AWS hypervisor, not Intel/AMD)
- **Attestation:** Cryptographic signatures via Nitro hardware, not CPU features

**Security model:**
```
┌─────────────────────────────────────────────────┐
│ AWS Nitro Hypervisor (custom hypervisor)        │
│                                                 │
│ ┌─────────────────┐   ┌─────────────────┐     │
│ │ Parent EC2      │   │ Nitro Enclave   │     │
│ │ Instance        │   │                 │     │
│ │ (your app)      │   │ (TEE workload)  │     │
│ └─────────────────┘   └─────────────────┘     │
│         ↑                      ↑               │
│         └──────── vsock ───────┘               │
│         (local socket only, no network)        │
└─────────────────────────────────────────────────┘
         ↑
    ARM Graviton CPU (no ME, no PSP)
         ↑
    Nitro Card (hardware attestation)
```

**Why it avoids backdoors:**

1. **No x86 management engines**
   - ARM architecture doesn't have Intel ME or AMD PSP equivalent
   - Graviton uses ARM TrustZone, but only for secure boot (no persistent access)

2. **Hypervisor-based isolation (not CPU features)**
   - Nitro Hypervisor enforces isolation in software
   - Does NOT rely on SEV-SNP, SGX, or other proprietary CPU features
   - AWS open-sourced key components for auditing

3. **Independent audit (August 2025)**
   - Third-party verification of Nitro System security claims
   - Confirmed: No "root" access for AWS operators
   - Confirmed: Restricted API prevents unauthorized access

4. **Cryptographic attestation without CPU trust**
   - Attestation documents signed by Nitro Card (separate hardware)
   - Not dependent on trusting CPU manufacturer
   - CBOR-encoded attestation documents are verifiable

**Supported Graviton instances:**
- **Graviton3** (Neoverse V1): 2× faster crypto than Graviton2
- **Graviton4** (Neoverse V2): 40% faster databases, 30% faster web apps
- Instance types: C7g, C6g, M6g, R6g, X2gd (all support Nitro Enclaves)

**Cost:**
- **~$400/month** for 2 vCPU, 4 GB RAM (c6g.large, 24/7)
- **FREE tier:** 750 hours/month on t4g.small through Dec 31, 2025
- **No additional Nitro Enclaves fees** (same EC2 pricing)

**Production use:**
- ✅ **Coinbase** - Uses Nitro Enclaves for crypto wallet key management
- ✅ **Banking** - Used for PCI-DSS compliant payment processing
- ✅ **Healthcare** - HIPAA-compliant data processing

---

### Option 2: RISC-V Open-Source TEEs 🔬 EXPERIMENTAL

**Projects:**
- **Keystone Enclave** - UC Berkeley open-source TEE for RISC-V
- **Penglai TEE** - Adopted by openEuler and OpenHarmony
- **SPEAR-V** - Fast and flexible RISC-V enclave architecture

**Why RISC-V for security:**
- ✅ **Open ISA** - Instruction set is public, auditable
- ✅ **No proprietary features** - No equivalent to ME/PSP
- ✅ **Open-source implementations** - Multiple open-source CPU cores
- ✅ **Immune to Spectre/Meltdown** - Popular RISC-V cores don't speculate memory

**Why NOT recommended for production (2025):**
- ❌ **No cloud providers** - No major cloud offers RISC-V instances yet
- ❌ **Limited hardware** - Few commercial RISC-V servers available
- ❌ **Performance gap** - Slower than ARM/x86 for general compute
- ❌ **Immature ecosystem** - Tooling, libraries still catching up

**Future potential:**
- RISC-V is the **gold standard** for auditable, backdoor-free computing
- Once cloud providers offer RISC-V instances, this becomes ideal choice
- Monitor for AWS/GCP RISC-V offerings (likely 2026-2027)

---

### Option 3: GCP Confidential Space (AMD SEV-SNP) ⚠️ ORIGINAL PLAN

**Architecture:**
- **CPU:** AMD EPYC with SEV-SNP (Secure Encrypted Virtualization)
- **Isolation:** Hardware memory encryption at CPU level
- **Attestation:** OIDC tokens via AMD PSP

**Security concerns:**

1. **Relies on AMD PSP** ❌
   - SEV-SNP attestation is generated by AMD PSP
   - Must trust AMD's proprietary firmware
   - Cannot verify no backdoors in PSP

2. **Hardware-dependent trust** ⚠️
   - If AMD PSP is compromised, SEV-SNP guarantees fail
   - No way to audit PSP firmware (closed-source)

3. **NSA risk (lower than Intel ME)** ⚠️
   - AMD PSP has no network access (requires physical attack)
   - Less likely NSA target than Intel (smaller market share)
   - Still cannot rule out backdoors

**Why we initially chose GCP:**
- Lower cost (~$350/month vs ~$400 AWS)
- Better attestation UX (OIDC JWT vs CBOR documents)
- Faster deployment (simpler API)

**Why we should switch:**
- AMD PSP is a proprietary black box
- Hardware-based security assumes AMD is trustworthy
- No independent verification of PSP firmware

---

### Option 4: Azure Confidential VMs ❌ NOT RECOMMENDED

**Why not:**
- Uses same AMD SEV-SNP as GCP (same PSP concerns)
- Alternative: Intel SGX on DCsv3 instances (Intel ME concerns)
- Higher cost (~$380-400/month)
- More complex attestation (MAA service)
- Microsoft is a PRISM participant (NSA surveillance program)

---

## Detailed Comparison: Nitro vs SEV-SNP

| Feature | AWS Nitro (ARM) ✅ | GCP Confidential (AMD) ⚠️ |
|---------|-------------------|---------------------------|
| **CPU Architecture** | ARM Neoverse (no ME/PSP) | AMD EPYC (has PSP) |
| **Isolation Method** | Hypervisor-based | Hardware memory encryption |
| **Trust Model** | Trust AWS hypervisor | Trust AMD PSP firmware |
| **Attestation** | Nitro Card (separate HW) | AMD PSP (CPU-integrated) |
| **Open Source** | Many components public | AMD firmware closed |
| **Independent Audit** | ✅ Yes (Aug 2025) | ❌ No |
| **Network Access** | None (vsock only) | None (VM-level) |
| **NSA Backdoor Risk** | 🟢 LOW | 🟡 MEDIUM |
| **Cost (2 CPU, 4GB)** | ~$400/month | ~$350/month |
| **Free Tier** | 750 hrs/mo (t4g.small) | None |
| **Production Use** | Coinbase, banks | Google Cloud customers |

---

## Security Guarantees Comparison

### AWS Nitro Enclaves (ARM Graviton)

**What you trust:**
1. AWS Nitro Hypervisor (partially open-source, independently audited)
2. ARM CPU cores (standard Neoverse, no secret features)
3. Nitro Card hardware (generates attestation, separate from CPU)

**What you DON'T trust:**
- AWS operators (restricted API prevents access)
- Parent EC2 instance (no access to enclave memory)
- Other AWS customers (isolated by hypervisor)

**Attack surface:**
- Hypervisor vulnerabilities (tested by third-party auditors)
- Physical access to AWS datacenter (covered by SOC2/ISO27001)
- Nitro Card compromise (separate hardware, harder to attack)

### GCP Confidential Space (AMD SEV-SNP)

**What you trust:**
1. AMD PSP firmware (closed-source, proprietary)
2. AMD SEV-SNP hardware (encrypts VM memory)
3. GCP infrastructure (Google's cloud)

**What you DON'T trust:**
- GCP operators (hardware encryption prevents access)
- Google Cloud hypervisor (SEV-SNP isolates from hypervisor)
- Other GCP customers (hardware memory encryption)

**Attack surface:**
- AMD PSP backdoors (cannot verify firmware)
- SEV-SNP vulnerabilities (research shows some weaknesses)
- Physical access to GCP datacenter (covered by SOC2/ISO27001)

---

## Key Insight: Hypervisor-Based vs Hardware-Based Isolation

### Hypervisor-Based (AWS Nitro) ✅

**Philosophy:** "Don't trust the CPU manufacturer, trust the hypervisor"

**Pros:**
- Hypervisor is auditable (AWS open-sourced components)
- Independent verification possible (third-party audits)
- Not dependent on proprietary CPU features
- Works on any CPU architecture (ARM, x86, RISC-V future)

**Cons:**
- Must trust AWS hypervisor implementation
- Software vulnerabilities possible (though audited)

### Hardware-Based (AMD SEV-SNP) ⚠️

**Philosophy:** "Trust the CPU manufacturer's hardware encryption"

**Pros:**
- Memory encryption at hardware level (very fast)
- Hypervisor cannot access encrypted memory
- Strong isolation guarantees (if CPU is trustworthy)

**Cons:**
- Must trust AMD PSP firmware (closed-source)
- Cannot verify no backdoors in PSP
- Dependent on specific CPU features (vendor lock-in)
- Research shows some SEV-SNP vulnerabilities

---

## Threat Model: NSA Backdoor Scenarios

### Scenario 1: Remote Exploitation (Intel ME style)

**Intel ME:**
- ❌ **HIGH RISK** - Has network stack, remotely exploitable
- ❌ NSA could potentially access via network

**AMD PSP:**
- 🟢 **LOW RISK** - No network access, requires physical attack
- 🟢 NSA would need physical datacenter access

**AWS Nitro (ARM):**
- 🟢 **LOW RISK** - No management engine, ARM TrustZone only for boot
- 🟢 NSA would need to compromise AWS infrastructure directly

**Winner:** AWS Nitro = AMD PSP (both require physical access)

### Scenario 2: Firmware Backdoor (Undetectable)

**Intel ME:**
- ❌ **HIGH RISK** - Closed-source, no auditing possible
- ❌ NSA could embed backdoor in firmware updates

**AMD PSP:**
- ⚠️ **MEDIUM RISK** - Closed-source, no auditing possible
- ⚠️ Smaller market share = less NSA interest (speculation)

**AWS Nitro (ARM):**
- 🟢 **LOW RISK** - Open-source components, independent audits
- 🟢 Third-party verification of security claims (Aug 2025)

**Winner:** AWS Nitro (auditable, verified)

### Scenario 3: Hypervisor Compromise

**GCP Confidential Space:**
- 🟢 **LOW RISK** - SEV-SNP encrypts memory, hypervisor cannot access
- 🟢 Even if hypervisor compromised, data remains encrypted

**AWS Nitro Enclaves:**
- 🟢 **LOW RISK** - Nitro Hypervisor isolated, restricted API
- 🟢 Independent audit confirms no "root" access exists

**Winner:** TIE (both provide strong hypervisor isolation)

### Scenario 4: Physical Datacenter Access

**Both GCP and AWS:**
- ⚠️ **MEDIUM RISK** - Physical access enables hardware attacks
- ⚠️ SOC2/ISO27001 compliance limits but doesn't eliminate risk
- ⚠️ NSA could theoretically access with government pressure

**Mitigation:**
- Use multi-cloud deployment (encrypt in AWS, decrypt in GCP)
- Geographic distribution (different legal jurisdictions)
- End-to-end encryption (plaintext never leaves TEE)

**Winner:** TIE (both vulnerable to physical access)

---

## Recommendation: Switch to AWS Nitro Enclaves

### Why AWS Nitro Enclaves on ARM Graviton is the best choice:

1. **No proprietary management engines**
   - ARM architecture avoids Intel ME and AMD PSP entirely
   - No persistent, privileged firmware with full system access

2. **Auditable security model**
   - AWS open-sourced key Nitro components
   - Independent third-party audit (August 2025)
   - Restricted API verified to prevent operator access

3. **Hypervisor-based isolation (not CPU trust)**
   - Don't need to trust AMD or Intel
   - Trust AWS hypervisor (which has been audited)
   - Works on any architecture (future RISC-V migration possible)

4. **Production-proven**
   - Coinbase uses Nitro Enclaves for crypto wallets
   - Banking/healthcare compliance (PCI-DSS, HIPAA)
   - Available in all AWS regions (2025)

5. **Cost-effective**
   - ~$400/month (similar to GCP ~$350)
   - FREE tier: 750 hours/month through Dec 2025
   - No additional Nitro fees (standard EC2 pricing)

### Migration Path: GCP → AWS Nitro

**Our existing code is already cloud-agnostic!** ✅

We designed the TEE abstraction layer to support multiple providers:

```typescript
// Current: GCP provider
const manager = new TEEManager({
  gcp: { projectId: '...', region: '...' }
});

// Future: AWS provider (just change config)
const manager = new TEEManager({
  aws: { region: 'us-east-1', accountId: '...' }
});
```

**Implementation steps:**

1. ✅ **Already done:** Cloud-agnostic abstraction layer
2. 🔜 **Create AWS provider:** `src/lib/core/tee/providers/aws.ts`
3. 🔜 **Implement CBOR attestation:** Parse AWS attestation documents
4. 🔜 **Deploy to Graviton instance:** c6g.large (ARM, 2 vCPU, 4 GB)
5. 🔜 **Test end-to-end:** Browser → AWS Nitro → CWC

**Time estimate:** 1-2 days (abstraction layer makes this easy)

---

## Long-Term Vision: RISC-V Migration

**When RISC-V becomes available on cloud providers (2026-2027):**

```typescript
// Future: RISC-V provider
const manager = new TEEManager({
  riscv: { provider: 'aws', instance: 'r6r.large' }
});
```

**Why RISC-V is the ultimate goal:**
- ✅ **Open ISA** - Instruction set is public specification
- ✅ **Open-source CPUs** - Multiple auditable implementations
- ✅ **No proprietary features** - No ME, no PSP, no TrustZone
- ✅ **Immune to x86 attacks** - Different architecture = different vulnerabilities

**Keystone Enclave** (UC Berkeley) is production-ready when RISC-V cloud instances arrive.

---

## Action Items

### Immediate (This Week)

1. ✅ Research complete - AWS Nitro on ARM Graviton is the best choice
2. 🔜 Create AWS Nitro provider implementation
3. 🔜 Implement CBOR attestation document parsing
4. 🔜 Deploy test enclave on Graviton instance

### Short-Term (Week 14)

1. 🔜 Migrate from GCP Confidential Space to AWS Nitro Enclaves
2. 🔜 Update documentation with security rationale
3. 🔜 Test end-to-end encryption → TEE → CWC flow
4. 🔜 Deploy to production (c6g.large, Graviton3)

### Long-Term (2026-2027)

1. 🔮 Monitor RISC-V cloud instance availability
2. 🔮 Implement RISC-V provider when available
3. 🔮 Migrate to Keystone Enclave on RISC-V
4. 🔮 Achieve fully auditable, open-source TEE stack

---

## Conclusion

**AWS Nitro Enclaves on ARM Graviton processors** is the best choice for Communiqué's TEE infrastructure:

- ✅ **No Intel ME or AMD PSP** - ARM avoids x86 management engines
- ✅ **Independently audited** - Third-party verification (Aug 2025)
- ✅ **Production-proven** - Used by Coinbase, banks, healthcare
- ✅ **Cost-effective** - ~$400/month + FREE tier through Dec 2025
- ✅ **Already abstracted** - Our code supports multi-cloud (easy migration)

**Switching from GCP to AWS Nitro is the right security decision.** We avoid trusting AMD PSP while gaining an auditable, hypervisor-based isolation model that doesn't depend on proprietary CPU features.

**Next step:** Implement AWS Nitro provider (`src/lib/core/tee/providers/aws.ts`) and deploy to Graviton3 instance.
