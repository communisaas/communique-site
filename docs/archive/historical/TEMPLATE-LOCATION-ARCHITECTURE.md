# Template Location Architecture: Making Semantic Discovery Possible

**Problem:** Templates don't currently store structured location data that enables:
1. Privacy-preserving semantic search
2. VPN-resistant location matching
3. Client-side filtering by user's actual jurisdiction
4. Network effects ("your neighbors are working on this")

**Root Issue:** Current schema stores location as unstructured string arrays, making contextual discovery impossible.

---

## Current Schema (Inadequate)

```prisma
model Template {
  // Geographic scope (TOO SIMPLE)
  applicable_countries      String[]   @default([])
  jurisdiction_level        String?    // "federal" | "state" | "city" (unstructured)
  specific_locations        String[]   @default([]) // ["Austin, TX", "Travis County"] (unparseable)

  // Missing entirely:
  // - No structured congressional districts
  // - No state legislative districts
  // - No county/city identifiers
  // - No embeddings for semantic location matching
  // - No geospatial data for proximity search
}
```

---

## Required Schema: Structured Jurisdictions

### 1. **Jurisdictions Junction Table** (Many-to-Many)

Templates apply to MULTIPLE jurisdictions (federal bill affects all states, city ordinance affects one city):

```prisma
model TemplateJurisdiction {
  id                String    @id @default(cuid())
  template_id       String    @map("template_id")

  // Jurisdiction identification (structured)
  jurisdiction_type String    @map("jurisdiction_type") // 'federal' | 'state' | 'county' | 'city' | 'school_district'

  // Federal
  congressional_district String? @map("congressional_district") // "TX-18", "CA-12"
  senate_class           String? @map("senate_class") // "class-1", "class-2", "class-3" (for US Senate)

  // State
  state_code             String? @map("state_code") // "TX", "CA" (ISO 3166-2)
  state_senate_district  String? @map("state_senate_district") // "SD-14"
  state_house_district   String? @map("state_house_district") // "HD-47"

  // County
  county_fips            String? @map("county_fips") // "48453" (Travis County, TX)
  county_name            String? @map("county_name") // "Travis County"

  // City
  city_name              String? @map("city_name") // "Austin"
  city_fips              String? @map("city_fips") // Census place code

  // School District
  school_district_id     String? @map("school_district_id")
  school_district_name   String? @map("school_district_name")

  // Geospatial (for proximity matching)
  latitude               Float?  // Center point
  longitude              Float?

  // Relations
  template               Template @relation(fields: [template_id], references: [id], onDelete: Cascade)

  @@unique([template_id, jurisdiction_type, congressional_district, state_code, county_fips, city_fips])
  @@index([congressional_district])
  @@index([state_code, state_senate_district])
  @@index([county_fips])
  @@index([city_fips])
  @@map("template_jurisdiction")
}
```

### 2. **Template Model Updates**

Add semantic embeddings and remove redundant string arrays:

```prisma
model Template {
  // REMOVE (replaced by TemplateJurisdiction):
  // applicable_countries      String[]   @default([])
  // jurisdiction_level        String?
  // specific_locations        String[]   @default([])

  // ADD: Semantic embeddings for multi-dimensional search
  location_embedding    Json?    @map("location_embedding") // OpenAI embedding of location context
  topic_embedding       Json?    @map("topic_embedding")    // OpenAI embedding of policy topic
  embedding_version     String   @default("v1") @map("embedding_version")
  embeddings_updated_at DateTime? @map("embeddings_updated_at")

  // ADD: Jurisdiction relations
  jurisdictions         TemplateJurisdiction[]
}
```

---

## How This Enables Semantic Search

### Client-Side Location Matching (VPN-Resistant)

