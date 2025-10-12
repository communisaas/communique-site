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
  - Address validation: `src/lib/core/congress/address-lookup.ts`
  - CWC generator: `src/lib/core/congress/cwc-generator.ts`
  - Legislative adapters: `src/lib/core/legislative/adapters/`
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

- Blockchain-based civic action rewards and verification (integration in progress)
- See voter-protocol repository for full architecture details

## Identity (optional)

- Self.xyz for humanity/age (ZK proofs)
- UI: `VerificationModal.svelte`; API: `src/routes/api/identity/*`

## OAuth providers

- Google, Facebook, Twitter, LinkedIn, Discord under `src/routes/auth/*`

## Email (direct delivery)

- Mailto-based delivery for non-congressional templates (opens client)
- Code: `src/lib/services/emailService.ts`

## Agent Orchestration

Template moderation uses LangGraph-based multi-agent consensus:
- 3 AI agents (OpenAI, Gemini, Claude) vote on template quality
- LangGraph workflows orchestrate agent coordination
- See: `docs/agents/agent-architecture.md` for details
- Code: `src/lib/agents/content/`

## Env

- `SUPABASE_DATABASE_URL` required
- Adapter keys (as needed), e.g., `CWC_API_KEY`
- AI keys: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
- OAuth client IDs/secrets as configured per provider
