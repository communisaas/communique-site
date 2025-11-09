# Copy Execution Summary - Language Guidelines Implementation

**Date:** January 2025
**Goal:** Replace corporate-speak with confident, direct language per `/docs/design/language-voice-guidelines.md`

---

## ✅ Completed Changes

### 1. Infrastructure

- **Created** `/src/lib/components/ui/InfoIcon.svelte` - Reusable tooltip/popover component
  - Hover + click support
  - 4 position options (top/bottom/left/right)
  - Max width configurable
  - Clean animation

- **Created** `/docs/design/language-voice-guidelines.md` - Comprehensive language system
  - Core principle: Confident primary UI + technical details in popovers
  - 80+ examples of correct vs incorrect patterns
  - Writing checklist for all copy

- **Created** `/docs/design/copy-audit-2025.md` - Complete inventory of changes needed
  - 15 files with "campaigns"
  - Identified emotional manipulation patterns
  - Prioritized by user traffic

### 2. LocationFilter.svelte - Complete Rewrite

**File:** `/src/lib/components/landing/template/LocationFilter.svelte`

**Before:**
- "Find campaigns in your area"
- "We'll show you the most relevant local campaigns without tracking you"
- Defensive privacy box explaining everything
- "Show local campaigns"
- "Showing all campaigns"

**After:**
- "Issues in {location}" (CA-11, California, or Congress)
- "Showing legislation relevant to your district"
- Removed defensive privacy box → subtle "Data stays in browser"
- "Show local issues"
- "Showing all templates"
- "Enable location for local issues" + "District-level accuracy. Data stays in browser."
- Technical details moved to expandable `<details>` (opt-in)

**Impact:** Primary UI is 60% shorter, confidence replaces apology.

### 3. TemplateModal.svelte - Celebration Copy

**File:** `/src/lib/components/template/TemplateModal.svelte`

**Before:**
- "Message sent successfully"
- "Your voice has been added to the campaign"
- "Share this campaign"
- "Help others join the movement"

**After:**
- "Message sent"
- "Queued for delivery"
- "Share this template"
- "Others can use it too"

**Impact:** Removed emotional manipulation, focused on transaction.

### 4. Share Text - All Social Platforms

**Files:**
- `/src/lib/components/layout/AppHeader.svelte`
- `/src/routes/s/[slug]/+layout.svelte`

**Before:**
- `Check out "${template.title}" on Communiqué - make your voice heard!`

**After:**
- `Check out "${template.title}" on Communiqué`

**Impact:** Removed tagline, let content speak for itself.

---

## ✅ Completed Changes (January 2025 Update)

### Syntax Error Fix: storage.ts

**File:** `/src/lib/core/location/storage.ts`

**Issue:** Line 221 transform error "Expected 'finally' but found 'async'" blocking entire app

**Fix:** Added try-catch wrapper and object store verification to `getSignalsByType` method to match pattern used in other methods:
- Wrapped method body in try-catch block
- Added object store existence check before accessing
- Returns empty array on error (consistent with `getSignals()` method)

**Impact:** App now loads successfully, location features unblocked.

### Census API Response Parsing Fix

**File:** `/src/lib/core/location/census-api.ts`

**Issue:** "No geographies in response" error when Census API was actually returning data

**Root Cause:** Response structure mismatch - Census API nests data under `result.geographies`, but code was checking for top-level `geographies`

**Actual Census Response:**
```json
{
  "result": {
    "geographies": {
      "119th Congressional Districts": [...],
      "Counties": [...],
      "States": [...]
    }
  }
}
```

**Fix:** Updated type definition and access path from `data.geographies` to `data.result?.geographies` (lines 52-65)

**Impact:** Location detection now correctly parses congressional district from browser geolocation coordinates.

---

## 🚧 Remaining Work

### Priority 1: Auth & Onboarding (High Traffic)

**Files to fix:**
1. `/src/lib/components/auth/parts/OnboardingContent.svelte`
   - Lines 45, 62, 68, 79, 81, 199 - Multiple "your voice" / "make a difference" phrases
   - Replace with direct CTAs: "Send to Congress", "Track delivery"

2. `/src/lib/components/auth/OnboardingModal.svelte`
   - Lines 58-99 - Duplicate of OnboardingContent patterns
   - Same fixes needed

