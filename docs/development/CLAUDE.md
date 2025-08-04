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
npm run lint              # Run ESLint and Prettier checks
npm run format            # Auto-format code with Prettier
npm run check             # Type-check with svelte-check
npm run test              # Run all tests (unit + e2e)
npm run test:unit         # Run unit tests with Vitest
npm run test:unit:coverage # Run unit tests with coverage analysis
npm run test:e2e          # Run e2e tests with Playwright
```

#### Testing Architecture
The project uses a comprehensive multi-layered testing approach:

**📊 Current Coverage: 200+ test cases across critical system components**

1. **Unit Tests (`src/**/*.test.ts`)**
   - **Store Testing**: Modal system, popover, tooltip, guest state, templates
   - **API Testing**: Congressional routing, user management, error handling, templates
   - **Component Testing**: Auth modals, address requirements, UI components
   - **Service Testing**: AI suggestions, email service, geolocation, personalization

2. **Integration Tests (`src/tests/integration/`)**
   - **Congressional Delivery Flow**: End-to-end message routing and CWC submission
   - **Authentication Flow**: OAuth providers, session management, template context
   - **Address Collection Flow**: Verification, representative lookup, Self.xyz integration

3. **E2E Tests (`e2e/`)**
   - **Critical User Journeys**: Auth flow, template creation, congressional delivery
   - **Mobile Experience**: Responsive design, touch interactions
   - **OAuth Integration**: Google, Facebook, Twitter, LinkedIn, Discord

#### Testing Patterns & Best Practices

**Component Testing**:
```typescript
// Standard pattern for Svelte component tests
import { render, fireEvent, screen } from '@testing-library/svelte';
import Component from './Component.svelte';

describe('Component', () => {
  it('handles user interaction correctly', async () => {
    render(Component, { props: { isOpen: true } });
    
    const button = screen.getByText('Click me');
    await fireEvent.click(button);
    
    expect(screen.getByText('Success')).toBeTruthy();
  });
});
```

**API Endpoint Testing**:
```typescript
// Standard pattern for SvelteKit API tests
import { POST } from './+server.ts';

describe('API Endpoint', () => {
  it('processes requests correctly', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({ data: 'test' })
    };
    
    const response = await POST({ request: mockRequest } as any);
    const data = JSON.parse(response.body);
    
    expect(data.success).toBe(true);
  });
});
```

**Store Testing**:
```typescript
// Standard pattern for Svelte store tests
import { get } from 'svelte/store';
import { myStore, actions } from './store.ts';

describe('Store', () => {
  it('manages state correctly', () => {
    actions.update('new value');
    expect(get(myStore)).toBe('new value');
  });
});
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

### Core Concepts

#### Dual Delivery Channels
The platform supports two message delivery methods, determined by `channelId`:

1. **Congressional Delivery** (`channelId: 'certified'`)
   - Formal constituent-to-representative communication
   - Requires: `[Representative Name]`, `[Name]`, `[Address]` variables
   - Auto-populates representative based on user's district

#### Tiered User Verification System
Users can exist at different verification levels for enhanced credibility:

1. **Unverified Users** (`is_verified: false`)
   - Standard OAuth authentication (Google, Facebook, etc.)
   - Can send messages but without verification badges
   - Subject to standard rate limiting

2. **Verified Users** (`is_verified: true`)
   - **Self.xyz Integration**: Zero-knowledge proof identity verification
     - Uses passport NFC scanning for humanity proof
     - Provides Sybil resistance (prevents fake accounts)
     - Age verification (18+) for voting eligibility
     - Nationality verification for appropriate advocacy
   - **Benefits**: 
     - Verified badge on advocacy messages and user profile
     - "Enhanced Credibility" indicator for congressional templates
     - Higher priority in congressional routing systems
     - Enhanced anti-spam protection for the community

