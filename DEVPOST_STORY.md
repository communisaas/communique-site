# Communiqué: Social Coordination Against Decision-Makers

## What we built

Multi-agent AI pipeline for coordinating action against any power structure. Three AI models vote on message quality. Research-backed citations in every message. Agent-resolved decision-makers—CEO, school board, city council, Congress.

**The flow:**
1. Write your issue → Agent finds who controls this (10-20s research across corporate, government, institutional targets)
2. Agent crafts message with citations from journalism, research, legal, advocacy sources (15-30s)
3. Send directly via email or (soon) encrypted delivery to congressional offices
4. On-chain reputation earned for verified delivery

**What makes this different:**
- No spam. 3-agent consensus (OpenAI, Gemini, Claude) filters quality.
- No copy-paste templates. Citations show you did your homework.
- No single-target limitation. Hit Congress, CEOs, school boards, labor unions, advocacy orgs.
- No black box. Research log shows exactly how the message was built.

**Coming soon:** Zero-knowledge residency verification. Encrypted delivery to 535 congressional offices via AWS Nitro Enclaves. Protecting people from getting subpoenaed. From unionization retaliation. From brash court cases targeting communities and what they stand for.

Built on SvelteKit 5, Halo2 zero-knowledge proofs (ready to deploy), Scroll zkEVM.

## Why this matters

Decision-makers can't hear you. Not because they don't care—because they can't separate signal from noise.

66% of constituent emails dismissed as spam (McDonald 2018). Corporate inboxes flooded with template campaigns. School boards ignoring form letters. Quality signals buried.

We're not solving money in politics. We're not solving decision-makers who genuinely don't care.

We're solving verification and credibility at scale. Research-backed messages with provable sources. Agent-filtered quality. Multi-stakeholder coordination.

Remove the excuse that they can't find legitimate voices in the noise.

## The technical gamble

**Challenge 1: Multi-stakeholder decision-maker resolution**
- Agent needs to find who controls this across government, corporate, institutional, labor, advocacy.
- School board presidents. Corporate executives. Union leadership. Congressional offices. City councils.
- 10-20s research per issue. Cross-reference authority, verify contact paths.
- Bet: AI can navigate power structures faster than humans researching manually.

**Challenge 2: Multi-agent consensus without censorship**
- 3 AI models vote on message quality. 2/3 threshold for approval.
- LangGraph orchestration. TypeScript coordination layer.
- Filtering spam vs. silencing dissent is a razor's edge.
- Bet: Agent disagreement reveals edge cases. Transparency in research logs builds trust.

**Challenge 3: Zero-knowledge proving in browser (coming soon)**
- Halo2 circuits. 4,096 Merkle tree leaves per district.
- WASM prover runs client-side. 2-5 seconds on desktop, longer on mobile.
- Bet: Users will wait if they understand why (residency verification without exposing address).
- **Use case:** Protecting union organizers. Activists in states with hostile governments. Communities fighting legal battles.

**Challenge 4: Encrypted delivery through TEE (coming soon)**
- Address encrypted XChaCha20-Poly1305 in browser.
- AWS Nitro Enclave decrypts in hardware isolation.
- Congressional office API called inside TEE. Address destroyed after delivery.
- Bet: Hardware isolation is the only honest way to handle PII at scale when the stakes are subpoenas and retaliation.

## What we shipped (72 hours)

**Working right now:**
- Template creator with 3 agentic steps (objective → decision-makers → message)
- Multi-agent content moderation (3-model voting consensus)
- Decision-maker resolution across all target types (government, corporate, institutional, labor, advocacy)
- Research-backed message generation with inline citations [1][2][3]
- 15-30s waiting experiences that educate instead of frustrate
- Research log showing agent's reasoning (no black box)
- Progressive disclosure: compact cards → expanded details → full provenance
- Database privacy architecture (pseudonymous IDs, no PII tracked)
- Direct email delivery to any decision-maker

**Coming soon (Phase 2):**
- Identity verification (self.xyz NFC passport + Didit.me fallback)
- Browser-native Halo2 proving (600ms-10s ZK proof generation)
- Encrypted congressional delivery via AWS Nitro Enclaves
- On-chain reputation tracking (ERC-8004 on Scroll zkEVM)
- Address protection for union organizers, activists, community groups facing legal retaliation

## The cost breakthrough

**Before:** OpenAI GPT-4o for credential verification. $682.50/month.
**After:** Gemini 2.5 Flash FREE tier. $0/month.
**Savings:** $8,190/year.

**Before:** Postgres encrypted blob storage. $500/month for 100K users.
**After (Phase 2):** IPFS pinning + on-chain pointers. $10 one-time for 100K users.
**Savings:** 99.97% reduction over 5 years ($30,000 → $10).

## The architecture decision

**Communiqué** (this repo): UI/UX, OAuth, template creation, congressional office lookup.
**voter-protocol** (sibling repo): Cryptography, TEE, blockchain, ZK circuits, reputation.

Clear separation. Frontend doesn't touch cryptographic primitives. Backend doesn't touch UI state.

## What we learned building this

**User control beats perfect AI:**
- Let users edit AI-generated messages. Keep citations.
- "Start fresh" button resets to original. User agency matters.
- Edit mode shows citations in monospace—preserve the [1][2][3] links.

**Waiting experiences can educate:**
- 15-30s agent research feels fast when you explain what's happening.
- Phase cycling: "Researching legislative context" → "Finding credible sources" → "Crafting persuasive message"
- Educational context: "Generic templates get ignored. This is strategic civic action."

**Progressive disclosure builds trust:**
- Level 1: Compact card (name, title, organization)
- Level 2: Reasoning ("Why this person matters")
- Level 3: Full provenance (source URLs, verification trail)
- Users drill down when they care, skip when they don't.

**Citations aren't decoration:**
- Decision-makers see hundreds of messages. Citations prove homework.
- Make them clickable. Scroll to source. Highlight on interaction.
- Research log shows agent's process—no black box.

## The reality-based claim

Decision-makers want to hear from credible voices with expertise. They can't find you in spam.

We're building multi-agent research + cryptographic verification + multi-stakeholder delivery.

**Congress, CEOs, school boards, union leadership, advocacy organizations.**

What they do with verified, research-backed messages is their choice.

But we're removing the excuse that they can't separate signal from noise.

**Soon:** Zero-knowledge proofs protect address privacy. Encrypted delivery to congressional offices protects people from subpoenas. From employer retaliation. From hostile state governments targeting activists. From legal discovery in brash court cases.

**Right now:** Research-backed messages with provable sources. Agent-filtered quality. Direct delivery to any decision-maker.

**One bottleneck removed. Many remain.**

---

Built with SvelteKit 5, Toolhouse AI agents, Halo2 (ready to deploy), AWS Nitro Enclaves (ready to deploy), Scroll zkEVM.

Open source. Cypherpunk architecture. Privacy by design, not by policy.
