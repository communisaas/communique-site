# Prisma Schema

For complete database documentation, see **[docs/development/database.md](../docs/development/database.md)**.

## Quick Commands

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes (dev)
npm run db:migrate   # Create/run migrations (prod)
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed sample data
```

## Schema Files

- **`schema.prisma`** - Main production schema (9 core models)
- **`features.prisma`** - Feature-flagged models (beta features)
- **`experimental.prisma`** - Research models (dev only)

See full documentation for schema organization, privacy architecture, and development workflow.
