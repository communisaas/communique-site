# Dev quickstart

## Setup
```bash
npm install
npm run dev        # http://localhost:5173
```

## Common commands
```bash
npm run build      # production build
npm run preview    # preview build
npm run check      # type + svelte-check
npm run lint       # eslint
npm run test       # unit + e2e
```

## Environment
Set required keys in your shell or `.env`:
```bash
SUPABASE_DATABASE_URL=...
CWC_API_KEY=...
```
Optional (OAuth providers, etc.) are listed in `docs/architecture.md`.

## What matters in code
- Routes: `src/routes/` (pages and API)
- Components: `src/lib/components/`
- Server utils: `src/lib/server/`
- Congressional: `src/lib/congress/`
- Types/stores/utils: `src/lib/types/`, `src/lib/stores/`, `src/lib/utils/`

## Running tests
```bash
npm run test:unit
npm run test:e2e
```

## Dev tips
- Use `$lib/...` absolute imports
- Keep everything SSR-safe; use `browserUtils.isBrowser()` for DOM access
- Prefer centralized utilities: `apiClient`, `timerCoordinator`, `modalSystem`
