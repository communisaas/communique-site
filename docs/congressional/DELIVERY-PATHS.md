# Delivery Paths - Technical Architecture

**Date**: 2025-01-08
**Purpose**: Clarify backend routing and OAuth verification strategy

---

## The Two Delivery Paths

### Path 1: API-Based Delivery (Congressional)
**Target**: U.S. Congress, State Legislatures with official APIs

**Flow**:
```
User clicks "Send"
    ↓
Frontend collects address
    ↓
Address → Census API → Congressional district
    ↓
Backend routes to CWC API (Communicating with Congress)
    ↓
Message delivered through official channels
    ↓
Delivery confirmed via API response
```

**Why we control delivery**:
- Official APIs require server-side keys
- Rate limiting needs backend coordination
- Delivery receipts come from API
- Constituent verification happens server-side

**User UX**:
- Click "Send Now"
- Enter address (for routing)
- Message sent automatically
- Confirmation shown

---

### Path 2: Direct Email (Everything Else)
**Target**: Companies, School Boards, Public Officials with email, HOAs, etc.

**Flow**:
```
User clicks "Send"
    ↓
Frontend opens mailto: link
    ↓
User's email client opens with pre-filled message
    ↓
User hits "Send" in their email client
    ↓
Email sent directly from user's account
    ↓
OAuth verification: Did they actually send it?
```

**Why user sends directly**:
- No official API (just email addresses)
- User's email = more authentic than platform email
- OAuth can verify it actually got sent
- No rate limiting issues

**User UX**:
- Click "Send Now"
- Email client opens (pre-filled)
- User hits "Send"
- We verify via OAuth

---

## The Confusion Point

### What Users See:
> "Send message to Delta Airlines"

### What Actually Happens (Two Paths):

**If Delta has official API** (Path 1):
- Backend sends via API
- User just clicks "Send"

**If Delta only has email** (Path 2):
- User's email client opens
- User sends from their account
- OAuth verifies delivery

**The Problem**:
Users don't know which path is happening. Both look like "Send Now" button.

---

## OAuth Verification Strategy

### For Path 2 (Direct Email):

**Challenge**: How do we know user actually sent the email?

**Solution**: OAuth access to user's email provider

**Flow**:
```
1. User clicks "Send Now"
2. Modal: "Connect your email to verify delivery"
3. User authorizes Gmail/Outlook (OAuth)
4. mailto: link opens with pre-filled message
5. User sends from their email client
6. We check their Sent folder (via OAuth API)
7. If found → Verified delivery → Increment counter
8. If not found → Remind user to send
```

**What we check**:
- Subject line matches
- Recipient matches
- Timestamp (sent within last 10 minutes)
- Message body matches (fuzzy match, users might edit)

**Privacy**:
- OAuth = read-only Sent folder access
- Never store credentials
- Token expires after verification
- User can revoke anytime

---

## The User Mental Model

### What Should Users Think?

**For Congress/Official APIs**:
> "Click 'Send' and we'll deliver it through official channels"

**For Direct Email**:
> "Click 'Send' to open your email. We'll verify you sent it."

### The Unified UX:

Both paths use same button: **"Send Now"**

But the modal explains what happens:

**Path 1 (API)**:
```
┌─────────────────────────────────────┐
│   Send to your representatives     │
│                                     │
│   Enter your address                │
│   [Street, City, State, Zip]        │
│                                     │
│   [Send Message]                    │
│                                     │
│   We'll deliver through official    │
│   congressional channels            │
└─────────────────────────────────────┘
```

**Path 2 (Direct Email)**:
```
┌─────────────────────────────────────┐
│   Send to Delta Airlines            │
│                                     │
│   Connect email to verify delivery  │
│   [Connect Gmail]                   │
│   [Connect Outlook]                 │
│                                     │
│   Your email will open pre-filled.  │
│   We'll verify you sent it.         │
└─────────────────────────────────────┘
```

---

## Backend Architecture

### Database Schema:

```typescript
Template {
  deliveryMethod: 'cwc' | 'email' | 'api'
  recipientConfig: {
    // For 'cwc':
    chamber: 'house' | 'senate' | 'both'

    // For 'email':
    recipientEmails: string[]  // ["support@delta.com"]

    // For 'api':
    apiEndpoint: string
    apiProvider: string
  }
}
```

### Routing Logic:

```typescript
async function sendMessage(template, user) {
  if (template.deliveryMethod === 'cwc') {
    // Path 1: Official Congressional API
    const district = await getDistrict(user.address);
    const reps = await getRepresentatives(district);
    return await cwcAPI.sendMessage(reps, template.message);
  }

  if (template.deliveryMethod === 'email') {
    // Path 2: Direct email with OAuth verification
    const mailtoUrl = buildMailto(template);

    // Return mailto URL + verification instructions
    return {
      action: 'mailto',
      url: mailtoUrl,
      verifyInstructions: 'We'll check your Sent folder to verify delivery'
    };
  }
}
```

---

