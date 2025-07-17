# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Development Workflow
```bash
npm run dev          # Start development server (port 5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm start            # Start production server
```

### Code Quality & Testing
```bash
npm run lint         # Run ESLint and Prettier checks
npm run format       # Auto-format code with Prettier
npm run check        # Type-check with svelte-check
npm run test         # Run all tests (unit + e2e)
npm run test:unit    # Run unit tests with Vitest
npm run test:e2e     # Run e2e tests with Playwright
```

### Database Management
```bash
npm run db:generate  # Generate Prisma client after schema changes
npm run db:push      # Push schema changes to database (development)
npm run db:migrate   # Create and apply migrations (production)
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed database with sample data
```

## Architecture Overview

### Tech Stack
- **Frontend**: SvelteKit 5 + TypeScript + Tailwind CSS
- **Backend**: SvelteKit API routes with server-side rendering
- **Database**: CockroachDB with Prisma ORM
- **Authentication**: Custom session-based auth using @oslojs/crypto
- **Testing**: Vitest (unit) + Playwright (e2e)

### Core Concept: Dual Delivery Channels

The platform supports two message delivery methods, determined by `channelId`:

1. **Congressional Delivery** (`channelId: 'certified'`)
   - Formal constituent-to-representative communication
   - Requires: `[Representative Name]`, `[Name]`, `[Address]` variables
   - Auto-populates representative based on user's district
   - Generates CWC-compliant XML for submission

2. **Direct Delivery** (any other `channelId`)
   - General-purpose messaging
   - Requires: `[Name]`, `[Address]` variables
   - Uses standard email delivery

### Directory Structure

```
src/
├── routes/              # SvelteKit pages and API endpoints
│   ├── api/            # REST API endpoints
│   │   ├── templates/  # Template CRUD operations
│   │   ├── address/    # Congressional district lookup
│   │   └── user/       # User-specific data
│   ├── auth/           # OAuth providers (Google, Facebook, Twitter)
│   └── dashboard/      # User dashboard views
├── lib/
│   ├── components/     # Reusable Svelte components
│   │   ├── landing/    # Public-facing components
│   │   ├── template/   # Template creation/editing
│   │   └── ui/         # Common UI components
│   ├── server/         # Server-side utilities
│   │   ├── auth.ts     # Session management
│   │   ├── db.ts       # Database connection
│   │   └── oauth.ts    # OAuth provider configs
│   ├── congress/       # Congressional integration
│   │   ├── address-lookup.ts  # Address → representatives
│   │   └── cwc-generator.ts   # CWC XML generation
│   └── types/          # TypeScript type definitions
└── app.d.ts            # SvelteKit app types (locals)
```

### Authentication Flow

1. OAuth login via `/auth/{provider}` endpoints
2. Session created using `createSession()` with 30-day expiry
3. Session validated on each request via `hooks.server.ts`
4. User/session available in `event.locals`

### Database Models

Key relationships:
- `User` → has many `Template`, `Session`, `user_representatives`
- `Template` → belongs to `User`, has metrics and personalizations
- `representative` → linked to users via `user_representatives`
- `Session` → belongs to `User` for auth

### API Patterns

All API routes follow RESTful conventions:
- `GET /api/templates` - List resources
- `POST /api/templates` - Create resource
- `GET /api/templates/[id]` - Get specific resource
- `PUT /api/templates/[id]` - Update resource
- `DELETE /api/templates/[id]` - Delete resource

### Environment Variables

Required:
```bash
DATABASE_URL          # CockroachDB connection string
CONGRESS_API_KEY      # Congress.gov API key
```

Optional:
```bash
GOOGLE_CLIENT_ID      # OAuth providers
GOOGLE_CLIENT_SECRET
FACEBOOK_CLIENT_ID
FACEBOOK_CLIENT_SECRET
TWITTER_CLIENT_ID
TWITTER_CLIENT_SECRET
GOOGLE_CIVIC_API_KEY  # Enhanced address lookup
```

### Congressional Integration

User flow:
1. **Onboarding**: User enters address → lookup representatives → store in DB
2. **Advocacy**: Retrieve stored reps → generate CWC XML → submit

This avoids repeated API calls and provides instant rep access during advocacy.

### Testing Approach

- Unit tests: Test individual functions and utilities
- E2E tests: Test full user workflows
- Run specific test: `npm run test:unit -- path/to/test`

### Deployment

The app deploys to Fly.io with staging configuration in `fly.staging.toml`. Production build uses Node adapter.