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

Vite loads `.env` automatically in dev mode. The standalone server relies on `dotenv`.

## High-level architecture

This is a React + Vite frontend with a small Node.js API layer. The entire UI lives in `src/main.jsx`; the API logic lives in `server/deepseek.js` and is exposed through three interchangeable surfaces.

### Frontend (`src/main.jsx`)

- Single-file React application that renders the planning board, packing list, input forms, and print/export dialogs.
- State is held in React hooks and persisted to `localStorage`:
  - `travel-plan-board-v1` stores the current trip plan.
  - `travel-plan-conversation-v1` stores the recent conversation history used for contextual refinements.
  - `travel-plan-theme` stores the light/dark theme preference.
- The core data model is a "plan" object:
  - `destination`, `start_date`, `total_budget_estimate`, `recommended_transport`
  - `weather`: map of `Day N` → weather summary string
  - `itinerary`: map of `Day N` → array of cards
  - `packing_items`: array of packing objects
- Each itinerary card has `{ id, type, title, cost, duration, advice }`. Valid `type` values are: `交通`, `景点`, `citywalk`, `美食`, `酒店`, `娱乐`, `工作`.
- Drag-and-drop uses `@hello-pangea/dnd` for reordering cards within a day, moving cards across days, and reordering days.
- Budget computation is derived from card `cost` strings via `parseCostAmount`/`getBudgetRange`.
- Export features build output in-memory:
  - JSON import/export reads/writes the full plan object.
  - Markdown export builds a text itinerary.
  - Print export builds a standalone HTML document with embedded CSS.
  - Image export renders the itinerary to a `<canvas>` and produces a PNG blob.

### API generation flow (`server/deepseek.js`)

`generateTravelPlan(idea, context)` is the only public generation function. It performs three steps:

1. **Extract trip context** — calls DeepSeek with a constrained JSON prompt to get `destination`, `start_date`, and `days`.
2. **Fetch real weather** — geocodes the destination via Open-Meteo, then fetches daily forecast data for the trip range.
3. **Generate the plan** — calls DeepSeek again with the extracted context, recent conversation history, current plan (if refining), and the real weather summary; parses the JSON response and normalizes it.

`normalizePlan(parsed, weatherByDay, tripContext)` validates the AI output, fixes malformed card IDs, coerces unknown card types to `景点`, deduplicates IDs, and aligns `weather` keys with `itinerary` days.

Network calls to DeepSeek retry once on 5xx and have a 60-second timeout per attempt.

### API surfaces

The same `generateTravelPlan` function is invoked from three places so the app works in dev, standalone, and serverless deployments:

- `vite.config.js` — `travelApiPlugin()` registers `/api/health` and `/api/generate` directly on the Vite dev server.
- `server/index.js` — Express app exposing the same two routes; used for standalone production hosting.
- `api/generate.js` and `api/health.js` — Vercel serverless function handlers.

When adding or changing an API route, keep all three surfaces in sync or extract the shared handler.

## Testing

- Framework: Vitest v4 with `globals: true` and default `node` environment.
- DOM/component tests rely on `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom`.
- Test files: `tests/**/*.{test,spec}.{js,jsx,ts,tsx}` and `src/**/*.{test,spec}.{js,jsx,ts,tsx}`.
- Server tests must declare `// @vitest-environment node` at the top of the file.
- `tests/server/deepseek.test.js` is the primary regression suite for the generation flow. It stubs the global `fetch` to mock DeepSeek and Open-Meteo responses.
- CI runs `npm test` on every push and pull request to `master` or `main` via `.github/workflows/test.yml`.

## Deployment notes

- Vercel: `vercel.json` is configured for Vite. Set `DEEPSEEK_API_KEY` in the Vercel dashboard.
- Standalone: run `npm run build` then `npm run server`, and serve the `dist/` directory with a reverse proxy.
