# Database Seeding

## Overview

Single consolidated seeding script for the MVP database with congressional and SF-focused templates.

## Usage

```bash
# Seed the database
npm run db:seed

# Or directly
npx tsx scripts/seed-database.ts
```

## What Gets Seeded

### Users (12)
- Mix of verified and unverified users
- VOTER Protocol data (trust scores, reputation tiers, tokens)
- Geographic distribution across US
- Realistic user personas (teachers, organizers, policy analysts)

### Templates (13)

#### Federal Templates (9) - All with Source Citations
1. **Climate**: NOAA 2024 damage reports ($178B disasters vs $7.4B spending)
2. **Defense vs Childcare**: NDAA FY2024 ($858B defense, $0 childcare)
3. **Healthcare**: HHS OIG on insulin pricing (900% markup)
4. **Student Debt**: Federal Reserve data ($1.7T debt crisis)
5. **Housing**: HUD 2025 rent data ($2,400 median rent)
6. **AI Regulation**: Senate hearings on regulation vacuum
7. **Child Privacy**: Surgeon General on mental health crisis
8. **Debt Ceiling**: Treasury/CBO on $34T debt
9. **Immigration**: CBP statistics on border encounters

#### SF Municipal Templates (4) - All with Source Citations
1. **SF Teacher Housing**: SFUSD data on 2-hour commutes
2. **Empty Offices**: Axios SF on 35% vacancy, only 1 conversion
3. **Retail Ghost Town**: CoStar on 22% Union Square vacancy
4. **SFUSD Exodus**: 5,000 students lost to housing crisis

### Representatives (4)
- Nancy Pelosi (CA-11)
- Alex Padilla (Senator)
- Laphonza Butler (Senator)
- Kevin Kiley (CA-3)

## Template Features

### Source Citations
Every template includes:
- Verified sources in description field
- In-message citations with dates
- Government reports, official statistics
- No unsourced claims

### Delivery Methods
- **Federal**: `cwc` (Communicating With Congress API)
- **Municipal**: `email` (Direct email to SF officials)

### Metrics
- Realistic send counts
- District coverage data
- Quality scores from AI agents
- Verification status

## Data Integrity

All templates follow "The Math Doesn't Work" format:
1. Sharp contrast numbers
2. Source citation
3. Local connection
4. Personal story placeholder
5. Direct question to officials

## Environment Variables

Required for full functionality:
- `SUPABASE_DATABASE_URL`
- `CWC_API_KEY` (for congressional delivery)

## Maintenance

The single seed file (`scripts/seed-database.ts`) contains all MVP data:
- Easy to modify templates
- Add new sources as needed
- Adjust user distribution
- Update representative data