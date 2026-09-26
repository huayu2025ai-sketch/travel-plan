# Testing

The project uses a Vitest regression suite covering the server-side AI generation flow, API route behavior, weather-provider branches, and key frontend interactions. Tests should cover behavior and external-service failure paths as features are added.

## Framework

- **Vitest** v4 — fast Vite-native test runner
- **@testing-library/react** — render and interact with React components
- **@testing-library/jest-dom** — DOM-focused matchers
- **jsdom** — browser-like environment for component tests

## Running tests

```bash
npm test
```

## Test layers

| Layer | What | Where | When |
|-------|------|-------|------|
| Unit | Pure functions, helpers, utilities | `tests/**/*.test.js` | Every change |
| Integration | AI generation flow and service boundaries | `tests/server/**/*.test.js` | When touching server code |
| Route | API method, validation, and public error behavior | `tests/api/**/*.test.js` | When touching API entry points |
| Component | Critical user interactions | `tests/components/**/*.test.jsx` | When touching frontend behavior |
| Smoke | App starts and renders without crashing | Not implemented yet | Add before deploys |
| E2E | Full user flows | Not implemented yet | Add when user flows stabilize |

## Current coverage

The current suite contains seven test files and 45 cases. It covers DeepSeek response normalization, retry and weather-provider behavior; request validation, concurrency-safe quota reservations and body limits; Vercel route behavior; budget parsing and concurrent edit/weather validity; plus key App interactions including edits made while AI generation is pending. Smoke and full browser E2E tests are not yet implemented.

## Conventions

- Test files live next to the code they test or under `tests/`.
- File naming: `*.test.js` or `*.spec.js`.
- Use `describe`/`it` blocks with clear intent.
- Assert behavior, not existence — avoid `expect(x).toBeDefined()`.
- Mock external dependencies (APIs, databases, environment variables).
- Server tests use `// @vitest-environment node`.
- Component tests use the default `jsdom` environment.
