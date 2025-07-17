# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📚 Complete Documentation

**For comprehensive development documentation, see [docs/development/CLAUDE.md](./docs/development/CLAUDE.md)**

The main development guide has been moved to the organized docs directory structure. This includes:

- Essential development commands and workflows
- Architecture overview and tech stack details
- Environment variables and testing approaches
- Database management and deployment instructions

## 📁 Documentation Structure

All documentation is now organized in the `/docs/` directory:

- **`/docs/development/`** - Development guides and Claude Code integration
- **`/docs/integrations/`** - External service integrations
- **`/docs/architecture/`** - System architecture and user flows
- **`/docs/api-reference/`** - API specifications and schemas

## 🚀 Quick Start

For immediate development:

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Check code quality
npm run check        # Type checking
npm run test         # Run tests
```

## 🎯 Essential Context

This is a **SvelteKit 5 + TypeScript + Tailwind CSS** civic engagement platform supporting:

- **Congressional Delivery** via Communicating With Congress (CWC) API
- **Direct Email Delivery** for general advocacy
- **OAuth Authentication** (Google, Facebook, Twitter, LinkedIn, Discord)
- **Template Creation** with action-oriented URL slugs
- **Address-based Representative Lookup** for congressional advocacy

For detailed information, see the complete documentation in `/docs/`.