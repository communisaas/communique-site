# Progressive Onboarding - Agency-Driven Funnel

**Date**: 2025-01-08 (Updated)
**Goal**: Draw users in step-by-step, engaging their agency, minimizing friction

---

## CRITICAL DISTINCTION: Two User Flows

### Flow 1: Template Senders (General Public - No Login Required)
**Who**: Anyone who wants to send an existing template
**Journey**: Browse templates → Click "Send" → Enter address (if government) → Send
**Email lookup**: NOT USED (recipients already defined by template creator)
**Login**: NOT REQUIRED (guests can send)

### Flow 2: Template Creators (Authenticated Users - Login Required)
**Who**: Activists, organizers, campaign creators
**Journey**: Sign in → Create template → Find decision-maker emails → Publish template
**Email lookup**: REQUIRED (need to source recipient emails)
**Login**: REQUIRED (before accessing template creator)

**Key insight**: Email lookup tools (Hunter.io, Apollo.io, etc.) are for **template creators**, not senders.

---

## The Core Insight

**People don't fill forms. They take action.**

### ❌ Traditional Onboarding (High Friction):
```
[Sign up form]
Name: ____________
Email: ____________
Address: ____________
Password: ____________
[Create Account]

Then browse templates
Then maybe send
```
**Drop-off**: 80%+ at signup form

### ✅ Progressive Onboarding (Agency-Driven):

**For Senders (General Public)**:
```
See template → Click "Send" → Enter address (if government) → Send message

(Address collected only for government targets, routing already defined)
```

**For Template Creators (Authenticated)**:
```
Sign in → Create template → Find decision-makers → Publish template

(Email lookup tools used to source recipient contacts)
```

**Drop-off**: ~20% (people who engage first, commit later)

---

## Template Sender Funnel (General Public - No Login)

### Step 1: Immediate Action (No Barriers)
```
User lands on homepage
↓
Sees template: "Tell Delta Airlines to stop overbooking"
  (Recipients: customercare@delta.com, ed.bastian@delta.com)
  (Already defined by template creator)
↓
Clicks "Send Now"
↓
[Modal opens - NO signup required]
```

**Agency engaged**: They clicked. They want to send.

**NO EMAIL LOOKUP**: Recipients already defined by template creator.

---

### Step 2: Address Collection (Only if Government Target)
```
┌─────────────────────────────────────┐
│   Find who represents you           │
│                                     │
│   Your address routes your message  │
│   to the right officials.           │
│                                     │
│   Street: [________________]        │
│   City: [______] State: [__]        │
│   Zip: [_____]                      │
│                                     │
│   [Find Representatives]            │
│                                     │
│   Used once. Deleted immediately.   │
└─────────────────────────────────────┘
```

**Why address**:
- Required for congressional routing
- Census Bureau API → District lookup
- Constituent verification

**Agency engaged**: They want their specific representatives.

**NO EMAIL LOOKUP**: Census API + CWC API handle routing automatically.

---

---

## Template Creator Funnel (Authenticated Users - Login Required)

**IMPORTANT**: Email lookup is ONLY for template creators, not senders.

### Step 1: Authentication Gate
```
User wants to create template
↓
"Sign in to create a template"
↓
OAuth (Google, Twitter, etc.)
↓
Authenticated → Access template creator
```

**Why authentication first**:
- Email lookup tools cost money (per-credit APIs)
- Prevents spam/abuse
- Enables template ownership + editing
- Required for publishing

---

### Step 2: Template Creation Form
```
┌─────────────────────────────────────┐
│   Create Template                   │
│                                     │
│   Title: [________________]         │
│   Category: [________]              │
│   Message: [_____________]          │
│                                     │
│   Target type:                      │
│   ○ Congress/Government             │
│   ○ Company executives              │
│   ○ School board                    │
│   ○ City council/Municipal          │
│                                     │
│   [Next: Find Recipients]           │
└─────────────────────────────────────┘
```

**Agency engaged**: They're creating a campaign.

---

### Step 3: Decision-Maker Lookup (CREATOR-ONLY FEATURE)
```
┌─────────────────────────────────────┐
│   Find Decision-Makers              │
│                                     │
│   Who should receive this template? │
│                                     │
│   Search: [Delta Airlines_____]     │
│          (company, person, or role) │
│                                     │
│   [Search]                          │
└─────────────────────────────────────┘

Results (from Hunter.io API):
┌─────────────────────────────────────┐
│ ☑ Ed Bastian (CEO)                  │
│   ed.bastian@delta.com              │
│   ✓ 95% verified (Hunter.io)        │
│                                     │
│ ☑ Delta Customer Care               │
│   customercare@delta.com            │
│   ✓ 100% verified (Official)        │
└─────────────────────────────────────┘

[Add Selected (2)]
```

