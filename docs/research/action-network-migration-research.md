# Action Network Migration Research

> Deep research for advocacy organizations migrating from Action Network (AN) to a verification-native civic platform.
> Compiled: 2026-03-06

---

## 1. Action Network Data Model & Export Capabilities

### 1.1 Core Data Model

Action Network is built on the OSDI (Open Supporter Data Interface) specification and exposes a HAL+JSON RESTful API. The data model centers on **People** (activists/supporters) connected to **Actions** they have taken.

**Primary resource types:**

| Resource | Description |
|----------|-------------|
| People | Activists with contact info, custom fields, tags |
| Petitions | Signature-collection campaigns |
| Events | RSVP-based event pages |
| Forms | Generic data-collection pages |
| Fundraising Pages | Donation-collection pages |
| Advocacy Campaigns | Letter/call campaigns targeting officials |
| Surveys | Multi-question response collection |
| Tags | Freeform labels applied to people |
| Messages | Mass emails |
| Campaigns | Groupings of actions |
| Event Campaigns | Groupings of events |
| Lists / Queries | Saved segments of people |

**Relational resources (join tables):**
- Signatures (people <-> petitions)
- Attendances (people <-> events)
- Submissions (people <-> forms)
- Donations (people <-> fundraising pages)
- Outreaches (people <-> advocacy campaigns)
- Responses (people <-> surveys)
- Taggings (people <-> tags)

### 1.2 Export via UI (CSV)

Action Network's report builder exports CSV files with the following fields:

**Built-in contact fields:**
- First name, last name, email, mobile number
- ZIP/postal code, address (partners only), city, state (full + abbreviation), country
- Legislative district, OCDID (Open Civic Data Identifier), county
- Unique ID (matches API identifier)
- Email subscription status (subscribed, unsubscribed, bouncing, spam complaint)
- Email subscription update timestamp

**Per-action fields (one action at a time):**
- Referrer, source code, action timestamp
- Custom field responses tied to that action

**Additional exportable data:**
- Tags column (all tags per activist)
- Custom fields (appear in dropdown once at least one activist has data)
- Email statistics: admin title, tags, from line, reply-to, subject, timestamp, total sent, opens, machine opens, clicks, actions, unsubscribes, bounces, spam complaints
- Event RSVPs (exportable per event)
- Ticket purchase transactions
- Form results (downloadable per form)
- Fundraising/donation data per page

**Critical limitation:** Action history is exportable only **one action at a time** in the report builder. There is no single-export mechanism for a person's full action history across all actions.

### 1.3 Export via API (REST, JSON+HAL)

**Authentication:** `OSDI-API-Token` header with API key.

**API access by tier:**
- Free: No API access
- Movement ($15+/mo): Full API access
- Network ($125+/mo): Full API access
- Enterprise: Full API access

**Endpoints & Methods:**

| Resource | GET | POST | PUT | DELETE |
|----------|-----|------|-----|--------|
| People | Y | Y | Y (upsert) | - |
| Petitions | Y | Y | Y | - |
| Signatures | Y | Y | Y | Y |
| Events | Y | Y | Y | - |
| Attendances | Y | Y | Y | Y |
| Forms | Y | Y | Y | - |
| Submissions | Y | Y | Y | Y |
| Fundraising Pages | Y | Y | Y | - |
| Donations | Y | Y | Y | Y |
| Advocacy Campaigns | Y | Y | Y | - |
| Outreaches | Y | Y | Y | Y |
| Surveys | Y | Y | Y | - |
| Responses | Y | Y | Y | Y |
| Tags | Y | Y | Y | - |
| Taggings | Y | Y | - | Y |
| Custom Fields | Y | Y | Y | - |
| Messages | Y | Y | - | - |
| Lists | Y | - | - | - |
| Queries | Y | - | - | - |
| Wrappers | Y | - | - | - |
| Items | Y | - | - | - |
| Metadata | Y | - | - | - |

**Pagination:** 25 records per page max. Navigate with `?page=N`. Collections include `total_pages`, `total_records`, `next`/`self` links.

