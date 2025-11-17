# Multi-Target Delivery System - Hackathon Implementation Spec

**Status**: 🚧 In Progress
**Last Updated**: 2025-11-15
**Goal**: Enable templates to contact Congress + external decision-makers in one action

---

## **Core Principle: Templates = Lists of Decision-Makers**

Templates are **never** "Congress-only" or "email-only." They're **always multi-target**, and the recipient list determines delivery flow.

**User mental model**: "Who do you want to reach about this issue?"

**Example template**: "Tell everyone about climate action"
- Recipients: Your 2 Senators + Your House Rep + EPA Administrator + President Biden
- User clicks "Send" → **One email** goes to all recipients
- **External emails** (EPA, Biden) delivered directly via mailto
- **Congressional offices** intercepted by our mail receiver → CWC API

---

## **Architecture Overview**

```
User Template Creator
    ↓
Specifies Recipients:
  - [x] Congress (user's district)
  - [x] EPA Administrator (epa@epa.gov)
  - [x] President Biden (biden@whitehouse.gov)
    ↓
User Clicks "Send"
    ↓
System Checks:
  - Has congressional recipients? → Collect address
  - Generate mailto URL with ALL recipients
    ↓
Mailto URL Opens:
  TO: epa@epa.gov, biden@whitehouse.gov, congress+slug+userId@communique.org
  SUBJECT: Climate action now
  BODY: [Template message]
    ↓
User Sends from Mail App
    ↓
Email Splits:
  - epa@epa.gov → Delivered directly
  - biden@whitehouse.gov → Delivered directly
  - congress+slug+userId@communique.org → Mail Receiver
    ↓
Mail Receiver Flow:
  1. Receives email from user's mail app
  2. Parses: congress+climate-action+user123@communique.org
  3. Looks up template + user address from database
  4. Resolves congressional representatives (2 Senators + 1 House Rep)
  5. Generates CWC XML for each representative
  6. Submits to Lambda workers (Senate + House queues)
  7. Tracks delivery status in database
    ↓
Lambda Workers:
  - Senate Worker: Direct CWC API submission
  - House Worker: GCP Proxy → House CWC API
    ↓
Delivery Confirmation:
  - User sees tracking page: "Delivered to Senator Warren ✓"
```

---

## **Database Schema**

### **New Table: CongressionalSubmission**

Tracks email-based congressional submissions (mail receiver → CWC API flow).

```prisma
model CongressionalSubmission {
  id                String    @id @default(cuid())

  // Tracking identifiers
  tracking_email    String    @unique // "congress+slug+userId@communique.org"
  template_id       String
  user_id           String    // REQUIRED (no guest support)

  // User data (from inbound email)
  sender_email      String    // User's actual email address
  sender_name       String?   // Extracted from email
  message_body      String    // What user actually sent
  message_subject   String?   // Email subject line

  // Congressional recipients (resolved from template + user address)
  target_representatives Json   // [{ bioguideId, name, chamber, officeCode }]

  // Delivery tracking
  received_at       DateTime? // When mail receiver got the email
  submitted_at      DateTime? // When submitted to CWC
  delivery_status   String    @default("pending") // 'pending' | 'received' | 'submitted' | 'delivered' | 'failed'

  // CWC Job correlation
  cwc_job_id        String?   // Links to CWCJob table
  cwc_confirmations Json?     // Array of { office, confirmationNumber, status }

  // Error tracking
  error_message     String?
  error_timestamp   DateTime?

  // Metadata
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  @@index([tracking_email])
  @@index([template_id])
  @@index([user_id])
  @@index([delivery_status])
  @@index([created_at])
  @@map("congressional_submission")
}
```

### **Template Schema Changes**

**Current state** (schema.prisma:141-287):
- ✅ `recipient_config` (Json) - Already exists, perfect!
- ❌ `deliveryMethod` (String) - **DEPRECATED, will remove**

**New `recipient_config` structure**:

```typescript
interface TemplateRecipientConfig {
  type: 'multi-target'; // Always this value
  recipients: TemplateRecipient[];
}

interface TemplateRecipient {
  type: 'congressional' | 'email';

  // Congressional recipients
  chamber?: 'house' | 'senate'; // 'house' | 'senate' | undefined (both)
  selection?: 'user_district' | 'all_congress' | 'specific_members';
  specific_bioguide_ids?: string[]; // For targeting specific members

  // Email recipients
  email?: string;
  name?: string; // Display name for UI
  organization?: string; // For context
}
```

**Migration strategy**:
- Phase 1 (Hackathon): Coexist with `deliveryMethod` for backward compatibility
- Phase 2 (Post-hackathon): Migrate all templates, remove `deliveryMethod`

---

## **Example Templates**

### **Congress-Only Template** (existing)
```json
{
  "type": "multi-target",
  "recipients": [
    {
      "type": "congressional",
      "selection": "user_district"
    }
  ]
}
```
→ User sends to: `congress+slug+userId@communique.org`

### **Email-Only Template** (existing)
```json
{
  "type": "multi-target",
  "recipients": [
    {
      "type": "email",
      "email": "epa@epa.gov",
      "name": "EPA Administrator"
    },
    {
      "type": "email",
      "email": "biden@whitehouse.gov",
      "name": "President Biden"
    }
  ]
}
```
→ User sends to: `epa@epa.gov, biden@whitehouse.gov`

### **Mixed Template** (NEW - hackathon goal)
```json
{
  "type": "multi-target",
  "recipients": [
    {
      "type": "congressional",
      "selection": "user_district"
    },
    {
      "type": "email",
      "email": "epa@epa.gov",
      "name": "EPA Administrator"
    },
    {
      "type": "email",
      "email": "biden@whitehouse.gov",
      "name": "President Biden"
    }
  ]
}
```
→ User sends to: `congress+slug+userId@communique.org, epa@epa.gov, biden@whitehouse.gov`

**Key insight**: Congressional receiver email is just another recipient in the mailto URL.

---

## **User Flow**

### **1. Template Creator UX**

**Question**: "Who should receive this message?"

**UI Pattern**: Multi-select with intuitive agency

```
┌─────────────────────────────────────────────┐
│ Who should receive this message?            │
├─────────────────────────────────────────────┤
│                                             │
│ ☐ Your congressional representatives       │
│   └─ [Auto-detected from your address]     │
│                                             │
│ ☐ Federal agencies                          │
│   └─ [+] Add agency email                   │
│                                             │
│ ☐ State officials                           │
│   └─ [+] Add official email                 │
│                                             │
│ ☐ Corporate decision-makers                 │
│   └─ [+] Add corporate email                │
│                                             │
│ ☐ Custom recipients                         │
│   └─ [+] Add email address                  │
│                                             │
└─────────────────────────────────────────────┘

[Continue →]
```

**Intuiting agency**:
- Checkboxes → Clear opt-in ("I want to reach these people")
- Category labels → Natural language ("Federal agencies" not "email recipients")
- Progressive disclosure → Add specific emails within categories
- Auto-detection → "Your congressional representatives" shows district when known

**Implementation notes**:
- Component: `src/lib/components/template/creator/RecipientSelector.svelte`
- State management: Track `selectedRecipients: TemplateRecipient[]`
- Validation: At least one recipient required
- Preview: Show mailto recipients before creation

### **2. Template Modal Flow** (User Sending)

**Current file**: `src/lib/components/template/TemplateModal.svelte`

**Changes needed**:

```typescript
// Lines 436-473: Modify handleSendConfirmation()

async function handleSendConfirmation(sent: boolean) {
  if (!sent) {
    // Retry mailto flow
    handleUnifiedEmailFlow(true);
    return;
  }

  // User confirmed they sent the email

  // STEP 1: Check if template has congressional recipients
  const hasCongressionalRecipients = template.recipient_config.recipients.some(
    r => r.type === 'congressional'
  );

  if (hasCongressionalRecipients) {
    // STEP 2: Ensure user has address (for congressional routing)
    const currentUser = $page.data?.user || user;
    const hasAddress = currentUser?.street && currentUser?.city &&
                      currentUser?.state && currentUser?.zip;

    if (!hasAddress) {
      // Collect address inline (already implemented at line 906)
      collectingAddress = true;
      needsAddress = true;
      return;
    }

    // STEP 3: Create tracking record in database
    // This allows mail receiver to route congressional messages
    const { api } = await import('$lib/core/api/client');

    await api.post('/congressional/submissions/track', {
      templateId: template.id,
      userId: user.id,
      trackingEmail: `congress+${template.slug}+${user.id}@communique.org`,
      userAddress: {
        street: currentUser.street,
        city: currentUser.city,
        state: currentUser.state,
        zip: currentUser.zip
      }
    });
  }

  // STEP 4: Show success + tracking
  modalActions.setState('celebration');

  // Navigate to template page
  coordinated.setTimeout(async () => {
    await goto(`/s/${template.slug}`, { replaceState: true });
  }, 1500, 'direct-navigation', componentId);
}
```

