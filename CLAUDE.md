# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Common commands

All commands run from the repository root.

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies. |
| `npm run dev` | Start Vite dev server on port 3000 with the built-in `/api/*` plugin. This is the default local workflow. |
| `npm run client` | Same as `npm run dev`. |
| `npm run server` | Start the standalone Express API server on `API_PORT` (default 8787). Use this when running the production frontend build separately. |
| `npm run build` | Build the production frontend bundle to `dist/`. |
| `npm run preview` | Preview the production build via Vite. |
| `npm test` | Run the full Vitest suite once. |
| `npm test -- tests/server/deepseek.test.js` | Run a single test file. |
| `npm test -- --reporter=verbose` | Run tests with verbose output. |

There is no lint script configured; if you add one, wire it through `package.json` and update this section.

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `DEEPSEEK_API_KEY` — required for AI plan generation.
- `DEEPSEEK_BASE_URL` — defaults to `https://api.deepseek.com`.
- `API_PORT` — port for the standalone Express server; defaults to `8787`.
- `TRUST_PROXY` — set to `1` or `true` only when a trusted reverse proxy overwrites client IP headers; Docker Compose sets this to `1`.
- `QWEATHER_API_KEY` — optional API key for QWeather (和风天气). When absent or unavailable, the app falls back to Open-Meteo.
- `QWEATHER_BASE_URL` — defaults to `https://devapi.qweather.com/v7`.
- `QWEATHER_GEO_URL` — defaults to `https://geoapi.qweather.com/v2`.

When `QWEATHER_API_KEY` is configured, QWeather is preferred for geocoding and forecast data. QWeather's `/weather/7d` response is matched by calendar date; if it cannot cover the complete itinerary, the app reuses the resolved coordinates and falls back to Open-Meteo. If the key is missing or a QWeather request fails, the app geocodes with Open-Meteo and uses its daily forecast for the trip range.

Vite loads `.env` automatically in dev mode. The standalone server relies on `dotenv`.

## High-level architecture

This is a React + Vite frontend with a small Node.js API layer. `src/main.jsx` only mounts the app; `src/App.jsx` coordinates application state and high-level interactions, while reusable UI and utilities live under `src/components/` and `src/utils/`. The API logic lives in `server/deepseek.js` and is exposed through three interchangeable surfaces.

### Frontend (`src/App.jsx` and modules)

- `App.jsx` coordinates the planning board, input forms, and print/export dialogs.
- `components/ItineraryComponents.jsx` owns the itinerary cards and day columns.
- `components/TravelControls.jsx` owns generation-progress controls.
- `utils/date.js`, `utils/plan.js`, `utils/storage.js`, and `utils/export.js` isolate date mapping, plan data, persistence, and export behavior.
- State is held in React hooks and persisted to `localStorage`:
  - `travel-plan-board-v1` stores the current trip plan.
  - `travel-plan-conversation-v1` stores the recent conversation history used for contextual refinements.
- The core data model is a "plan" object:
  - `destination`, `start_date`, `total_budget_estimate`, `recommended_transport`
  - `weather`: map of `Day N` → weather summary string
  - `itinerary`: map of `Day N` → array of cards
- Each itinerary card has `{ id, type, title, cost, duration, advice }`. Valid `type` values are: `交通`, `景点`, `citywalk`, `美食`, `酒店`, `娱乐`, `工作`.
- Drag-and-drop uses `@hello-pangea/dnd` for reordering cards within a day, moving cards across days, and reordering days.
- Budget computation is derived from card `cost` strings via `parseCostAmount`/`getBudgetRange`.
- Export features build output in-memory:
  - JSON import/export reads/writes the full plan object.
  - Markdown export builds a text itinerary.
  - Print export builds a standalone HTML document with embedded CSS.
  - Image export renders the itinerary to a `<canvas>` and produces a PNG blob.

### API generation flow (`server/deepseek.js`)

`generateTravelPlan(idea, context)` is the generation service called by the shared request handler. It performs three steps:

1. **Extract trip context** — calls DeepSeek with a constrained JSON prompt to get `destination`, `start_date`, and `days`.
2. **Fetch real weather** — when configured, geocodes the destination with QWeather and fetches its 7-day forecast by date; if that forecast cannot cover the complete itinerary, it falls back to Open-Meteo using the already resolved coordinates. Otherwise it geocodes with Open-Meteo and fetches its daily forecast for the trip range.
3. **Generate the plan** — calls DeepSeek again with the extracted context, recent conversation history, current plan (if refining), and the real weather summary; parses the JSON response and normalizes it.