## What Makes Sense (UX Clarity)

### Option A: Honest Labels

**Congressional Templates**:
> **Send via Official Channels**
> We'll deliver through the Congressional Web Communication API

**Direct Email Templates**:
> **Send from Your Email**
> Your email will open pre-filled. We'll verify you sent it.

**Pros**: Crystal clear what happens
**Cons**: More words, might confuse users

---

### Option B: Unified Button, Clear Modal

**All templates**:
> **Send Now**

**Modal content varies**:
- Congressional → Address collection + auto-send
- Direct Email → OAuth + mailto

**Pros**: Simple UX, clarity in modal
**Cons**: Users don't know until modal opens

---

### Option C: Icons + Tooltips

**Button**:
> **Send Now** [🏛️ icon for Congress, ✉️ icon for direct email]

**Tooltip**:
- 🏛️ = "Delivered through official channels"
- ✉️ = "Sent from your email"

**Pros**: Visual hint without clutter
**Cons**: Icons might be missed

---

## Recommended Approach

### Use Option B (Unified Button, Clear Modal)

**Why**:
1. **Simple UX** - One button ("Send Now") everywhere
2. **Clarity when needed** - Modal explains delivery method
3. **Flexibility** - Can add more delivery paths later
4. **No premature explanation** - Don't confuse before they click

### Implementation:

**Template Card** (Unified):
```svelte
<button class="send-button">Send Now</button>
```

**Modal Content** (Path-Specific):

```typescript
if (template.deliveryMethod === 'cwc') {
  showModal('AddressCollectionModal');
  // → User enters address → Auto-send via API
}

if (template.deliveryMethod === 'email') {
  showModal('EmailVerificationModal');
  // → User connects OAuth → mailto opens → We verify
}
```

---

## OAuth Verification Flow (Detailed)

### Step 1: User Intent
```
User clicks "Send Now" on company template
```

### Step 2: OAuth Connection
```
┌─────────────────────────────────────┐
│   Verify your message               │
│                                     │
│   Connect your email to prove       │
│   delivery and track responses      │
│                                     │
│   [🔵 Connect Gmail]                │
│   [🔷 Connect Outlook]              │
│                                     │
│   Your credentials are never stored │
└─────────────────────────────────────┘
```

### Step 3: OAuth Authorization
```
User redirected to Gmail/Outlook
→ Authorizes read-only Sent folder access
→ Redirected back to Communiqué
```

### Step 4: mailto Launch
```
mailto:support@delta.com?subject=...&body=...

User's email client opens
User clicks "Send" in their client
```

### Step 5: Verification
```
Backend polls Gmail API (via OAuth token):
→ GET /gmail/v1/users/me/messages?q=to:support@delta.com
→ Finds message sent in last 10 minutes
→ Verifies subject matches
→ Increments template counter
→ Notifies user: "✓ Delivery verified"
```

### Step 6: Cleanup
```
Store verification:
→ templateId: "delta-baggage-complaint"
→ verifiedAt: "2025-01-08T12:34:56Z"
→ recipientEmail: "support@delta.com"

Revoke OAuth token (optional):
→ User can keep token for future sends
→ Or revoke immediately after verification
```

---

## Privacy Considerations

### What We Access (Path 2 - Direct Email):
- ✅ Read-only Sent folder
- ✅ Specific message (subject + recipient match)
- ✅ Timestamp (within 10 minutes of send)

### What We DON'T Access:
- ❌ Inbox
- ❌ Contacts
- ❌ Message content (beyond verification)
- ❌ Full email history

### User Control:
- User can revoke OAuth anytime
- Token expires after verification
- User sees what we access (OAuth consent screen)

---

## Technical Implementation (Backend)

### Gmail API Verification:

```typescript
async function verifyEmailSent(
  userId: string,
  oauthToken: string,
  expectedRecipient: string,
  expectedSubject: string,
  sentAfter: Date
): Promise<boolean> {
  const gmail = google.gmail({ version: 'v1', auth: oauthToken });

  const query = [
    `to:${expectedRecipient}`,
    `subject:"${expectedSubject}"`,
    `after:${Math.floor(sentAfter.getTime() / 1000)}`
  ].join(' ');

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 1
  });

  return response.data.messages?.length > 0;
}
```

---

## The Bottom Line

### Two Delivery Paths:

**Path 1 (Congressional - API-based)**:
- User clicks "Send" → Enter address → Auto-delivery via CWC API
- Backend controls delivery
- Immediate confirmation

**Path 2 (Direct Email - OAuth-verified)**:
- User clicks "Send" → Connect OAuth → mailto opens → User sends
- User controls delivery
- Verification via Sent folder

### Unified UX:
- Same button ("Send Now")
- Different modals (path-specific)
- Clear explanation at modal-open time

### Why This Works:
- Simple for users (one button)
- Flexible (add more paths later)
- Privacy-preserving (OAuth read-only)
- Verifiable (Sent folder check)

---

**Next**: Implement EmailVerificationModal.svelte with OAuth flow