### **3. Mailto URL Generation**

**Current file**: `src/lib/services/emailService.ts:37`

**Changes needed**:

```typescript
// Modify analyzeEmailFlow() to handle multi-target recipients

export function analyzeEmailFlow(template: Template, user: User | null): EmailFlow {
  const recipients: string[] = [];

  // Extract email recipients
  template.recipient_config.recipients
    .filter(r => r.type === 'email')
    .forEach(r => {
      if (r.email) recipients.push(r.email);
    });

  // Add congressional mail receiver if template has congressional recipients
  const hasCongressional = template.recipient_config.recipients.some(
    r => r.type === 'congressional'
  );

  if (hasCongressional) {
    if (!user?.id) {
      // No guest support - require login
      return {
        requiresAuth: true,
        mailtoUrl: null,
        error: 'Login required for congressional messages'
      };
    }

    const trackingEmail = `congress+${template.slug}+${user.id}@communique.org`;
    recipients.push(trackingEmail);
  }

  // Build mailto URL
  const subject = encodeURIComponent(template.title);
  const body = encodeURIComponent(template.message_body);
  const mailtoUrl = `mailto:${recipients.join(',')}?subject=${subject}&body=${body}`;

  return {
    requiresAuth: false,
    mailtoUrl,
    recipients,
    hasCongressional
  };
}
```

---

## **Mail Receiver Implementation**

### **Infrastructure: SendGrid Inbound Parse**

**Setup**:
1. Configure SendGrid domain: `communique.org`
2. Set up Inbound Parse webhook: `https://communique.org/api/email/receive`
3. All emails to `congress+*@communique.org` → webhook

**Alternative (AWS SES)**:
1. Configure SES to receive emails for `communique.org`
2. SES → Lambda → POST to `/api/email/receive`

**Hackathon decision**: Use SendGrid (faster setup, 3rd-party dependency OK for MVP)

### **API Endpoint: Inbound Email Receiver**

**File**: `src/routes/api/email/receive/+server.ts` (NEW)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';
import { submitToCongressViaLambda } from '$lib/core/congress/mail-receiver-submission';

/**
 * Inbound Email Webhook (SendGrid Inbound Parse)
 *
 * Receives emails sent to congress+{slug}+{userId}@communique.org
 * Submits to CWC API via Lambda workers
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse SendGrid Inbound Parse payload
    const formData = await request.formData();
    const email = parseInboundEmail(formData);

    // Extract tracking email from TO field
    const trackingMatch = email.to.find(addr =>
      addr.match(/congress\+(.+?)\+(.+?)@communique\.org/)
    );

    if (!trackingMatch) {
      throw error(400, 'Not a congressional tracking email');
    }

    const match = trackingMatch.match(/congress\+(.+?)\+(.+?)@communique\.org/);
    if (!match) {
      throw error(400, 'Invalid tracking email format');
    }

    const [_, templateSlug, userId] = match;

    // Look up template and user
    const template = await prisma.template.findUnique({
      where: { slug: templateSlug }
    });

    if (!template) {
      throw error(404, 'Template not found');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        street: true,
        city: true,
        state: true,
        zip: true
      }
    });

    if (!user) {
      throw error(404, 'User not found');
    }

    if (!user.street || !user.city || !user.state || !user.zip) {
      throw error(400, 'User address not found - cannot route to congressional representatives');
    }

    // Create Congressional Submission record
    const submission = await prisma.congressionalSubmission.create({
      data: {
        tracking_email: trackingMatch,
        template_id: template.id,
        user_id: user.id,
        sender_email: email.from,
        sender_name: email.fromName || user.name,
        message_body: email.text,
        message_subject: email.subject,
        delivery_status: 'received',
        received_at: new Date()
      }
    });

    console.log('[Mail Receiver] Congressional submission received:', {
      submissionId: submission.id,
      templateSlug,
      userId,
      from: email.from
    });

    // Submit to CWC via Lambda workers (async)
    await submitToCongressViaLambda({
      submissionId: submission.id,
      template,
      user,
      personalizedMessage: email.text
    });

    return json({
      success: true,
      submissionId: submission.id,
      message: 'Congressional submission queued for delivery'
    });

  } catch (err) {
    console.error('[Mail Receiver] Error:', err);

    if (err && typeof err === 'object' && 'status' in err) {
      throw err; // Re-throw SvelteKit errors
    }

    throw error(500, 'Failed to process inbound email');
  }
};

/**
 * Parse SendGrid Inbound Parse payload
 */
