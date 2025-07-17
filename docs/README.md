# Communique Documentation

This directory contains comprehensive documentation for the Communique platform, organized for efficient development and integration with Claude Code.

## 📁 Directory Structure

### `/development/`
Documentation for developers working with Claude Code and the development environment.

- **[CLAUDE.md](./development/CLAUDE.md)** - Primary development guide for Claude Code integration
  - Essential commands, architecture overview, and development workflows
  - Environment variables and testing approaches
  - Database management and deployment instructions

### `/integrations/`
External service integrations and third-party API documentation.

- **[CONGRESSIONAL_INTEGRATION.md](./integrations/CONGRESSIONAL_INTEGRATION.md)** - Congressional advocacy system
  - User-focused congressional integration approach
  - Address → Representatives mapping during onboarding
  - CWC/email delivery system for advocacy actions

### `/architecture/`
System architecture, user flows, and strategic implementation documents.

- **[SOCIAL_MEDIA_FUNNEL.md](./architecture/SOCIAL_MEDIA_FUNNEL.md)** - User acquisition system
  - Social media traffic conversion strategies
  - OAuth onboarding flows and session management
  - Guest → authenticated user conversion paths

- **[blockchain-civic-engagement-analysis.md](./architecture/blockchain-civic-engagement-analysis.md)** - Blockchain integration analysis
  - Cost analysis for blockchain civic engagement features
  - Alternative platform evaluation and implementation strategies
  - Economic models ensuring free democratic participation

### `/api-reference/` *(Private Documentation)*
API specifications, schemas, and sensitive integration documentation.

*Note: Congressional API documentation is kept private and excluded from the public repository.*

## 🎯 For Claude Code Development

When working with Claude Code, start with:

1. **[development/CLAUDE.md](./development/CLAUDE.md)** - Main development guide
2. **[integrations/CONGRESSIONAL_INTEGRATION.md](./integrations/CONGRESSIONAL_INTEGRATION.md)** - Congressional feature context
3. **[architecture/SOCIAL_MEDIA_FUNNEL.md](./architecture/SOCIAL_MEDIA_FUNNEL.md)** - User flow understanding

## 🔗 Quick Navigation

| Topic | Document | Purpose |
|-------|----------|---------|
| **Development Setup** | [development/CLAUDE.md](./development/CLAUDE.md) | Essential for all development work |
| **Congressional Features** | [integrations/CONGRESSIONAL_INTEGRATION.md](./integrations/CONGRESSIONAL_INTEGRATION.md) | Understanding advocacy workflows |
| **User Acquisition** | [architecture/SOCIAL_MEDIA_FUNNEL.md](./architecture/SOCIAL_MEDIA_FUNNEL.md) | Social media conversion flows |
| **Private API Docs** | *Not in public repo* | Congressional API integration (private) |
| **Blockchain Strategy** | [architecture/blockchain-civic-engagement-analysis.md](./architecture/blockchain-civic-engagement-analysis.md) | Future blockchain features |

## 📝 Contributing to Documentation

When adding new documentation:

- **Development guides** → `/development/`
- **Integration docs** → `/integrations/`
- **Architecture & flows** → `/architecture/`
- **API references** → `/api-reference/`

Keep the main project `README.md` focused on getting started, while detailed documentation lives here.