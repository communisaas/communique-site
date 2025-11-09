# UI Copy Audit - Phase 1 Launch

**Date**: 2025-01-09
**Context**: Launching without OAuth email verification. Users can only track messages going to Congressional APIs (CWC). But users don't care about that - they care about WHO they're messaging.

---

## The Core Problem

**Current UI**: Talks about "delivery methods" (Certified Delivery, Direct Outreach, Verified Delivery)

**Phase 1 Reality**: No OAuth yet. Can only verify Congressional messages via CWC API.

**User Mental Model**: "I'm messaging my Senator" NOT "I'm using the CWC API"

**Voice.md Principle**: Don't wear cypherpunk on our sleeve. Show don't tell.

---

## Phase 1 vs Phase 2 Framing

### Phase 1 (Current Launch - No OAuth)

**What works**:
- Congressional messages → CWC API → on-chain verification → reputation tracking
- User verifies identity (self.xyz/Didit.me)
- User enters address → zero-knowledge proof → message delivered
- Reputation earned for verified Congressional delivery

**What doesn't work yet**:
- Email OAuth verification (no Sent folder access)
- Direct email verification (can't prove user sent it)
- Impact tracking for non-Congressional messages

**User-facing copy must reflect**: "Contact your representatives" NOT "Choose delivery method"

### Phase 2 (Future - With OAuth)

**What will work**:
- Everything from Phase 1
- OAuth email verification (read Sent folder, zero-knowledge check)
- Verify ANY message sent (Congressional, local gov, corporations, HOAs)
- Full protocol participation (impact tracking, coordination, reputation for ALL messages)

**User-facing copy will reflect**: "Join protocol to track all civic impact" (already documented in congressional/delivery.md)

---

## UI Components Audit

### 1. TemplateModal.svelte (HIGH PRIORITY)

**Current problems**:
- Line 285: "Certified Delivery" check → Should be "Congressional message"
- Line 317: "Direct outreach - skip agent processing" → Misleading, sounds like it's supported
- References "deliveryMethod" which implies user choice

**Phase 1 reality**:
- Congressional templates → Automatic CWC API delivery → Verification → Reputation
- Non-Congressional templates → mailto: link opens → NO verification (Phase 2)
- User doesn't choose method → Protocol handles routing

**Fix**:
```svelte
// BEFORE (WRONG - delivery method framing):
const isCertifiedDelivery = template.deliveryMethod === 'cwc';

if (isCertifiedDelivery) {
  // Congressional delivery - use full agent processing pipeline
  modalActions.setState('tracking');
} else {
  // Direct outreach - skip agent processing, go straight to celebration
  modalActions.confirmSend();
}

// AFTER (CORRECT - who they're contacting):
const isCongressional = template.level === 'federal' && template.delivery_method === 'cwc_api';

if (isCongressional) {
  // Congressional message - verified delivery, reputation tracking
  modalActions.setState('tracking');
} else {
  // Phase 1: Non-Congressional messages open mailto, no verification yet
  // Phase 2: Will add OAuth verification here
  modalActions.confirmSend();
}
```

**Modal state copy fixes**:
- Line 497: "Opening your email app..." → "Preparing your message..."
- Line 499: "Your message is ready with your information pre-filled." → Good (accurate)
- Line 526: "Did you send your message?" → Phase 1: Only ask for Congressional. Phase 2: Ask for all.
- Line 528: "Help us track real impact by confirming your send." → "Help us verify delivery for reputation tracking."

---

### 2. TemplateList.svelte (HIGH PRIORITY)

**Current problem**:
- Line 107: `{isCongressional ? 'Certified Delivery' : 'Direct Outreach'}`
- Delivery method badge when user doesn't choose

**Phase 1 fix**:
```svelte
// BEFORE (WRONG):
{isCongressional ? 'Certified Delivery' : 'Direct Outreach'}

// AFTER (CORRECT):
{isCongressional ? 'US Congress' : template.recipient_name || 'Email'}
```

**Better**: Show WHO, not HOW
- "US Congress" → They know it's verified (we handle it)
- "Austin Mayor" → They know it's direct email
- "Delta Airlines" → They know it's corporate contact

---

### 3. ChannelExplainer.svelte (REMOVE OR REWRITE)

**Current problem**:
- Lines 102-124: Entire "Certified Delivery" vs "Direct Outreach" section
- Explains delivery methods users don't need to understand

**Phase 1 fix**: Remove entire "channel" framing. Replace with "Who can you contact?"

```svelte
// BEFORE (WRONG - delivery method explainer):
{
  title: 'Certified Delivery',
  features: [
    { text: 'Zero-knowledge district verification' },
    { text: 'Verified delivery receipt' }
  ]
},
{
  title: 'Direct Outreach',
  features: [
    { text: 'Opens your email client' },
    { text: 'No address verification required' }
  ]
}

// AFTER (CORRECT - who you can contact):
{
  title: 'US Congress',
  subtitle: 'Verified constituent voice',
  features: [
    { text: 'Automatic district verification' },
    { text: 'Delivery tracked on-chain' },
    { text: 'Reputation earned per message' }
  ],
  example: 'Contact your Senator about healthcare'
},
{
  title: 'Everyone Else',
  subtitle: 'Coming in Phase 2',
  features: [
    { text: 'Local government (city, county, state)' },
    { text: 'Corporations, HOAs, universities' },
    { text: 'OAuth verification for impact tracking' }
  ],
  example: 'Contact your mayor or your HOA board'
}
```

---

### 4. ChannelBadge.svelte (REMOVE OR SIMPLIFY)

**Current problem**:
- Line 9: "Verified delivery to Congressional offices"
- Line 18: "Direct Outreach"

**Phase 1 fix**: Show recipient type, not delivery method

```svelte
// BEFORE (WRONG):
const channelConfig = {
  cwc: {
    text: 'Verified Delivery',
    tooltip: 'Verified delivery to Congressional offices'
  },
  email: {
    text: 'Direct Outreach'
  }
};

// AFTER (CORRECT):
const recipientTypeConfig = {
  congress: {
    text: 'US Congress',
    icon: '🏛️',
    tooltip: 'Verified delivery, reputation tracked'
  },
  local_gov: {
    text: 'Local Government',
    icon: '🏫',
    tooltip: 'Phase 2: OAuth verification'
  },
  corporate: {
    text: 'Corporate',
    icon: '🏢',
    tooltip: 'Phase 2: OAuth verification'
  }
};
```

---

### 5. OnboardingModal.svelte + OnboardingContent.svelte (MEDIUM PRIORITY)

**Current problems**:
- "Join the pressure campaign" (line 68)
- "This campaign needs supporters like you" (line 100)
- "Tracked for impact" + "We monitor campaign effectiveness" (line 156)

**Phase 1 reality**:
- Only Congressional messages are tracked
- "Campaign" is politically loaded (voice.md says avoid)
- "Tracked for impact" misleading (only Congressional, not all)

**Fix**:
```svelte
// BEFORE (WRONG - "campaign" language):
headline: 'Join the pressure campaign',
subtext: 'This campaign needs supporters like you.'

// AFTER (CORRECT - "template" language):
headline: 'Add your voice to {template.metrics.sent} others',
subtext: 'Contact your representatives about {template.category.toLowerCase()}.'

// BEFORE (WRONG - misleading tracking):
{ icon: Users, title: 'Tracked for impact', desc: 'We monitor campaign effectiveness' }

// AFTER (CORRECT - Congressional only):
{ icon: Users, title: 'Verified delivery', desc: 'Congressional messages tracked on-chain' }
```

---

### 6. Hero.svelte (LOW PRIORITY)

**Current problem**:
- Line 25: "Coordinate campaigns that decision-makers can't ignore."

**Fix**:
```svelte
// BEFORE (WRONG):
Coordinate campaigns that decision-makers can't ignore.

// AFTER (CORRECT):
Coordinate civic action that decision-makers can't ignore.
```

---

### 7. TemplateCreator.svelte (MEDIUM PRIORITY)

**Current problem**:
- Line 401: "Launch Campaign" button

**Fix**:
```svelte
// BEFORE (WRONG):
Launch Campaign

// AFTER (CORRECT):
Publish Template
```

---

### 8. SlugCustomizer.svelte (LOW PRIORITY)

**Current problems**:
- Line 45: "Year suffix for campaigns"
- Line 58: `${acronym}-campaign`
- Line 175: "Campaign Link"
- Line 194: "your-campaign"

**Fix**:
```svelte
// BEFORE (WRONG):
variations.push(`${acronym}-campaign`);

// AFTER (CORRECT):
variations.push(`${acronym}-action`);
```

```svelte
// BEFORE (WRONG):
Campaign Link

// AFTER (CORRECT):
Template Link
```

---

## Copy Patterns (From voice.md)

### What to avoid:
- ❌ "campaigns" → Use "issues, bills, templates, legislation"
- ❌ "verified delivery" (when OAuth not implemented) → "Congressional delivery"
- ❌ "certified delivery" → "Verified to Congress"
- ❌ "direct outreach" → "Email" or "Opening your email"
- ❌ "delivery method" → (Remove entirely, users don't choose)

### What to use:
- ✅ "Send to Congress" (primary action)
- ✅ "US Congress" (badge/label) not "CWC API" (how)
- ✅ "Your representative: Senator Warren" (tooltip/secondary only)
- ✅ "Automatically routed to your district" (technical detail, not primary)
- ✅ "Reputation tracked" (Phase 1: Congressional only)
- ✅ "Phase 2: OAuth verification for all messages" (honest about roadmap)

**Principle**: Primary UI is direct and confident. Secondary details (tooltips) show routing to their specific rep if they want to know.

---

## Phase 1 User Flows (What Copy Should Reflect)

### Congressional Message Flow:
```
1. User clicks template → "Send to Congress"
2. Modal shows: "Preparing message..."
3. Address verification: Silent, automatic (2-5s zero-knowledge proof)
4. Message sent: "Sent to Congress"
   - Tooltip (if they hover): "Delivered to Senator Warren (CA-11)"
5. Reputation earned: "+10 reputation"
```

**Copy emphasis**:
- Primary: "Send to Congress" (direct, confident)
- Secondary: "Your rep: Senator Warren" (tooltip, only if they want detail)
- User doesn't think about district routing unless they dig for it

### Non-Congressional Message Flow (Phase 1):
```
1. User clicks template → "Email Austin Mayor"
2. Modal shows: "Opening your email app..."
3. mailto: link opens
4. Modal asks: "Did you send it?" → No verification yet
5. No reputation (Phase 2)
```

**Copy emphasis**: Honest that verification isn't ready. No false promises.

---

## Recommended Immediate Fixes (Launch Blockers)

### Priority 1 (MUST FIX before launch):

1. **TemplateModal.svelte**:
   - Change "Certified Delivery" check to "Congressional message"
   - Update modal states to remove "verified delivery" language for non-Congressional
   - Add "Phase 2" note for non-Congressional messages

2. **TemplateList.svelte**:
   - Change badge from "Certified Delivery" → "US Congress"
   - Change badge from "Direct Outreach" → "Email" or recipient name

3. **ChannelBadge.svelte**:
   - Replace "Verified Delivery" / "Direct Outreach" with recipient types
   - Or remove entirely if not adding value

### Priority 2 (Should fix soon):

4. **OnboardingModal.svelte**:
   - Remove "campaign" language
   - Change "Tracked for impact" to "Congressional messages tracked"

5. **TemplateCreator.svelte**:
   - "Launch Campaign" → "Publish Template"

### Priority 3 (Nice to have):

6. **ChannelExplainer.svelte**:
   - Rewrite to explain WHO not HOW
   - Add "Phase 2" section for transparency

7. **Hero.svelte**:
   - "campaigns" → "civic action"

8. **SlugCustomizer.svelte**:
   - "campaign" → "action" or "template"

---

## Phase 2 Copy Updates (Future - When OAuth Launches)

When OAuth email verification launches, update:

1. **TemplateModal.svelte**: Enable verification for ALL messages, not just Congressional
2. **OnboardingModal.svelte**: "Track all civic impact" (not just Congressional)
3. **ChannelExplainer.svelte**: Remove "Phase 2" notes, all message types now verified
4. **Add new component**: OAuthVerificationExplainer.svelte (explain read-only Sent folder access)

---

## Writing Checklist (from voice.md)

Before shipping UI copy:

**Primary UI:**
- [ ] No "campaigns" (use issues, bills, templates)
- [ ] No "delivery methods" (use recipient names: "US Congress", "Austin Mayor")
- [ ] No "verified delivery" for unverified flows (honest about Phase 1 limitations)
- [ ] No passive voice ("will be delivered" → "we deliver")
- [ ] No over-explaining (technical details go in tooltips)
- [ ] Imperative voice ("Contact your Senator", not "You can contact")
- [ ] Geographic scope clear (CA-11, California, Federal)

**Tooltips/Popovers:**
- [ ] Technical mechanism explained concisely (if user cares)
- [ ] Trade-offs acknowledged (Phase 1 vs Phase 2)
- [ ] Maximum 2 sentences

---

## Example Rewrites (Phase 1)

### TemplateModal Loading State:

**BEFORE (WRONG - overpromises):**
```svelte
<h3>Opening your email app...</h3>
<p>Your message is ready with your information pre-filled.</p>
```

**AFTER (CORRECT - Phase 1 accurate):**
```svelte
{#if isCongressional}
  <h3>Verifying your district...</h3>
  <p>Zero-knowledge proof generating (2-5s)</p>
{:else}
  <h3>Opening your email</h3>
  <p>You'll send from your email. Verification coming in Phase 2.</p>
{/if}
```

### TemplateList Badge:

**BEFORE (WRONG - delivery method):**
```svelte
{isCongressional ? 'Certified Delivery' : 'Direct Outreach'}
```

**AFTER (CORRECT - recipient type):**
```svelte
{#if template.level === 'federal'}
  <Badge icon="🏛️">US Congress</Badge>
{:else if template.level === 'city'}
  <Badge icon="🏫">{template.city}</Badge>
{:else if template.level === 'corporate'}
  <Badge icon="🏢">{template.recipient_name}</Badge>
{/if}
```

---

## Bottom Line

**Phase 1 (Current Launch):**
- Congressional messages: Verified, tracked, reputation earned
- Non-Congressional messages: mailto: opens, no verification (yet)
- UI should reflect this honestly, not overpromise

**User mental model:**
- "I'm contacting my Senator" (not "I'm using the CWC API")
- "I'm emailing my mayor" (not "I'm using Direct Outreach")
- "My Congressional messages earn reputation" (not "All messages are verified")

**Voice.md principle:**
- Show don't tell
- Don't wear cypherpunk on our sleeve
- Be honest about what works now vs Phase 2

**Next step**: Update components in priority order, test with users, iterate based on confusion points.