function parseInboundEmail(formData: FormData) {
  return {
    to: formData.get('to')?.toString().split(',') || [],
    from: formData.get('from')?.toString() || '',
    fromName: formData.get('from')?.toString().split('<')[0].trim() || null,
    subject: formData.get('subject')?.toString() || '',
    text: formData.get('text')?.toString() || '',
    html: formData.get('html')?.toString() || null
  };
}
```

### **CWC Submission via Lambda**

**File**: `src/lib/core/congress/mail-receiver-submission.ts` (NEW)

```typescript
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { prisma } from '$lib/core/db';
import { lookupRepresentatives } from '$lib/core/congress/address-lookup';
import type { Template, User } from '@prisma/client';

/**
 * Submit congressional message via Lambda workers
 *
 * Flow:
 * 1. Resolve congressional representatives from user's address
 * 2. Create CWC job in database
 * 3. Send messages to SQS FIFO queues (Senate + House)
 * 4. Update congressional submission with job ID
 */
export async function submitToCongressViaLambda(params: {
  submissionId: string;
  template: Template;
  user: User;
  personalizedMessage: string;
}) {
  const { submissionId, template, user, personalizedMessage } = params;

  console.log('[Mail Receiver] Submitting to Congress via Lambda:', {
    submissionId,
    templateId: template.id,
    userId: user.id
  });

  // STEP 1: Resolve congressional representatives
  const representatives = await lookupRepresentatives({
    street: user.street!,
    city: user.city!,
    state: user.state!,
    zip: user.zip!
  });

  console.log('[Mail Receiver] Representatives resolved:', {
    count: representatives.length,
    representatives: representatives.map(r => ({
      name: r.name,
      chamber: r.chamber,
      state: r.state,
      district: r.district
    }))
  });

  // STEP 2: Create CWC job
  const job = await prisma.cWCJob.create({
    data: {
      templateId: template.id,
      userId: user.id,
      status: 'queued',
      submissionCount: representatives.length
    }
  });

  // STEP 3: Send to SQS FIFO queues
  const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const messageIds: string[] = [];

  for (const rep of representatives) {
    const queueUrl = rep.chamber === 'senate'
      ? process.env.SENATE_QUEUE_URL
      : process.env.HOUSE_QUEUE_URL;

    if (!queueUrl) {
      console.error(`[Mail Receiver] Missing queue URL for ${rep.chamber}`);
      continue;
    }

    const messageBody = {
      jobId: job.id,
      templateId: template.id,
      userId: user.id,
      template: {
        id: template.id,
        title: template.title,
        message_body: template.message_body,
        subject: template.title
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        street: user.street,
        city: user.city,
        state: user.state,
        zip: user.zip
      },
      [rep.chamber === 'senate' ? 'senator' : 'representative']: {
        bioguideId: rep.bioguideId,
        name: rep.name,
        chamber: rep.chamber,
        officeCode: rep.officeCode,
        state: rep.state,
        district: rep.district,
        party: rep.party
      },
      personalizedMessage,
      messageId: `${job.id}_${rep.bioguideId}`
    };

    const result = await sqsClient.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: rep.officeCode, // FIFO deduplication per office
      MessageDeduplicationId: `${job.id}_${rep.bioguideId}_${Date.now()}`
    }));

    if (result.MessageId) {
      messageIds.push(result.MessageId);
    }

    console.log('[Mail Receiver] SQS message sent:', {
      chamber: rep.chamber,
      office: rep.name,
      messageId: result.MessageId
    });
  }

  // STEP 4: Update CWC job with message IDs
  await prisma.cWCJob.update({
    where: { id: job.id },
    data: {
      messageIds,
      status: 'processing'
    }
  });

  // STEP 5: Update congressional submission
  await prisma.congressionalSubmission.update({
    where: { id: submissionId },
    data: {
      cwc_job_id: job.id,
      submitted_at: new Date(),
      delivery_status: 'submitted',
      target_representatives: representatives.map(r => ({
        bioguideId: r.bioguideId,
        name: r.name,
        chamber: r.chamber,
        officeCode: r.officeCode,
        state: r.state,
        district: r.district,
        party: r.party
      }))
    }
  });

  console.log('[Mail Receiver] Congressional submission complete:', {
    submissionId,
    jobId: job.id,
    representativesCount: representatives.length,
    messageIds: messageIds.length
  });

  return job;
}
```

---

## **Tracking & Status API**

### **Submission Status Endpoint**

**File**: `src/routes/api/congressional/submissions/[submissionId]/+server.ts` (NEW)

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/core/db';

/**
 * Get Congressional Submission Status
 *
 * Used by tracking modal to poll delivery progress
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const { submissionId } = params;

  // Authentication check
  const session = locals.session;
  if (!session?.userId) {
    throw error(401, 'Authentication required');
  }

  const submission = await prisma.congressionalSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      delivery_status: true,
      received_at: true,
      submitted_at: true,
      target_representatives: true,
      cwc_confirmations: true,
      error_message: true,
      error_timestamp: true,
      cwc_job_id: true,
      user_id: true
    }
  });

  if (!submission) {
    throw error(404, 'Submission not found');
  }

  // Authorization check
  if (submission.user_id !== session.userId) {
    throw error(403, 'Not authorized to view this submission');
  }

  // Fetch CWC job status if available
  let cwcJob = null;
  if (submission.cwc_job_id) {
    cwcJob = await prisma.cWCJob.findUnique({
      where: { id: submission.cwc_job_id },
      select: {
        status: true,
        results: true,
        submissionCount: true,
        completedAt: true
      }
    });
  }

  return json({
    submissionId: submission.id,
    status: submission.delivery_status,
    receivedAt: submission.received_at,
    submittedAt: submission.submitted_at,
    representatives: submission.target_representatives,
    confirmations: submission.cwc_confirmations,
    error: submission.error_message,
    errorTimestamp: submission.error_timestamp,
    cwcJob: cwcJob
  });
};
```

