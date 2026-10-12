# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (pinned via `packageManager` in package.json).

```bash
pnpm dev                              # Vite dev server
pnpm build                            # production build -> dist/
pnpm preview                          # serve the built output
pnpm typecheck                        # tsc --noEmit (tests are excluded from tsconfig)
pnpm test                             # vitest run (all tests, non-watch)
pnpm vitest run src/lib/checklist.test.ts             # single file
pnpm vitest run -t "merges remote state"              # single test by name
pnpm vitest                                           # watch mode
```

There is no linter or formatter configured.

## What this app is

A single-page, read-and-check "atlas" of the Mission App product requirements (all UI copy is Brazilian Portuguese). Users tick each requirement in **two independent checklists**:

- **back** — backend done, frontend missing (orange)
- **full** — backend + frontend integrated (navy)

State lives in `localStorage` and is mirrored to a shared Vercel KV store so the checklist is the same across devices/people.

## Architecture

### Requirement tree (`src/data/requirements.ts`)
The entire requirement corpus is a hardcoded recursive `RequirementNode[]` (`id`, `code`, `title`, `description?`, `children?`), built with the local `item()` helper, split into `functionalRequirements` / `nonFunctionalRequirements` and concatenated into `allRequirements`. Node `id`s are the persistence keys — **renaming an id silently drops that item's saved state** (unknown ids are filtered out on load in `loadTimestampedChecklist`). Adding/removing nodes changes every progress denominator.

### Checklist engine (`src/lib/checklist.ts`)
All state logic is here, pure and tested; `App.tsx` only wires it to React. Key invariants:

- **Two state shapes.** `TimestampedChecklistState` (`{[id]: {value, timestamp}}`) is what's persisted and synced. `ChecklistState` (`{[id]: boolean}`) is derived via `toPlainState` for rendering. Never persist the plain form.
- **Cascade down, roll up.** `toggleChecklist` writes the new value to the node *and all descendants* (`getDescendantIds`); `syncParentStates` then recomputes every parent as "checked iff all children checked". The plain state rendered by `App` is always passed through `syncParentStates`, so parent booleans are derived, not authoritative.
- **Mutual exclusion between the two checklists.** The two boxes are *states*, not cumulative steps: an item is either "back only" or "back+front", never both. Checking a node in one checklist moves it out of the other — `App` calls `clearTimestampedBranch(oppositeTsState, id, oppositeType, timestamp)`, which clears the node and all its descendants there and re-derives the ancestors via `syncParentStates`. It only emits updates for genuinely changed ids. Nothing is disabled in the UI (the old `getLockedIds` lock was removed: it only looked at ancestors, so checking a parent in one list silently left a child checked in both).
- **Conflict resolution is per-item "latest timestamp wins"**, implemented twice and deliberately mirrored: `mergeTimestampedStates` on the client and the update loop in `api/checklist.ts`. Change one, change the other.
- **Legacy migration.** A stored bare `boolean` is read as `{value, timestamp: 0}` so any remote value wins over pre-timestamp local data.
- Three storage keys exist: `CHECKLIST_BACK_KEY`, `CHECKLIST_FULL_KEY`, and the older `CHECKLIST_STORAGE_KEY` (still the default arg of the load/save helpers, only used by tests).

### Sync flow (`src/App.tsx` ↔ `api/checklist.ts`)
1. Mount: state initialises from `localStorage`, then `fetchCloudState()` GETs `/api/checklist` and merges remote into local (`mergeTimestampedStates`).
2. Toggle: `toggleTimestampedChecklist` returns `{nextTsState, updates}`; `App` sets state, writes localStorage, and fires `syncCloudItems(updates)` — a POST of only the changed items, not the whole map. When the toggle *checks* an item, the updates from `clearTimestampedBranch` on the opposite checklist are appended to the same POST.
3. There is no polling or realtime channel; a second device only picks up changes on reload.
4. All cloud helpers swallow errors and return `null`, so the app degrades to localStorage-only. The serverless function does the same: with no KV env vars it returns `{back:{}, full:{}, warning:'Vercel KV not configured'}` with status 200.

`api/checklist.ts` is a Vercel serverless function storing one JSON blob under `mission-app:checklist-state:v1`, accepting `GET`, `POST {updates}` and `POST {reset:true}`. It accepts either `KV_REST_API_*` or `UPSTASH_REDIS_REST_*` env vars. See `VERCEL_DEPLOYMENT_GUIDE.md` and `.env.example`.

### UI
`src/App.tsx` (~440 lines) is the whole UI: topbar, sidebar summary/search, hero, summary rings, and the recursive `RequirementCard` → `SubRequirement` → `NodeCheck` tree. Search/filter is a pure `filterNode` pass producing a pruned copy of the tree — a node survives if it matches or any descendant does.

Styling is **hand-written CSS with semantic class names in `src/index.css`** (single dense file, CSS custom properties for the palette), *not* Tailwind utilities in JSX. Tailwind and a full shadcn/ui library (`src/components/ui/*`, `components.json`) are installed but essentially unused by the app — only `error-boundary.tsx` and the unrouted `pages/not-found.tsx` touch them. Match the existing CSS-class approach when editing `App.tsx`; treat `components/ui/*` as vendored scaffolding. `wouter` is a dependency but there is no router.

### Tests
`src/lib/checklist.test.ts` runs in the `node` environment (`vitest.config.ts`) and stubs `globalThis.window.localStorage` by hand with `Object.defineProperty`. There is no jsdom and no component testing — keep logic in `src/lib/` so it stays testable.

## Gotchas

- `vite.config.ts` copies a logo into `public/` from a hardcoded absolute path under another user's home directory (`/home/pedroamaro/.gemini/...`). It's guarded by `fs.existsSync`, so it's a no-op here — don't "fix" it by pointing it anywhere else without asking; `public/logo.png` and `public/favicon.png` are already committed.
- `@/*` resolves to `src/*` in vite, vitest and tsconfig — all three must stay in sync.
- Requirement counts quoted in UI copy (e.g. "RF 01 — RF 20", "NF 01 — NF 06") and the "Última revisão" date in the hero are hardcoded strings in `App.tsx`, not derived from the data.