#### Self.xyz Verification Flow
1. User completes OAuth (gets address for congressional templates)
2. Optional: User chooses identity verification via VerificationModal
3. **Real Self.xyz Integration**:
   - Frontend uses `@selfxyz/qrcode` SelfQRcodeWrapper component
   - QR code generated with SelfAppBuilder configuration
   - Backend API endpoint `/api/identity/verify` handles verification
   - Uses `@selfxyz/core` SelfBackendVerifier for proof validation
4. User scans passport with Self mobile app (NFC required)
5. Zero-knowledge proof generated, submitted to our API endpoint
6. Backend verifies proof and updates user verification status
7. User marked as verified with comprehensive verification metadata

**Database Schema for Verification:**
```sql
-- Added to User model
is_verified: Boolean @default(false)
verification_method: String? -- 'self_xyz', 'manual', etc.
verification_data: Json?     -- Store Self.xyz verification details:
                            -- { attestationId, nationality, ageVerified, 
                            --   ofacPassed, nullifier, sessionUserId, verifiedAt }
verified_at: DateTime?
```

**Self.xyz SDK Configuration:**
- **Frontend**: `@selfxyz/qrcode` - SelfQRcodeWrapper component
- **Backend**: `@selfxyz/core` - SelfBackendVerifier with custom config storage
- **Scope**: `communique-sybil-resistance`
- **Requirements**: Age 18+, OFAC compliance, nationality disclosure
- **Document Types**: Passports and EU ID cards supported

**Note**: Self.xyz provides **identity verification** (humanity/age), not address verification. Address collection remains separate for congressional routing.
   - Generates CWC-compliant XML for submission

2. **Direct Delivery** (any other `channelId`)
   - General-purpose messaging
   - Requires: `[Name]`, `[Address]` variables
   - Uses standard email delivery

### Directory Structure

```
src/
├── routes/              # SvelteKit pages and API endpoints
│   ├── api/            # REST API endpoints (organized by domain)
│   │   ├── (dev)/      # Development/testing endpoints
│   │   ├── address/    # Address validation services
│   │   ├── civic/      # Congressional routing & analytics
│   │   ├── errors/     # Error reporting
│   │   ├── identity/   # Identity verification (Self.xyz)
│   │   ├── templates/  # Template CRUD operations
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

### Address Validation & Congressional Integration

**Real Implementation Stack** (No Mock Data):

#### **Address Verification Flow**
1. **Primary**: Census Bureau Geocoding API validates addresses and extracts congressional districts
2. **Fallback**: ZIP-to-district lookup using OpenSourceActivismTech dataset (119th Congress)
3. **Representatives**: Congress.gov API gets actual representative data

#### **API Endpoints**
- `POST /api/address/verify` - Real address validation + district extraction
- `POST /api/address/lookup` - Representative lookup with ZIP fallback
- `GET /api/address/lookup?state=CA&district=12` - Test district lookup
- `POST /api/civic/routing` - Congressional message routing
- `POST /api/civic/analytics` - Engagement tracking
- `POST /api/identity/init` - Initialize identity verification
- `GET /api/identity/status/[userId]` - Check verification status

#### **User Onboarding Flow**
1. **Address Collection**: AddressCollectionModal.svelte captures user address
2. **Real Validation**: Census Bureau API standardizes address (e.g., "Main St" → "MAIN ST") 
3. **District Extraction**: Gets congressional district from geographies data
4. **Representative Lookup**: Congress.gov API retrieves actual representatives
5. **Storage**: Store validated address + reps in database

#### **Data Sources**
- **Census Bureau**: Free geocoding API for address validation
- **OpenSourceActivismTech**: Free ZIP-district mapping (updated July 2024)
- **Congress.gov**: Free representative data with actual API key

This eliminates all mock data and provides production-grade address validation.

### Testing Approach

- Unit tests: Test individual functions and utilities
- E2E tests: Test full user workflows
- Run specific test: `npm run test:unit -- path/to/test`

### Deployment

The app deploys to Fly.io with staging configuration in `fly.staging.toml`. Production build uses Node adapter.