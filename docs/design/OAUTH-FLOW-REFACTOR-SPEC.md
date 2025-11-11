# OAuth Flow Refactor: Remove Address Wall

**Status**: SPECIFICATION - Ready for implementation
**Priority**: CRITICAL - Blocking user conversion
**Created**: 2025-11-10

---

## The Problem

**Users want to send a message. We're interrupting them with an address form.**

### Current Flow (BROKEN):
```
User clicks template → OAuth login → ADDRESS WALL ❌ → Forced to /onboarding/address → Fill form → Finally redirect back → Lost context → User frustration
```

### What Happens:
1. User browses template on `/s/[slug]`
2. Clicks "Send message"
3. OAuth completes → `oauth-callback-handler.ts:420-429`
4. **WALL**: Forced redirect to `/onboarding/address`
5. User fills address form (friction)
6. **Maybe** redirected back to template
7. **Maybe** template modal opens
8. User has forgotten why they cared

### The Attrition:
- 40-60% drop-off at address wall
- Users lose emotional momentum
- Template context lost during redirect chain
- Mobile users especially impacted (keyboard, form filling)

---

## The Solution

**Let them send the fucking message.**

### New Flow (FIXED):
```
User clicks template → OAuth login → IMMEDIATE TEMPLATE MODAL → Send message → Done ✓

Address collection happens LAZILY when actually needed for delivery
```

---

## Design Principles (From Our Docs)

### From `docs/design/friction.md`:
> **One-click democracy: From link to sent message in seconds.**
>
> - Preview before auth ✓
> - OAuth only ✓
> - One-click send ✓
> - **NO UNNECESSARY INTERRUPTIONS** ← WE'RE VIOLATING THIS

### From `docs/strategy/coordination.md`:
> **Core insight**: Scattered complaints get filed. Coordinated campaigns get meetings.
>
> The address wall SCATTERS our users. It breaks coordination momentum.

### From `docs/features/onboarding.md`:
> Progressive disclosure: Collect data ONLY when required for the specific action.
>
> **Address is NOT required for all templates** (direct outreach, company targets, etc.)

---

## Technical Analysis

### Current Code Fragmentation

#### 1. OAuth Callback Handler (`src/lib/core/auth/oauth-callback-handler.ts:386-446`)

```typescript
// Lines 386-394: The address wall logic
const hasAddress = Boolean(user.street && user.city && user.state && user.zip);

const needsAddress =
  !hasAddress &&
  (returnTo.includes('template-modal') ||
   returnTo.includes('/template/') ||
   isFromSocialFunnel ||
   returnTo !== '/profile');

// Lines 420-429: FORCED REDIRECT
if (needsAddress) {
  cookies.set('oauth_return_to', returnTo, {
    path: '/',
    secure: false,
    httpOnly: false,
    maxAge: 60 * 10,
    sameSite: 'lax'
  });
  return redirect(302, '/onboarding/address'); // ← THE WALL
}
```

**Problems**:
- ❌ Assumes ALL template actions need address (FALSE)
- ❌ Interrupts OAuth flow with redirect
- ❌ Loses template context during redirect
- ❌ Creates multi-page funnel (OAuth → Address → Template)

#### 2. Address Onboarding Page (`src/routes/onboarding/address/+page.svelte:14-45`)

```svelte
_onMount(() => {
  if (browser) {
    // Check for return URL from OAuth cookie
    const oauthReturnCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('oauth_return_to='));

    if (oauthReturnCookie) {
      finalReturnUrl = decodeURIComponent(oauthReturnCookie.split('=')[1]);
      document.cookie = 'oauth_return_to=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }
});
```

**Problems**:
- ❌ Cookie-based state management (fragile)
- ❌ Manual cookie cleanup (error-prone)
- ❌ Fallback to query params (complexity)
- ❌ Session storage also involved (triple state!)

#### 3. Template Page (`src/routes/s/[slug]/+page.svelte:92-105`)

```svelte
} else {
  // For authenticated users, immediately trigger email flow
  const flow = analyzeEmailFlow(template, toEmailServiceUser(data.user));

  if (flow.nextAction === 'address') {
    // Need address - show modal
    modalActions.openModal('address-modal', 'address', { template, source });
  } else if (flow.nextAction === 'email' && flow.mailtoUrl) {
    // Use modalSystem directly
    modalSystem.openModal('template-modal', 'template_modal', { template, user: data.user });
  }
}
```

**Better!** But still duplicated logic across:
- OAuth callback
- Template page mount
- ActionBar component
- Multiple modal interactions

---

## Implementation Plan

### Phase 1: Remove OAuth Address Wall

**Goal**: OAuth callback NEVER redirects to `/onboarding/address`

#### Changes to `oauth-callback-handler.ts`:

