# Feature Documentation

**Feature implementation guides, organized by priority and dependencies.**

---

## Core Features (Start Here)

### 1. [templates.md](templates.md) - Template System

Variable extraction, customization, multi-agent content moderation.

**What it does**: Users create/customize message templates, AI agents moderate for quality.

**Dependencies**: None (core feature)

### 2. [creator.md](creator.md) - Template Creator

CodeMirror editor, jurisdiction picker, variable extraction UI.

**What it does**: Rich text editor for creating templates with jurisdiction targeting.

**Dependencies**: templates.md

### 3. [verification.md](verification.md) - Email Verification

TEE-based email verification with OAuth persistence. Privacy-preserving proof of delivery.

**What it does**: Verify user sent congressional message without reading email content.

**Dependencies**: oauth.md

---

## Authentication & Onboarding

### 4. [oauth.md](oauth.md) - OAuth Integration

Google, Facebook, Twitter, LinkedIn, Discord authentication. Token persistence and management.

**What it does**: Single sign-on, encrypted token storage, user can revoke anytime.

**Dependencies**: None

### 5. [onboarding.md](onboarding.md) - Progressive Onboarding

Progressive disclosure patterns, step-by-step user activation.

**What it does**: Gradual feature introduction, reduces cognitive load.

**Dependencies**: oauth.md

---

## Discovery & Search

### 6. [search.md](search.md) - Semantic Search

Template discovery via semantic embeddings, natural language queries.

**What it does**: "Find templates about housing" → relevant templates ranked by semantic similarity.

**Dependencies**: embeddings.md

### 7. [jurisdiction.md](jurisdiction.md) - Jurisdiction Targeting

Geographic targeting for templates (city council, state legislature, congressional district).

**What it does**: Templates can target specific elected officials by geography.

**Dependencies**: templates.md

---

## Advanced Features

### 8. [embeddings.md](embeddings.md) - Gemini Embeddings

Google Gemini integration for semantic search, template clustering, recommendation engine.

**What it does**: Generate vector embeddings for templates, enable semantic search.

**Dependencies**: None (standalone service)

**Roadmap**: See "Next Steps" section in embeddings.md

### 9. [sharing.md](sharing.md) - Universal Sharing

Native share API (mobile) + clipboard (desktop). Platform-agnostic sharing patterns.

**What it does**: One button shares everywhere (WhatsApp, Discord, Slack, Twitter, email, SMS).

**Dependencies**: templates.md

### 10. [abstraction.md](abstraction.md) - Legislative Abstraction

Adapter pattern for different legislative bodies (US Congress, state legislatures, city councils).

**What it does**: Unified interface for delivering messages to any legislative body.

**Dependencies**: None (architecture pattern)

---

## Cross-References

**Search UX patterns** → See `/docs/design/search-ux.md`

**Privacy architecture** → See `/docs/architecture/`

**Template design guidelines** → See `/docs/design/discovery.md`

**Database schema** → See `/docs/development/schema.md`

---

## Implementation Status

| Feature | Status | Priority |
|---------|--------|----------|
| templates.md | ✅ Complete | P0 (core) |
| creator.md | ✅ Complete | P0 (core) |
| oauth.md | ✅ Complete | P0 (core) |
| onboarding.md | ✅ Complete | P1 |
| jurisdiction.md | ✅ Complete | P1 |
| sharing.md | ✅ Complete | P1 |
| abstraction.md | ✅ Complete | P1 |
| search.md | 🚧 In Progress | P2 |
| embeddings.md | 🚧 In Progress | P2 |
| verification.md | 📋 Planned | P3 |

---

## Reading Order

**New developers**: templates.md → creator.md → oauth.md

**UX designers**: onboarding.md → sharing.md → search.md

**Backend engineers**: abstraction.md → embeddings.md → verification.md

**Security engineers**: verification.md → oauth.md → /docs/architecture/tee.md