```typescript
// 1. User's browser resolves location (5-signal progressive inference)
const userLocation = await resolveUserLocation(); // IndexedDB, never transmitted
// Returns: { congressional_district: "TX-18", state: "TX", city: "Austin", county_fips: "48453" }

// 2. Fetch ALL templates to client (cached in IndexedDB, refreshed daily)
const allTemplates = await indexedDB.getAll('templates'); // ~10MB for 10,000 templates

// 3. Client-side filtering by jurisdiction (no server knows user location)
const relevantTemplates = allTemplates.filter(template => {
  return template.jurisdictions.some(jurisdiction => {
    // Match congressional district (federal templates)
    if (jurisdiction.congressional_district === userLocation.congressional_district) return true;

    // Match state (state-level templates)
    if (jurisdiction.state_code === userLocation.state) return true;

    // Match county (county-level templates)
    if (jurisdiction.county_fips === userLocation.county_fips) return true;

    // Match city (city-level templates)
    if (jurisdiction.city_fips === userLocation.city_fips) return true;

    return false;
  });
});

// 4. Semantic search on filtered results (OpenAI embeddings)
const queryEmbedding = await generateQueryEmbedding("I can't afford rent");

const scored = relevantTemplates.map(template => {
  // Multi-dimensional similarity
  const locationScore = cosineSimilarity(queryEmbedding, template.location_embedding);
  const topicScore = cosineSimilarity(queryEmbedding, template.topic_embedding);

  // Contextual boosting
  let boost = 1.0;
  if (hasLocalAdoption(template, userLocation)) boost *= 1.5; // Network effects
  if (hasRecentActivity(template)) boost *= 1.3; // Temporal relevance
  if (hasImpactCorrelation(template)) boost *= 1.8; // Proven efficacy

  return {
    template,
    score: (locationScore * 0.3 + topicScore * 0.7) * boost
  };
}).sort((a, b) => b.score - a.score);
```

**Why this is VPN-resistant:**
- User resolves location client-side using 5 signals (IP is just one)
- OAuth profile data (verified home address) overrides IP geolocation
- Behavioral patterns (template clicks) refine location inference
- Identity verification (self.xyz/Didit.me) provides ground truth
- VPN only affects Signal 1 (IP) - other 4 signals remain accurate

---

## Template Writer UX: Jurisdiction Selection

### Current Problem
Template creators have no structured way to specify "this applies to Austin City Council" vs. "this applies to Travis County Commissioners" vs. "this applies to Texas State Senate District 14."

### Solution: Jurisdiction Picker UI

```svelte
<!-- Template Creator: Jurisdiction Selection Step -->
<script lang="ts">
  let selectedJurisdictions = $state<TemplateJurisdiction[]>([]);

  function addJurisdiction(type: 'federal' | 'state' | 'county' | 'city') {
    if (type === 'federal') {
      // User selects congressional districts
      selectedJurisdictions.push({
        jurisdiction_type: 'federal',
        congressional_district: 'TX-18', // Autocomplete with Census data
        state_code: 'TX'
      });
    } else if (type === 'city') {
      // User selects city
      selectedJurisdictions.push({
        jurisdiction_type: 'city',
        city_name: 'Austin',
        city_fips: '4805000', // Census place code
        state_code: 'TX',
        county_fips: '48453', // Travis County (auto-resolved)
        latitude: 30.2672, // City center (auto-geocoded)
        longitude: -97.7431
      });
    }
  }
</script>

<div class="jurisdiction-picker">
  <h3>Who should receive this template?</h3>

  <!-- Federal -->
  <button onclick={() => addJurisdiction('federal')}>
    Add Congressional District
  </button>
  <!-- Opens autocomplete: "TX-18 (Houston)", "CA-12 (San Francisco)" -->

  <!-- State -->
  <button onclick={() => addJurisdiction('state')}>
    Add State Legislature
  </button>
  <!-- Cascading: Select state → Select chamber → Select district -->

  <!-- County -->
  <button onclick={() => addJurisdiction('county')}>
    Add County
  </button>
  <!-- Autocomplete: "Travis County, TX", "Los Angeles County, CA" -->

  <!-- City -->
  <button onclick={() => addJurisdiction('city')}>
    Add City
  </button>
  <!-- Autocomplete: "Austin, TX", "San Francisco, CA" -->

  <!-- Selected jurisdictions preview -->
  <ul>
    {#each selectedJurisdictions as jurisdiction}
      <li>
        {jurisdiction.jurisdiction_type}: {jurisdiction.city_name || jurisdiction.congressional_district}
      </li>
    {/each}
  </ul>
</div>
```

---

## VPN Remediation for Template Writers

