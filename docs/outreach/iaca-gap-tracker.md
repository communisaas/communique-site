# IACA Gap State Tracker

Last updated: 2026-03-05
Current coverage: 15 states/territories (AK, AZ, CA, CO, GA, HI, IL, MD, MT, ND, NM, OH, PR, UT, VA)
Pending: WV (cipher downloading cert — will bring total to 16)
Gap: 6 IDEMIA-vendor states (AR, DE, IA, KY, NY, WV)

---

## Status Table

| State | Pop (M) | Vendor | Status | Action | Contact | Next Step |
|-------|---------|--------|--------|--------|---------|-----------:|
| NY | 20.2 | IDEMIA | DRAFT READY | IDEMIA portal preferred | dmv.ny.gov/contact-us (form only) | Register IDEMIA Experience Portal |
| KY | 4.5 | IDEMIA | DRAFT READY | Email/contact form | drive.ky.gov contact page | Submit via form |
| IA | 3.2 | IDEMIA | DRAFT READY | Email outreach | OMV@iowadot.us | Send email |
| AR | 3.0 | IDEMIA | DRAFT READY | Email outreach | info.dfa@dfa.arkansas.gov | Send email |
| WV | 1.8 | IDEMIA | **IN PROGRESS** | Direct .gov download | transportation.wv.gov/DMV/MiD | cipher downloading "WV mID Root.zip" |
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
- **Signup:** [experience.idemia.com/auth/signup](https://experience.idemia.com/auth/signup/) (free trial)
- **Process:** Register → IDEMIA contacts within 24h → approve trial → SDK access with IACA certs
- **Formats:** `.pem`, `.crt`, `.der` — all supported
- **Coverage:** All IDEMIA-backed states (NY, KY, IA, AR, DE, WV, plus MT, AK, PR already covered via VICAL)
- **Contact (alternative):** MobileIDHelp@us.idemia.com (technical), info@ps-idemia.com (general)

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

3. **Register for IDEMIA Experience Portal** — [experience.idemia.com/auth/signup](https://experience.idemia.com/auth/signup/)
   - This is the single action most likely to resolve all 5 remaining gaps
   - Use project email, select "Relying Party" role
   - IDEMIA contacts within 24h to approve trial

### On Completion (cipher)

4. **Merge WV cert** — cipher is downloading "WV mID Root.zip" from transportation.wv.gov/DMV/MiD. Once parsed and added to `iaca-roots.ts`, coverage goes to 16.

### Follow-up (2 weeks)

5. **Check for email responses** — re-send if no reply after 14 days
6. **Check IDEMIA portal** — if approved, extract IACA certs for all gap states
7. **Re-parse VICAL** — check if any IDEMIA states were added in the quarterly update

---

## Coverage Impact

| Scenario | States Covered | US Pop Coverage (est.) |
|----------|---------------|----------------------|
| Current (15 states) | AK, AZ, CA, CO, GA, HI, IL, MD, MT, ND, NM, OH, PR, UT, VA | ~42% |
| +WV (in progress) | +WV | ~43% |
| +IDEMIA portal (all 5) | +AR, DE, IA, KY, NY | ~52% |
| +NY alone | +NY | ~49% |

New York alone adds ~6 percentage points of US population coverage.

---

## Notes

- **All 6 gap states use IDEMIA** as their mDL vendor. This is not coincidental — IDEMIA does not publish to the AAMVA VICAL, creating a distribution gap for independent relying parties.
- **Delaware adopter program:** DE has a Google Form for business Mobile ID adoption ([forms.gle/1HEDdrparqV1di9w9](https://forms.gle/1HEDdrparqV1di9w9)). Could be useful as an alternative entry point.
- **Kentucky launched Jan 2026** — newest program in the gap. May not have established IACA distribution processes yet.
- **VICAL is Thales-only today:** The 10 states currently in VICAL all use Thales (formerly Gemalto) as their vendor. The IDEMIA/VICAL gap appears structural, not temporary.
