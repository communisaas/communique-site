# Integrations

## Address + Representatives
- Primary: Census Bureau Geocoding API (address validation + district)
- Fallback: ZIP→district (OpenSourceActivismTech, 119th)
- Representatives: Congress.gov API
- Code: `src/lib/congress/address-lookup.ts`

## Legislative submission adapters (e.g., CWC)
- User flow is invariant: we open the mail client with prepared content
- Backend adapters can translate/submit to certified APIs/forms when required
- US example: generate CWC XML from template + user + target rep
- Code: `src/lib/congress/cwc-generator.ts`
- API examples under `src/routes/api/civic/*`
- See: `docs/integrations/congressional-integration.md`

## Identity (optional)
- Self.xyz for humanity/age (ZK proofs)
- UI: `VerificationModal.svelte`; API: `src/routes/api/identity/*`

## OAuth providers
- Google, Facebook, Twitter, LinkedIn, Discord under `src/routes/auth/*`

## Email (direct delivery)
- Mailto-based delivery for non-congressional templates (opens client)
- Code: `src/lib/services/emailService.ts`

## Env
- `SUPABASE_DATABASE_URL` required
- Adapter keys (as needed), e.g., `CWC_API_KEY`
- OAuth client IDs/secrets as configured per provider
