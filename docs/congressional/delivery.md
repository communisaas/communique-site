# Message Delivery - User Perspective

**What users care about**: Who am I contacting?

**What users don't care about**: Backend implementation details (API vs email).

---

## Who You Can Contact

### Large Legislatures (Cryptographically Verified Constituent Messages)

**Who**:
- **US Congress** (House + Senate, 535 members)
- **State Legislatures** (varies by state, typically 100-400 members)
- **European Parliament** (planned, 705 members)
- **UK Parliament** (planned, 650 MPs)

**What makes them different**: These bodies receive thousands of constituent messages daily. They need to verify you're actually a constituent (not spam, not out-of-district activists). Email can't do this at scale. So they built systems (APIs like CWC) to handle verified constituent contact.

**What we do**: We prove you're a constituent using zero-knowledge cryptography - without revealing your address. Congressional offices get cryptographic proof you're in their district, not just your claim.

**How delivery works** (user perspective):
1. You customize a template
2. You verify your address (we generate zero-knowledge proof of district membership)
3. You click "Send Message"
4. **We deliver cryptographically verified constituent message**
5. You get confirmation ("✓ Message delivered to Senator Warren")

**Why this matters**: Congressional offices can trust these messages are from real constituents (can't be forged), while your address stays private (zero-knowledge proof). Not spam, not astroturfing - verifiable constituent voice.

**User experience**: Seamless. You click "Send" and we handle cryptographic verification + delivery.

---

### Everyone Else (Direct Contact)

**Who** (this is OPEN - any decision-maker with community impact):

**Local Government**:
- City Councils (typically 5-15 members)
- School Boards (typically 5-9 members)
- County Boards (varies by jurisdiction)
- Special Districts (water boards, transit boards, planning commissions)

**Corporations**:
- Customer service departments
- C-suite executives
- Corporate boards
- Investor relations

**HOAs** (Homeowner Associations):
- HOA boards (24.8M homes, 62M residents governed by HOAs)
- Property management companies
- Community associations

**Universities**:
- Administration
- Boards of trustees
- Department chairs
- Student affairs offices

**Healthcare**:
- Hospital administration
- Insurance companies
- Medical billing departments
- Patient advocacy offices

**Nonprofits**:
- Leadership teams
- Boards of directors
- Program managers
- Community organizations

**Any entity with community impact** - if they make decisions affecting people, you can contact them.

**How delivery works** (user perspective):
1. You customize a template
2. You click "Send Message"
3. **Your email client opens with pre-filled message**
4. You review and hit "Send" from your email
5. We verify you sent it (via OAuth access to your Sent folder)

**Why direct email**: These entities don't have centralized APIs. Each decision-maker has email contact info (public or semi-public).

**User experience**: You send from your own email (more authentic), we verify delivery.

---

## User Mental Model

**What users should think**:

### For Large Legislatures:
> "I'm sending a cryptographically verified message to my Senator. They'll know I'm a real constituent without seeing my address."

### For Everyone Else:
> "I'm sending an email to my city councilmember / corporate CEO / HOA board / university administration. Communiqué will verify I sent it."

**Key insight**: Users care about **who they're contacting**, not whether it's API-based or email-based.

---

## Delivery Methods Explained (For Users)

### Cryptographically Verified Delivery (Large Legislatures)

**What happens**:
- You fill out your address → We generate zero-knowledge proof of district membership
- You click "Send Message" → We deliver message + cryptographic proof
- Congressional office receives message with unforgeable proof you're a constituent
- You see confirmation: "✓ Message delivered to Senator Warren"

**Why this works**:
- Congressional offices need to verify constituent status (filter spam, out-of-district messages)
- Email can't prove constituent status at scale (address can be faked, no verification)
- We use zero-knowledge cryptography: prove you're in the district without revealing address
- Congressional offices get cryptographic proof (can't be forged), you keep address private

**What makes this different from campaigns**:
- **Not spam**: Cryptographically proven constituent messages
- **Not astroturfing**: Each message proves real district membership
- **Privacy-preserving**: Zero-knowledge proof reveals district, not address
- **Trustworthy**: Congressional offices can verify proof, can't fake constituent status

**Privacy**:
- Your address is verified via zero-knowledge proof (we don't store plaintext)
- Congressional office sees district verification, not your address
- Cryptographically unforgeable proof of constituent status
- See: `/docs/architecture/decision-record.md` for ZK proof details

---

### Email Verification (Everyone Else)

**What happens**:
- You click "Send Message" → Your email client opens (Gmail, Outlook, etc.)
- Message is pre-filled with your customized content
- You review and click "Send" from your email client
- We check your Sent folder (via OAuth) to verify you sent it
- You see confirmation: "✓ Delivery verified - Email sent to [recipient]"

**Why this works**:
- Decision-makers have email addresses (no centralized API)
- Sending from your personal email is more authentic than platform email
- OAuth verification proves you actually sent it (prevents fake engagement)

**Privacy**:
- OAuth access is read-only (we check Sent folder only, not Inbox)
- We verify subject line + recipient match (don't read full content)
- You can revoke OAuth access anytime
- See: `/docs/strategy/delivery-verification.md` for verification roadmap

---

## What This Means for Template Creators

### When creating a template, you choose target:

**Option 1: Large Legislature**
- Template targets: US Congress, State Legislature, European Parliament
- Delivery method: Cryptographically verified constituent messages
- User enters address → We generate ZK proof → We deliver message + proof
- Example: "Tell your Senator to support housing bill"

**Option 2: Direct Contact (Open)**
- Template targets: Local gov, corporations, HOAs, universities, hospitals, nonprofits, ANY decision-maker
- Delivery method: Email (user sends from their account)
- User reviews pre-filled email → Sends from Gmail/Outlook → We verify
- Example: "Email your city council about zoning reform"
- Example: "Contact your HOA board about fee increases"
- Example: "Message your university administration about tuition"
- Example: "Email corporate customer service about product issues"

**Option 3: Multiple Levels** (planned)
- Template targets: All levels (federal + state + local + corporate)
- Delivery method: Hybrid (cryptographically verified for large legislatures, email for others)
- User sends to multiple decision-makers at once
- Example: "Contact all your elected officials + corporate stakeholders about climate"

---

## Technical Implementation (For Developers)

### Database Schema:

```prisma
model Template {
  target_level        String    // "federal" | "state" | "local" | "corporate" | "nonprofit" | "multi"
  target_body         String?   // "us_congress" | "ca_legislature" | "sf_city_council" | "hoa_board" | "corporate_board"
  delivery_method     String    // "api" | "email" | "hybrid"

  // For API delivery:
  api_provider        String?   // "cwc" | "state_api"

  // For email delivery:
  recipient_emails    String[]  // ["council@cityofsf.gov", "ceo@corp.com", "hoa-board@example.com"]
}
```

### Routing Logic:

```typescript
async function sendMessage(template: Template, user: User) {
  if (template.delivery_method === 'api') {
    // Large legislature - official API delivery
    const district = await voterClient.resolveDistrict(user.address);
    const recipients = await getOfficials(district, template.target_body);
    return await officialAPI.sendMessage(recipients, template.message);
  }

  if (template.delivery_method === 'email') {
    // Direct contact (open to any decision-maker) - email delivery with OAuth verification
    const mailtoUrl = buildMailtoUrl({
      to: template.recipient_emails,
      subject: template.subject,
      body: template.message
    });

    return {
      action: 'mailto',
      url: mailtoUrl,
      requiresVerification: true,
      verificationInstructions: 'We\'ll check your Sent folder to verify delivery'
    };
  }
}
```

### User Flow (Frontend):

```typescript
// User clicks "Send Message" button
function handleSendMessage(template: Template) {
  if (template.delivery_method === 'api') {
    // Show address collection modal
    showModal('AddressCollectionModal', {
      onSubmit: async (address) => {
        const result = await sendViaAPI(template, address);
        showConfirmation(`✓ Message delivered to ${result.recipient}`);
      }
    });
  }

  if (template.delivery_method === 'email') {
    // Show email verification modal
    showModal('EmailVerificationModal', {
      onConnect: async (oauthToken) => {
        const mailtoUrl = await getMailtoUrl(template);
        window.location.href = mailtoUrl; // Opens email client

        // Background: Verify email was sent
        await verifyEmailDelivery(oauthToken, template);
        showConfirmation('✓ Delivery verified');
      }
    });
  }
}
```

---

## Privacy Guarantees by Delivery Method

### Cryptographically Verified Delivery (Large Legislatures):

**What we send**:
- Zero-knowledge proof of district membership
- Your customized message content
- Template metadata (issue category, timestamp)

**What we DON'T send**:
- Your residential address (only ZK proof)
- Your email address (unless you include it in message)
- Your phone number (unless you include it in message)

**What congressional office sees**:
- ✅ Cryptographic proof you're a verified constituent
- ✅ Your message content
- ❌ Your plaintext address

---

### Email Delivery (Direct Contact):

**What we access (via OAuth)**:
- Read-only access to your Sent folder
- Verification that you sent email to specific recipient
- Timestamp verification (sent within 10 minutes)

**What we DON'T access**:
- Your Inbox (only Sent folder)
- Your email content beyond verification
- Your contacts
- Your full email history

**What recipient sees**:
- Your email (standard email from you)
- Your email address (Gmail/Outlook address)
- Your message content (whatever you sent)

**User control**:
- You can revoke OAuth access anytime
- You review the email before sending
- You can edit the message before sending

---

## Roadmap

### Phase 1 (Current): US Congress + Open Direct Contact

**Implemented**:
- ✅ US Congress delivery (CWC API)
- ✅ Direct email delivery (open to any decision-maker)
- ✅ OAuth verification for email

**Status**: Live in production

---

### Phase 2 (Next 3-6 months): State Legislatures

**Planned**:
- State-specific APIs (where available)
- Fallback to email (for states without APIs)
- Multi-tier targeting (federal + state in one message)

**Example**: "Tell your federal AND state representatives about housing"

---

### Phase 3 (6-12 months): International Legislatures

**Planned**:
- UK Parliament (MPs API)
- European Parliament (MEPs API)
- Canadian Parliament
- Australian Parliament

**Challenge**: Each country has different contact systems

---

### Phase 4 (12+ months): Corporate Accountability at Scale

**Requires**: Google Transparency & Accountability Center (TAC) for email verification

**Planned targets**:
- Corporations (customer service, C-suite)
- Universities (administration)
- HOAs (board members)
- Nonprofits
- Healthcare providers
- Any decision-maker with community impact

**Blocker**: Email verification at scale requires Google TAC partnership (proving you sent an email without reading it)

---

## For Congressional Offices

**Understanding messages from Communiqué**:

### What you receive:
- Verified constituent messages (cryptographic proof of district membership)
- Delivered through official CWC API (same system you already use)
- Aggregate constituent sentiment data (issue tracking, volume)

### Privacy architecture:
- Constituents' addresses are verified via zero-knowledge proofs
- You see proof of district membership, NOT plaintext addresses
- Cryptographically secure (Halo2 ZK circuits, can't be forged)

### Why trust these messages:
- District verification is cryptographic (not self-reported)
- Messages come through official CWC channels
- Platform prevents spam (rate limiting, content moderation)

**See**: `/docs/congressional/dashboard.md` for office dashboard setup

---

## Cross-References

**District verification (voter-protocol)** → See `/docs/DISTRICT-VERIFICATION-RESPONSIBILITIES.md`

**Zero-knowledge proofs** → See `/docs/architecture/decision-record.md`

**Email verification roadmap** → See `/docs/strategy/delivery-verification.md`

**CWC API integration** → See `/docs/congressional/cwc.md`

**Template system** → See `/docs/features/templates.md`

**Power structures** → See `/docs/research/power-structures.md`

---

## Bottom Line

**User perspective**: "Who am I contacting?"

- **Large legislatures** (Congress, state legislatures, parliaments) → Cryptographically verified constituent messages (zero-knowledge proof)
- **Everyone else** (local gov, corporations, HOAs, universities, hospitals, nonprofits, ANY decision-maker) → You send email, we verify

**Not**: "Path 1 vs Path 2" or "API vs email" - users don't care about backend implementation.

**Key insight**: Users care about civic impact, not delivery infrastructure.

**What makes large legislatures different**: Zero-knowledge cryptography proves you're a constituent without revealing your address. Not spam, not astroturfing - verifiable constituent voice.

**The openness of direct email**: Communiqué enables messaging to ANY entity with community impact. Start with governments (cryptographic verification), expand to everything else (direct email).