**Problem:** If users are on VPNs, IP-based location inference fails. How do template writers ensure their templates reach the right people?

### Multi-Signal Location Resolution (Cypherpunk-Compatible)

Template writers don't need to do anything special. The platform handles VPN resistance through:

#### 1. **Progressive Location Inference Hierarchy**

```typescript
// User's location resolved via 5 signals (ordered by reliability)
async function resolveUserLocation(): Promise<UserLocation> {
  // Signal 1: IP Geolocation (WEAKEST - fails with VPN)
  let location = await ipGeolocation(); // 80% accurate without VPN, 0% with VPN

  // Signal 2: Browser Geolocation API (STRONG - if user grants permission)
  const browserLocation = await navigator.geolocation.getCurrentPosition();
  if (browserLocation) {
    location = await reverseGeocode(browserLocation); // Overrides IP
  }

  // Signal 3: OAuth Profile Data (STRONGEST - verified address)
  const oauthProfile = await getOAuthProfile(); // Google/Facebook verified address
  if (oauthProfile.address) {
    location = await geocodeAddress(oauthProfile.address); // Overrides IP + browser
  }

  // Signal 4: Behavioral Inference (STRONG - VPN-resistant)
  const behavioralLocation = await inferFromTemplateClicks(); // User clicked "Austin rent control"
  if (behavioralLocation.confidence > 0.8) {
    location = behavioralLocation; // Refines previous signals
  }

  // Signal 5: Identity Verification (GROUND TRUTH - self.xyz/Didit.me)
  const verifiedAddress = await getVerifiedAddress(); // NFC passport scan or ID upload
  if (verifiedAddress) {
    location = await geocodeAddress(verifiedAddress); // OVERRIDES ALL
  }

  // Store in IndexedDB (local browser storage, never transmitted)
  await indexedDB.put('user_location', location);

  return location;
}
```

#### 2. **Template Delivery Guarantees**

Templates reach users through structured jurisdictions, NOT IP addresses:

```typescript
// Server-side template API (no location inference needed)
export async function GET({ url }) {
  // Client requests ALL templates (no location sent to server)
  const templates = await prisma.template.findMany({
    include: {
      jurisdictions: true // Include all jurisdiction mappings
    }
  });

  // Server has NO IDEA where user is
  // Client filters locally based on resolved location
  return json(templates);
}
```

#### 3. **Template Writer Preview**

Template creators see coverage BEFORE publishing:

```svelte
<!-- Template Creator: Preview Coverage -->
<script lang="ts">
  let jurisdictions = $state<TemplateJurisdiction[]>([
    { jurisdiction_type: 'city', city_name: 'Austin', city_fips: '4805000' }
  ]);

  async function previewCoverage() {
    // Estimate reach based on Census data
    const coverage = await estimateCoverage(jurisdictions);
    // Returns: { estimated_users: 950000, congressional_districts: ["TX-21", "TX-25", "TX-35"] }
  }
</script>

<div class="coverage-preview">
  <h4>Estimated Reach</h4>
  <p>~950,000 residents in Austin, TX</p>
  <p>Covers congressional districts: TX-21, TX-25, TX-35</p>
  <p>State legislative districts: SD-14, HD-47, HD-48, HD-49</p>
</div>
```

---

## Cypherpunk Privacy Guarantees

### User Privacy (Zero Server-Side Location Tracking)

1. **Location resolved client-side** - 5-signal progressive inference in browser (IndexedDB)
2. **Templates downloaded in bulk** - Server sees "user requested templates list", not "user in Austin"
3. **Filtering happens locally** - Client-side JavaScript filters by jurisdiction
4. **No location transmitted** - Server NEVER receives user's congressional district, city, or coordinates
5. **Action-based revelation only** - Server learns "user clicked Austin template" (minimal, already known)

### Template Writer Privacy (No Surveillance of Creation)

1. **Jurisdiction selection is public info** - "This template applies to Austin" is not PII
2. **No tracking of WHO creates what WHERE** - Template authorship is pseudonymous (wallet address)
3. **Network effects use on-chain commitments** - District hashes (Poseidon), not plaintext locations

### VPN Users Are First-Class Citizens

