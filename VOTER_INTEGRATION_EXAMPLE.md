# VOTER Protocol Integration Example

## How to Add VOTER Certification to Existing Email Flows

The integration is designed to be **non-invasive** - it doesn't break existing functionality and can be added incrementally.

### Method 1: Using the Integration Helper

```typescript
// In any component where email is launched
import { voterIntegration } from '$lib/integrations/voter';
import { launchEmail } from '$lib/services/emailService';

// After successful email launch
const launchResult = launchEmail(mailtoUrl);

if (launchResult.success) {
  // Certify with VOTER Protocol (runs in background)
  voterIntegration.certifyEmailDelivery({
    user: $user,
    template: template,
    mailtoUrl: mailtoUrl,
    recipients: recipients
  });
}
```

### Method 2: Using the Wrapper Function

```typescript
import { withVOTERCertification } from '$lib/integrations/voter';

// Wrap existing email launch
const result = await withVOTERCertification(
  () => launchEmail(mailtoUrl),
  {
    user: $user,
    template: template,
    mailtoUrl: mailtoUrl,
    recipients: recipients
  }
);
```

### Method 3: Direct Certification Service

```typescript
import { certification } from '$lib/services/certification';

// For more control
const certResult = await certification.certifyAction(
  userAddress,
  {
    actionType: 'direct_action',
    deliveryReceipt: JSON.stringify({ /* receipt data */ }),
    messageHash: 'generated-hash',
    timestamp: new Date().toISOString(),
    // ... other fields
  }
);
```

## Integration Points

### 1. Template Modal (When User Clicks Send)

In `TemplateModal.svelte`, after email launch:

```svelte
<script>
  import { voterIntegration } from '$lib/integrations/voter';

  async function handleSend() {
    const result = launchEmail(mailtoUrl);
    
    if (result.success) {
      // Add VOTER certification
      voterIntegration.certifyEmailDelivery({
        user: $authStore.user,
        template: template,
        mailtoUrl: mailtoUrl,
        recipients: recipientEmails
      });
    }
  }
</script>
```

### 2. Page-level Email Launches

In route pages, after `launchEmail()`:

```svelte
<script>
  import { voterIntegration } from '$lib/integrations/voter';

  function handleEmailLaunch() {
    if (flow.mailtoUrl) {
      const result = launchEmail(flow.mailtoUrl);
      
      // Certify if user is authenticated
      if (result.success && $authStore.user) {
        voterIntegration.certifyEmailDelivery({
          user: $authStore.user,
          template: template,
          mailtoUrl: flow.mailtoUrl,
          recipients: extractRecipientEmails(template)
        });
      }
    }
  }
</script>
```

## Environment Setup

Add to your `.env`:

```bash
VOTER_API_URL=http://localhost:8000
VOTER_API_KEY=shared-secret-key
ENABLE_CERTIFICATION=true
```

## Testing the Integration

1. **Start VOTER Protocol backend:**
   ```bash
   cd voter-protocol
   python api/server.py
   ```

2. **Start Communiqué:**
   ```bash
   cd communique
   npm run dev
   ```

3. **Send an email with an authenticated user**
   - The email will launch normally
   - Check browser console for certification logs
   - Check VOTER Protocol logs for reward processing

## Key Benefits

- **Non-breaking**: Existing flows work exactly the same
- **Optional**: Certification happens in background
- **Gradual**: Can be added to flows one by one
- **Resilient**: Certification failures don't break email delivery

## Next Steps

1. Add integration to key email launch points
2. Implement user notification system for rewards
3. Add reputation display (future)
4. Connect to actual blockchain (when contracts deployed)

The integration is ready to use and will immediately start tracking civic actions and issuing VOTER rewards!