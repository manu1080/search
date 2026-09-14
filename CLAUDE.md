# Agent Instructions — search

## Project
`search` is a personal project (GitHub account `manu1080`, repo `manu1080/search`): a fully local
e-commerce product search app with asynchronous CSV catalog ingestion. It is a Node/TypeScript
monorepo with two packages — it does NOT use `dotnet`; skip every .NET rule from the parent
`manu-projects/CLAUDE.md`.

- `backend/` — Express 5 API + RabbitMQ worker, TypeScript, Prisma 7 (Postgres), OpenSearch client, Zod, pino
- `frontend/` — Vite + React 19 + TypeScript, HeroUI, Tailwind 4, react-router 7
- `docker-compose.yml` — local infra: Postgres, RabbitMQ, OpenSearch (+ optional Dashboards)

Read `README.md` first — it documents the architecture, the two-phase search strategy, the CSV
format, the API surface, and the reasoning behind non-obvious decisions. Do not re-derive those.

## Architecture (backend) — respect the boundaries
```
backend/src/
├─ core/              pure domain: entities, use cases, ports (interfaces). Imports NOTHING from infrastructure/ or http/
├─ infrastructure/    adapters: Prisma, OpenSearch, RabbitMQ, disk storage, bcrypt, JWT, CSV parser
├─ http/              Express: routes, thin controllers, middleware
├─ worker/            queue consumer entrypoint
└─ container.ts       composition root — the ONLY place that picks concrete implementations
```
- New behaviour goes in a use case under `core/`, wired through a port. Adapters live in `infrastructure/`
- Controllers stay thin — no business logic in `http/`
- `backend/src/generated/` is Prisma output: never edit it by hand, never commit it

## Commands — always use `make` from the repo root (`make help` lists everything)
- `make install` — `npm install` for backend and frontend (also runs `prisma generate`)
- `make up` — start postgres + rabbitmq + opensearch and wait for healthchecks
- `make db-migrate` — apply Prisma migrations
- `make db-seed` — create the demo user
- `make os-init` — create the `products` index in OpenSearch
- `make dev` — API (:4000) + worker + frontend (:5173) together
- `make dev-api` / `make dev-worker` / `make dev-web` — one process at a time
- `make test` — Vitest, backend + frontend (no infra needed)
- `make lint` — backend typecheck + frontend eslint
- `make e2e` — Cypress against the running stack (needs `make up` + `make dev` first); `make e2e-open` for interactive
- `make build` — production build of both packages
- `make tools` — OpenSearch Dashboards on :5601
- `make down` / `make reset` — stop containers / stop and wipe volumes
- `make logs` — tail infra logs

Run `cd backend && npm run <script>` / `cd frontend && npm run <script>` only for scripts the
Makefile does not expose (e.g. `test:watch`, `typecheck`, `prisma:generate`).

## Ports and credentials
| Service | Port | Notes |
|---|---|---|
| Frontend (Vite) | 5173 | proxies `/api` and `/health` to the API |
| API | 4000 | `PORT` in `backend/.env` |
| Postgres | 5434 | `search` / `search` / db `search` (5432/5433 are used by other projects) |
| RabbitMQ | 5672 | management UI on 15672, `guest` / `guest` |
| OpenSearch | 9200 | security plugin disabled, single node |

- Demo login: `demo@search.local` / `Demo1234!` (created by `make db-seed`)
- `backend/.env` is gitignored; `backend/.env.example` is the template. Never commit `.env`
- Sample catalogs for ingestion: `backend/samples/products.csv` (120 valid rows) and
  `backend/samples/products-con-errores.csv` (5 valid + 3 invalid rows)

## Testing
- **Unit / integration (Vitest)**: `make test`. Backend tests live in `backend/tests/` mirroring
  `backend/src/` (`tests/core`, `tests/http`, `tests/infrastructure`); frontend tests sit next to
  the source as `*.test.ts(x)` under `frontend/src/`. Use fake ports / in-memory repositories for
  use cases, `supertest` for HTTP routes, Testing Library for components. They must NOT require
  Docker
