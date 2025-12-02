# ZKP & Encryption UX: The "Digital Faraday Cage"

**Objective:** Design a client-side Zero-Knowledge Proof (ZKP) and Encryption flow that feels secure, tangible, and valuable, without using Web3 jargon.

**Philosophy:** "Pragmatic Cypherpunk" — High-tech privacy that feels like a physical tool, not a math problem.

---

## 1. The Core Metaphor: "The Secure Envelope"

We are not "generating a proof" or "hashing a commitment."
We are **sealing an envelope**.

*   **The Message:** The letter inside.
*   **The Encryption:** The lead lining of the envelope (only the recipient can open it).
*   **The ZK Proof:** The wax seal on the outside (proves it's authentic without revealing the sender).

## 2. Perceptual Engineering Stages

The process takes time (600ms - 10s). We must fill this time with *meaning*, not just a spinner.

### Stage 1: The "Hum" (Proof Generation)
*   **Technical:** WASM Prover running in a Web Worker. High CPU usage.
*   **Visual:** The "Send" button expands into a status bar. A complex, organic pattern (like a Voronoi diagram or a noise field) iterates and resolves. It looks like "computation" or "thinking," not "loading."
*   **Haptic (Mobile):** A low-frequency, steady vibration (if supported) or a rhythmic visual pulse.
*   **Copy:** "Verifying eligibility..." -> "Anonymizing identity..."
*   **Why:** Tells the user "Your device is doing work to protect you."

### Stage 2: The "Snap" (Encryption)
*   **Technical:** XChaCha20-Poly1305 encryption of the message blob. Fast (<100ms).
*   **Visual:** The organic pattern "crystallizes" or "locks" into a solid, geometric shape (e.g., a shield or a closed lock). A sharp, satisfying animation.
*   **Sound (Optional):** A subtle "click" or "snap" sound.
*   **Copy:** "Message sealed."
*   **Why:** Visually confirms that the content is now unreadable to anyone but the recipient.

### Stage 3: The "Slide" (Transmission)
*   **Technical:** HTTP POST to backend.
*   **Visual:** The sealed geometric shape slides off-screen (upwards or to the right), leaving a clean "Sent" state.
*   **Copy:** "Delivered to [Representative Name]."

---

## 3. Technical Implementation Strategy

### The "Shadow Worker"
To ensure the UI remains buttery smooth (60fps) while the CPU crunches the ZK proof, we **MUST** use a Web Worker.

*   **Main Thread:** Handles animations, UI updates, and the "Fluid Fill" effects.
*   **Worker Thread:** Loads the WASM, computes the witness, generates the proof.
*   **Communication:**
    *   Main -> Worker: `START_PROOF { inputs }`
    *   Worker -> Main: `PROGRESS { step: 'witness', percent: 20 }`
    *   Worker -> Main: `PROGRESS { step: 'proving', percent: 60 }`
    *   Worker -> Main: `COMPLETE { proof, publicSignals }`

### Conflict Avoidance
We encrypt *while* we prove, or immediately after, depending on CPU contention.
Since encryption is fast, we can do it on the Main Thread or Worker. Doing it in the Worker keeps the Main Thread purely for rendering.

**Sequence:**
1.  **User Clicks Send.**
2.  **UI:** Starts "The Hum" animation.
3.  **Worker:** Starts Proof Generation (Heavy).
4.  **Worker:** *Parallel* - Encrypts Message (Light).
5.  **Worker:** Finishes Proof.
6.  **UI:** Triggers "The Snap" (Encryption visualization).
7.  **Network:** Sends payload.

---

## 4. Copy Dictionary (Jargon vs. Intuition)

| Web3 / Tech Jargon | Our UI Copy |
| :--- | :--- |
| **Zero-Knowledge Proof** | **Anonymous Verification** |
| **Generate Witness** | **Checking Eligibility** |
| **Circuit Constraint** | **Security Check** |
| **Merkle Root** | **District Registry** |
| **Gas / Transaction** | **Delivery** |
| **Wallet / Signer** | **Your Device** |
| **Hash** | **Digital Fingerprint** |
| **Encrypt** | **Seal** |

---

## 5. Error Handling (The "Jam")

If the proof fails (e.g., invalid inputs) or takes too long:
*   **Visual:** The organic pattern turns "dissonant" (red/orange tint, jagged edges) and fades out.
*   **Copy:** "Could not seal message."
*   **Action:** "Retry" button appears. *Never* show a raw stack trace.

## 6. Accessibility
*   **Screen Readers:** Announce status changes ("Anonymizing...", "Sealed", "Sent").
## 7. Architectural Decisions (The "Why")

### What are we encrypting?
We encrypt **Personally Identifiable Information (PII)**: Name, Email, Physical Address.
*   **Congressional Delivery:** The *recipient* (Congress) mandates PII. The *platform* (Communique) must not see it. We encrypt to the TEE's public key.
*   **Direct Delivery:** The user chooses.

### Must we run the prover every time?
**Yes, for maximum privacy.**
*   **Unlinkability:** Each proof uses a unique `nullifier = hash(identity, action_id)`. If we reused a "session proof", all your actions would be linkable to that session.
*   **Performance:** The WASM prover takes ~600ms-10s. This is acceptable for high-value actions (sending a letter), especially with "Perceptual Engineering" to fill the time.

### Is the Merkle Tree necessary?
**Yes.** It provides the **Anonymity Set**.
*   It allows you to prove "I am one of the 700,000 people in this district" without revealing *which* one.
*   Without it, you'd have to reveal your identity to prove eligibility.

---

## 8. Selective Disclosure (The "Slider")

For direct messages (e.g., to a CEO or public board), the user controls how much they reveal.

**UI Component:** "Signature Level"
*   **Level 1: "Anonymous Verified"** (Default)
    *   *Reveals:* "Verified Constituent of [District]"
    *   *Proof:* ZK Proof only.
    *   *Data:* No PII sent.
*   **Level 2: "Verified Resident"**
    *   *Reveals:* "Verified Resident of [City, State]"
    *   *Proof:* ZK Proof + City/State.
*   **Level 3: "Full Identity"**
    *   *Reveals:* "Jane Doe, 123 Maple St" + Verified Badge
    *   *Proof:* ZK Proof + Encrypted PII (for recipient).

**Visual:** A slider or card selector that "unblurs" fields as you move up levels.
*   Level 1: Name is blurred, "Verified" badge glows.
*   Level 3: Name is clear, "Verified" badge glows.

---

## 9. Voter Protocol Integration
*   **Circuits:** We use the existing `voter-protocol` K=14 circuits.
*   **Changes:** No circuit changes needed. The "Action ID" input allows us to contextualize proofs (e.g., Action 42 = "Send Template X").
*   **Client:** We need to build the `prover-client.ts` wrapper to handle the WASM loading and "Shadow Worker" orchestration.
