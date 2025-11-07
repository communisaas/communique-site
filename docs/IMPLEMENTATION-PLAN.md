# Implementation Plan: Elevating Communique to Production Architecture

**Goal:** Transform Communique from prototype to production-ready cryptographic governance infrastructure. No legacy code, no technical debt, no deprecated patterns. Clean architectural foundation for Phase 1 launch (3 months) and Phase 2 economic layer (12-18 months).

**Last Updated:** 2025-11-04

---

## Executive Summary

**Current State:**
- ✅ Face ID biometric wallet (working)
- ✅ self.xyz/Didit.me identity verification (integrated)
- ✅ Basic template system (functional but inadequate schema)
- ✅ Multi-agent content moderation (3-layer consensus)
- ❌ Templates use unstructured location strings (blocks semantic search)
- ❌ No semantic template discovery (users can't find relevant templates)
- ❌ No VPN-resistant location resolution (IP geolocation only)
- ❌ No reputation dashboard (users can't see their impact)
- ❌ No template creator analytics (creators have no feedback)
- ❌ No network effects visualization (can't see coordination)
- ❌ No Phase 2 earning previews (users don't understand token economics)

**Target State (Phase 1 Launch - 3 months):**
- ✅ Structured jurisdictions (`TemplateJurisdiction` table with congressional districts, state/county/city FIPS codes)
- ✅ Semantic template discovery (multi-dimensional embeddings, contextual boosting)
- ✅ VPN-resistant location resolution (5-signal progressive inference)
- ✅ User reputation dashboard (domain expertise scores, impact tracking)
- ✅ Template creator analytics (adoption metrics, geographic distribution, impact correlation)
- ✅ Network effects visualization ("89 Austin residents sent this")
- ✅ Phase 2 earning previews throughout interface (token reward calculations, reputation multipliers)
- ✅ Clean codebase (zero deprecated code, zero legacy patterns, zero technical debt)

---

## Phase 0: Codebase Audit & Cleanup (Week 1)

**Objective:** Identify all dead code, deprecated patterns, and technical debt before building new features. Clean foundation = sustainable velocity.

### 0.1 Database Schema Audit

**Action:** Review Prisma schema for unused tables, deprecated fields, redundant relations.

**Known Issues from Schema Analysis:**
```prisma
// DEPRECATED FIELDS (to be removed):
model Template {
  applicable_countries      String[]   @default([])  // ❌ Remove - replaced by TemplateJurisdiction
  jurisdiction_level        String?                  // ❌ Remove - replaced by TemplateJurisdiction
  specific_locations        String[]   @default([])  // ❌ Remove - replaced by TemplateJurisdiction
}

// UNUSED EXPERIMENTAL TABLES (to be removed):
model political_field_state { ... }      // ❌ Research feature, not production
model local_political_bubble { ... }     // ❌ Research feature, not production
model community_intersection { ... }     // ❌ Research feature, not production
model political_dead_end { ... }         // ❌ Research feature, not production
model community_lifecycle { ... }        // ❌ Research feature, not production
model user_context_stack { ... }         // ❌ Research feature, not production
model political_flow { ... }             // ❌ Research feature, not production
model political_uncertainty { ... }      // ❌ Research feature, not production

// REDUNDANT AGENT TRACKING (consolidate):
model AgentDissent { ... }               // ⚠️  Consolidate into AgentPerformance
model CostTracking { ... }               // ⚠️  Consolidate into analytics_experiment
```

**Cleanup Tasks:**
- [ ] Remove all experimental/research tables (not used in production)
- [ ] Consolidate agent tracking (AgentDissent → AgentPerformance)
- [ ] Remove deprecated Template fields (applicable_countries, jurisdiction_level, specific_locations)
- [ ] Document which fields are actually used in production vs. planned features
- [ ] Create migration plan for data preservation (if any research data is valuable)

### 0.2 Code Pattern Audit

**Action:** Grep for deprecated patterns, unused imports, commented-out code, TODOs, FIXMEs.

**Commands:**
```bash
# Find all TODO/FIXME comments
rg "TODO|FIXME" src/

# Find all @ts-ignore/@ts-nocheck violations
rg "@ts-ignore|@ts-nocheck|@ts-expect-error" src/

# Find all commented-out code blocks
rg "^[\s]*//.*{$" src/

# Find all unused imports (requires running build)
npm run lint:strict 2>&1 | grep "is defined but never used"

# Find all any type usage
rg ":\s*any|as any|<any>" src/ --type ts

# Find all console.log statements (should use proper logging)
rg "console\.(log|warn|error)" src/ --type ts
```

**Cleanup Tasks:**
- [ ] Remove all TODO/FIXME comments (convert to GitHub issues or implement)
- [ ] Remove all @ts-ignore/@ts-nocheck violations (fix types properly)
- [ ] Remove all commented-out code (git history preserves it)
- [ ] Remove all unused imports (run linter, fix all warnings)
- [ ] Replace all `any` types with proper interfaces
- [ ] Replace console.log with proper logging framework

### 0.3 Feature Flag Audit

**Action:** Review all feature flags, identify which are production-ready vs. experimental.

**Known Feature Flags:**
```typescript
ENABLE_BETA=true           // What does this control?
ENABLE_RESEARCH=true       // Research features (should be removed for production)
NODE_ENV=production        // Standard
```

**Cleanup Tasks:**
- [ ] Document what each feature flag controls
- [ ] Remove ENABLE_RESEARCH flag (research code should be removed entirely)
- [ ] Decide on ENABLE_BETA strategy (either promote to production or remove)
- [ ] Create clear feature flag taxonomy (ALPHA/BETA/PRODUCTION)

### 0.4 Dependency Audit

**Action:** Review package.json for unused dependencies, outdated packages, security vulnerabilities.

**Commands:**
```bash
# Find unused dependencies
npx depcheck

# Check for outdated packages
npm outdated

# Security audit
npm audit

# License audit (ensure compliance)
npx license-checker --summary
```

**Cleanup Tasks:**
- [ ] Remove unused dependencies
- [ ] Update outdated packages (test thoroughly)
- [ ] Fix security vulnerabilities
- [ ] Document license compliance

### 0.5 Test Suite Audit

**Action:** Review test coverage, identify flaky tests, remove obsolete tests.

**Commands:**
```bash
# Run test coverage report
npm run test:coverage

# Identify failing tests
npm run test:run

# Check for skipped tests
rg "test.skip|it.skip|describe.skip" tests/
```

**Cleanup Tasks:**
- [ ] Remove skipped tests (either fix or delete)
- [ ] Fix failing tests
- [ ] Remove tests for deleted features
- [ ] Increase coverage for critical paths (reputation, identity verification, template delivery)

---

## Phase 1: Database Architecture Migration (Week 2-3)

**Objective:** Implement structured jurisdictions, add embeddings, migrate existing data. This is the BLOCKER for everything else.

### 1.1 Create TemplateJurisdiction Table

**Prisma Migration:**
```prisma
model TemplateJurisdiction {
  id                String    @id @default(cuid())
  template_id       String    @map("template_id")

  // Jurisdiction identification (structured)
  jurisdiction_type String    @map("jurisdiction_type") // 'federal' | 'state' | 'county' | 'city' | 'school_district'

  // Federal
  congressional_district String? @map("congressional_district") // "TX-18", "CA-12"
  senate_class           String? @map("senate_class") // "class-1", "class-2", "class-3"

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

  // Timestamps
  created_at             DateTime @default(now()) @map("created_at")
  updated_at             DateTime @updatedAt @map("updated_at")

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

**Tasks:**
- [ ] Create Prisma migration: `npx prisma migrate dev --name add_template_jurisdictions`
- [ ] Add TemplateJurisdiction relation to Template model
- [ ] Test migration on development database
- [ ] Verify foreign key constraints work correctly

### 1.2 Add Embeddings to Template Model

**Prisma Migration:**
```prisma
model Template {
  // ADD: Semantic embeddings for multi-dimensional search
  location_embedding    Json?    @map("location_embedding") // 3072-dim vector from OpenAI
  topic_embedding       Json?    @map("topic_embedding")    // 3072-dim vector from OpenAI
  embedding_version     String   @default("v1") @map("embedding_version")
  embeddings_updated_at DateTime? @map("embeddings_updated_at")

  // ADD: Jurisdiction relations
  jurisdictions         TemplateJurisdiction[]

  // REMOVE: Deprecated location fields (after data migration)
  // applicable_countries      String[]   @default([])
  // jurisdiction_level        String?
  // specific_locations        String[]   @default([])
}
```

**Tasks:**
- [ ] Add embedding fields to Template model
- [ ] Add TemplateJurisdiction relation
- [ ] Create migration: `npx prisma migrate dev --name add_template_embeddings`
- [ ] Test migration on development database

### 1.3 Data Migration: Parse Existing Templates

**Script:** `scripts/migrate-template-locations.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { geocodeAddress } from '$lib/utils/geocoding';
import { resolveCongressionalDistrict } from '$lib/utils/census';

const prisma = new PrismaClient();

async function migrateTemplateLocations() {
  console.log('Starting template location migration...');

  const templates = await prisma.template.findMany({
    where: {
      OR: [
        { specific_locations: { isEmpty: false } },
        { jurisdiction_level: { not: null } }
      ]
    }
  });

  console.log(`Found ${templates.length} templates to migrate`);

  for (const template of templates) {
    console.log(`Migrating template: ${template.id} - ${template.title}`);

    // Parse specific_locations (e.g., ["Austin, TX", "Travis County, TX"])
    for (const locationString of template.specific_locations) {
      try {
        const parsed = await parseLocationString(locationString);

        // Create TemplateJurisdiction record
        await prisma.templateJurisdiction.create({
          data: {
            template_id: template.id,
            jurisdiction_type: parsed.type, // 'city' | 'county' | 'state' | 'federal'

            // Federal
            congressional_district: parsed.congressional_district,

            // State
            state_code: parsed.state_code,
            state_senate_district: parsed.state_senate_district,
            state_house_district: parsed.state_house_district,

            // County
            county_fips: parsed.county_fips,
            county_name: parsed.county_name,

            // City
            city_name: parsed.city_name,
            city_fips: parsed.city_fips,

            // Geospatial
            latitude: parsed.latitude,
            longitude: parsed.longitude
          }
        });

        console.log(`  ✓ Created jurisdiction: ${parsed.type} - ${locationString}`);
      } catch (error) {
        console.error(`  ✗ Failed to parse location: ${locationString}`, error);
        // Log error but continue migration
      }
    }

    // Parse jurisdiction_level (e.g., "federal", "state", "city")
    if (template.jurisdiction_level && template.specific_locations.length === 0) {
      // Template has jurisdiction_level but no specific_locations
      // This is likely a federal template that applies nationwide
      if (template.jurisdiction_level === 'federal') {
        // Create federal jurisdiction (no specific district - applies to all)
        await prisma.templateJurisdiction.create({
          data: {
            template_id: template.id,
            jurisdiction_type: 'federal',
            state_code: null, // Nationwide
            congressional_district: null // All districts
          }
        });
        console.log(`  ✓ Created federal jurisdiction (nationwide)`);
      }
    }
  }

  console.log('Migration complete!');
}

async function parseLocationString(locationString: string): Promise<ParsedLocation> {
  // Parse common patterns:
  // "Austin, TX" → city
  // "Travis County, TX" → county
  // "Texas" → state
  // "TX-18" → congressional district

  if (locationString.match(/^[A-Z]{2}-\d+$/)) {
    // Congressional district pattern: "TX-18"
    const [state, district] = locationString.split('-');
    return {
      type: 'federal',
      state_code: state,
      congressional_district: locationString,
      // Geocode to get center point
      ...(await geocodeCongressionalDistrict(locationString))
    };
  }

  if (locationString.includes('County')) {
    // County pattern: "Travis County, TX"
    const [countyName, state] = locationString.split(',').map(s => s.trim());
    const fips = await resolveCountyFIPS(countyName, state);
    return {
      type: 'county',
      county_name: countyName,
      county_fips: fips,
      state_code: state,
      ...(await geocodeCounty(fips))
    };
  }

  if (locationString.split(',').length === 2) {
    // City pattern: "Austin, TX"
    const [city, state] = locationString.split(',').map(s => s.trim());
    const cityData = await geocodeCity(city, state);
    return {
      type: 'city',
      city_name: city,
      city_fips: cityData.fips,
      state_code: state,
      county_fips: cityData.county_fips, // Auto-resolve county
      congressional_district: cityData.congressional_district, // Auto-resolve
      latitude: cityData.latitude,
      longitude: cityData.longitude
    };
  }

  if (locationString.length === 2 || locationString.match(/^[A-Z][a-z]+$/)) {
    // State pattern: "TX" or "Texas"
    const stateCode = locationString.length === 2 ? locationString : stateToCode(locationString);
    return {
      type: 'state',
      state_code: stateCode,
      ...(await geocodeState(stateCode))
    };
  }

  throw new Error(`Unable to parse location string: ${locationString}`);
}

// Run migration
migrateTemplateLocations()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Tasks:**
- [ ] Implement parseLocationString function
- [ ] Implement geocoding utilities (Census Bureau API)
- [ ] Test migration script on development database
- [ ] Verify data accuracy (spot-check migrated jurisdictions)
- [ ] Run migration on production database
- [ ] Verify all templates have at least one jurisdiction

### 1.4 Generate Embeddings for All Templates

**Script:** `scripts/generate-template-embeddings.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateTemplateEmbeddings() {
  console.log('Generating embeddings for all templates...');

  const templates = await prisma.template.findMany({
    where: {
      OR: [
        { location_embedding: null },
        { topic_embedding: null }
      ]
    },
    include: {
      jurisdictions: true
    }
  });

  console.log(`Found ${templates.length} templates without embeddings`);

  for (const template of templates) {
    console.log(`Generating embeddings for: ${template.id} - ${template.title}`);

    try {
      // Generate location embedding
      const locationInput = `
        Jurisdictions: ${template.jurisdictions.map(j =>
          `${j.jurisdiction_type}: ${j.city_name || j.county_name || j.state_code || j.congressional_district}`
        ).join(', ')}
        Geographic context: ${template.jurisdictions.map(j =>
          `${j.city_name ? 'City' : j.county_name ? 'County' : j.state_code ? 'State' : 'Federal'}`
        ).join(', ')}
      `.trim();

      const locationEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: locationInput,
        dimensions: 3072
      });

      // Generate topic embedding
      const topicInput = `
        Title: ${template.title}
        Description: ${template.description}
        Category: ${template.category}
        Message: ${template.message_body.substring(0, 1000)} // Truncate for token limits
      `.trim();

      const topicEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: topicInput,
        dimensions: 3072
      });

      // Update template with embeddings
      await prisma.template.update({
        where: { id: template.id },
        data: {
          location_embedding: locationEmbedding.data[0].embedding,
          topic_embedding: topicEmbedding.data[0].embedding,
          embedding_version: 'v1',
          embeddings_updated_at: new Date()
        }
      });

      console.log(`  ✓ Generated embeddings`);
    } catch (error) {
      console.error(`  ✗ Failed to generate embeddings`, error);
    }

    // Rate limit: OpenAI has 3,000 RPM limit for embeddings
    await new Promise(resolve => setTimeout(resolve, 100)); // 10 req/sec = 600 req/min
  }

  console.log('Embedding generation complete!');
}

// Run generation
generateTemplateEmbeddings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Tasks:**
- [ ] Set up OpenAI API key in environment
- [ ] Test embedding generation on 10 templates
- [ ] Verify embedding dimensions (should be 3072)
- [ ] Run batch generation for all templates
- [ ] Monitor OpenAI API costs (embeddings are cheap, ~$0.13 per 1M tokens)
- [ ] Store embeddings as JSON arrays in database

### 1.5 Remove Deprecated Fields

**After data migration is verified:**

```prisma
model Template {
  // REMOVE (after migration):
  // applicable_countries      String[]   @default([])
  // jurisdiction_level        String?
  // specific_locations        String[]   @default([])
}
```

**Tasks:**
- [ ] Create Prisma migration: `npx prisma migrate dev --name remove_deprecated_location_fields`
- [ ] Verify no code references these fields (grep search)
- [ ] Update TypeScript interfaces to remove deprecated fields
- [ ] Run migration on development database
- [ ] Test thoroughly (no breakage)
- [ ] Run migration on production database

### 1.6 Remove Research/Experimental Tables

**Tables to Remove:**
```prisma
// ❌ Remove all experimental tables
model political_field_state { ... }
model local_political_bubble { ... }
model community_intersection { ... }
model political_dead_end { ... }
model community_lifecycle { ... }
model user_context_stack { ... }
model political_flow { ... }
model political_uncertainty { ... }
```

**Tasks:**
- [ ] Verify these tables are not used in production code (grep search)
- [ ] Export any valuable research data (if needed)
- [ ] Create migration: `npx prisma migrate dev --name remove_research_tables`
- [ ] Run migration on development database
- [ ] Verify no code breakage
- [ ] Run migration on production database

---

## Phase 2: Client-Side Location Resolution (Week 3-4)

**Objective:** Implement 5-signal progressive location inference. VPN-resistant, privacy-preserving, client-side only.

### 2.1 Signal 1: IP Geolocation (Coarse)

**Implementation:** `src/lib/utils/location/ip-geolocation.ts`

```typescript
export interface CoarseLocation {
  country: string;
  state: string;
  city: string;
  confidence: number;
  source: 'ip';
  timestamp: number;
}

export async function resolveCoarseLocation(): Promise<CoarseLocation> {
  try {
    // Get user's IP address
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipResponse.json();

    // Resolve to geographic location (using IPinfo.io free tier)
    const geoResponse = await fetch(`https://ipinfo.io/${ip}/json`);
    const geoData = await geoResponse.json();

    return {
      country: geoData.country,
      state: geoData.region,
      city: geoData.city,
      confidence: 0.8, // Drops to 0.0 if VPN detected
      source: 'ip',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('IP geolocation failed:', error);
    return null;
  }
}
```

**Tasks:**
- [ ] Implement IP geolocation utility
- [ ] Store result in sessionStorage (cleared on browser close)
- [ ] Handle VPN detection (low confidence if IP location conflicts with other signals)
- [ ] Test with/without VPN

### 2.2 Signal 2: Browser Geolocation API (Precise)

**Implementation:** `src/lib/utils/location/browser-geolocation.ts`

```typescript
export interface PreciseLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  congressional_district: string;
  state_senate_district: string;
  state_house_district: string;
  county_fips: string;
  city_fips: string;
  confidence: number;
  source: 'browser';
  timestamp: number;
}

export async function requestPreciseLocation(): Promise<PreciseLocation | null> {
  try {
    // Request browser geolocation (user permission required)
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000
      });
    });

    // Resolve to governance units (Census Bureau API, client-side)
    const governance = await resolveGovernanceUnits({
      lat: position.coords.latitude,
      lon: position.coords.longitude
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      ...governance,
      confidence: 0.95,
      source: 'browser',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Browser geolocation failed:', error);
    return null; // User denied permission or error occurred
  }
}
```

**Tasks:**
- [ ] Implement browser geolocation utility
- [ ] Integrate Census Bureau Geocoding API (client-side calls)
- [ ] Store result in IndexedDB (persistent, local-only)
- [ ] Handle permission denial gracefully
- [ ] Test on mobile (GPS) and desktop (WiFi triangulation)

### 2.3 Signal 3: OAuth Profile Data

**Implementation:** `src/lib/utils/location/oauth-location.ts`

```typescript
export interface OAuthLocation {
  city: string;
  state: string;
  country: string;
  confidence: number;
  source: 'oauth';
  provider: string; // 'google' | 'facebook' | 'twitter'
  timestamp: number;
}

export async function enrichLocationFromOAuth(
  oauthProfile: OAuthProfile
): Promise<OAuthLocation | null> {
  // OAuth providers sometimes include location in profile
  if (!oauthProfile.location) return null;

  try {
    const parsed = parseOAuthLocation(oauthProfile.location);

    return {
      city: parsed.city,
      state: parsed.state,
      country: parsed.country,
      confidence: 0.9, // High confidence (user verified with OAuth provider)
      source: 'oauth',
      provider: oauthProfile.provider,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('OAuth location parsing failed:', error);
    return null;
  }
}
```

**Tasks:**
- [ ] Implement OAuth location extraction
- [ ] Parse Google/Facebook/Twitter profile location formats
- [ ] Store result in sessionStorage (cleared on logout)
- [ ] Handle conflicts with IP geolocation (trust OAuth over IP)
- [ ] Test with real OAuth profiles

### 2.4 Signal 4: Behavioral Inference

**Implementation:** `src/lib/utils/location/behavioral-inference.ts`

```typescript
export interface BehavioralLocation {
  city: string;
  state: string;
  congressional_district: string;
  confidence: number;
  source: 'behavior';
  evidence: string[]; // Template IDs clicked
  timestamp: number;
}

export async function inferLocationFromBehavior(): Promise<BehavioralLocation | null> {
  // Get recent template clicks from IndexedDB
  const recentClicks = await indexedDB.getAll('template_clicks', { last: 30 }); // Last 30 days

  if (recentClicks.length < 5) {
    return null; // Not enough data to infer
  }

  // Count geographic signals from clicked templates
  const locationFrequency: Record<string, number> = {};

  for (const click of recentClicks) {
    const template = click.template;

    // Count jurisdictions from template
    for (const jurisdiction of template.jurisdictions) {
      const key = `${jurisdiction.city_name || jurisdiction.county_name || jurisdiction.state_code}`;
      locationFrequency[key] = (locationFrequency[key] || 0) + 1;
    }
  }

  // Find most frequent location
  const sorted = Object.entries(locationFrequency).sort((a, b) => b[1] - a[1]);
  const [mostFrequentLocation, clickCount] = sorted[0];

  // Confidence based on consistency (how often user clicks templates from same location)
  const confidence = Math.min(clickCount / recentClicks.length, 0.95);

  if (confidence < 0.7) {
    return null; // Not confident enough
  }

  return {
    city: mostFrequentLocation, // Simplified - would need to parse properly
    state: 'TX', // Would need to resolve from jurisdiction data
    congressional_district: 'TX-18', // Would need to resolve
    confidence,
    source: 'behavior',
    evidence: recentClicks.map(c => c.template.id),
    timestamp: Date.now()
  };
}
```

**Tasks:**
- [ ] Implement behavioral inference utility
- [ ] Track template clicks in IndexedDB (client-side only)
- [ ] Parse jurisdiction data from clicked templates
- [ ] Calculate confidence based on consistency
- [ ] Test with realistic user behavior patterns

### 2.5 Signal 5: Identity Verification Address

**Implementation:** `src/lib/utils/location/identity-verification.ts`

```typescript
export interface VerifiedLocation {
  address: string; // NEVER stored, used only for ZK proof generation
  congressional_district: string;
  state_senate_district: string;
  state_house_district: string;
  county_fips: string;
  city_fips: string;
  latitude: number;
  longitude: number;
  confidence: number;
  source: 'identity_verification';
  verification_method: 'self.xyz' | 'didit.me';
  verified_at: number;
}

export async function onIdentityVerification(
  verificationResult: VerificationResult
): Promise<VerifiedLocation> {
  const address = verificationResult.address;

  // Resolve to ALL governance units (Census Bureau API, client-side)
  const governance = await resolveAllGovernanceUnits(address);

  // Generate ZK proof of congressional district (for federal delivery)
  // Address used ONLY for proof generation, then discarded from memory
  const zkProof = await generateDistrictProof(address, governance.congressional_district);

  // Submit ZK proof to blockchain (reveals only district hash, not address)
  await submitProofToScroll(zkProof);

  // Store governance units in IndexedDB (local-only, never transmitted)
  const verified = {
    // Address NOT stored - only governance units
    congressional_district: governance.congressional_district,
    state_senate_district: governance.state_senate_district,
    state_house_district: governance.state_house_district,
    county_fips: governance.county_fips,
    city_fips: governance.city_fips,
    latitude: governance.latitude,
    longitude: governance.longitude,
    confidence: 1.0, // Ground truth
    source: 'identity_verification' as const,
    verification_method: verificationResult.method,
    verified_at: Date.now()
  };

  await indexedDB.put('verified_governance', verified);

  // Address now destroyed - only governance units remain
  return verified;
}
```

**Tasks:**
- [ ] Implement identity verification location extraction
- [ ] Integrate with self.xyz NFC passport verification
- [ ] Integrate with Didit.me government ID verification
- [ ] Ensure address is NEVER stored (only used for ZK proof, then destroyed)
- [ ] Store governance units in IndexedDB
- [ ] Test with real verification flows

### 2.6 Location Resolution Priority

**Implementation:** `src/lib/utils/location/location-resolver.ts`

```typescript
export async function getCurrentLocation(): Promise<Location | null> {
  // Priority 1: Identity verification (ground truth, confidence 1.0)
  const verified = await indexedDB.get('verified_governance');
  if (verified) {
    return { ...verified, confidence: 1.0 };
  }

  // Priority 2: Browser geolocation (precise, confidence 0.95)
  const precise = await indexedDB.get('governance_units');
  if (precise) {
    return { ...precise, confidence: 0.95 };
  }

  // Priority 3: Behavioral inference (VPN-resistant, confidence 0.7-0.95)
  const behavioral = await inferLocationFromBehavior();
  if (behavioral && behavioral.confidence > 0.7) {
    return behavioral;
  }

  // Priority 4: OAuth profile (verified by provider, confidence 0.9)
  const oauth = sessionStorage.getItem('oauth_location');
  if (oauth) {
    return { ...JSON.parse(oauth), confidence: 0.9 };
  }

  // Priority 5: IP geolocation (coarse, VPN-vulnerable, confidence 0.8)
  const coarse = sessionStorage.getItem('coarse_location');
  if (coarse) {
    return { ...JSON.parse(coarse), confidence: 0.8 };
  }

  // No location data available
  return null;
}
```

**Tasks:**
- [ ] Implement location resolver with priority logic
- [ ] Handle conflicts between signals (higher priority wins)
- [ ] Cache resolved location in memory for performance
- [ ] Test priority logic with different signal combinations
- [ ] Document signal priority reasoning

---

## Phase 3: Semantic Template Discovery (Week 4-5)

**Objective:** Implement semantic search with multi-dimensional embeddings and contextual boosting.

### 3.1 Client-Side Template Search

**Implementation:** `src/lib/utils/search/semantic-search.ts`

```typescript
export interface SearchResult {
  template: Template;
  score: number;
  matchReasons: {
    semantic: number;
    geographic: number;
    temporal: number;
    network: number;
    impact: number;
    reputation: number;
  };
}

export async function searchTemplates(query: string): Promise<SearchResult[]> {
  // 1. Get user's current location context (IndexedDB)
  const location = await getCurrentLocation();

  // 2. Generate embedding for user's query
  const queryEmbedding = await generateQueryEmbedding(query, location);

  // 3. Fetch ALL templates (cached in IndexedDB, refreshed daily)
  const allTemplates = await indexedDB.getAll('templates');

  // 4. Compute semantic similarity + contextual boosting (CLIENT-SIDE)
  const scored = allTemplates.map(template => {
    // Multi-dimensional semantic similarity
    const locationScore = cosineSimilarity(queryEmbedding, template.location_embedding);
    const topicScore = cosineSimilarity(queryEmbedding, template.topic_embedding);
    const semanticScore = locationScore * 0.3 + topicScore * 0.7;

    // Contextual boosts (all computed client-side)
    let geoBoost = 1.0;
    let temporalBoost = 1.0;
    let networkBoost = 1.0;
    let impactBoost = 1.0;
    let reputationBoost = 1.0;

    // Geographic relevance (matches user's districts)
    if (location && matchesUserJurisdiction(template, location)) {
      geoBoost = 2.0; // 2x boost for user's districts
    }

    // Temporal relevance (happening now vs. upcoming vs. past)
    if (isActiveNow(template)) {
      temporalBoost = 1.5; // Active legislative session, upcoming vote
    }

    // Network effects (what neighbors are doing)
    if (hasLocalAdoption(template, location)) {
      networkBoost = 1.3; // Other constituents in user's district
    }

    // Impact history (templates that actually changed things)
    if (hasLegislativeCorrelation(template)) {
      impactBoost = 1.8; // Previous templates correlated with legislation
    }

    // Creator reputation
    const creatorScore = template.creator_reputation / 10000; // Normalize
    reputationBoost = 1 + creatorScore;

    // Combined score
    const totalBoost = geoBoost * temporalBoost * networkBoost * impactBoost * reputationBoost;
    const finalScore = semanticScore * totalBoost;

    return {
      template,
      score: finalScore,
      matchReasons: {
        semantic: semanticScore,
        geographic: geoBoost,
        temporal: temporalBoost,
        network: networkBoost,
        impact: impactBoost,
        reputation: reputationBoost
      }
    };
  });

  // 5. Sort by combined score
  return scored.sort((a, b) => b.score - a.score).slice(0, 20);
}
```

**Tasks:**
- [ ] Implement semantic search utility
- [ ] Integrate OpenAI embeddings API for query embedding
- [ ] Implement cosine similarity calculation
- [ ] Implement contextual boosting logic
- [ ] Cache templates in IndexedDB (refresh daily)
- [ ] Test with realistic queries

### 3.2 Template Browser UI

**Implementation:** `src/lib/components/template/TemplateBrowser.svelte`

```svelte
<script lang="ts">
  import { searchTemplates } from '$lib/utils/search/semantic-search';
  import type { SearchResult } from '$lib/utils/search/semantic-search';

  let searchQuery = $state('');
  let searchResults = $state<SearchResult[]>([]);
  let isSearching = $state(false);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    isSearching = true;
    try {
      searchResults = await searchTemplates(searchQuery);
    } finally {
      isSearching = false;
    }
  }

  // Debounced search
  $effect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  });