- **E2E (Cypress)**: `frontend/cypress/e2e/*.cy.ts`. Search specs seed their own catalog
  (`sku` prefix `E2E-`, brand `Zephyra`) directly into the index and clean it up; `upload.cy.ts`
  exercises the real upload → RabbitMQ → worker → OpenSearch chain. Cover the golden path and key
  edge cases of any new user-facing flow
- Always run `make test` and `make lint` before marking a task as done
- Run `make e2e` when the change touches a user-facing flow, search behaviour, or the ingestion pipeline
- Never skip, comment out, or loosen failing tests to make the suite green — fix the root cause
- Search behaviour changes: verify the two-phase strategy still holds (precise phase first,
  fuzzy only on zero hits) and that facet counts are not polluted by fuzzy matches

## Rules
- Apply SOLID principles; keep `core/` free of framework and I/O concerns
- Prefer dependency injection through `container.ts` over module-level singletons
- UI: reuse HeroUI components and Tailwind utilities already in the repo — no new CSS files, no
  hand-rolled primitives
- Frontend talks to the API with relative paths only (`/api/...`) — the Vite proxy handles the rest
- Indexing must stay idempotent (`_id = sku`); invalid CSV rows are counted, never abort the import
- Keep comments and user-facing strings in Spanish, matching the existing codebase; code identifiers in English
- No dead code, no commented-out blocks left behind
- Never modify the Makefile or `docker-compose.yml` without explicit approval
- Always use `zsh` as the shell for commands

## Parallel agents / worktrees
- `agents_search.sh` (in this folder) manages parallel Claude agents in git worktrees under
  `../search-worktrees/slot-*`. Each worktree gets `backend/.env` copied from the base repo and
  its own `node_modules` (via `make install`)
- The Docker infra (`make up`) is shared by every worktree — ports and the compose project name
  are fixed. Only ONE worktree can run `make dev` / `make e2e` at a time; `make test` and
  `make lint` need no infra and are safe to run in parallel
- Data in Postgres / OpenSearch is shared too: don't `make reset` while another agent may be
  running E2E tests

## Output — agents directory
- ALL generated output goes to `~/projects/manu-projects/agents/` — no exceptions
- Subdirectories by type: `agents/docs/`, `agents/plans/`, `agents/scripts/`
- Screenshots and images from Playwright: `agents/screenshots/`
- Temporary files, reports, and any other AI-generated artifact: `agents/`
- Never save generated output inside this repo or any of its worktrees unless it is actual code
  that belongs in the codebase
- Every time you create a plan, save it as `agents/plans/plan_<feature>.md`

## Browser testing — Playwright MCP
- Playwright MCP is available for browser interaction; use it for smoke tests, UI debugging, and
  verifying flows end-to-end against the locally running app
- Start the stack with `make up` then `make dev`; check the Vite output for the actual frontend
  port (5173 by default, Vite picks the next free one if it is taken) before navigating
- To take a screenshot, navigate, click, or fill forms: use the playwright MCP tools directly

## Commit and PR Guidelines
- GitHub account: `manu1080`; remote `https://github.com/manu1080/search.git`
- Use `gh` with `zsh` for all GitHub operations
- Do not push changes without explicit user approval
- Before pushing: `make lint` and `make test` (and `make e2e` when the change warrants it)
- Fix any lint / type errors before pushing
- Commit messages follow the existing style: short, Spanish, imperative, no prefix
  (e.g. `Busqueda por prefijo: "tec" encuentra "Teclado"`)
- Create a PR using `gh`
- Do not include Claude Code signatures in PRs, commit messages, or comments
- Do not include "Generated with Claude Code" or similar signatures
- Keep PR descriptions concise and focused on the changes
- Review CI in GitHub before considering the PR done
