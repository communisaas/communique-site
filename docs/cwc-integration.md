# CWC (Communicating With Congress) Integration

**Status**: ✅ IMPLEMENTED | Certified Congressional Message Delivery

---

**Official API integration for verified delivery of constituent messages to US Congress.**

## Overview

The CWC (Communicating With Congress) system is the official platform for delivering constituent messages to congressional offices. Communique integrates with CWC to provide certified, trackable delivery to both House and Senate offices.

**What CWC Provides**:
- Certified delivery receipts
- Official constituent verification
- House + Senate coverage (535 offices)
- Spam filtering and rate limiting
- Response tracking (optional)

**Delivery Volume**: CWC handles 81 million+ messages annually across participating offices.

## Architecture

```
User Message
    ↓
Template + Personal Story
    ↓
Address Lookup (Census Geocoding)
    ↓
Representative Identification
    ↓
CWC Field Mapping
    ↓
XML Generation (House or Senate format)
    ↓
CWC API Submission
    ↓
Delivery Receipt
    ↓
User Notification
```

## Code Structure

### Core Files

**CWC Adapter**: `src/lib/core/legislative/adapters/cwc/cwcAdapter.ts`
- Implements `LegislativeAdapter` interface
- Handles message submission flow
- Returns delivery receipts

**XML Builder**: `src/lib/core/legislative/adapters/cwc/xmlBuilder.ts`
- Generates CWC-compliant XML
- Handles House vs Senate format differences
- XML escaping and validation

**Field Mapper**: `src/lib/core/legislative/adapters/cwc/fieldMapper.ts`
- Transforms Communiqué data → CWC format
- Maps template variables to CWC fields
- Handles address normalization

**Type Definitions**: `src/lib/core/legislative/adapters/cwc/types.ts`
- Complete CWC XML schema types
- Input/output interface definitions
- Configuration types

**Legacy Generator**: `src/lib/core/congress/cwc-generator.ts`
- Original CWC XML generation (before adapter pattern)
- Still used for some direct integrations
- Being migrated to adapter pattern

### Address Lookup

**Location**: `src/lib/core/congress/address-lookup.ts`

Resolves user address → congressional district → representatives:

1. **Geocode address** via Census Bureau API
2. **Find congressional district** from geocoded coordinates
3. **Look up representatives**:
   - 1 House representative (from district)
   - 2 Senators (from state)
4. **Retrieve office codes** for CWC submission

## XML Formats

### House Format (CWC 2.0)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CWC version="2.0">
    <MessageHeader>
        <MessageId>comm_1234567890_tpl_abc123_rep_H001234</MessageId>
        <Timestamp>2025-10-12T19:35:00Z</Timestamp>
        <DeliveryAgent>
            <Name>Communique Advocacy Platform</Name>
            <Email>cwc@communique.org</Email>
            <Phone>+1-555-CWC-MAIL</Phone>
        </DeliveryAgent>
        <OfficeCode>CA12_HOUSE</OfficeCode>
    </MessageHeader>

    <ConstituentData>
        <Name>
            <First>Jane</First>
            <Last>Constituent</Last>
        </Name>
        <Address>
            <Street>123 Main Street</Street>
            <City>San Francisco</City>
            <State>CA</State>
            <Zip>94102</Zip>
        </Address>
        <Email>jane@example.com</Email>
        <Phone>555-123-4567</Phone>
    </ConstituentData>

    <MessageData>
        <Subject>Support for Climate Action Legislation</Subject>
        <Body>Dear Representative,

I'm writing to urge support for climate action legislation...