</script>

<div class="template-browser">
  <!-- Search input -->
  <input
    type="text"
    bind:value={searchQuery}
    placeholder="What's on your mind? (e.g., 'I can't afford rent')"
    class="search-input"
  />

  {#if isSearching}
    <div class="loading">Searching...</div>
  {:else if searchResults.length > 0}
    <div class="results">
      {#each searchResults as result}
        <div class="template-card">
          <h3>{result.template.title}</h3>
          <p>{result.template.description}</p>

          <!-- Match reasons (show why this template was surfaced) -->
          <div class="match-reasons">
            {#if result.matchReasons.geographic > 1.5}
              <span class="badge">📍 Your district</span>
            {/if}
            {#if result.matchReasons.network > 1.2}
              <span class="badge">👥 {result.template.adoptions} neighbors</span>
            {/if}
            {#if result.matchReasons.impact > 1.5}
              <span class="badge">✓ Proven impact</span>
            {/if}
            {#if result.matchReasons.temporal > 1.3}
              <span class="badge">🔥 Active now</span>
            {/if}
          </div>

          <!-- Reputation & adoption -->
          <div class="stats">
            <span>Creator: {result.template.creator_reputation} reputation</span>
            <span>Adoptions: {result.template.adoption_count}</span>
          </div>

          <button onclick={() => selectTemplate(result.template)}>
            Send to My Representative
          </button>
        </div>
      {/each}
    </div>
  {:else if searchQuery}
    <div class="no-results">
      No templates found for "{searchQuery}"
    </div>
  {/if}
</div>
```

**Tasks:**
- [ ] Implement template browser component
- [ ] Add semantic search integration
- [ ] Display match reasons (why template was surfaced)
- [ ] Show reputation, adoption, impact badges
- [ ] Handle empty states gracefully
- [ ] Test with realistic user queries

---

## Phase 4: User Reputation Dashboard (Week 5-6)

**Objective:** Build user-facing reputation dashboard showing domain expertise, impact tracking, Phase 2 earning previews.

### 4.1 Reputation Calculation

**Implementation:** `src/lib/utils/reputation/calculate-reputation.ts`

```typescript
export interface UserReputation {
  total: number;
  domain_scores: Record<string, number>; // { healthcare: 6200, climate: 1800 }
  percentile: number; // Top 2% in district
  phase2_multiplier: number; // +87% token rewards
}

export async function calculateUserReputation(userId: string): Promise<UserReputation> {
  // Fetch user's civic actions
  const actions = await prisma.civicAction.findMany({
    where: { user_id: userId },
    include: { template: true }
  });

  let total = 0;
  const domainScores: Record<string, number> = {};

  for (const action of actions) {
    // Base points for sending message
    const basePoints = 50;

    // Impact multiplier (10x if template correlated with legislation)
    const impactMultiplier = action.template.impact_correlation ? 10 : 1;

    // Domain-specific accumulation
    const domain = action.template.category;
    const points = basePoints * impactMultiplier;

    total += points;
    domainScores[domain] = (domainScores[domain] || 0) + points;
  }

  // Calculate percentile (requires district-wide reputation data)
  const percentile = await calculatePercentile(userId, total);

  // Phase 2 token multiplier: +10% per 1,000 reputation
  const phase2Multiplier = Math.floor(total / 1000) * 0.1;

  return {
    total,
    domain_scores: domainScores,
    percentile,
    phase2_multiplier
  };
}
```

**Tasks:**
- [ ] Implement reputation calculation utility
- [ ] Calculate domain-specific scores
- [ ] Calculate percentile ranking within district
- [ ] Calculate Phase 2 token multipliers
- [ ] Cache reputation scores (update on new actions)

### 4.2 User Dashboard UI

**Implementation:** `src/lib/components/dashboard/UserDashboard.svelte`

```svelte
<script lang="ts">
  import { calculateUserReputation } from '$lib/utils/reputation/calculate-reputation';
  import type { UserReputation } from '$lib/utils/reputation/calculate-reputation';

  let reputation = $state<UserReputation | null>(null);

  $effect(() => {
    // Load user reputation on mount
    loadReputation();
  });

  async function loadReputation() {
    reputation = await calculateUserReputation(user.id);
  }
</script>

<div class="user-dashboard">
  <h1>Your Impact Dashboard</h1>

  {#if reputation}
    <!-- Total Reputation -->
    <div class="reputation-card">
      <h2>Reputation Score: {reputation.total.toLocaleString()}</h2>
      <p>Top {reputation.percentile}% in your district</p>
      <p class="phase2-preview">
        Phase 2 Token Multiplier: +{Math.round(reputation.phase2_multiplier * 100)}%
      </p>
    </div>

    <!-- Domain Expertise -->
    <div class="domain-scores">
      <h3>Domain Expertise</h3>
      {#each Object.entries(reputation.domain_scores).sort((a, b) => b[1] - a[1]) as [domain, score]}
        <div class="domain-score">
          <span>{domain}</span>
          <span>{score.toLocaleString()} points</span>
        </div>
      {/each}
    </div>

    <!-- This Month -->
    <div class="monthly-stats">
      <h3>This Month</h3>
      <ul>
        <li>12 messages sent to TX-18 representative</li>
        <li>3 templates created (847 total adoptions)</li>
        <li>2 template impact correlations detected</li>
        <li>+1,420 reputation earned</li>
      </ul>
      <p class="phase2-preview">
        Phase 2 Preview: ~34,500 VOTER tokens earned (if economic layer were active)
      </p>
    </div>

    <!-- Template Performance -->
    <div class="template-performance">
      <h3>Your Templates</h3>
      <!-- Show user's created templates with adoption metrics -->
    </div>

    <!-- Network Coordination -->
    <div class="network-coordination">
      <h3>Network Coordination</h3>
      <p>Templates you've sent: 12</p>
      <p>Other TX-18 constituents on same templates: 89</p>
      <p>Geographic coordination: Healthcare priority emerging in TX (247 constituents across 12 districts)</p>
    </div>

    <!-- Phase 2 Preview -->
    <div class="phase2-preview-card">
      <h3>Phase 2 Economic Preview</h3>
      <p>Total Reputation: {reputation.total.toLocaleString()} points</p>
      <p>Estimated Token Multiplier: +{Math.round(reputation.phase2_multiplier * 100)}%</p>
      <p>Estimated Phase 2 Launch Earnings: ~125,000 VOTER tokens</p>
      <p class="muted">(Based on current activity, Phase 2 launches in 12-18 months)</p>
    </div>
  {:else}
    <div class="loading">Loading your impact data...</div>
  {/if}
</div>
```

**Tasks:**
- [ ] Implement user dashboard component
- [ ] Display total reputation and percentile rank
- [ ] Display domain expertise breakdown
- [ ] Display monthly stats
- [ ] Display template performance
- [ ] Display Phase 2 earning previews
- [ ] Test with realistic user data

---

## Phase 5: Template Creator Analytics (Week 6-7)

**Objective:** Build template creator dashboard showing adoption metrics, geographic distribution, impact correlation, Phase 2 earnings preview.

### 5.1 Template Analytics Calculation

**Implementation:** `src/lib/utils/analytics/template-analytics.ts`

```typescript
export interface TemplateAnalytics {
  template_id: string;
  adoption_count: number;
  geographic_distribution: {
    congressional_district: string;
    adoption_count: number;
  }[];
  adoption_velocity: number; // Adoptions per day
  impact_correlation: {
    bill_id: string;
    confidence: number;
    impact_multiplier: number;
  } | null;
  reputation_earned: number;
  phase2_earnings_preview: number; // VOTER tokens
}

export async function calculateTemplateAnalytics(templateId: string): Promise<TemplateAnalytics> {
  // Fetch template adoptions (CivicAction records)
  const adoptions = await prisma.civicAction.findMany({
    where: { template_id: templateId },
    include: { user: true }
  });

  // Geographic distribution (group by congressional district)
  const geoDistribution: Record<string, number> = {};
  for (const adoption of adoptions) {
    const district = adoption.user.congressional_district;
    geoDistribution[district] = (geoDistribution[district] || 0) + 1;
  }

  // Adoption velocity (adoptions per day)
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  const daysSinceCreation = (Date.now() - template.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const adoptionVelocity = adoptions.length / daysSinceCreation;

  // Impact correlation (check if template correlated with legislation)
  const impactCorrelation = await checkImpactCorrelation(templateId);

  // Reputation earned
  const baseReputationPerAdoption = 100;
  const impactMultiplier = impactCorrelation ? 10 : 1;
  const reputationEarned = adoptions.length * baseReputationPerAdoption * impactMultiplier;

  // Phase 2 earnings preview
  const baseTokensPerAdoption = 100;
  const networkBonus = adoptions.length > 100 ? 2000 : 0;
  const phase2Earnings = (adoptions.length * baseTokensPerAdoption * impactMultiplier) + networkBonus;

  return {
    template_id: templateId,
    adoption_count: adoptions.length,
    geographic_distribution: Object.entries(geoDistribution).map(([district, count]) => ({
      congressional_district: district,
      adoption_count: count
    })),
    adoption_velocity: adoptionVelocity,
    impact_correlation: impactCorrelation,
    reputation_earned: reputationEarned,
    phase2_earnings_preview: phase2Earnings
  };
}
```

**Tasks:**
- [ ] Implement template analytics calculation
- [ ] Calculate geographic distribution of adoptions
- [ ] Calculate adoption velocity
- [ ] Check for impact correlation (templates → legislation)
- [ ] Calculate reputation earned
- [ ] Calculate Phase 2 earnings preview

### 5.2 Template Creator Dashboard UI

**Implementation:** `src/lib/components/dashboard/TemplateCreatorDashboard.svelte`

```svelte
<script lang="ts">
  import { calculateTemplateAnalytics } from '$lib/utils/analytics/template-analytics';
  import type { TemplateAnalytics } from '$lib/utils/analytics/template-analytics';

  let userTemplates = $state<Template[]>([]);
  let selectedTemplate = $state<Template | null>(null);
  let analytics = $state<TemplateAnalytics | null>(null);

  $effect(() => {
    loadUserTemplates();
  });

  async function loadUserTemplates() {
    userTemplates = await fetchUserTemplates(user.id);
    if (userTemplates.length > 0) {
      selectTemplate(userTemplates[0]);
    }
  }

  async function selectTemplate(template: Template) {
    selectedTemplate = template;
    analytics = await calculateTemplateAnalytics(template.id);
  }
</script>

<div class="creator-dashboard">
  <h1>Template Creator Analytics</h1>

  <div class="template-selector">
    <h2>Your Templates: {userTemplates.length} active</h2>
    {#each userTemplates as template}
      <button onclick={() => selectTemplate(template)} class:active={selectedTemplate?.id === template.id}>
        {template.title}
      </button>
    {/each}
  </div>

  {#if analytics && selectedTemplate}
    <div class="analytics-content">
      <h2>{selectedTemplate.title}</h2>
      <p>Created: {new Date(selectedTemplate.createdAt).toLocaleDateString()}</p>

      <!-- Adoption Metrics -->
      <div class="adoption-metrics">
        <h3>Adoption Metrics</h3>
        <ul>
          <li>Total Adoptions: {analytics.adoption_count} verified constituents</li>
          <li>Geographic Distribution: {analytics.geographic_distribution.length} congressional districts</li>
          <li>Adoption Velocity: {analytics.adoption_velocity.toFixed(1)} per day</li>
        </ul>

        <!-- Top Districts -->
        <h4>Top Districts</h4>
        {#each analytics.geographic_distribution.slice(0, 5) as geo}
          <div>{geo.congressional_district}: {geo.adoption_count} adoptions</div>
        {/each}
      </div>

      <!-- Impact Tracking -->
      {#if analytics.impact_correlation}
        <div class="impact-tracking">
          <h3>Impact Correlation Detected</h3>
          <p>Bill ID: {analytics.impact_correlation.bill_id}</p>
          <p>Confidence: {Math.round(analytics.impact_correlation.confidence * 100)}%</p>
          <p>Impact Multiplier: {analytics.impact_correlation.impact_multiplier}x</p>
        </div>
      {/if}

      <!-- Reputation Earned -->
      <div class="reputation-earned">
        <h3>Reputation Earned</h3>
        <p>{analytics.reputation_earned.toLocaleString()} points</p>
      </div>

      <!-- Phase 2 Earnings Preview -->
      <div class="phase2-earnings">
        <h3>Phase 2 Earnings Preview</h3>
        <p>Base Earnings: {analytics.adoption_count} adoptions × 100 VOTER = {analytics.adoption_count * 100} tokens</p>
        {#if analytics.adoption_count > 100}
          <p>Network Bonus: +2,000 VOTER (>100 adoptions)</p>
        {/if}
        {#if analytics.impact_correlation}
          <p>Impact Multiplier: ×{analytics.impact_correlation.impact_multiplier}</p>
        {/if}
        <p class="total">Total Preview: ~{analytics.phase2_earnings_preview.toLocaleString()} VOTER tokens</p>
        <p class="muted">(Economic layer launches in 12-18 months)</p>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>Select a template to view analytics</p>
    </div>
  {/if}
</div>
```

**Tasks:**
- [ ] Implement template creator dashboard component
- [ ] Display adoption metrics
- [ ] Display geographic distribution (map visualization)
- [ ] Display impact correlation
- [ ] Display reputation earned
- [ ] Display Phase 2 earnings preview
- [ ] Test with realistic creator data

---

## Phase 6: Template Creator Jurisdiction Picker (Week 7)

**Objective:** Build jurisdiction picker UI for template creators. Structured autocomplete with coverage preview.

### 6.1 Jurisdiction Autocomplete

**Implementation:** `src/lib/components/template/JurisdictionPicker.svelte`

```svelte
<script lang="ts">
  import { searchJurisdictions } from '$lib/utils/jurisdiction/search';
  import type { Jurisdiction } from '$lib/types/jurisdiction';

  let selectedJurisdictions = $state<Jurisdiction[]>([]);
  let searchQuery = $state('');
  let searchResults = $state<Jurisdiction[]>([]);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    // Search Census data for jurisdictions
    searchResults = await searchJurisdictions(searchQuery);
  }

  function addJurisdiction(jurisdiction: Jurisdiction) {
    selectedJurisdictions = [...selectedJurisdictions, jurisdiction];
    searchQuery = '';
    searchResults = [];
  }

  function removeJurisdiction(index: number) {
    selectedJurisdictions = selectedJurisdictions.filter((_, i) => i !== index);
  }
</script>

<div class="jurisdiction-picker">
  <h3>Who should receive this template?</h3>

  <!-- Search input -->
  <input
    type="text"
    bind:value={searchQuery}
    oninput={handleSearch}
    placeholder="Search for congressional district, city, county, or state..."
  />

  <!-- Search results -->
  {#if searchResults.length > 0}
    <div class="search-results">
      {#each searchResults as result}
        <button onclick={() => addJurisdiction(result)}>
          <div class="result-title">{result.name}</div>
          <div class="result-type">{result.type}</div>
          <div class="result-coverage">~{result.population.toLocaleString()} residents</div>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Selected jurisdictions -->
  <div class="selected-jurisdictions">
    <h4>Selected Jurisdictions</h4>
    {#each selectedJurisdictions as jurisdiction, i}
      <div class="jurisdiction-chip">
        <span>{jurisdiction.name}</span>
        <button onclick={() => removeJurisdiction(i)}>×</button>
      </div>
    {/each}
  </div>

  <!-- Coverage Preview -->
  {#if selectedJurisdictions.length > 0}
    <div class="coverage-preview">
      <h4>Estimated Coverage</h4>
      <p>Total residents: ~{selectedJurisdictions.reduce((sum, j) => sum + j.population, 0).toLocaleString()}</p>
      <p>Congressional districts: {getCongressionalDistricts(selectedJurisdictions).join(', ')}</p>
    </div>
  {/if}
</div>
```

**Tasks:**
- [ ] Implement jurisdiction picker component
- [ ] Integrate Census Bureau API for jurisdiction search
- [ ] Add autocomplete functionality
- [ ] Display coverage preview (population, districts)
- [ ] Handle multiple jurisdiction selection
- [ ] Test with realistic jurisdiction searches

---

## Phase 7: Network Effects Visualization (Week 8)

**Objective:** Display "89 Austin residents sent this" without revealing who. On-chain district commitments with client-side count resolution.

### 7.1 On-Chain District Commitments

**Smart Contract:** `contracts/TemplateAdoptions.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TemplateAdoptions {
    // Template ID → District Hash → Count
    mapping(bytes32 => mapping(bytes32 => uint256)) public adoptionsByDistrict;

    event TemplateAdopted(
        bytes32 indexed templateId,
        bytes32 indexed districtCommitment,
        uint256 timestamp
    );

    // User submits ZK proof of district + template action
    function recordAdoption(
        bytes calldata zkProof,
        bytes32 templateId,
        bytes32 districtCommitment  // Poseidon(district, salt) - hides actual district
    ) external {
        // Verify ZK proof (user is in some district, proves action)
        require(verifyProof(zkProof), "Invalid proof");

        // Increment count for this template + district commitment
        adoptionsByDistrict[templateId][districtCommitment] += 1;

        emit TemplateAdopted(templateId, districtCommitment, block.timestamp);
    }

    // Public query - anyone can see counts, but can't reverse-engineer which district
    function getAdoptionCount(
        bytes32 templateId,
        bytes32 districtCommitment
    ) external view returns (uint256) {
        return adoptionsByDistrict[templateId][districtCommitment];
    }
}
```

**Tasks:**
- [ ] Implement TemplateAdoptions smart contract
- [ ] Deploy to Scroll L2 testnet
- [ ] Integrate ZK proof verification
- [ ] Test adoption recording
- [ ] Deploy to Scroll L2 mainnet

### 7.2 Client-Side Count Resolution

**Implementation:** `src/lib/utils/network/adoption-count.ts`

```typescript
export async function getLocalAdoptionCount(templateId: string): Promise<number> {
  // 1. Get user's governance units from IndexedDB (local-only)
  const location = await getCurrentLocation();

  if (!location) return 0;

  // 2. Compute district commitment (same as what we'd submit for ZK proof)
  const districtCommitment = poseidonHash(location.city_name, SALT);

  // 3. Query on-chain count (no server intermediary)
  const count = await scrollContract.adoptionsByDistrict(templateId, districtCommitment);

  return count;
}
```

**Tasks:**
- [ ] Implement Poseidon hash function (client-side)
- [ ] Integrate with Scroll L2 contract
- [ ] Query adoption counts from blockchain
- [ ] Cache counts for performance
- [ ] Test with realistic adoption data

### 7.3 Network Effects UI

**Implementation:** `src/lib/components/template/NetworkEffects.svelte`

```svelte
<script lang="ts">
  import { getLocalAdoptionCount } from '$lib/utils/network/adoption-count';

  let localAdoptionCount = $state(0);

  $effect(() => {
    loadAdoptionCount();
  });

  async function loadAdoptionCount() {
    localAdoptionCount = await getLocalAdoptionCount(template.id);
  }
</script>

<div class="network-effects">
  {#if localAdoptionCount > 0}
    <div class="adoption-badge">
      👥 {localAdoptionCount} {getLocalityName()} residents sent this
    </div>
  {/if}
</div>
```

**Tasks:**
- [ ] Implement network effects component
- [ ] Display local adoption counts
- [ ] Handle different jurisdiction types (city, county, state)
- [ ] Test with realistic adoption data

---

## Phase 8: Production Deployment & Monitoring (Week 9)

**Objective:** Deploy to production with comprehensive monitoring, error tracking, performance optimization.

### 8.1 Production Environment Setup

**Tasks:**
- [ ] Set up production database (Supabase production tier)
- [ ] Set up production environment variables
- [ ] Configure CDN for static assets
- [ ] Set up SSL certificates
- [ ] Configure production domain (communique.app)

### 8.2 Monitoring & Error Tracking

**Tools:**
- [ ] Set up Sentry for error tracking
- [ ] Set up PostHog for analytics
- [ ] Set up Uptime monitoring (UptimeRobot)
- [ ] Set up performance monitoring (Vercel Analytics)
- [ ] Set up database monitoring (Supabase dashboard)

### 8.3 Performance Optimization

**Tasks:**
- [ ] Optimize bundle size (code splitting, tree shaking)
- [ ] Optimize images (WebP, lazy loading)
- [ ] Optimize database queries (indexes, query optimization)
- [ ] Enable caching (Redis for API responses)
- [ ] Enable compression (gzip, brotli)

### 8.4 Security Hardening

**Tasks:**
- [ ] Enable HTTPS everywhere
- [ ] Set up CSP (Content Security Policy)
- [ ] Enable rate limiting (DDoS protection)
- [ ] Audit dependencies for vulnerabilities
- [ ] Enable CORS properly
- [ ] Set up API authentication
- [ ] Enable database encryption at rest

### 8.5 Deployment

**Tasks:**
- [ ] Deploy to Vercel production
- [ ] Run database migrations
- [ ] Generate embeddings for all templates
- [ ] Verify all features work in production
- [ ] Monitor error rates
- [ ] Monitor performance metrics

---

## Phase 9: Documentation & Knowledge Transfer (Week 10)

**Objective:** Comprehensive documentation for developers, users, and stakeholders.

### 9.1 Developer Documentation

**Tasks:**
- [ ] Update README.md with production setup instructions
- [ ] Document database schema (Entity-Relationship Diagram)
- [ ] Document API endpoints (OpenAPI/Swagger)
- [ ] Document deployment process
- [ ] Document monitoring & alerting
- [ ] Document incident response procedures

### 9.2 User Documentation

**Tasks:**
- [ ] Update QUICKSTART.md with latest UX
- [ ] Create video tutorials (Face ID → Verify → Send)
- [ ] Document template creation workflow
- [ ] Document reputation system
- [ ] Document Phase 2 earning previews
- [ ] Create FAQ

### 9.3 Stakeholder Documentation

**Tasks:**
- [ ] Create product roadmap document
- [ ] Create metrics dashboard (adoption, retention, congressional reach)
- [ ] Document Phase 1 → Phase 2 transition plan
- [ ] Create investor/stakeholder presentation

---

## Success Metrics

**Phase 1 Launch (3 months):**
- [ ] Zero deprecated code in production
- [ ] Zero ESLint errors
- [ ] Zero TypeScript errors
- [ ] 95%+ test coverage for critical paths
- [ ] Database migration complete (all templates have structured jurisdictions)
- [ ] Semantic search functional (VPN-resistant location resolution)
- [ ] User reputation dashboard live
- [ ] Template creator analytics dashboard live
- [ ] Network effects visualization live
- [ ] Phase 2 earning previews throughout interface
- [ ] <2s page load time
- [ ] <100ms semantic search latency
- [ ] Zero downtime deployment

**User Engagement Metrics:**
- [ ] 40% of users return within 7 days (vs. traditional advocacy <5%)
- [ ] Average template achieves 8+ district adoption
- [ ] 60%+ of VOTER messages reach policy staff review (vs. current 34%)
- [ ] 30% of users accumulate 1,000+ reputation within 30 days
- [ ] 15% of users create templates (vs. <1% in traditional platforms)

---

## Risk Mitigation

**Technical Risks:**
- **Database migration failure:** Test thoroughly on development database, create rollback plan
- **Embedding generation costs:** Monitor OpenAI API costs, implement caching
- **VPN detection accuracy:** Test with multiple VPN providers, refine signal weighting
- **Performance degradation:** Load testing, performance profiling, optimization

**Product Risks:**
- **User confusion:** Comprehensive onboarding, tooltips, documentation
- **Low adoption:** Marketing, outreach, influencer partnerships
- **Congressional rejection:** Engage with congressional offices early, demonstrate value

**Regulatory Risks:**
- **Privacy compliance:** Legal review of data handling practices
- **Token regulation:** Legal review of Phase 2 token economics, CLARITY Act compliance

---

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1 | Codebase Audit | Clean schema, remove dead code, fix type violations |
| 2-3 | Database Migration | TemplateJurisdiction table, embeddings, data migration |
| 3-4 | Location Resolution | 5-signal progressive inference (VPN-resistant) |
| 4-5 | Semantic Search | Multi-dimensional embeddings, contextual boosting |
| 5-6 | User Dashboard | Reputation scores, impact tracking, Phase 2 previews |
| 6-7 | Creator Dashboard | Adoption metrics, geographic distribution, earnings preview |
| 7 | Jurisdiction Picker | Structured autocomplete, coverage preview |
| 8 | Network Effects | On-chain commitments, client-side count resolution |
| 9 | Production Deployment | Monitoring, error tracking, performance optimization |
| 10 | Documentation | Developer, user, stakeholder docs |

**Total Duration:** 10 weeks (2.5 months)

**Phase 1 Launch Target:** Week 12 (buffer for testing, bug fixes)

---

## Next Steps

1. **Review this plan with team** - Gather feedback, adjust timeline
2. **Start Phase 0: Codebase Audit** - Identify all dead code, deprecated patterns
3. **Begin Phase 1: Database Migration** - This is the critical blocker
4. **Set up project tracking** - GitHub Projects, linear issues for each task
5. **Establish sprint cadence** - 2-week sprints, weekly progress reviews

**Let's build production-grade cryptographic governance infrastructure. No legacy code. No technical debt. Clean foundation for Phase 1 → Phase 2 evolution.**
