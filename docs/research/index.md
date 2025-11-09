# Research Documentation

**Strategic research informing Communiqué's product direction and technical decisions.**

---

## Research Documents

### 1. [power-structures.md](power-structures.md) - All Power Structures Needing Accountability

**What it researches**: Mapping every decision-making body affecting communities (beyond just government).

**Key findings**:
- **Housing**: Private equity landlords, HOAs (62M residents), RealPage algorithmic pricing collusion
- **Workplace**: Corporate boards, gig economy platforms, worker cooperatives
- **Education**: School boards ($3.2B conflict cost), university administration bloat
- **Healthcare**: Hospital consolidation, insurance denials, pharmaceutical pricing
- **Finance**: Predatory lending, credit bureaus, debt collection

**Why important**: Expands Communiqué's vision beyond congressional advocacy to ALL power structures.

**Use case**: Product roadmap (Phase 2+), organizing infrastructure for non-government decision-makers.

---

### 2. [tee-security.md](tee-security.md) - TEE Security & Backdoor Analysis

**What it researches**: Security analysis of Trusted Execution Environment (TEE) providers.

**Key findings**:
- **Intel SGX**: Known vulnerabilities (Spectre, Foreshadow, Plundervolt), Intel ME backdoor concerns
- **AMD SEV**: Fewer known attacks, AMD PSP concerns
- **AWS Nitro (ARM)**: No Intel ME/AMD PSP, hypervisor-based isolation, independently audited

**Why important**: TEE choice affects entire message delivery privacy model.

**Decision made**: AWS Nitro Enclaves chosen (see `/docs/architecture/tee-systems.md`)

**Use case**: Security audits, threat modeling, TEE provider evaluation.

---

## Research Philosophy

**Evidence-based strategy**: Product decisions grounded in empirical research, not assumptions.

**Power analysis**: Understanding actual leverage points in systems (not just moral appeals).

**Threat modeling**: Realistic security analysis (state actors, corporate surveillance, bad actors).

**Organizing reality**: What organizing victories actually look like (rent strikes, union drives, ballot initiatives).

---

## Cross-References

**Strategic direction** → See `/docs/strategy/organizing.md` (organizing reality, class struggle infrastructure)

**TEE architecture** → See `/docs/architecture/tee-systems.md` (AWS Nitro decision)

**Congressional delivery** → See `/docs/congressional/delivery.md` (TEE implementation)

**Cypherpunk philosophy** → See `/docs/CYPHERPUNK-ARCHITECTURE.md` (McDonald 2018 research)

---

## Research Methodology

**Primary sources**: Academic papers, government reports, investigative journalism

**Empirical evidence**: Real organizing victories (KC rent strike, union win rates, ballot initiatives)

**Security analysis**: Peer-reviewed vulnerability research, independent audits, open-source code inspection

**No bullshit**: Honest assessment of what works and what doesn't (no ideological wishful thinking)

---

## For Product Team

**Understanding power structures**: power-structures.md (who actually has leverage)

**Strategic roadmap**: power-structures.md (expansion beyond Congress)

**Security decisions**: tee-security.md (why AWS Nitro over Intel SGX)

---

## For Security Engineers

**TEE threat model**: tee-security.md (known vulnerabilities, backdoor analysis)

**Architecture decisions**: See `/docs/architecture/decision-record.md` (browser-native proving)

**Deployment security**: See `/docs/development/aws-deployment.md` (AWS Nitro setup)

---

## For Organizers

**Power analysis**: power-structures.md (where to apply pressure)

**Organizing strategy**: See `/docs/strategy/organizing.md` (what actually wins)

**Infrastructure needs**: See `/docs/strategy/organizing.md` (retaliation defense, surveillance countermeasures)
