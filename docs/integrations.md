# Integrations

## Address + Representatives

- Primary: Census Bureau Geocoding API (address validation + district)
- Fallback: ZIP→district (OpenSourceActivismTech, 119th)
- Representatives: Congress.gov API
- Code: `src/lib/core/congress/address-lookup.ts`

## Legislative Submission (Governance Adapters)

**Universal flow**: Open user's mail client with prepared message. Backend adapters handle certified submissions.

### US Congress (Current)
- **Address lookup**: Census Geocoding API → district → representatives
- **CWC submission**: Generate XML for Communicating with Congress API
- **Components**:
  - Address validation: `src/lib/congress/address-lookup.ts`
  - CWC generator: `src/lib/congress/cwc-generator.ts`
  - API routes: `src/routes/api/civic/*`
- **Flow**: 
  1. Geocode address → find district
  2. Look up House rep + 2 Senators
  3. Format for CWC (prefix, topic, delivery method)
  4. Submit and return cryptographic receipt

### Future Adapters (Planned)
- **Westminster** (UK/Canada/Australia): Postcode → constituency → MP
- **European Parliament**: Country/region → MEPs with multi-language support
- **Direct Democracy**: Initiative tracking and signature collection
- See: `docs/governance-adapters.md` for full roadmap

## VOTER Protocol Integration

- Blockchain-based civic action rewards and verification
- Server-side proxy architecture for secure API communication
- Deterministic address generation for wallet-free participation
- See: `docs/integrations/voter-blockchain.md`

## Identity (optional)

- Self.xyz for humanity/age (ZK proofs)
- UI: `VerificationModal.svelte`; API: `src/routes/api/identity/*`

## OAuth providers

- Google, Facebook, Twitter, LinkedIn, Discord under `src/routes/auth/*`

## Email (direct delivery)

- Mailto-based delivery for non-congressional templates (opens client)
- Code: `src/lib/services/emailService.ts`

## N8N Workflow Orchestration

**External service that orchestrates the entire template processing pipeline.**

### Architecture
- **Deployment**: Fly.io (`communique-n8n.fly.dev`)
- **Communication**: Webhook-based with Communique APIs
- **Purpose**: Orchestrates agents, CWC submission, status tracking

### Workflow Stages
1. **Template Submission** → N8N webhook trigger
2. **Consensus Stage** → Calls `/api/n8n/process-template?stage=consensus`
   - Triggers multi-agent voting (OpenAI + Gemini + Claude)
   - Returns approval decision with consensus type
3. **CWC Submission** → If approved, calls `/api/cwc/submit`
4. **Status Updates** → Posts to `/api/webhooks/n8n/status`
   - Maps workflow stages to user-facing status
   - Broadcasts updates via WebSocket

### N8N Configuration
```env
N8N_INSTANCE_URL=https://communique-n8n.fly.dev
N8N_WEBHOOK_SECRET=shared-secret
COMMUNIQUE_API_URL=https://api.communi.email
```

### Webhook Endpoints
- **Process**: `/api/n8n/process-template` - Main processing endpoint
- **Status**: `/api/webhooks/n8n/status` - Workflow progress updates
- **Moderation**: `/api/webhooks/template-moderation` - Direct trigger (testing)

### Flow Example
```
[N8N Webhook] → [HTTP Request: Consensus] → [Switch: Approved?]
                                                ├─Yes→ [CWC Submit]
                                                └─No→ [Stop]
```

The N8N workflow acts as the orchestrator while Communique agents provide the intelligence.

## Env

- `SUPABASE_DATABASE_URL` required
- Adapter keys (as needed), e.g., `CWC_API_KEY`
- N8N keys: `N8N_WEBHOOK_SECRET`, `N8N_INSTANCE_URL`
- AI keys: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- OAuth client IDs/secrets as configured per provider
