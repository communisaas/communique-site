# Universal Decision-Maker Voice System

**Date**: 2025-01-08
**Problem**: Copy is too narrow (Congress-only) and destroyed what worked (universality, WHY explanation)
**Solution**: Universal voice for ALL decision-makers with clear routing logic

---

## What the Prior Copy Did Well

### ✅ "We'll find your representatives"
- **Clear action** - "find"
- **Clear benefit** - User gets matched to right decision-maker
- **Implies routing** - Address determines WHO gets message

### ✅ "to route to the correct representatives"
- **Explains WHY** - Not just data collection
- **Routing logic** - Your location = your decision-makers
- **Constituent verification** - Address proves you're affected

### ✅ Process transparency
- "find → send → forget" = Clear 3-step process

---

## What I Destroyed

### ❌ Removed universality
- **Before**: "find your representatives" (works for Congress, school boards, local officials)
- **After**: "Their desk" (too vague, no routing logic)

### ❌ Removed WHY explanation
- **Before**: "to route to the correct representatives"
- **After**: No explanation for why address is needed

### ❌ Too narrow
- **Before**: Could work for ANY decision-maker (rep = representative of ANY body)
- **After**: "Congress" only

---

## The Universal Decision-Maker Spectrum

### Who do people have problems with?

**Government (All Levels)**:
- Congress (federal legislators)
- State legislators
- City council members
- County supervisors
- School boards
- Planning commissions
- Zoning boards
- HOA boards

**Corporations**:
- Tech companies (Facebook, Google, Twitter)
- Airlines (customer complaints)
- Banks (fee disputes)
- Insurance companies
- Telecom providers (Comcast, AT&T)

**Institutions**:
- Universities (tuition, policies)
- Healthcare systems
- Landlords / property management
- Utilities (PG&E, water, electric)

**Verified Email Delivery**:
- ANY email can be verified via OAuth (Gmail, Outlook, etc.)
- User connects email provider → We verify delivery via "Sent" folder
- Unified UX paradigm: `mailto:` link (universal)

---

## When is Address Required?

### ✅ Address REQUIRED (Constituent verification):
1. **Government officials** - Must prove you're in their jurisdiction
2. **School boards** - Must prove you're in district
3. **City/county** - Must prove you're a resident
4. **HOA** - Must prove you live there

### ⚠️ Address OPTIONAL (But improves delivery):
1. **Companies** - No geographic restriction, but "I'm a customer in CA" adds weight
2. **Universities** - Student status matters more than address
3. **Corporate complaints** - "I'm affected" matters, not location

### ❌ Address NOT NEEDED (Email verification only):
1. **Public figures** - Anyone can contact them
2. **Customer service** - No constituent requirement
3. **General advocacy** - Open to public

---

## The Unified Routing Logic

### The Core Pattern:
> **Your [identifier] routes your message to the right [decision-maker].**

**Examples**:
- Your **address** routes to your **representatives**
- Your **zip code** routes to your **school board**
- Your **email domain** routes to your **company contacts**
- Your **student ID** routes to **university administration**

### Universal Copy Structure:

**Header**: What we're doing
**Subtext**: Why we need [identifier] + Privacy promise
**Process**: Find → Send → Forget/Verify

---

## Revised Universal Voice

### Homepage Hero (All Contexts)

**Before** (Too narrow):
> Your voice. Their desk.
> Send verified messages to Congress.

**After** (Universal):
> **Your voice. Their decision.**
>
> Send verified messages to the people who decide.
> Congress. Companies. School boards. Anyone with power.

**Why it works**:
- "Their decision" = Universal (not just Congress)
- "People who decide" = Clear target
- Examples = Show range (Congress, companies, school boards)

---

### Address Collection (When Required)

**Context**: Sending to government official, school board, local HOA

**Header**:
> **Find who represents you**

**Subtext**:
> Your address routes your message to the right officials.
> Used once. Deleted immediately.