**Filtering (OData):** `eq`, `gt`, `lt` operators on fields like `created_date`, `modified_date`, `email_address`, `region`.

**Background/bulk processing:** POST, PUT, and helper operations support `?background_request=true` for Attendances, Donations, Outreaches, People, Signatures, Submissions, Responses, Taggings. Returns immediate success; processing happens asynchronously.

**Rate limit:** 4 requests per second.

**No dedicated bulk export endpoint.** Full data extraction requires paginating through every collection at 25 records/page at 4 req/sec. For an org with 100K contacts, extracting people alone requires 4,000 pages = ~17 minutes minimum (people only, not including action histories).

### 1.4 Data NOT Exportable / Locked In

Based on documentation analysis, the following data is difficult or impossible to fully extract:

| Data | Status |
|------|--------|
| Full per-person action history (all actions) | Must query each action type separately and reconstruct per-person |
| Email open/click per-recipient detail | Aggregate stats exportable; per-recipient engagement requires API traversal |
| Email HTML content/templates | Not exposed in standard exports; Messages API returns content |
| Automation/ladder configurations | Not exportable via API or UI |
| A/B test variant results | Aggregate only |
| Embedded page JavaScript/CSS | Not exportable; pages are AN-hosted |
| Historical email delivery logs | Limited to aggregate stats |
| Fundraising payment processor tokens | Not portable (processor-specific) |
| Page design/layout | AN-hosted, not exportable as templates |
| Network hierarchy configuration | Not documented in export |
| Machine learning prediction scores | Boost add-on; not exportable |

### 1.5 Action Page Data Structure

AN "action pages" are typed resources:

- **Petitions:** Title, description, target (text), petition letter text, signature count, custom fields/questions
- **Events:** Title, description, start/end date, location (address + coordinates), RSVP count, instructions, visibility
- **Fundraising Pages:** Title, description, donation amounts, payment processor config, total raised
- **Advocacy Campaigns (Letters):** Title, description, targets (officials), letter template with merge fields, type (email/fax)
- **Forms:** Title, description, arbitrary custom fields/questions
- **Surveys:** Title, description, questions with response options
- **Ticketed Events:** Event + ticket tiers + pricing

Each page has: `identifiers[]`, `created_date`, `modified_date`, `title`, `description`, `browser_url`, `featured_image_url`, `total_*` counts, and embedded `_links` to associated records.

---

## 2. Competitor Migration Precedents

### 2.1 Existing Migration Paths