[Personal Connection: As a parent in San Francisco, I've seen...]

Sincerely,
Jane Constituent
123 Main Street
San Francisco, CA 94102</Body>

        <MessageMetadata>
            <IntegrityHash>sha256:abc123...</IntegrityHash>
        </MessageMetadata>
    </MessageData>
</CWC>
```

### Senate Format (Simplified CWC)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CWC>
    <DeliveryId>comm_1234567890_tpl_abc123_sen_S000123</DeliveryId>
    <DeliveryAgent>
        <Name>Communique Advocacy Platform</Name>
        <Email>cwc@communique.org</Email>
        <Phone>+1-555-CWC-MAIL</Phone>
    </DeliveryAgent>
    <Constituent>
        <Prefix></Prefix>
        <FirstName>Jane</FirstName>
        <MiddleName></MiddleName>
        <LastName>Constituent</LastName>
        <Suffix></Suffix>
        <ConstituentAddress>
            <Address>123 Main Street</Address>
            <Address></Address>
            <City>San Francisco</City>
            <StateAbbreviation>CA</StateAbbreviation>
            <Zip>94102</Zip>
        </ConstituentAddress>
        <ConstituentEmail>jane@example.com</ConstituentEmail>
        <ConstituentPhone>555-123-4567</ConstituentPhone>
    </Constituent>
    <Message>
        <Subject>Support for Climate Action Legislation</Subject>
        <LibraryOfCongressTopics></LibraryOfCongressTopics>
        <BillNumber></BillNumber>
        <ProOrCon></ProOrCon>
        <ConstituentMessage>Dear Senator,

I'm writing to urge support for climate action legislation...

[Personal Connection: As a parent in San Francisco, I've seen...]

Sincerely,
Jane Constituent</ConstituentMessage>
    </Message>
    <OfficeCode>CA_SENATE_FEINSTEIN</OfficeCode>
</CWC>
```

## Message ID Format

Unique identifier for tracking and deduplication:

```
comm_{timestamp}_{userId}_{templateId}_{repBioguideId}

Example:
comm_1728764100_user_abc123_tpl_climate-action_H001234
```

**Format**:
- `comm_` prefix (Communique identifier)
- Unix timestamp
- User ID (anonymized or hashed)
- Template ID
- Representative bioguide ID

## Field Mapping

### Constituent Data

| Communiqué Field | CWC House Field | CWC Senate Field | Required |
|------------------|-----------------|------------------|----------|
| `user.name` | `ConstituentData.Name.First/Last` | `Constituent.FirstName/LastName` | Yes |
| `user.email` | `ConstituentData.Email` | `Constituent.ConstituentEmail` | Yes |
| `user.address.street` | `ConstituentData.Address.Street` | `ConstituentAddress.Address` | Yes |
| `user.address.city` | `ConstituentData.Address.City` | `ConstituentAddress.City` | Yes |
| `user.address.state` | `ConstituentData.Address.State` | `ConstituentAddress.StateAbbreviation` | Yes |
| `user.address.zip` | `ConstituentData.Address.Zip` | `ConstituentAddress.Zip` | Yes |
| `user.phone` | `ConstituentData.Phone` | `Constituent.ConstituentPhone` | Optional |

### Message Data

| Communiqué Field | CWC House Field | CWC Senate Field | Required |
|------------------|-----------------|------------------|----------|
| `template.title` | `MessageData.Subject` | `Message.Subject` | Yes |
| `template.message_body` | `MessageData.Body` | `Message.ConstituentMessage` | Yes |
| `personalConnection` | Inserted into body | Inserted into message | Optional |

### Office Identification

| Data Source | CWC House Field | CWC Senate Field |
|-------------|-----------------|------------------|
| Representative bioguide ID | `MessageHeader.OfficeCode` | `OfficeCode` |
| Format | `{STATE}{DISTRICT}_HOUSE` | `{STATE}_SENATE_{LASTNAME}` |

## API Integration

### Submission Endpoint

```typescript
interface CWCSubmission {
  xml: string;
  officeCode: string;
  messageId: string;
}

async function submitToCWC(submission: CWCSubmission): Promise<CWCResponse> {
  const response = await fetch(`${CWC_API_BASE_URL}/submit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CWC_API_KEY}`,
      'Content-Type': 'application/xml'
    },
    body: submission.xml
  });

  return response.json();
}
```

### Response Format

```typescript
interface CWCResponse {
  success: boolean;
  submissionId: string;
  messageId: string;
  deliveryReceipt?: string;
  errors?: CWCError[];
}

interface CWCError {
  code: string;
  field?: string;
  message: string;
}
```

## Address Validation

**Requirement**: CWC requires verified constituent addresses to prevent spam.

**Implementation**:
1. **Geocoding**: Census Bureau Geocoding API
   - Input: Street address, city, state, zip
   - Output: Latitude, longitude, congressional district
   - Fallback: ZIP code → district lookup

2. **District Mapping**: Database lookup
   - Map geocoded coordinates to congressional district
   - Identify House representative
   - Identify 2 Senators

3. **Validation Rules**:
   - Address must geocode successfully
   - District must match representative
   - No PO boxes (most offices)
   - US addresses only

## Error Handling

### Common CWC Errors

```typescript
const CWC_ERROR_CODES = {
  'INVALID_OFFICE': 'Office code not recognized',
  'MISSING_FIELD': 'Required field missing from XML',
  'INVALID_ADDRESS': 'Address cannot be verified',
  'DUPLICATE_MESSAGE': 'Message ID already submitted',
  'RATE_LIMIT': 'Too many submissions from this user',
  'XML_MALFORMED': 'XML does not match schema',
  'UNAUTHORIZED': 'Invalid API credentials'
};
```

