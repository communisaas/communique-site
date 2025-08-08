# Integrations

## Address + Representatives
- Primary: Census Bureau Geocoding API (address validation + district)
- Fallback: ZIP→district (OpenSourceActivismTech, 119th)
- Representatives: Congress.gov API
- Code: `src/lib/congress/address-lookup.ts`

## Congressional delivery (CWC)
- Generate CWC XML from template + user + target rep
- Code: `src/lib/congress/cwc-generator.ts`
- API examples under `src/routes/api/civic/*`

## Identity (optional)
- Self.xyz for humanity/age (ZK proofs)
- UI: `VerificationModal.svelte`; API: `src/routes/api/identity/*`

## OAuth providers
- Google, Facebook, Twitter, LinkedIn, Discord under `src/routes/auth/*`

## Email (direct delivery)
- Standard email delivery for non-congressional templates
- Code: `src/lib/services/emailService.ts`

## Env
- `CONGRESS_API_KEY` required
- OAuth client IDs/secrets as configured per provider