---

## **Template Creator Changes**

### **New Component: RecipientSelector**

**File**: `src/lib/components/template/creator/RecipientSelector.svelte` (NEW)

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TemplateRecipient } from '$lib/types/template';
  import Button from '$lib/components/ui/Button.svelte';
  import { Plus, X, Users, Building2, Briefcase } from '@lucide/svelte';

  let {
    recipients = $bindable([])
  }: {
    recipients: TemplateRecipient[];
  } = $props();

  const dispatch = createEventDispatcher<{
    change: TemplateRecipient[];
  }>();

  // State
  let includesCongress = $state(false);
  let customEmails = $state<Array<{ email: string; name: string }>>([]);
  let newEmail = $state('');
  let newName = $state('');

  // Sync state with recipients array
  $effect(() => {
    const updated: TemplateRecipient[] = [];

    if (includesCongress) {
      updated.push({
        type: 'congressional',
        selection: 'user_district'
      });
    }

    customEmails.forEach(({ email, name }) => {
      updated.push({
        type: 'email',
        email,
        name
      });
    });

    recipients = updated;
    dispatch('change', recipients);
  });

  function addCustomEmail() {
    if (!newEmail.trim()) return;

    customEmails = [
      ...customEmails,
      { email: newEmail.trim(), name: newName.trim() || newEmail.trim() }
    ];

    newEmail = '';
    newName = '';
  }

  function removeCustomEmail(index: number) {
    customEmails = customEmails.filter((_, i) => i !== index);
  }