`normalizePlan(parsed, weatherByDay, tripContext)` validates the AI output, fixes malformed card IDs, coerces unknown card types to `景点`, deduplicates IDs, and aligns `weather` keys with `itinerary` days.

DeepSeek calls retry once on 5xx and have a 60-second timeout per attempt. QWeather calls use a 10-second timeout; Open-Meteo calls currently do not have an explicit timeout.

### API surfaces

The shared `handleGenerateRequest` transport flow is exposed through three deployment surfaces so the app works in dev, standalone, and serverless deployments:

- `vite.config.js` — `travelApiPlugin()` registers `/api/health` and `/api/generate` directly on the Vite dev server.
- `server/index.js` — Express app exposing the same two routes; used for standalone production hosting.
- `api/generate.js` and `api/health.js` — Vercel serverless function handlers.

The full `/api/generate` pipeline (body reading, rate limiting, validation, generation, error shaping) lives in the shared `server/generate-handler.js`, which all three surfaces call. Keep the surfaces limited to transport glue so they cannot drift apart.

### Request protection

All users can access the app without registration or a password. The shared `/api/generate` handler applies the guards in `server/request-guard.js`:

- Process-local rate limit: 5 successful generations per 10 minutes per client address. Quota is consumed only after a generation succeeds; failed requests do not count.
- Request body limit: 1 MiB, enforced while reading the raw stream (the frontend Nginx `client_max_body_size` matches); larger bodies return 413.
- Oversized but well-formed fields are truncated instead of rejected: `idea` to 2,000 characters, `history` to the last 8 items with 800 characters each, `currentPlan` itinerary to 16 days and 200 cards. Structural errors return 400.
- The rate-limit key comes from the socket address unless `TRUST_PROXY=1` (or `true`), which enables the proxy-forwarded `X-Real-IP` / `X-Forwarded-For` headers. The Docker frontend Nginx uses the realip module and only honors those headers from private-network proxies, so spoofed client headers never reach the API.
- Intentionally user-facing errors are created via `createPublicError` (which sets `expose`); everything else is reduced to a generic message, and upstream `detail` is logged server-side only.

The limiter is intentionally dependency-free and process-local. In a multi-instance Vercel deployment, each instance has its own counter; use shared storage if a globally consistent quota is required.

## Testing

- Framework: Vitest v4 with `globals: true` and default `node` environment.
- DOM/component tests rely on `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`.
- Test files: `tests/**/*.{test,spec}.{js,jsx,ts,tsx}` and `src/**/*.{test,spec}.{js,jsx,ts,tsx}`.
- Server tests must declare `// @vitest-environment node` at the top of the file.
- `tests/server/deepseek.test.js` covers generation flow, retry logic, QWeather date mapping, and the Open-Meteo fallback boundary.
- `tests/server/request-guard.test.js` covers request validation, rate-limit behavior, and public error shaping.
- `tests/api/generate.test.js` covers the Vercel route method guard, validation, successful responses, and unexpected-error convergence.
- `tests/components/App.test.jsx` covers key custom-card interactions.
- CI runs `npm test` on every push and pull request to `master` or `main` via `.github/workflows/test.yml`.

## Deployment notes

- **Production deploys and rollbacks use the repo-root `deploy.sh` / `rollback.sh` on the server — see `DEPLOYMENT.md` for the spec.** Flow: build timestamped images → start candidate containers on an isolated network (ports bound to `127.0.0.1`) → pre-verify gates → atomic cutover with old containers renamed and retained for 24h → public re-check; failed cutovers auto-rollback. Do NOT run `docker compose down` / `up` against the live containers anymore (`docker compose build` is still used by the script). Deploy from the server repo at `/opt/git/travel-plan`, which pulls from Gitee — push both remotes locally.
- Docker (recommended for production): the root `Dockerfile` builds the Vite frontend and serves it with Nginx; Nginx proxies `/api/` to the `travel-plan-api` Node container on port `8787`. `server/Dockerfile` runs the API container. `docker-compose.yml` attaches both services to the external `npm-network` and does not publish application ports to the host.
- Nginx Proxy Manager must join the same external network and proxy to `travel-plan:80`. The frontend Nginx preserves the upstream client address headers used by the API rate limiter.
- Required Docker environment: `DEEPSEEK_API_KEY`. Optional weather variables are `QWEATHER_API_KEY`, `QWEATHER_BASE_URL`, and `QWEATHER_GEO_URL`; without the key, weather falls back to Open-Meteo.
- Vercel remains supported through `vercel.json` and `api/`, but is not the primary deployment path.
- Local standalone: run `npm run build` then `npm run server`, and serve the `dist/` directory with a reverse proxy.
