# **Communiqué**

**Civic engagement platform for congressional advocacy and direct outreach campaigns.**

Turn-key email delivery to Congress via Communicating With Congress (CWC) API, plus direct email campaigns with OAuth-powered user acquisition.

**Self-sustaining civic infrastructure funded by cryptographic proof-of-work.**

*Let the collective voice rise.*

## 🚀 Live Deployment

- **Production**: https://communi.email
- **Staging**: https://staging.communi.email

## 🛠 Tech Stack

- **Framework**: SvelteKit 5 + TypeScript + Tailwind CSS
- **Database**: Supabase (Postgres) + Prisma ORM
- **Authentication**: OAuth (Google, Facebook, Twitter, LinkedIn, Discord)
- **Congressional Delivery**: Communicating With Congress (CWC) API
- **Address Validation**: Census Bureau Geocoding API
- **Deployment**: Fly.io


## ⚡ Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/communisaas/communique-site.git
cd communique-site
npm install
```

### 2. Environment Setup
Create `.env` with required variables:

```bash
# Database (Supabase Postgres)
SUPABASE_DATABASE_URL="postgresql://user:pass@host:port/db"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
FACEBOOK_CLIENT_ID="your-facebook-app-id"
FACEBOOK_CLIENT_SECRET="your-facebook-app-secret"
TWITTER_CLIENT_ID="your-twitter-client-id"
TWITTER_CLIENT_SECRET="your-twitter-client-secret"
LINKEDIN_CLIENT_ID="your-linkedin-client-id"
LINKEDIN_CLIENT_SECRET="your-linkedin-client-secret"
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"

# OAuth Configuration
OAUTH_REDIRECT_BASE_URL="http://localhost:5173"

# APIs
CWC_API_KEY="your-cwc-api-key"
CWC_API_BASE_URL="https://cwc.api.url"

# Analytics (Optional)

```

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed sample templates and global legislative channels
npm run db:seed
npm run db:seed:channels
```

### 4. Start Development
```bash
npm run dev
```

App available at `http://localhost:5173`

## 🔑 OAuth Provider Setup

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add redirect URIs:
   - `http://localhost:5173/auth/google/callback` (dev)
   - `https://staging.communi.email/auth/google/callback` (staging)
   - `https://communi.email/auth/google/callback` (prod)

### Facebook, Twitter, LinkedIn, Discord
Similar setup - create apps in respective developer consoles and configure redirect URIs following the same pattern: `{BASE_URL}/auth/{provider}/callback`

## 📊 Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema changes (dev)
npm run db:migrate     # Create/run migrations (prod)
npm run db:studio      # Open Prisma Studio GUI
npm run db:seed        # Seed sample data
npm run db:reset       # Reset database (dev only)
```

## 🏗 Build & Deploy

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Linting
npm run lint
```

### Fly.io Deployment
```bash
# Deploy to staging
fly deploy --config fly.staging.toml

# Deploy to production  
fly deploy
```

## ✨ Features

### 🌍 Global Legislative Channels
- Tiered access by country (email, api/form, social-only)
- Dynamic channel resolution in SSR via `channelResolver`
- US certified delivery (web forms) gated; Tier 1 countries use direct email

### 📧 Congressional Advocacy
- **Address-based representative lookup**: Find user's Congress members
- **CWC API integration**: Direct delivery to congressional offices
- **Template system**: Pre-built advocacy messages
- **Personalization**: Custom user details injection

### 🎯 Direct Email Campaigns
- **mailto-based delivery**: Opens the user's email client with pre-filled content
- **Template engine**: Customizable message templates
- **Campaign tracking**: Delivery analytics

### 🔐 Authentication & Onboarding
- **OAuth providers**: Google, Facebook, Twitter, LinkedIn, Discord
- **Address collection**: For congressional campaigns
- **Profile completion**: For direct outreach
- **Extended sessions**: 90-day cookies for template-action deep-link flows (e.g., `template-modal`, `auth=required`, `action=complete`)

### 📱 User Experience
- **Responsive design**: Mobile-first interface
- **Template modal**: Streamlined sharing flow
- **mailto: integration**: One-click email client launch (Tier 1 countries)
- **Social amplification**: Built-in viral pattern generator and share flow

## 📁 Project Structure

```
src/
├── lib/
│   ├── server/          # Server-side utilities
│   │   ├── auth.ts      # Session management
│   │   ├── db.ts        # Prisma client
│   │   └── oauth.ts     # OAuth utilities
│   └── components/      # Reusable UI components
├── routes/
│   ├── auth/           # OAuth callback handlers
│   ├── api/            # API endpoints
│   ├── template-modal/ # Template sharing pages
│   └── onboarding/     # Address/profile collection
├── app.html           # HTML template
└── app.css            # Global styles

docs/                  # Documentation
prisma/               # Database schema & migrations
static/               # Static assets
```

## 🔗 Key Integrations

### Communicating With Congress (CWC)
- Validates messages against CWC requirements
- Handles delivery to congressional offices
- Provides delivery confirmation

### Address Validation
- Census Bureau Geocoding API (primary)
- ZIP→District fallback (OpenSourceActivismTech, 119th)

### Cryptographic Infrastructure (Algorithmic Coordination)
- Anchoring: Monad (cheap EVM) for cryptographic proof verification; batch Merkle roots and deterministic execution logs
- Algorithmic Treasury: Smart contracts automatically execute fund allocation based on mathematical correlation scores
- ERC-8004 Reputation: Portable democratic credibility across platforms - built for AI agents, extended to human civic participants
- Zero-Knowledge Verification: Didit.me integration for privacy-preserving identity proofs
- Autonomous Execution: Code-as-constitution eliminating human discretion from democratic coordination

## 🚨 Common Issues

### OAuth Redirect Mismatches
Ensure redirect URIs in OAuth provider consoles match exactly:
- `http://localhost:5173/auth/{provider}/callback` (dev)
- `https://staging.communi.email/auth/{provider}/callback` (staging)  
- `https://communi.email/auth/{provider}/callback` (prod)

### Database Connection Issues
- Check Supabase Postgres connection string format
- Ensure database exists and is accessible
- Run `npm run db:generate` after schema changes

### Missing Environment Variables
- All OAuth provider keys must be set
- CWC API credentials required for congressional delivery
- Check `.env` against the example above

## 📚 Documentation

See **[docs/](./docs/)** for comprehensive documentation:

- **[Claude guide](./CLAUDE.md)**: Single authoritative development guide
- **[Architecture](./docs/architecture.md)**: System design & flows
- **[Integrations](./docs/integrations.md)**: External services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper tests
4. Submit a pull request

## 📄 License

[MIT License](./LICENSE)