**How it works**:
- **Tier 1**: Hunter.io API (50 free searches/month, then $0.025/email)
- **Tier 2**: Apollo.io API ($59/month unlimited for creators)
- **Tier 3**: Pattern guessing (firstname.lastname@company.com)
- **Government**: Google Civic Information API (FREE)

**Agency engaged**: They're defining campaign targets.

**Cost**: Template creator pays (via platform subscription or per-template fee).

---

### Step 4: Publish Template
```
Template ready:
- Title: "Tell Delta to stop overbooking"
- Recipients: customercare@delta.com, ed.bastian@delta.com
- Type: Direct email (mailto:)

[Publish Template]
```

**Now**: Template available for **senders** (general public, no login required).

---

## The Decision-Maker Lookup Challenge (CREATOR-ONLY)

### The Problem:
**Input**: Company name, person's name, or role
**Output**: Actual email addresses

### Examples:

**Government** (Easy):
- Input: User's address
- Lookup: Census Bureau API → Congressional district → Representatives
- Output: Official contact forms (CWC API)

**Public Company Executives** (Medium):
- Input: "Tim Cook" or "Apple CEO"
- Lookup: Hunter.io API, RocketReach, LinkedIn scraping
- Output: `tim_cook@apple.com` (verified)

**School Board Members** (Hard):
- Input: Zip code + "school board"
- Lookup: Ballotpedia API, local .gov sites
- Output: `board@sfusd.edu` or individual emails

**Private Company** (Very Hard):
- Input: "Pantone" or "Pantone CEO"
- Lookup: Company website scraping, WHOIS, LinkedIn
- Output: `info@pantone.com` or `ceo@pantone.com` (unverified)

---

## The Lookup Strategy (Waterfall)

### Tier 1: Free APIs (Use First)
1. **Hunter.io** (freemium) - Email finder by company/name
2. **Clearbit** (freemium) - Company enrichment
3. **Ballotpedia** (free) - Elected officials
4. **Google Civic Information API** (free) - US representatives
5. **OpenCorporates** (free) - Company officers

### Tier 2: Web Scraping (Fallback)
1. **Company website** - "Contact" page, "About" page
2. **LinkedIn** - Executive profiles (public data)
3. **Press releases** - Often include contact emails
4. **Local .gov sites** - School boards, city councils

### Tier 3: Pattern Guessing (Last Resort)
1. **Common patterns**:
   - `firstname.lastname@company.com`
   - `firstinitial.lastname@company.com`
   - `firstname@company.com`
2. **Verify with email validation API**
3. **Show confidence score** ("80% likely valid")

---

## The Progressive Flow (Two Paths)

### Path A: Government (Address Required)

**Step 1: Engage**
```
[Template: "Tell Congress to protect net neutrality"]
[Send Now button]
```

**Step 2: Name**
```
Your name: [____________]
[Continue]
```

**Step 3: Address**
```
Find your representatives:
Street: [____________]
City: [______] State: [__] Zip: [_____]
[Find Representatives]
```

**Step 4: Confirm & Send**
```
✓ Found your representatives:
• Sen. Dianne Feinstein
• Sen. Alex Padilla
• Rep. Nancy Pelosi

[Send Message]
```

---

### Path B: Public Email (Name + Lookup)

**Step 1: Engage**
```
[Template: "Tell Apple to allow sideloading"]
[Send Now button]
```

**Step 2: Name**
```
Your name: [____________]
[Continue]
```

**Step 3: Lookup & Select**
```
Finding Apple decision-makers...

[Search results - API lookup]

Who should receive this?
☑ Tim Cook (CEO)
☑ Craig Federighi (SVP, Software Engineering)
☐ Phil Schiller (Fellow, Marketing)

[Send to Selected (2)]
```

**Step 4: Message Preview & Send**
```
Your message to Apple:

From: [Your Name]
To: Tim Cook, Craig Federighi

[Message preview]

Send from:
○ Your email (connect Gmail/Outlook)
○ Anonymous (via our relay)

[Send Message]
```

---

## The Lookup UI Components

### Component 1: DecisionMakerSearch.svelte

