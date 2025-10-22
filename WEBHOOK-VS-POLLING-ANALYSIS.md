# Webhook vs Polling: Identity Verification Flow Analysis

**Question:** Do we need to implement webhooks for Didit.me, or can we use polling/alternative approaches?

**Research Date:** Based on self.xyz + Didit.me documentation review

---

## TL;DR: Recommendation

**For our use case (Phase 1 launch):**

### ✅ **self.xyz: NO WEBHOOK NEEDED**
- Frontend-initiated synchronous flow
- User stays on page during verification
- Backend endpoint receives POST from frontend (not from self.xyz servers)
- **Implementation:** Simple API endpoint that verifies proof

### ⚠️ **Didit.me: WEBHOOK RECOMMENDED (but not required)**
- Can use polling as fallback
- Webhooks provide better UX (real-time updates)
- **For Phase 1:** Start with polling, add webhooks in Phase 1D (polish)

---

## How Each SDK Actually Works

### 1. self.xyz Flow (Frontend-Driven)

```
┌─────────┐     1. Generate QR     ┌──────────┐
│ Browser │ ◄─────────────────────┤ Our API  │
└────┬────┘                        └──────────┘
     │
     │ 2. User scans QR with Self app
     │
     ▼
┌─────────────┐
│  Self App   │
│  (mobile)   │
└──────┬──────┘
       │
       │ 3. App generates zero-knowledge proof
       │
       ▼
┌─────────────────────────────────────────────┐
│  Self App sends proof data to Browser       │
│  (via deep link / QR completion callback)   │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  Browser/Frontend receives proof            │
│  attestationId, proof, publicSignals, etc.  │
└──────┬──────────────────────────────────────┘
       │
       │ 4. Frontend POSTs to our backend
       │
       ▼
┌──────────────────────────────────────────────┐
│  Our Backend: /api/identity/verify           │
│  - Receives proof from OUR FRONTEND          │
│  - Verifies with SelfBackendVerifier         │
│  - Returns success/failure to frontend       │
└──────┬───────────────────────────────────────┘
       │
       │ 5. Response
       ▼
┌─────────┐
│ Browser │ → Show success/error UI
└─────────┘
```

**Key Insight:** The `/api/identity/verify` endpoint is called by **our frontend**, not by self.xyz servers. It's a synchronous request-response flow.

**No webhook needed because:**
- User stays on the verification page
- Frontend handles the proof and sends to backend
- Immediate response (synchronous)
- User sees result instantly

---

### 2. Didit.me Flow (Redirect-Based)

```
┌─────────┐     1. Create Session    ┌──────────┐
│ Browser │ ─────────────────────────► Our API  │
└────┬────┘                           └────┬─────┘
     │                                     │
     │                                     │ 2. POST to Didit API
     │                                     │
     │                                     ▼
     │                              ┌─────────────┐
     │                              │  Didit API  │
     │                              └──────┬──────┘
     │                                     │
     │ ◄───────────────────────────────────┘
     │    3. Returns verification_url
     │
     │ 4. Redirect user to Didit
     │
     ▼
┌──────────────────────────┐
│  Didit Verification Page │
│  - User uploads ID       │
│  - Didit processes       │
└──────┬───────────────────┘
       │
       │ 5a. WEBHOOK (if configured)
       │     Didit sends verification result to our webhook endpoint
       │
       ▼
┌──────────────────────────────────────────────┐
│  Our Backend: /api/identity/didit/webhook    │
│  - Verifies HMAC signature                   │
│  - Processes verification result             │
│  - Updates user in database                  │
└──────────────────────────────────────────────┘

       │ 5b. POLLING (alternative)
       │     We periodically call GET /session/{id}/decision/
       │
       ▼
┌──────────────────────────────────────────────┐
│  Our Backend: Poll Didit API                 │
│  - Check session status every N seconds      │
│  - When status=Approved, process result      │
└──────────────────────────────────────────────┘
```

**Key Difference:** User is redirected away from our app to Didit's hosted page.

**Webhook vs Polling Trade-offs:**

| Aspect | Webhook | Polling |
|--------|---------|---------|
| **Real-time updates** | ✅ Instant | ⏱️ Delayed (polling interval) |
| **Server load** | ✅ Low (only when events occur) | ⚠️ Higher (continuous polling) |
| **Complexity** | ⚠️ HMAC verification, public endpoint | ✅ Simple GET requests |
| **Reliability** | ⚠️ Depends on webhook delivery | ✅ We control retry logic |
| **Security** | ⚠️ Must validate signatures | ✅ We initiate requests |
| **Development** | ⚠️ Need public URL (harder in dev) | ✅ Works on localhost |