**Progressive disclosure**:
> <details>Why your address? →</details>
> Officials only respond to constituents in their jurisdiction.
> Your address proves you're affected by their decisions.

**Why it works**:
- "Find who represents you" = Clear benefit
- "routes your message" = Explains WHY (not data collection)
- "Used once. Deleted immediately." = Privacy promise
- Progressive disclosure = Deeper "why" for curious users

---

### Email Verification (When Address Not Required)

**Context**: Sending to company, public figure, or open petition

**Header**:
> **Verify your message**

**Subtext**:
> Connect your email to prove delivery.
> We never store your credentials.

**Process**:
> 1. Connect Gmail/Outlook (OAuth)
> 2. Send message (mailto: link opens)
> 3. We verify it's in your Sent folder

**Why it works**:
- No address needed
- OAuth = User stays in control
- Verification = Proof of delivery
- Unified UX = mailto: link (works everywhere)

---

### Zip Code Only (Lightweight verification)

**Context**: School board, local issue, light touch

**Header**:
> **Find your school board**

**Subtext**:
> Your zip code finds the right district.
> We don't store it.

**Why it works**:
- Less friction than full address
- Still routes correctly (zip → district)
- Clear privacy promise

---

## OAuth Email Provider Integration (Frontend Stub)

### The Vision:
**Unified delivery verification** - Works for ANY email recipient.

### How it works:
1. **User clicks "Send Message"** → Modal opens
2. **User sees recipient email** → `support@company.com`
3. **Two options**:
   - **Option A**: "Send via your email" (OAuth)
   - **Option B**: "Send via our system" (if we have API integration)

### Option A: OAuth Email (Universal)

**Step 1: Connect email provider**
```
┌─────────────────────────────────────┐
│   Send verified message             │
│                                     │
│   Connect your email to:            │
│   • Prove you sent it               │
│   • Track delivery                  │
│   • Get response notifications      │
├─────────────────────────────────────┤
│   [🔵 Connect Gmail]                │
│   [🔷 Connect Outlook]              │
│   [✉️  Connect Other Email]         │
└─────────────────────────────────────┘
```

**Step 2: Compose & send (mailto: opens)**
```
mailto:support@company.com?subject=...&body=...
```

**Step 3: Verify delivery**
```
┌─────────────────────────────────────┐
│   ✓ Message sent                    │
│                                     │
│   We'll check your Sent folder to  │
│   verify delivery within 5 minutes. │
│                                     │
│   You'll get notified when they:    │
│   • Open your message               │
│   • Reply to you                    │
└─────────────────────────────────────┘
```

### Frontend Implementation (Stub)

**File**: `/src/lib/components/email/EmailProviderConnect.svelte`

```svelte
<script lang="ts">
  let providers = [
    { id: 'gmail', name: 'Gmail', icon: 'gmail-icon.svg', color: 'bg-red-500' },
    { id: 'outlook', name: 'Outlook', icon: 'outlook-icon.svg', color: 'bg-blue-500' },
    { id: 'yahoo', name: 'Yahoo', icon: 'yahoo-icon.svg', color: 'bg-purple-500' }
  ];

  function connectProvider(providerId: string) {
    // TODO: OAuth flow
    window.location.href = `/auth/email-provider/${providerId}`;
  }
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold">Verify your message</h2>
  <p class="text-sm text-slate-600">
    Connect your email to prove delivery and track responses.
  </p>

  <div class="space-y-2">
    {#each providers as provider}
      <button
        onclick={() => connectProvider(provider.id)}
        class="flex w-full items-center gap-3 rounded-lg border p-3 hover:bg-slate-50"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-full {provider.color}">
          <img src={provider.icon} alt={provider.name} class="h-6 w-6" />
        </div>
        <div class="flex-1 text-left">
          <p class="font-medium">{provider.name}</p>
          <p class="text-xs text-slate-500">Connect via OAuth</p>
        </div>
        <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </button>
    {/each}
  </div>

  <details class="text-center">
    <summary class="cursor-pointer text-xs text-slate-500">Why connect email? →</summary>
    <p class="mt-2 text-xs text-slate-600">
      We verify your message was sent by checking your Sent folder.
      Your credentials are never stored - we use OAuth (same as "Sign in with Google").
    </p>
  </details>
</div>
```