```svelte
<script lang="ts">
  let query = $state('');
  let results = $state([]);
  let loading = $state(false);

  async function searchDecisionMakers() {
    loading = true;
    // API call to lookup service
    results = await fetch(`/api/decision-makers/search?q=${query}`).then(r => r.json());
    loading = false;
  }
</script>

<div>
  <input
    type="text"
    bind:value={query}
    placeholder="Company name or person (e.g., 'Tim Cook' or 'Apple CEO')"
    onkeydown={(e) => e.key === 'Enter' && searchDecisionMakers()}
  />

  {#if loading}
    <div class="loading">Finding decision-makers...</div>
  {/if}

  {#if results.length > 0}
    <div class="results">
      <p class="heading">Who should receive this?</p>
      {#each results as person}
        <label class="person-option">
          <input type="checkbox" bind:checked={person.selected} />
          <div>
            <p class="name">{person.name}</p>
            <p class="role">{person.role}, {person.company}</p>
            <p class="email">{person.email}</p>
            {#if person.confidence < 80}
              <p class="confidence">~{person.confidence}% verified</p>
            {/if}
          </div>
        </label>
      {/each}
    </div>
  {/if}

  <button onclick={sendToSelected}>
    Send to Selected ({results.filter(p => p.selected).length})
  </button>
</div>
```

---

### Component 2: AddressOrLookup.svelte (Smart Router)

```svelte
<script lang="ts">
  let { template } = $props();

  // Decide which path based on template metadata
  const requiresAddress = template.deliveryMethod === 'cwc' || template.targetType === 'government';
</script>

{#if requiresAddress}
  <!-- Path A: Government (address required) -->
  <AddressCollectionModal {template} />
{:else}
  <!-- Path B: Public Email (lookup) -->
  <DecisionMakerSearch {template} />
{/if}
```

---

## The Lookup API (Backend)

### Endpoint: `/api/decision-makers/search`

**Input**:
```json
{
  "query": "Tim Cook",
  "context": "Apple CEO",
  "type": "executive" // or "school_board", "local_official"
}
```

**Waterfall Logic**:
```typescript
async function findDecisionMakers(query: string, context?: string) {
  // Tier 1: Try Hunter.io
  const hunterResults = await hunterAPI.search(query, context);
  if (hunterResults.length > 0 && hunterResults[0].confidence > 80) {
    return hunterResults;
  }

  // Tier 2: Try Clearbit
  const clearbitResults = await clearbitAPI.search(query);
  if (clearbitResults.length > 0) {
    return clearbitResults;
  }

  // Tier 3: Web scraping
  const scrapedResults = await scrapeCompanyWebsite(context);
  if (scrapedResults.length > 0) {
    return scrapedResults;
  }

  // Tier 4: Pattern guessing
  const guessedEmails = guessEmailPattern(query, context);
  return guessedEmails.map(email => ({
    email,
    confidence: 50, // Low confidence
    verification: 'pattern-guessed'
  }));
}
```

**Output**:
```json
[
  {
    "name": "Tim Cook",
    "role": "CEO",
    "company": "Apple Inc.",
    "email": "tcook@apple.com",
    "confidence": 95,
    "source": "hunter.io",
    "verified": true
  },
  {
    "name": "Craig Federighi",
    "role": "SVP, Software Engineering",
    "company": "Apple Inc.",
    "email": "federighi@apple.com",
    "confidence": 85,
    "source": "clearbit",
    "verified": true
  }
]
```

---

## Free APIs for Lookup

### 1. Hunter.io (Email Finder)
- **Free tier**: 50 searches/month
- **API**: `https://api.hunter.io/v2/email-finder?domain=apple.com&first_name=tim&last_name=cook`
- **Returns**: Email + confidence score

### 2. Clearbit (Company Enrichment)
- **Free tier**: 1000 requests/month
- **API**: `https://company.clearbit.com/v2/companies/find?domain=apple.com`
- **Returns**: Company officers + emails

### 3. Google Civic Information API
- **Free**: Unlimited
- **API**: `https://civicinfo.googleapis.com/civicinfo/v2/representatives?address=...`
- **Returns**: Elected officials + contact info

### 4. Ballotpedia API (Elected Officials)
- **Free**: Public data
- **API**: Web scraping (no official API, but scrapable)
- **Returns**: School boards, city councils, etc.

### 5. OpenCorporates (Company Officers)
- **Free tier**: 500 requests/day
- **API**: `https://api.opencorporates.com/v0.4/companies/us_ca/...`
- **Returns**: Corporate officers (but rarely emails)

---

## The Interesting Challenges

### Challenge 1: School Board Emails
**Input**: User's zip code + "school board"
**Difficulty**: No centralized API

**Solution**:
1. Zip → School district (NCES database - free)
2. District → School board website (Google search)
3. Website → Scrape board member emails
4. Cache results (update monthly)

### Challenge 2: Private Company Executives
**Input**: "Pantone CEO"
**Difficulty**: Private companies hide contact info

