# IACA Gap State Tracker

Last updated: 2026-03-05
Current coverage: 16 states/territories (AK, AZ, CA, CO, GA, HI, IL, MD, MT, ND, NM, OH, PR, UT, VA, WV)
Gap: 5 IDEMIA-vendor states (AR, DE, IA, KY, NY)
IDEMIA portal: account created, awaiting approval

---

## Status Table

| State | Pop (M) | Vendor | Status | Action | Contact | Next Step |
|-------|---------|--------|--------|--------|---------|-----------:|
| NY | 20.2 | IDEMIA | BLOCKED ON IDEMIA | IDEMIA portal (preferred) | dmv.ny.gov/contact-us (form only) | Awaiting IDEMIA portal approval |
| KY | 4.5 | IDEMIA | BLOCKED ON IDEMIA | IDEMIA portal or contact form | drive.ky.gov contact page | Awaiting IDEMIA portal approval |
| IA | 3.2 | IDEMIA | DRAFT READY | Email outreach | OMV@iowadot.us | Send email |
| AR | 3.0 | IDEMIA | DRAFT READY | Email outreach | info.dfa@dfa.arkansas.gov | Send email |
| WV | 1.8 | IDEMIA | **DONE** | Direct .gov download | transportation.wv.gov/DMV/MiD | Merged — commit 1910f1bd |
| DE | 1.0 | IDEMIA | DRAFT READY | Email outreach | DMVCustomerService@delaware.gov | Send email |

Sorted by population (descending) — NY is the highest-impact gap.

---

## Parallel Strategies

### Strategy 1: Direct State Outreach
Email drafts are ready in [`docs/outreach/iaca-request-emails.md`](./iaca-request-emails.md).

**Email-ready (3 states):**
- AR → info.dfa@dfa.arkansas.gov
- IA → OMV@iowadot.us
- DE → DMVCustomerService@delaware.gov

**Contact-form-only (2 states):**
- KY → [drive.ky.gov/Pages/Contact-Us.aspx](https://drive.ky.gov/Pages/Contact-Us.aspx) (no public email)
- NY → [dmv.ny.gov/contact-us](https://dmv.ny.gov/contact-us) (form only; NY explicitly does not provide verification tools — delegates to IDEMIA)

**Expected response time:** 1-3 weeks. State DMVs route technical requests internally; follow up after 2 weeks if no response.

### Strategy 2: IDEMIA Experience Portal (resolves ALL 5 remaining)
The single highest-leverage action. IDEMIA bundles IACA certs for all their states in the Verify SDK.

- **Portal:** [experience.idemia.com](https://experience.idemia.com/)
- **Status:** Account created 2026-03-05. **Awaiting IDEMIA approval.**
- **Navigate (once approved):** Mobile ID → Develop → Verify SDKs → download SDK → extract Production IACA certs
- **Formats:** `.pem`, `.crt`, `.der` — all supported by our trust store
- **Coverage:** All IDEMIA-backed states (NY, KY, IA, AR, DE, plus WV already done via .gov)
- **Cost:** Free evaluation tier is sufficient. We only need the certificate files, not the SDK itself.
- **Contact (if approval stalls):** MobileIDHelp@us.idemia.com (technical), info@ps-idemia.com (general)

**Why this is the best path for NY:** New York (20.2M pop) explicitly delegates all verification to IDEMIA. The state DMV will not provide certs directly. The IDEMIA portal is the intended acquisition channel.

### Strategy 3: AAMVA VICAL Monitoring (zero-effort long-term)
The runtime `vical-service.ts` + `parse-vical.ts` pipeline auto-ingests any state that starts publishing to VICAL.

- **Current VICAL (2026-03-05):** 10 issuers, all Thales-vendor states
- **IDEMIA states in VICAL:** 0 of 6 — confirmed by cipher's parse
- **If IDEMIA pushes to VICAL:** Zero code changes needed. The parser handles it automatically.
- **Likelihood:** Low near-term (IDEMIA has not historically published to VICAL), but worth monitoring quarterly

---

## Human Actions Required

### Immediate (this week)

1. **Send 3 outreach emails** — copy drafts from `iaca-request-emails.md`:
   - AR → info.dfa@dfa.arkansas.gov
   - IA → OMV@iowadot.us
   - DE → DMVCustomerService@delaware.gov

2. **Submit 2 contact forms** — adapt email draft text:
   - KY → [drive.ky.gov/Pages/Contact-Us.aspx](https://drive.ky.gov/Pages/Contact-Us.aspx)
   - NY → [dmv.ny.gov/contact-us](https://dmv.ny.gov/contact-us)

3. ~~**Register for IDEMIA Experience Portal**~~ — **DONE** (2026-03-05)
   - Account created at experience.idemia.com
   - Awaiting IDEMIA approval to access Verify SDK + IACA certs
   - Once approved: Mobile ID → Develop → Verify SDKs → download → extract Production certs
   - If no approval within 48h, email MobileIDHelp@us.idemia.com

### Completed

4. ~~**Merge WV cert**~~ — **DONE** (2026-03-05, commit 1910f1bd)
   - WV IACA root added to iaca-roots.ts (P-256, expires 2033-12-09)
   - First IDEMIA-vendor state in trust store. Coverage: 16 states.

### Follow-up (2 weeks)

5. **Check for email responses** — re-send if no reply after 14 days
6. **Check IDEMIA portal** — if approved, extract IACA certs for all gap states
7. **Re-parse VICAL** — check if any IDEMIA states were added in the quarterly update

---

## Coverage Impact

| Scenario | States Covered | US Pop Coverage (est.) |
|----------|---------------|----------------------|
| Current (16 states) | AK, AZ, CA, CO, GA, HI, IL, MD, MT, ND, NM, OH, PR, UT, VA, WV | ~43% |
| +IDEMIA portal (all 5) | +AR, DE, IA, KY, NY | ~52% |
| +NY alone | +NY | ~49% |

New York alone adds ~6 percentage points of US population coverage.

---

## Notes

- **All 6 gap states use IDEMIA** as their mDL vendor. This is not coincidental — IDEMIA does not publish to the AAMVA VICAL, creating a distribution gap for independent relying parties.
- **Delaware adopter program:** DE has a Google Form for business Mobile ID adoption ([forms.gle/1HEDdrparqV1di9w9](https://forms.gle/1HEDdrparqV1di9w9)). Could be useful as an alternative entry point.
- **Kentucky launched Jan 2026** — newest program in the gap. May not have established IACA distribution processes yet.
- **VICAL is Thales-only today:** The 10 states currently in VICAL all use Thales (formerly Gemalto) as their vendor. The IDEMIA/VICAL gap appears structural, not temporary.
