# Mission App Requirements React

Aplicação frontend pública para consultar os requisitos do Mission App e acompanhar o progresso de cada requisito e sub-requisito.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/mission-app-requirements run test` — run Vitest checklist tests
- `pnpm --filter @workspace/mission-app-requirements run typecheck` — typecheck the frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mission-app-requirements/src/App.tsx` — application shell, navigation, filtering and checklist interactions
- `artifacts/mission-app-requirements/src/data/requirements.ts` — typed requirement catalogue derived from the original Mission App document
- `artifacts/mission-app-requirements/src/lib/checklist.ts` — frontend-only checklist state, progress and localStorage persistence
- `artifacts/mission-app-requirements/src/lib/checklist.test.ts` — Vitest coverage for progress, toggling and persistence
- `reference-original/` — imported HTML/CSS/JS/image reference files from the public GitHub repository

## Architecture decisions

- The checklist is intentionally local to the browser; there is no backend, authentication or external validation.
- Requirement progress counts both parent requirements and nested sub-requirements so every visible checkbox contributes to the global total.
- Unknown or stale localStorage entries are ignored when the requirement catalogue changes.
- The original site remains a content and visual reference; the React app owns the interactive checklist experience.

## Product

The app reproduces the Mission App requirements atlas in Portuguese, with searchable functional and non-functional requirements, independent checkboxes, parent progress summaries, completion filters, responsive navigation and a reset flow.

## User preferences

- Frontend-only application with no authentication or validation service.
- Use React and Vitest.

## Gotchas

- The Vite build requires `PORT` and `BASE_PATH`; managed workflows provide them automatically.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