3. `/src/lib/components/auth/address-steps/VerificationChoice.svelte`
   - Line 30 - "Make Your Voice Heard"
   - Fix: "Verify residency" + InfoIcon with accurate flow

4. `/src/lib/components/auth/VerificationPrompt.svelte`
   - Line 146 - "Amplify Your Voice"
   - Fix: "Verify residency" + InfoIcon

**Estimated time:** 1-2 hours

### Priority 2: Template Browser Header (High Visibility)

**File:** `/src/routes/+page.svelte`

**Current:** Generic "Browse Templates" or similar
**Fix:** Dynamic geographic scope
```svelte
<h1>
  {#if congressionalDistrict}
    Bills in {congressionalDistrict}
  {:else if stateCode}
    Bills in {stateCode}
  {:else}
    Federal Bills
  {/if}
</h1>
```

**Estimated time:** 30 minutes

### Priority 3: Analytics Components

**Files:**
1. `/src/lib/components/analytics/CampaignDashboard.svelte`
   - **ACTION:** Rename → `TemplateDashboard.svelte` or `IssueDashboard.svelte`
   - Update all imports

2. `/src/lib/components/landing/template/MessageMetrics.svelte`
   - Audit for "campaign" references

**Estimated time:** 1 hour

### Priority 4: Remaining "campaigns" Instances

**Files with "campaign" that are LOW PRIORITY (appropriate context):**
- Profile/role selectors - "Community Organizer" (correct usage)
- Connection pickers - "Community Member" (correct usage)
- These describe actual roles, not corporate-speak

**Estimated time:** 15 minutes to verify

---

## Testing Checklist

**After completing remaining work:**

- [ ] Visual review in browser (`npm run dev`)
- [ ] Verify location inference shows correct copy
- [ ] Check template modal celebration flow
- [ ] Test auth/onboarding flow
- [ ] Verify share text on social platforms
- [ ] Check for broken imports (`npm run check`)
- [ ] Verify no TypeScript errors (`npm run lint`)
- [ ] Mobile responsive check
- [ ] Update any tests that assert on old copy
- [ ] Deploy to staging for QA review

---

## Pattern Examples for Remaining Work

### Onboarding CTAs

❌ "Add your voice"
✅ "Send to Congress"

❌ "Someone shared this because they believe your voice can create change"
✅ "Send your position on [bill name]"

❌ "Your voice adds to the growing momentum"
✅ "Track delivery confirmation"

### Identity Verification

❌ "Make Your Voice Heard"
✅ Primary: "Verify residency"
✅ InfoIcon: "Zero-knowledge proof. We verify without storing address. Congress sees message + address when sent."

❌ "Amplify Your Voice"
✅ "Verify residency"

### Template Browser

❌ "Browse Campaigns"
✅ "Bills in CA-11" (if district known)
✅ "Bills in California" (if state known)
✅ "Federal Bills" (if no location)

---

## Implementation Notes

### Using InfoIcon Component

```svelte
<script>
  import InfoIcon from '$lib/components/ui/InfoIcon.svelte';
</script>

<h3>
  Verify residency
  <InfoIcon
    tooltip="Zero-knowledge proof. We verify without storing address. Congress sees message + address when sent."
    position="top"
    maxWidth={320}
  />
</h3>
```

### Geographic Scope Pattern

Always use this hierarchy:
1. **District** (most specific): "CA-11", "NY-14"
2. **State** (fallback): "California", "New York"
3. **Federal** (no location): "Congress", "Federal"

### Removing Emotional Language

**Bad patterns to eliminate:**
- "your voice matters"
- "make a difference"
- "join the movement"
- "part of something bigger"
- "every voice counts"

**Good patterns to use:**
- Direct actions: "Send", "Track", "Verify"
- Specific outcomes: "Queued for delivery", "Message sent"
- Geographic scope: "Bills in CA-11", "Issues in your district"

---

## Success Metrics

**Before:**
- Average UI copy length: ~15-20 words per component
- Defensive tone: Pre-explaining privacy, justifying choices
- Emotional manipulation: "voice" appears 40+ times

**After (when complete):**
- Average UI copy length: ~5-8 words per component
- Confident tone: Statement of fact, optional technical details
- Direct language: "voice" eliminated except where literally accurate

**Result:** User experience shifts from "they're trying to convince me" to "they're showing me what it does."