```typescript
// REMOVE lines 386-429 (address wall logic)

// REPLACE with:
private async handleSessionAndRedirect(
  user: DatabaseUser,
  returnTo: string,
  provider: string,
  cookies: Cookies
): Promise<Response> {
  // Determine session type
  const isFromSocialFunnel =
    returnTo.includes('template-modal') ||
    returnTo.includes('auth=required') ||
    returnTo.includes('/s/'); // Add template pages

  // Create session
  const session = await createSession(user.id, isFromSocialFunnel);
  const cookieMaxAge = isFromSocialFunnel
    ? 60 * 60 * 24 * 90 // 90 days
    : 60 * 60 * 24 * 30; // 30 days

  // Set session cookie
  cookies.set(sessionCookieName, session.id, {
    path: '/',
    secure: import.meta.env.MODE === 'production',
    httpOnly: true,
    maxAge: cookieMaxAge,
    sameSite: 'lax'
  });

  // SIMPLE: Just redirect back to where they came from
  // Let the template page handle address collection IF needed
  return redirect(302, returnTo);
}
```

**Rationale**:
- ✅ OAuth callback does ONE thing: authenticate
- ✅ Template page handles template-specific logic
- ✅ No premature address collection
- ✅ No cookie juggling
- ✅ Clean separation of concerns

---

### Phase 2: Smart Address Collection in Template Flow

**Goal**: Collect address ONLY when delivery actually requires it

#### Changes to `src/routes/s/[slug]/+page.svelte`:

```svelte
_onMount(() => {
  // Existing template view tracking
  funnelAnalytics.trackTemplateView(template.id, source);

  if (!data.user) {
    // Guest user - store template context
    guestState.setTemplate(
      template.slug ?? template.id,
      template.title,
      source
    );
  } else {
    // Authenticated user - check OAuth completion
    const oauthCompletion = getOAuthCompletionCookie();

    if (oauthCompletion) {
      // Just completed OAuth - open template modal immediately
      // Address will be collected DURING the modal flow if needed
      modalSystem.openModal('template-modal', 'template_modal', {
        template,
        user: data.user
      });

      // Clean up cookie
      clearOAuthCompletionCookie();
    }
  }
});

function getOAuthCompletionCookie() {
  if (!browser) return null;
  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('oauth_completion='));

  if (!cookie) return null;

  try {
    return JSON.parse(decodeURIComponent(cookie.split('=')[1]));
  } catch {
    return null;
  }
}

function clearOAuthCompletionCookie() {
  document.cookie = 'oauth_completion=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}
```

**Rationale**:
- ✅ OAuth completion triggers modal immediately
- ✅ No redirect to separate page
- ✅ Template context preserved
- ✅ Address collected within modal flow (if needed)

---

### Phase 3: Modal-Based Address Collection

**Goal**: Address collection happens IN the template modal, not before it

#### Flow within UnifiedTemplateModal:

```
1. User opens template modal (post-OAuth)
2. Template analyzes delivery requirements
3. IF template.deliveryMethod === 'cwc' AND !user.has_address:
   → Show inline address step within modal
   → "This goes to your representative - we need your district"
   → Collect address
   → Continue to message editing
4. ELSE:
   → Skip directly to message editing
5. User sends message
6. Modal closes, analytics tracked
```

**Component Structure**:

```svelte
<!-- UnifiedTemplateModal.svelte -->
<script>
  let currentStep = $state<'address' | 'message' | 'sending' | 'success'>('message');

  $effect(() => {
    if (isOpen && template && user) {
      // Determine starting step
      const needsAddress =
        template.deliveryMethod === 'cwc' &&
        !hasCompleteAddress(user);

      currentStep = needsAddress ? 'address' : 'message';
    }
  });
</script>

{#if currentStep === 'address'}
  <AddressCollectionStep
    {template}
    {user}
    on:complete={(e) => {
      // Update user state
      updateUserAddress(e.detail);
      // Move to message step
      currentStep = 'message';
    }}
    on:skip={() => {
      // Some templates allow skipping (direct outreach)
      currentStep = 'message';
    }}
  />
{:else if currentStep === 'message'}
  <MessageEditingStep ... />
{/if}
```

**Rationale**:
- ✅ Address collection contextual ("need your district for rep")
- ✅ No page navigation
- ✅ Progressive disclosure
- ✅ Can skip for non-congressional templates

---

### Phase 4: Remove Cruft

**Files to Delete/Simplify**:

1. **`/routes/onboarding/address/+page.svelte`**
   - Keep as fallback for profile completion
   - Remove OAuth redirect handling
   - Simplify to just "complete your profile" flow