**Solution**:
1. Company website → "About" page scraping
2. LinkedIn → Executive profiles (public data)
3. Press releases → Often include PR contact
4. Pattern guessing + verification
5. Fallback: `info@pantone.com` (always exists)

### Challenge 3: Local Officials (City Council, HOA)
**Input**: User's address + "city council"
**Difficulty**: Hyper-local, no APIs

**Solution**:
1. Address → City/County (Census Bureau)
2. City → Official website (Google)
3. Website → Council member directory
4. Scrape emails + cache
5. Show confidence score

---

## The User Experience (Full Flow)

### Example 1: Sending to Congress

```
[Homepage: Template "Protect Net Neutrality"]
↓
Click "Send Now"
↓
[Modal] Your name: Alice Johnson [Continue]
↓
[Modal] Find your representatives:
        123 Main St, San Francisco, CA 94102
        [Find Representatives]
↓
[Modal] ✓ Found:
        • Sen. Dianne Feinstein
        • Sen. Alex Padilla
        • Rep. Nancy Pelosi
        [Send Message]
↓
[Success] Message sent! Join 247 others who sent this today.
```

### Example 2: Sending to Apple

```
[Homepage: Template "Allow iPhone Sideloading"]
↓
Click "Send Now"
↓
[Modal] Your name: Bob Smith [Continue]
↓
[Modal] Finding Apple decision-makers...

        Who should receive this?
        ☑ Tim Cook (CEO) - tcook@apple.com
        ☑ Craig Federighi (SVP) - federighi@apple.com
        ☐ Phil Schiller (Fellow) - schiller@apple.com

        [Send to Selected (2)]
↓
[Modal] Send from:
        ○ Your email (connect Gmail)
        ○ Anonymous relay

        [Send Message]
↓
[Success] Opening your email client...
          (We'll verify you sent it)
```

### Example 3: Sending to School Board

```
[Homepage: Template "Increase Teacher Pay"]
↓
Click "Send Now"
↓
[Modal] Your name: Carol Davis [Continue]
↓
[Modal] Your zip code: 94102
        [Find School Board]
↓
[Modal] ✓ Found: San Francisco Unified School Board

        Board members:
        ☑ Jenny Lam (President)
        ☑ Kevine Boggess (VP)
        ☑ All 7 board members

        [Send to Selected]
↓
[Success] Message sent to SF school board!
          Join 89 others in your district.
```

---

## Implementation Priority

### Phase 1 (This Week): Government Path
1. ✅ Address collection (already built)
2. ✅ Census API → Congressional district
3. ✅ CWC API delivery
4. ⬜ Progressive onboarding (name first, address second)

### Phase 2 (Next Week): Public Email Path + Lookup
1. ✅ DecisionMakerSearch component (`src/lib/components/decision-maker/DecisionMakerSearch.svelte`)
2. ✅ Hunter.io API integration (`src/routes/api/decision-makers/search/+server.ts`)
3. ✅ Clearbit API fallback (in waterfall logic)
4. ✅ Email pattern guessing (fallback tier)
5. ✅ Confidence scoring (display in UI)
6. ✅ AddressOrLookup router (`src/lib/components/decision-maker/AddressOrLookup.svelte`)

**Next Steps**:
- Add environment variables: `HUNTER_IO_API_KEY`, `CLEARBIT_API_KEY` (optional)
- Integrate AddressOrLookup into TemplateModal flow
- Add name collection step before routing
- Test waterfall lookup with real APIs

### Phase 3 (Week 3): School Board / Local
1. ⬜ Zip → School district lookup
2. ⬜ Web scraping (board member emails)
3. ⬜ Caching layer (monthly updates)
4. ⬜ Local officials (city council, county supervisors)

### Phase 4 (Week 4): Private Companies
1. ⬜ Company website scraping
2. ⬜ LinkedIn public data extraction
3. ⬜ Press release parsing
4. ⬜ Info@ fallback emails

---

## The Bottom Line

**Progressive onboarding**:
1. Engage first (click "Send")
2. Minimal input (name only)
3. Context-aware collection (address OR lookup)
4. Agency at every step (they choose, they send)

**Lookup strategy**:
1. Free APIs first (Hunter.io, Clearbit, Google Civic)
2. Web scraping second (company sites, LinkedIn)
3. Pattern guessing last (with confidence scores)
4. Always show verification status

**Two paths**:
- **Government** → Name → Address → Auto-send
- **Public Email** → Name → Lookup → User sends (OAuth verification)

**Next**: Build DecisionMakerSearch component + Hunter.io integration