**AN -> CiviCRM:**
- CiviCRM has an Action Network integration extension supporting one-time and scheduled two-way sync of People <-> Contacts via OSDI. This is the most documented open-source migration path.
- Source: [CiviCRM OSDI project](https://civicrm.org/blog/everykittysdaydream/civicrm-osdi-project-updates)

**AN -> EveryAction/Bonterra:**
- No public migration tooling. EveryAction (now Bonterra) has its own API but does not publish AN-specific importers. Orgs report manual CSV export/import cycles.
- EveryAction has been criticized for data hostage practices during outbound migration — prolonging the process and charging extra months.

**AN -> Solidarity Tech:**
- Solidarity Tech positions itself as an AN alternative for orgs needing phone banking, relationship management, and website building. No public migration tooling found; likely manual CSV import.

**AN -> NationBuilder:**
- NationBuilder publishes comparison pages but no automated migration tools from AN. Standard CSV import path.

**AN -> ActionKit:**
- ActionKit and AN were historically competitors in the progressive space. ActionKit (now part of Bonterra) does not publish AN migration tools. BSD Tools (also Bonterra) was shut down, forcing orgs to migrate.

**AN -> Salsa:**
- Salsa announced shutdown, causing orgs to migrate away. AN itself published migration guides for orgs moving FROM Salsa TO AN. No reverse path documented.

### 2.2 Existing Migration Tools & Scripts

| Tool | Type | Notes |
|------|------|-------|
| CiviCRM AN Extension | Open source | Two-way People sync via OSDI |
| AN API + custom scripts | DIY | Most orgs write Python/Node scripts against the AN API |
| Zapier / n8n | Integration platform | n8n has an AN node; Zapier has AN triggers/actions |
| Celigo | iPaaS | Has AN API connector for enterprise integrations |
| ControlShift Labs | Platform | Has AN integration for distributed petition campaigns |

No turnkey "export everything from AN" tool exists. Migration is always a combination of CSV exports and API scripting.

### 2.3 Common Pain Points

1. **Action history reconstruction:** No single export for full per-person history. Must export each action individually and join by email/ID.
2. **Rate limits:** 4 req/sec with 25 records/page makes full extraction slow for large lists (100K+ contacts).
3. **Embedded pages:** Orgs with hundreds of embedded action pages on their websites must rebuild or redirect every embed.
4. **Email template loss:** Email designs, A/B test history, and automation ladders do not export cleanly.
5. **Staff retraining:** AN's UI is distinctive; switching platforms requires significant retraining.
6. **Donor data:** Payment processor tokens are not portable. Recurring donors must re-enter payment info.
7. **Tag taxonomy:** AN tags are flat strings; mapping to a new system's taxonomy requires manual cleanup.
8. **Subscription status:** Must carefully preserve unsubscribe/bounce/complaint status to maintain CAN-SPAM compliance.

### 2.4 Typical Migration Timeline

Based on nonprofit CRM migration research:

- **Planning phase:** 2-3 months (audit data, select destination, map fields)
- **Implementation:** 3-6 months (build import pipeline, migrate data, test, train staff)
- **Parallel operation:** 1-2 months (run both systems simultaneously)
- **Total:** 6-12 months recommended from decision to full cutover

For smaller orgs (<10K contacts, few actions): 2-3 months is achievable.
For large orgs (100K+ contacts, hundreds of actions, embedded pages): 6-12 months.

---

## 3. AN Pricing & Lock-in Mechanisms

### 3.1 Current Pricing (as of May 2025 rate change)

| Tier | Base Cost | Email Rate | Mobile Rate | Target Org |
|------|-----------|------------|-------------|------------|
| Free | $0 | Limited | - | Individual activists |
| Movement | $15/mo min | $1.25/1K emails | $10/1K messages ($50 min) | Small-midsize orgs |
| Network | $125/mo min | $2.50/1K emails | $20/1K messages ($100 min) | Federated/multi-group |
| Enterprise | Custom | Negotiated | Negotiated | 1M+ emails/month |

**Key pricing notes:**
- Usage-based billing (fluctuates monthly)
- No per-seat charges for core platform
- Action Builder add-on: ~$80/user (for relational organizing features)
- Boost add-on: ML predictions (separate pricing)
- API access: Included with Movement+ tiers
- Negotiated rates available for 500K+ emails/month

### 3.2 Lock-in Mechanisms

| Mechanism | Severity | Description |
|-----------|----------|-------------|
| Embedded action pages | **High** | Orgs embed AN petition/event/fundraising forms across their website via iframes/JS. Hundreds of embeds must be replaced on migration. |
| Email list + subscription state | **High** | Contact list with subscription status, bounce history, and complaint records. Must be perfectly preserved for deliverability. |
| Action history | **Medium-High** | Years of "who signed what, when" data. Difficult to fully extract (one action at a time). |
| Tag taxonomy | **Medium** | Organizational tagging schemes built over years. Flat strings, org-specific meaning. |
| Automation ladders | **Medium** | Email drip sequences / engagement ladders. Not exportable; must be rebuilt. |
| Staff training | **Medium** | Staff familiar with AN's specific UI patterns, report builder, targeting. |
| Integrations | **Medium** | Zapier/ActBlue/Salesforce integrations configured with AN. Must be rewired. |
| Donor recurring payments | **Medium** | Payment processor tokens are platform-bound. Recurring donors must re-authorize. |
| Network hierarchy | **Low-Medium** | Network-tier orgs have parent/child group relationships configured. |
| Custom field schemas | **Low** | Custom field definitions must be recreated. Data is exportable. |
| URL/redirect equity | **Low** | actionnetwork.org/petitions/... URLs have SEO equity and may be shared widely on social media. |

### 3.3 Contract Terms

- Monthly billing (no annual lock-in documented for Movement tier)
- Network and Enterprise may have negotiated terms
- Data is owned by the org (AN's terms state orgs own their data)
- No documented data deletion timeline after account closure — orgs should export before canceling

---

## 4. Data Portability Standards

### 4.1 OSDI (Open Supporter Data Interface)

**Version:** 1.2.0
**Status:** Specification is published but **adoption has stalled**. The GitHub repo (`opensupporter/osdi-docs`) has minimal recent activity. The governance site (opensupporter.org) is largely static.

**What it defines:** 28+ resource types including People, Donations, Events, Petitions, Signatures, Attendances, Canvasses, Tags, Messages, and more.

**Technical format:** JSON+HAL with OData filtering. Hypermedia-driven (HATEOAS links).

**Who implemented it:**
- Action Network (primary implementer, API is OSDI-based)
- CiviCRM (OSDI extension, partial implementation)
- NGP VAN (participated in governance, limited implementation)
- CallHub (OSDI integration for AN sync)

**Reality check:** OSDI was promising but never achieved critical mass. Most platforms implement proprietary APIs. AN's API is the most complete OSDI implementation, which ironically means OSDI is more useful for getting data OUT of AN than for interchange between arbitrary systems.

### 4.2 VAN/VPB Export Formats

- VoteBuilder (VAN's voter file tool) exports CSV with standardized voter file fields
- EveryAction Organizing exports in formats designed for upload into VoteBuilder, EveryAction, NationBuilder, or third-party CRMs
- Matching is by unique ID (VANID) or standard fields (name, address, email)
- MiniVAN (mobile canvassing) syncs real-time back to VAN database
- No formal interchange standard; each platform defines its own CSV column conventions

### 4.3 Other Relevant Standards

| Standard | Domain | Status |
|----------|--------|--------|
| OSDI | Advocacy/organizing | Stalled (see above) |
| CiviCRM API v4 | Nonprofit CRM | Active, open-source |
| Salesforce NPSP schema | Nonprofit CRM | Active, proprietary |
| VAN file format | Voter contact | Proprietary, de facto standard for Democratic campaigns |
| CSV with email as primary key | Universal | The actual interchange "standard" in practice |
| vCard/hCard | Contact data | Not used in advocacy contexts |
| Webhook payloads | Event-driven | Each platform defines its own; no standard |

**Practical reality:** The de facto standard for advocacy data interchange is **CSV files keyed on email address**, with manual field mapping. No broadly-adopted machine-readable interchange standard exists for the advocacy/organizing sector.

---

## 5. What AN Orgs Actually Use

### 5.1 Core Feature Usage (80/20 Analysis)

Based on case studies (Women's March, March for Our Lives, AFL-CIO, DNC, 350.org, AAUP chapters), the features that cover ~80% of use cases are:

| Feature | Usage Frequency | Description |
|---------|----------------|-------------|
| **Mass email** | Daily/Weekly | Broadcast emails to segmented lists. A/B testing, scheduling. This is the #1 feature. |
| **Petitions** | Per campaign | Collect signatures, display counter, thank-you emails. High public visibility. |
| **Event pages** | Per event | RSVP collection, event details, location. Used for rallies, meetings, town halls. |
| **List management & tagging** | Ongoing | Segment supporters by tags, action history, geography. Foundation of targeting. |
| **Reports/targeting** | Weekly | Query builder to create segments for email sends or exports. |

**Secondary features (remaining 20%):**

| Feature | Usage | Notes |
|---------|-------|-------|
| Fundraising pages | Per campaign | Often orgs use ActBlue instead; AN fundraising is secondary |
| Advocacy/letter campaigns | Per legislative session | Target officials with templated letters |
| Forms | As needed | Generic data collection (surveys, sign-ups) |
| Automation ladders | Set-and-forget | Welcome series, engagement escalation |
| Embeddable widgets | One-time setup | Action pages embedded on org websites |
| Ticketed events | Occasional | Less common; orgs often use Eventbrite |
| Surveys | Occasional | Internal polling of supporter base |
| SMS/mobile messaging | Growing | Newer feature, not universally adopted |

### 5.2 What Orgs Wish AN Had

Based on competitor positioning, forum discussions, and migration motivations:

1. **Built-in phone banking / calling** — AN requires third-party tools (CallHub, ThruTalk). Orgs want integrated dialers.
2. **Relational organizing / 1:1 tracking** — AN's Action Builder is a paid add-on. Orgs want built-in relationship mapping without extra cost.
3. **Full website builder** — AN only provides action pages, not full websites. Orgs maintain separate website platforms.
4. **Advanced CRM features** — Contact records in AN are thin. Orgs want richer contact profiles, interaction history, notes, tasks.
5. **Better reporting / analytics** — The one-action-at-a-time export limitation frustrates data teams. Cross-action analytics are weak.
6. **Multilingual support** — Not well-documented in AN. Organizations serving non-English-speaking communities struggle.
7. **Deeper integrations** — While AN has Zapier/ActBlue/Salesforce integrations, orgs want native integrations with more tools.
8. **Offline organizing tools** — AN is purely digital. Orgs doing door-to-door canvassing need separate tools.
9. **Member management / dues** — AN is activist-centric, not member-centric. Orgs with formal membership structures need more.
10. **Decentralized data ownership** — AN hosts all data on its infrastructure. Privacy-conscious orgs want self-hosted or verifiable data control.

### 5.3 Org Profiles by Size

**Small orgs (<5K contacts):**
- Use email + petitions almost exclusively
- Rarely use API
- Migration is straightforward (CSV export/import)
- Biggest barrier: embedded action pages on website

**Mid-size orgs (5K-50K contacts):**
- Heavy email users, multiple campaign types
- Use tagging and targeting extensively
- May have Zapier integrations and ActBlue connected
- Migration complexity: moderate (need to preserve action history and integrations)

**Large orgs (50K+ contacts):**
- Full feature usage including Network tier, automation ladders, fundraising
- Complex tag taxonomies, multiple administrators
- Deep integrations with CRM (Salesforce, EveryAction)
- Migration complexity: high (6-12 months, likely needs custom scripting)

---

## 6. Migration Architecture Implications

### 6.1 What a Migration Tool Needs

For a verification-native platform to offer AN migration, it must handle:

1. **People import** — Email, name, address, phone, custom fields, tags, subscription status
2. **Action history reconstruction** — Map AN actions to the new platform's participation model
3. **Subscription state preservation** — Critical for CAN-SPAM/CASL compliance
4. **Tag mapping** — Flat AN tags to new platform's taxonomy (potentially hierarchical)
5. **Embedded page replacement** — Provide equivalent embeddable widgets or redirect strategy
6. **Ongoing sync period** — Support parallel operation during transition (AN API -> new platform)

### 6.2 AN API Extraction Strategy

```
For a complete extraction from AN:

1. GET /api/v2/people (paginate all)              → contacts
2. GET /api/v2/tags (paginate all)                 → tag definitions
3. For each person: GET .../taggings               → tag assignments
4. GET /api/v2/petitions (paginate all)            → petition metadata
5. For each petition: GET .../signatures           → who signed
6. GET /api/v2/events (paginate all)               → event metadata
7. For each event: GET .../attendances             → who RSVP'd
8. GET /api/v2/forms (paginate all)                → form metadata
9. For each form: GET .../submissions              → who submitted
10. GET /api/v2/fundraising_pages (paginate all)   → fundraising metadata
11. For each page: GET .../donations               → who donated
12. GET /api/v2/advocacy_campaigns (paginate all)  → letter campaigns
13. For each campaign: GET .../outreaches          → who sent letters
14. GET /api/v2/surveys (paginate all)             → survey metadata
15. For each survey: GET .../responses             → who responded
16. GET /api/v2/custom_fields                      → field definitions
17. GET /api/v2/messages                           → email history
```

**Estimated extraction time for 100K contacts, 200 actions:**
- People: 4,000 pages x 0.25s = ~17 min
- Actions metadata: ~8 pages = ~2s
- Per-action participation: 200 actions x avg 2,000 participants x 80 pages = 16,000 pages = ~67 min
- Tags/custom fields: <1 min
- **Total: ~90-120 minutes** (within rate limits)

### 6.3 Verification-Native Value Proposition for AN Orgs

The migration pitch to AN orgs should emphasize what AN fundamentally cannot provide:

1. **Verified civic identity** — AN has no identity verification. Petition signatures could be bots. A verification-native platform proves real constituents.
2. **Verifiable participation** — ZK proofs of civic action, not just database rows.
3. **Data sovereignty** — Org/individual owns data cryptographically, not a platform vendor.
4. **Anti-astroturfing** — Verified district membership means petitions reflect actual constituents.
5. **Privacy-preserving analytics** — Aggregate civic engagement without exposing individual records.

---

## Sources

- [Action Network API Documentation v2](https://actionnetwork.org/docs/v2/)
- [Action Network Help: Choosing Data to Pull for Reports](https://help.actionnetwork.org/hc/en-us/articles/203113119-Choosing-the-data-to-pull-for-reports)
- [Action Network Help: API Documentation for Developers](https://help.actionnetwork.org/hc/en-us/articles/203113609-API-documentation-for-developers)
- [Action Network Help: Downloading Email Statistics](https://help.actionnetwork.org/hc/en-us/articles/203846705-Downloading-email-statistics)
- [Action Network Help: Managing and Exporting Event RSVPs](https://help.actionnetwork.org/hc/en-us/articles/204680295-Managing-and-exporting-event-RSVPs)
- [Action Network Help: Viewing and Managing Custom Fields](https://help.actionnetwork.org/hc/en-us/articles/204256825-Viewing-and-managing-questions-and-custom-fields)
- [Action Network Plans/Pricing](https://actionnetwork.org/get-started/)
- [Action Network Pricing Update Blog Post](https://actionnetwork.blog/an-update-on-action-network-pricing/)
- [Action Network Billing FAQs](https://help.actionnetwork.org/hc/en-us/articles/360022159952-Billing-FAQs)
- [OSDI Specification Documentation](https://opensupporter.github.io/osdi-docs/)
- [OSDI GitHub Repository](https://github.com/opensupporter/osdi-docs)
- [CiviCRM OSDI Integration](https://civicrm.org/blog/anudit-verma/implementing-the-open-supporter-data-interface-osdi-api-for-civicrm)
- [CiviCRM Action Network Integration](https://civicrm.org/blog/noah/action-network-integration-seeking-input)
- [Solidarity Tech vs Action Network Comparison](https://www.solidarity.tech/alternative-to/action-network)
- [Action Network Migration Blog Post](https://actionnetwork.blog/were-ready-to-make-your-migration-to-action-network-as-quick-easy-as-possible/)
- [NationBuilder vs Action Network](https://nationbuilder.com/how_is_nationbuilder_different_from_actionnetwork)
- [Action Network InfluenceWatch Profile](https://www.influencewatch.org/non-profit/action-network/)
- [350.org Action Network Guide](https://350.org/local/digital-tools/action-network/)
- [n8n Action Network Node](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.actionnetwork/)
- [Celigo Action Network APIs](https://docs.celigo.com/hc/en-us/articles/25053559520539-Available-Action-Network-APIs)
- [Virtuous: Perfect Timeline for CRM Migration](https://virtuous.org/blog/timeline-migrating-to-a-new-crm/)
- [CharityEngine: Challenges When Switching CRMs](https://blog.charityengine.net/nonprofit-crm-software-challenges)
- [Social Edge: How to Prepare for Platform Migration](https://www.socialedgeconsulting.com/post/how-to-prepare-for-a-platform-migration)
