# Copy Audit - January 2025

**Scope:** Replace corporate-speak with confident, direct language per `/docs/design/language-voice-guidelines.md`

**Key patterns to eliminate:**
1. "campaigns" → "issues", "bills", "templates"
2. "your voice matters" → imperative actions
3. "make a difference" → specific outcomes
4. Over-explaining in primary UI → move to popovers
5. Defensive privacy language → show through design

---

## Priority 1: High-Traffic User-Facing Copy

### LocationFilter.svelte (line 569)
**Current:** "Find campaigns in your area"
**Fix:** "Issues in {district || state || 'Congress'}" + InfoIcon popover
**Pattern:** Confident primary + optional technical details

### Template Browser Header (multiple files)
**Current:** "Browse Campaigns"
**Fix:** "Bills in CA-11" / "Bills in California" / "Federal Bills"
**Pattern:** Geographic scope hierarchy

### Identity Verification Flow
**Files:**
- `VerificationChoice.svelte:30` - "Make Your Voice Heard"
- `VerificationPrompt.svelte:146` - "Amplify Your Voice"

**Fix:** "Verify residency" + InfoIcon with accurate flow explanation
**Pattern:** Confident action + popover explaining ZK proof flow

---

## Priority 2: Onboarding & Auth Flow

### OnboardingContent.svelte (lines 45-199)
**Problem:** Repetitive "your voice" emotional manipulation

**Current examples:**
- Line 45: "Add your voice"
- Line 62: "Someone shared this because they believe your voice can create change"
- Line 68: "Make your voice heard"
- Line 79: "Your voice can drive change"

**Fix strategy:**
- Remove emotional framing
- Focus on transaction: "Send to Congress", "Track delivery"
- If context needed: "Send your position on [bill name]"

### OnboardingModal.svelte (lines 58-99)
**Same pattern as OnboardingContent** - needs identical fixes

---

## Priority 3: Template Interaction

### TemplateModal.svelte (line 527)
**Current:** "Your voice has been added to the campaign"
**Fix:** "Message queued for delivery" or "Sent to Congress"
**Pattern:** Specific outcome, not vague emotion

### Share text (AppHeader.svelte, +layout.svelte)
**Current:** "make your voice heard!"
**Fix:** "Send your position to Congress" or just remove tagline
**Pattern:** Specific action or confident silence

---

## Priority 4: Analytics & Metrics

### CampaignDashboard.svelte
**Problem:** Component name itself uses "campaign"
**Fix:** Consider rename to `TemplateDashboard.svelte` or `IssueDashboard.svelte`
**Note:** Check all imports/references before renaming

### MessageMetrics.svelte
**Action:** Review for "campaign" references in UI copy

---

## Priority 5: Lower-Priority UI Elements

### Role/Connection selectors
**Files:**
- `RoleSelector.svelte`
- `ConnectionPicker.svelte`
- `DirectOutreachCompact.svelte`

**Pattern:** "Community" used appropriately in context (community organizer, community member)
**Action:** Keep these - they're describing actual roles, not corporate-speak

### Profile options
**File:** `ProfileEditModal.svelte:277`
**Current:** "Community member concerned"
**Action:** Keep - describes actual relationship

---

## Implementation Strategy

### Phase 1: Core User Flow (Estimated: 2-3 hours)
1. Create InfoIcon/Popover component
2. Fix LocationFilter.svelte
3. Fix template browser headers
4. Fix identity verification CTAs

### Phase 2: Onboarding Rewrite (Estimated: 1-2 hours)
5. Rewrite OnboardingContent.svelte
6. Rewrite OnboardingModal.svelte
7. Update TemplateModal completion message

### Phase 3: Share & External (Estimated: 30 min)
8. Update share text in AppHeader & layout
9. Remove emotional taglines

### Phase 4: Analytics Components (Estimated: 1 hour)
10. Rename CampaignDashboard → TemplateDashboard
11. Update all imports
12. Audit MessageMetrics

---

## Testing Checklist

After each phase:
- [ ] Visual review in browser (npm run dev)
- [ ] Check for broken imports (npm run check)
- [ ] Verify no TypeScript errors (npm run lint)
- [ ] Test user flows (onboarding, verification, template selection)
- [ ] Mobile responsive check

---

## Files to Edit (Priority Order)

1. ✅ `/docs/design/language-voice-guidelines.md` - Done
2. `src/lib/components/ui/InfoIcon.svelte` - Create new
3. `src/lib/components/landing/template/LocationFilter.svelte`
4. `src/lib/components/auth/address-steps/VerificationChoice.svelte`
5. `src/lib/components/auth/VerificationPrompt.svelte`
6. `src/routes/+page.svelte` - Template browser header
7. `src/lib/components/auth/parts/OnboardingContent.svelte`
8. `src/lib/components/auth/OnboardingModal.svelte`
9. `src/lib/components/template/TemplateModal.svelte`
10. `src/lib/components/layout/AppHeader.svelte`
11. `src/routes/s/[slug]/+layout.svelte`
12. `src/lib/components/analytics/CampaignDashboard.svelte` → rename
13. `src/lib/components/landing/template/MessageMetrics.svelte`

---

## Post-Implementation

After all changes:
1. Full regression test of user flows
2. Update any remaining docs that reference "campaigns"
3. Search codebase for missed instances: `rg -i "campaigns?|your voice|make a difference"`
4. Update tests that assert on old copy
5. Deploy to staging for QA review