---

## Our Specific Use Case Analysis

### User Flow Context

**self.xyz (NFC Passport):**
```
1. User customizes template on our site
2. Clicks "Send to Congress" → Verification modal appears
3. Shows QR code with "Scan with Self app"
4. User scans → Self app verifies passport chip
5. **User waits on our page** (30-60 seconds)
6. Verification completes → User continues to message submission
```

**Duration:** 30-60 seconds
**User behavior:** Stays on page, waits for completion
**Best approach:** ✅ **Synchronous (current self.xyz flow)**

---

**Didit.me (Government ID Upload):**
```
1. User clicks "Use Government ID Instead"
2. Redirect to Didit-hosted verification page
3. User uploads driver's license photo
4. **User may close tab, come back later**
5. Didit processes (1-5 minutes)
6. User returns to our site → Check verification status
```

**Duration:** 1-5 minutes (sometimes longer for manual review)
**User behavior:** May navigate away, multitask
**Options:**
- ⚠️ **Polling:** User returns to our site, we check status
- ✅ **Webhook:** We get notified when complete, update DB, send email

---

## Recommended Approach (Phase 1)

### **Phase 1A/1B: MVP (Weeks 1-9)**

#### self.xyz: Synchronous Flow ✅
```typescript
// Frontend (PassportFlow.svelte)
<SelfQRcodeWrapper
  config={qrConfig}
  onSuccess={async (proof) => {
    // Frontend sends proof to our backend
    const result = await fetch('/api/identity/verify', {
      method: 'POST',
      body: JSON.stringify(proof)
    });

    if (result.ok) {
      // Show success, continue to message submission
    }
  }}
/>

// Backend (/api/identity/verify/+server.ts)
export const POST: RequestHandler = async ({ request }) => {
  const { attestationId, proof, publicSignals, userContextData } = await request.json();

  // Verify with self.xyz SDK
  const result = await selfVerifier.verify(...);

  if (result.isValid) {
    // Update user, create audit record
    return json({ success: true });
  }
};
```

**No webhook needed.** ✅

---

#### Didit.me: Polling with Return URL ⏱️

**Phase 1 approach (simpler, no webhook):**

```typescript
// 1. Create session with return URL
const response = await fetch('https://verification.didit.me/v2/session/', {
  method: 'POST',
  headers: { 'x-api-key': DIDIT_API_KEY },
  body: JSON.stringify({
    workflow_id: DIDIT_APP_ID,
    metadata: { user_id: userId },
    redirect_url: 'https://communi.email/verify-complete'  // User returns here
  })
});

const { session_id, verification_url } = await response.json();

// 2. Redirect user to Didit
window.location.href = verification_url;

// 3. User completes verification on Didit

// 4. User redirected back to /verify-complete
// Frontend polls for status
const checkStatus = async () => {
  const result = await fetch(`/api/identity/didit/check/${session_id}`);

  if (result.status === 'Approved') {
    // Show success, continue
  } else if (result.status === 'Declined') {
    // Show error
  } else {
    // Still processing, poll again in 3 seconds
    setTimeout(checkStatus, 3000);
  }
};

checkStatus();
```