</script>

<div class="space-y-6">
  <div>
    <h3 class="text-lg font-semibold text-slate-900 mb-2">Who should receive this message?</h3>
    <p class="text-sm text-slate-600">Select all decision-makers who should get this template.</p>
  </div>

  <!-- Congressional Representatives -->
  <label class="flex items-start gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
    <input
      type="checkbox"
      bind:checked={includesCongress}
      class="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
    />
    <div class="flex-1">
      <div class="flex items-center gap-2">
        <Users class="h-5 w-5 text-slate-600" />
        <span class="font-medium text-slate-900">Your congressional representatives</span>
      </div>
      <p class="mt-1 text-sm text-slate-600">
        Automatically routes to the sender's 2 Senators + House Representative based on their address.
      </p>
    </div>
  </label>

  <!-- Custom Email Recipients -->
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <Building2 class="h-5 w-5 text-slate-600" />
      <h4 class="font-medium text-slate-900">Additional recipients</h4>
    </div>

    {#if customEmails.length > 0}
      <div class="space-y-2">
        {#each customEmails as recipient, i}
          <div class="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <div class="flex-1">
              <div class="font-medium text-slate-900">{recipient.name}</div>
              <div class="text-sm text-slate-600">{recipient.email}</div>
            </div>
            <button
              onclick={() => removeCustomEmail(i)}
              class="p-1 text-slate-400 hover:text-red-600"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="grid grid-cols-2 gap-3">
      <input
        type="email"
        bind:value={newEmail}
        placeholder="email@example.com"
        class="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="text"
        bind:value={newName}
        placeholder="Recipient name (optional)"
        class="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <Button
      variant="secondary"
      size="sm"
      onclick={addCustomEmail}
      disabled={!newEmail.trim()}
      classNames="w-full"
    >
      <Plus class="h-4 w-4 mr-2" />
      Add recipient
    </Button>
  </div>

  {#if recipients.length === 0}
    <div class="p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <p class="text-sm text-amber-900">
        ⚠️ At least one recipient is required. Select congressional representatives or add email addresses.
      </p>
    </div>
  {/if}
</div>
```

**Usage in Template Creator**:

```svelte
<!-- src/lib/components/template/TemplateCreator.svelte -->

<script>
  import RecipientSelector from './creator/RecipientSelector.svelte';

  let recipients = $state<TemplateRecipient[]>([]);
</script>

<!-- Add to form steps -->
<section>
  <RecipientSelector bind:recipients />
</section>
```

---

## **Implementation Checklist**

### **Week 1: Core Infrastructure**

- [ ] **Day 1: Database Setup**
  - [ ] Create `CongressionalSubmission` table migration
  - [ ] Update type definitions in `src/lib/types/template.ts`
  - [ ] Seed test data with multi-target recipients

- [ ] **Day 2: Mail Receiver (SendGrid)**
  - [ ] Configure SendGrid Inbound Parse webhook
  - [ ] Create `/api/email/receive` endpoint
  - [ ] Test email reception with curl

- [ ] **Day 3: CWC Submission Flow**
  - [ ] Implement `mail-receiver-submission.ts`
  - [ ] Test SQS message sending to Senate queue
  - [ ] Test SQS message sending to House queue

- [ ] **Day 4: Mailto Generation**
  - [ ] Update `analyzeEmailFlow()` for multi-target
  - [ ] Update `TemplateModal.svelte` for tracking creation
  - [ ] Test end-to-end mailto flow

- [ ] **Day 5: Testing & Bug Fixes**
  - [ ] Send test email to `congress+test+userId@communique.org`
  - [ ] Verify mail receiver intercepts
  - [ ] Verify SQS submission
  - [ ] Verify Lambda worker processing

### **Week 2: UX & Tracking**

- [x] **Day 1: Template Creator UX**
  - [x] Create `RecipientSelector.svelte` component
  - [x] Integrate into `TemplateCreator.svelte`
  - [x] Test recipient selection flow
  - [x] Update template type definitions for multi-target

- [ ] **Day 2: Tracking Modal**
  - [ ] Create `/api/congressional/submissions/[id]` endpoint
  - [ ] Update `SubmissionStatus.svelte` for congressional tracking
  - [ ] Add polling mechanism

- [ ] **Day 3: Status Updates**
  - [ ] Lambda workers update `CongressionalSubmission` table
  - [ ] CWC confirmations stored in `cwc_confirmations`
  - [ ] Error handling and retry logic

- [ ] **Day 4: Polish & Edge Cases**
  - [ ] Handle missing user address
  - [ ] Handle failed CWC submissions
  - [ ] Add delivery receipts

- [ ] **Day 5: Demo Preparation**
  - [ ] Create demo template with mixed recipients
  - [ ] Practice end-to-end flow
  - [ ] Record demo video

---

## **Environment Variables**

Add to `.env`:

```bash
# SendGrid Inbound Parse
SENDGRID_INBOUND_WEBHOOK_SECRET=xxx

# AWS SQS Queues
SENATE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/xxx/senate-cwc-fifo.fifo
HOUSE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/xxx/house-cwc-fifo.fifo

# AWS Region
AWS_REGION=us-east-1

# CWC API (already exists)
CWC_API_KEY=xxx
CWC_API_BASE_URL=https://soapbox.senate.gov/api

# GCP Proxy (for House)
GCP_PROXY_URL=https://your-gcp-proxy.com/submit
GCP_PROXY_AUTH_TOKEN=xxx
```

---

## **Testing Strategy**

### **Unit Tests**

```bash
# Test recipient config parsing
npm run test tests/unit/template-recipient-config.test.ts

# Test mailto URL generation
npm run test tests/unit/mailto-multi-target.test.ts
```

### **Integration Tests**

```bash
# Test mail receiver flow
npm run test tests/integration/mail-receiver.test.ts

# Test CWC submission via Lambda
npm run test tests/integration/congressional-submission.test.ts
```

### **E2E Tests**

```bash
# Test complete user flow (requires running app)
npm run test:e2e tests/e2e/multi-target-delivery.spec.ts
```

---

## **Open Questions**

### **Answered**:
- ✅ **Guest user support?** → NO. Require login for all congressional messages.
- ✅ **Auto-detect Congress from mailto?** → NO. Template creator explicitly selects recipients.

### **Still Open**:
1. **Should congressional receiver email be visible in mailto?**
   - Option A: Show `congress+slug+userId@communique.org` (transparent)
   - Option B: Hide it somehow (better UX, but how?)
   - **Recommendation**: Show it. Transparency > magic.

2. **How to handle delivery failures?**
   - CWC API rejects message (invalid XML, rate limit, etc.)
   - Lambda worker fails
   - Mail receiver doesn't receive email
   - **Recommendation**: Store error in `CongressionalSubmission.error_message`, show in tracking modal

3. **Should we support BCC for congressional receiver?**
   - User sends to `epa@epa.gov` (TO)
   - Congressional receiver in BCC
   - **Issue**: BCC not supported in mailto protocol
   - **Recommendation**: Keep congressional receiver in TO field

4. **Template creator: Should we offer pre-set recipient lists?**
   - "Climate action" → Auto-add EPA, White House, Congress
   - "Healthcare" → Auto-add HHS, CMS, Congress
   - **Recommendation**: Phase 2 feature, start with manual selection

---

## **Success Metrics**

**Hackathon Demo Goals**:
- ✅ User creates template with Congress + external emails
- ✅ User sends email from mail app
- ✅ External emails delivered directly
- ✅ Congressional emails intercepted by mail receiver
- ✅ Mail receiver submits to CWC via Lambda
- ✅ User sees delivery confirmation in tracking modal

**Post-Hackathon Goals**:
- Migrate all existing templates to multi-target model
- Remove `deliveryMethod` field entirely
- Add pre-set recipient lists
- Add delivery analytics dashboard

---

**Last Updated**: 2025-11-15
**Next Update**: As implementation progresses