---

## Decision Tree: When to Use What

```
User clicks "Send Message"
    ↓
Is recipient a government official?
    ├─ YES → Require full address
    │         "Find who represents you"
    │         "Your address routes your message"
    │
    └─ NO → Is recipient location-based? (school board, HOA, local)
            ├─ YES → Require zip code only
            │         "Find your [school board/HOA]"
            │         "Your zip code finds the right district"
            │
            └─ NO → Email verification only
                    "Verify your message"
                    "Connect your email to prove delivery"
```

---

## Revised Universal Copy Map

### 1. Homepage Hero (Universal)

```
Your voice. Their decision.

Send verified messages to the people who decide.
Congress. Companies. School boards. Anyone with power.

Join 12,847 people making decision-makers listen.
```

### 2. Template Card (Context-aware)

**Congressional template**:
> 5,247 sent to Congress · 89% delivered

**Company template**:
> 1,823 sent to Delta Airlines · 67% got responses

**School board template**:
> 412 sent to SF school board · 94% read

### 3. Address Collection (Government)

```
Find who represents you

Your address routes your message to the right officials.
Used once. Deleted immediately.

[Street, City, State, Zip fields]

[Find Representatives]

<details>Why your address? →</details>
```

### 4. Zip Code Collection (School/Local)

```
Find your school board

Your zip code finds the right district.
We don't store it.

[Zip code field]

[Find School Board]
```

### 5. Email Verification (Companies/Open)

```
Verify your message

Connect your email to prove delivery.
We never store your credentials.

[Connect Gmail]
[Connect Outlook]
[Connect Other Email]

<details>Why connect email? →</details>
```

---

## Implementation Priority

### Phase 1: Restore Universality (This Week)
1. **Homepage hero** - "Your voice. Their decision."
2. **Address modal** - "Find who represents you / Your address routes your message"
3. **Add context examples** - "Congress. Companies. School boards."

### Phase 2: Email Provider OAuth (Next Week)
1. **Create EmailProviderConnect.svelte** - Frontend stub
2. **OAuth flow** - `/auth/email-provider/:provider`
3. **Sent folder verification** - Check via Gmail/Outlook API
4. **Delivery tracking** - "We verified your message was sent"

### Phase 3: Smart Routing (Week 3)
1. **Decision tree logic** - Government = address, Company = email, School = zip
2. **Dynamic modals** - Show correct collection method per template
3. **Template metadata** - `requiresAddress: boolean`, `requiresZip: boolean`, `requiresEmail: boolean`

---

## The Core Insight

### What Worked Before:
> "We'll find your representatives" + "to route to the correct representatives"

**Why it worked**:
1. **Clear benefit** - "find" (we do the work)
2. **Clear routing logic** - "route to correct" (address determines recipient)
3. **Universal term** - "representatives" (not just Congress)

### What Works Now (Revised):
> "Find who represents you" + "Your address routes your message to the right officials"

**Why it works**:
1. **Same benefit** - "find who represents you"
2. **Clearer routing** - "routes your message" (explicit cause → effect)
3. **Still universal** - "who represents you" (Congress, school board, HOA, company reps)
4. **Privacy preserved** - "Used once. Deleted immediately."

---

## The Bottom Line

**What I destroyed**:
- ❌ Universality ("Congress" too narrow)
- ❌ WHY explanation (no routing logic)
- ❌ Clear action + benefit ("find your representatives")

**What we're restoring**:
- ✅ Universal applicability (Congress, companies, school boards, HOAs)
- ✅ Clear routing logic ("Your address routes your message")
- ✅ Action + benefit ("Find who represents you")
- ✅ Privacy promise ("Used once. Deleted immediately.")

**Next**: Implement universal voice + email provider OAuth stub