**Backend polling endpoint:**
```typescript
// /api/identity/didit/check/[sessionId]/+server.ts
export const GET: RequestHandler = async ({ params }) => {
  const { sessionId } = params;

  // Poll Didit API
  const response = await fetch(
    `https://verification.didit.me/v2/session/${sessionId}/decision/`,
    { headers: { 'x-api-key': DIDIT_API_KEY } }
  );

  const data = await response.json();

  if (data.status === 'Approved') {
    // Process verification result (extract ID data, create hash, update user)
    await processVerificationResult(data);
  }

  return json({ status: data.status });
};
```

**Pros:**
- ✅ Simple to implement (no HMAC verification)
- ✅ Works in development (no public webhook URL needed)
- ✅ We control retry logic
- ✅ No webhook secret management

**Cons:**
- ⏱️ Slight delay (3-5 second polling interval)
- ⚠️ User must return to our site to complete flow
- ⚠️ Higher API call volume (but Didit doesn't charge per call)

---

### **Phase 1D: Polish (Weeks 14-18)**

Add webhooks for better UX:

```typescript
// /api/identity/didit/webhook/+server.ts
export const POST: RequestHandler = async ({ request }) => {
  // Verify HMAC signature
  const isValid = verifyDiditWebhook(body, signature, timestamp, secret);

  if (!isValid) {
    throw error(401, 'Invalid signature');
  }

  // Process verification asynchronously
  if (body.status === 'Approved') {
    await processVerificationResult(body.decision);

    // Send email notification to user
    await sendEmail({
      to: user.email,
      subject: 'Verification Complete',
      body: 'Your identity has been verified. Click here to continue...'
    });
  }

  return json({ received: true });
};
```

**Benefits:**
- ✅ Real-time updates (instant)
- ✅ Can notify user via email/SMS even if they closed tab
- ✅ Lower polling load
- ✅ Better user experience

**Required:**
- Public webhook URL (configured in Didit Console)
- HMAC signature verification (security)
- Webhook secret management

---

## Implementation Decision Matrix

| Scenario | self.xyz | Didit.me |
|----------|----------|----------|
| **Phase 1 MVP (Weeks 1-9)** | Synchronous POST | Polling |
| **Phase 1D Polish (Weeks 14-18)** | Synchronous POST | Webhook + Email |
| **Development Environment** | ✅ Works locally | ✅ Works locally (polling) |
| **Production Environment** | ✅ Works | ✅ Works (both approaches) |

---

## Final Recommendation

### **Phase 1A/1B (Current): Implement Polling Only**

**Reasons:**
1. **Faster to implement** - No HMAC verification, webhook secret management
2. **Easier to test** - Works on localhost, no ngrok needed
3. **Good enough UX** - Most users complete verification and return to our site
4. **Lower risk** - We control the retry logic, no dependency on webhook delivery

**Implementation:**
- ✅ self.xyz: `/api/identity/verify` (synchronous, frontend-initiated)
- ✅ Didit.me: `/api/identity/didit/check/[sessionId]` (polling endpoint)
- ✅ Frontend: Poll every 3 seconds until status changes

---

### **Phase 1D (Polish): Add Webhooks**

**When:**
- After core verification flows working
- After we have production domain/infrastructure
- When we want to add email notifications

**Implementation:**
- Add `/api/identity/didit/webhook` endpoint
- Configure webhook URL in Didit Console
- Implement HMAC verification
- Add email notifications for async completions
- Keep polling as fallback (in case webhook delivery fails)

---

## Code Changes Required (Phase 1 Polling Approach)

### **self.xyz: No Changes Needed**

Our existing approach already correct:
- ✅ Backend endpoint receives POST from frontend
- ✅ Synchronous verification flow
- ✅ Frontend handles success/error callbacks

---

### **Didit.me: Polling Implementation**

**New endpoints needed:**

1. **Create Session** - `/api/identity/didit/init/+server.ts`
   - POST to Didit API
   - Return verification URL
   - Store session ID in database

2. **Check Status** - `/api/identity/didit/check/[sessionId]/+server.ts`
   - GET from Didit API
   - Process result if Approved
   - Return status to frontend

**Frontend polling logic:**

```svelte
<!-- GovernmentIDFlow.svelte -->
<script lang="ts">
  let sessionId = '';
  let status = 'pending';

  async function startVerification() {
    // Create session
    const response = await fetch('/api/identity/didit/init', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });

    const { session_id, verification_url } = await response.json();
    sessionId = session_id;

    // Redirect to Didit
    window.location.href = verification_url;
  }

  async function checkStatus() {
    const response = await fetch(`/api/identity/didit/check/${sessionId}`);
    const data = await response.json();

    status = data.status;

    if (status === 'Approved') {
      // Show success, allow continuation
    } else if (status === 'Declined') {
      // Show error
    } else if (status === 'In Progress' || status === 'Not Started') {
      // Poll again in 3 seconds
      setTimeout(checkStatus, 3000);
    }
  }

  // Start polling when user returns from Didit
  onMount(() => {
    if (sessionId) {
      checkStatus();
    }
  });
</script>
```

---

## Summary

**Do we need webhooks?**

- **self.xyz:** ❌ No, frontend-initiated synchronous flow
- **Didit.me:** ⚠️ Not required for Phase 1, but nice to have for Phase 1D

**What should we implement now?**

1. ✅ self.xyz synchronous verification endpoint (already mostly correct)
2. ✅ Didit.me polling endpoints (simpler, faster to implement)
3. ⏳ Didit.me webhooks (add in Phase 1D for better UX)

**Next steps:**
1. Implement Didit polling approach first
2. Test end-to-end flow
3. Add webhooks later when we have production infrastructure

This gives us:
- ✅ Working verification flows (both SDKs)
- ✅ Faster implementation (no webhook complexity)
- ✅ Easier development/testing
- ✅ Clear upgrade path (add webhooks in Phase 1D)