1. **Signal 1 (IP) fails gracefully** - Other 4 signals still work
2. **OAuth overrides IP** - Google/Facebook verified address trumps VPN IP
3. **Behavioral inference refines** - Clicking "Austin rent control" signals Austin interest
4. **Identity verification is ground truth** - self.xyz NFC passport scan reveals actual address (stored client-side only)
5. **Progressive disclosure** - User reveals location through actions, not automatic surveillance

---

## Implementation Checklist

### Phase 1: Database Migration (Immediate)

```bash
npx prisma migrate dev --name add_template_jurisdictions
```

**Changes:**
- [ ] Create `TemplateJurisdiction` table
- [ ] Add `location_embedding`, `topic_embedding` to `Template`
- [ ] Remove `applicable_countries`, `jurisdiction_level`, `specific_locations` (deprecated)
- [ ] Migrate existing templates to new jurisdiction structure

### Phase 2: Template Creator UI (1 week)

- [ ] Jurisdiction picker component (autocomplete with Census data)
- [ ] Coverage preview (estimated reach)
- [ ] Multi-jurisdiction support (federal + state + city simultaneously)

### Phase 3: Client-Side Location Resolution (2 weeks)

- [ ] 5-signal progressive inference
- [ ] IndexedDB storage for user location
- [ ] Behavioral pattern tracking (template clicks → location inference)

### Phase 4: Semantic Search Integration (2 weeks)

- [ ] Generate embeddings for all templates (OpenAI text-embedding-3-large)
- [ ] Client-side cosine similarity scoring
- [ ] Contextual boosting (geographic + temporal + network + impact)

### Phase 5: Network Effects (1 week)

- [ ] On-chain district commitments (Poseidon hashed)
- [ ] Client-side adoption count resolution
- [ ] "Your neighbors are working on this" without surveillance

---

## Why This Works

**VPN Resistance:**
- IP geolocation is Signal 1 of 5
- OAuth, behavioral, and identity verification override VPN IP
- User's actual location revealed through progressive signals, not single-point-of-failure IP lookup

**Privacy Preservation:**
- All location resolution happens client-side
- Server downloads ALL templates (no location filtering server-side)
- Action-based revelation (clicking "Austin template" is minimal disclosure)
- On-chain network effects use hashed district commitments

**Template Writer Simplicity:**
- Pick jurisdictions from structured autocomplete
- Preview coverage before publishing
- No manual string entry ("Austin, TX" vs. "Austin, Texas" inconsistency eliminated)

**Semantic Search Performance:**
- Embeddings enable "I can't afford rent" → zoning + vouchers + wages
- Contextual boosting surfaces templates with local adoption
- Client-side filtering means instant results (no server round-trip)

---

## Database Migration Script

```typescript
// scripts/migrate-template-locations.ts
import { PrismaClient } from '@prisma/client';
import { geocodeAddress } from '$lib/utils/geocoding';

const prisma = new PrismaClient();

async function migrateTemplateLocations() {
  const templates = await prisma.template.findMany({
    where: {
      specific_locations: { isEmpty: false }
    }
  });

  for (const template of templates) {
    for (const locationString of template.specific_locations) {
      // Parse "Austin, TX" → structured jurisdiction
      const parsed = await parseLocation(locationString);

      await prisma.templateJurisdiction.create({
        data: {
          template_id: template.id,
          jurisdiction_type: parsed.type, // 'city'
          city_name: parsed.city, // 'Austin'
          city_fips: parsed.fips, // '4805000'
          state_code: parsed.state, // 'TX'
          county_fips: parsed.county_fips, // '48453'
          latitude: parsed.lat,
          longitude: parsed.lng
        }
      });
    }
  }
}
```

---

**Bottom Line:**

Templates MUST store structured jurisdictions (congressional districts, state legislative districts, counties, cities) to enable:
1. VPN-resistant semantic search (5-signal client-side location resolution)
2. Privacy-preserving template discovery (all filtering happens locally)
3. Template writer simplicity (structured jurisdiction picker vs. free-text entry)
4. Network effects without surveillance (on-chain district commitments)

Current schema is inadequate. This architecture makes semantic discovery ACTUALLY POSSIBLE.