### Retry Logic

```typescript
async function submitWithRetry(
  xml: string,
  maxRetries: number = 3
): Promise<CWCResponse> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await submitToCWC({ xml });
      if (response.success) return response;

      // Don't retry on validation errors
      if (response.errors?.some(e => e.code.includes('INVALID'))) {
        throw new Error(`CWC validation failed: ${response.errors}`);
      }

    } catch (error) {
      if (attempt === maxRetries) throw error;
      await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
    }
  }

  throw new Error('Max retries exceeded');
}
```

## Delivery Tracking

### Receipt Format

```typescript
interface DeliveryReceipt {
  messageId: string;
  submissionId: string;
  officeCode: string;
  submittedAt: Date;
  deliveredAt?: Date;
  status: 'pending' | 'delivered' | 'failed';
  responseReceived?: boolean;
}
```

### Database Storage

```prisma
model CongressionalSubmission {
  id              String   @id @default(cuid())
  user_id         String
  template_id     String
  representative  String   // Bioguide ID
  message_id      String   @unique
  cwc_submission_id String?
  status          String   // pending, delivered, failed
  submitted_at    DateTime @default(now())
  delivered_at    DateTime?
  receipt         Json?

  @@index([user_id])
  @@index([template_id])
  @@map("congressional_submissions")
}
```

## Testing

### Mock CWC API

```typescript
// tests/mocks/cwc-api.ts
export function mockCWCSuccess(): CWCResponse {
  return {
    success: true,
    submissionId: 'cwc_test_12345',
    messageId: 'comm_test_message',
    deliveryReceipt: 'delivered_at_2025-10-12T19:35:00Z'
  };
}

export function mockCWCError(code: string): CWCResponse {
  return {
    success: false,
    submissionId: '',
    messageId: '',
    errors: [{
      code,
      message: CWC_ERROR_CODES[code]
    }]
  };
}
```

### Test Coverage

```bash
# Unit tests
npm run test:unit -- cwc-client.test.ts

# Integration tests
npm run test:integration -- congressional-delivery.test.ts

# E2E tests (requires CWC sandbox credentials)
CWC_API_KEY=test npm run test:e2e -- congressional-delivery.spec.ts
```

## Configuration

### Environment Variables

```bash
# CWC API Credentials
CWC_API_KEY=your-api-key-here
CWC_API_BASE_URL=https://soapbox.senate.gov/api  # Production
CWC_API_BASE_URL=https://sandbox.senate.gov/api   # Sandbox

# Rate Limiting
CWC_RATE_LIMIT_PER_HOUR=10    # Max submissions per user per hour
CWC_MAX_RETRIES=3              # Retry attempts on transient failures
CWC_RETRY_DELAY_MS=1000        # Initial retry delay

# Feature Flags
ENABLE_CWC_DELIVERY=true       # Enable certified delivery
ENABLE_CWC_RECEIPTS=true       # Track delivery receipts
```

## Production Considerations

### Rate Limits

- **Per User**: 10 messages/hour to prevent spam
- **Per Office**: Varies by office (typically 100-1000/hour)
- **Platform-wide**: Negotiated with CWC administrators

### Cost

- **API Access**: Free for nonprofit advocacy platforms
- **Certified Delivery**: No per-message fees
- **Enterprise SLA**: Available for high-volume platforms

### Compliance

- **Constituent Verification**: Required for all submissions
- **Data Retention**: Message IDs stored for deduplication (90 days)
- **Privacy**: Personal data (email, phone) encrypted at rest
- **Spam Prevention**: Rate limiting + content moderation

## Roadmap

### Near Term
- Delivery status webhooks (real-time updates)
- Representative response tracking
- Bulk submission API (campaign mode)

### Medium Term
- State legislature CWC integration (some states have similar systems)
- Enhanced analytics (open rates, response rates)
- A/B testing for message effectiveness

### Long Term
- International parliamentary systems (Westminster, etc.)
- Direct integration with constituent response systems
- Predictive delivery optimization (best time to send)

## References

- **CWC Official Documentation**: Contact Senate Rules Committee for API access
- **Code**: `src/lib/core/legislative/adapters/cwc/` and `src/lib/core/congress/`
- **Address Lookup**: `src/lib/core/congress/address-lookup.ts`
- **Tests**: `tests/integration/congressional-delivery*.test.ts`
- **Legislative Abstraction**: `docs/legislative/abstraction-layer.md`

---

CWC integration enables Communique to provide certified, trackable delivery of constituent messages to all 535 congressional offices with official verification and delivery receipts.