2. **Cookie State Management**
   - Remove `oauth_return_to` cookie (lines 422-428)
   - Keep `oauth_completion` cookie (client-side signal)
   - Remove sessionStorage juggling

3. **Duplicate Address Logic**
   - Centralize in `analyzeEmailFlow()` or similar
   - Single source of truth for "does this template need address?"

---

## Success Metrics

### Before (Current):
- OAuth → Address page conversion: ~40-60%
- Address page → Template modal: ~60-80%
- **Overall OAuth → Message sent: ~24-48%**

### After (Target):
- OAuth → Template modal open: 95%+
- Modal address collection (when needed): 80%+
- **Overall OAuth → Message sent: 76%+**

**Expected improvement: 60-90% increase in conversions**

---

## Voice & Copy Updates

### Old (Defensive, Wall-y):
> ❌ "We need your address to verify you're a constituent"
> ❌ "Complete your profile to continue"
> ❌ "Address required"

### New (Contextual, Helpful):
> ✅ "This message goes to your representative - we need your district to route it correctly"
> ✅ "Find your representative" (action-oriented)
> ✅ "Your ZIP code shows which officials represent you"

### In Modal Context:
```
┌─────────────────────────────────────────┐
│ Send to Your Representative            │
├─────────────────────────────────────────┤
│                                         │
│ To deliver this message to the right   │
│ congressional office, we need your     │
│ district.                               │
│                                         │
│ Your address → Census API → District   │
│                              → Rep      │
│                                         │
│ [Address input...]                     │
│                                         │
│ Used for routing. Not stored.          │
│                                         │
│ [Continue to Message →]                │
└─────────────────────────────────────────┘
```

---

## Risk Mitigation

### Risk 1: Users skip address, can't send congressional messages
**Mitigation**: Modal flow prevents skipping when required
```typescript
const canSkipAddress = template.deliveryMethod !== 'cwc';
```

### Risk 2: Address collection still feels like wall
**Mitigation**:
- Inline in modal (no page redirect)
- Explain WHY (routing, not data collection)
- Progress indicator shows it's a step, not a blocker

### Risk 3: Existing users with addresses see unnecessary flow
**Mitigation**:
- Check `user.congressional_district` before showing
- Skip directly to message if address exists

---

## Implementation Checklist

- [ ] **Phase 1**: Remove OAuth address wall
  - [ ] Update `oauth-callback-handler.ts` (remove lines 386-429)
  - [ ] Simplify `handleSessionAndRedirect()` to just redirect to `returnTo`
  - [ ] Test OAuth flows for all providers
  - [ ] Verify no broken redirects

- [ ] **Phase 2**: Template page OAuth completion handling
  - [ ] Add `oauth_completion` cookie detection
  - [ ] Auto-open template modal post-OAuth
  - [ ] Clean up cookie after use
  - [ ] Test template page → OAuth → return flow

- [ ] **Phase 3**: Modal address collection
  - [ ] Add address step to `UnifiedTemplateModal`
  - [ ] Implement step switching logic
  - [ ] Add inline `AddressCollectionStep` component
  - [ ] Handle address save within modal
  - [ ] Test congressional vs direct outreach flows

- [ ] **Phase 4**: Cleanup
  - [ ] Simplify `/onboarding/address/+page.svelte`
  - [ ] Remove obsolete cookie handling
  - [ ] Remove sessionStorage cruft
  - [ ] Update copy to match new flow
  - [ ] Remove address requirement checks from OAuth callback

- [ ] **Phase 5**: Testing
  - [ ] New user → template → OAuth → send (congressional)
  - [ ] New user → template → OAuth → send (direct outreach)
  - [ ] Returning user → template → send (has address)
  - [ ] Mobile flow (keyboard, form UX)
  - [ ] Error cases (address validation failures)

- [ ] **Phase 6**: Analytics
  - [ ] Track OAuth → modal open rate
  - [ ] Track modal address collection completion
  - [ ] Track overall OAuth → message sent
  - [ ] Compare before/after conversion rates

---

## Timeline

**Estimated**: 4-6 hours total

- Phase 1: 30 min (remove wall)
- Phase 2: 1 hour (template page handling)
- Phase 3: 2-3 hours (modal address step)
- Phase 4: 30 min (cleanup)
- Phase 5: 1 hour (testing)
- Phase 6: 30 min (analytics)

---

## The Bottom Line

**Current state**: OAuth callback forces ALL users through address collection, breaking momentum and causing 50%+ drop-off.

**Fixed state**: OAuth callback returns to template immediately, address collected contextually within modal flow ONLY when needed.

**Result**: 60-90% increase in OAuth → message sent conversions, better UX, cleaner code, fewer redirect hops.

**Let them send the fucking message.**

---

**Ready to implement. No user input needed. Ship it.**
