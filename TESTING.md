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

The current suite contains four test files and 35 cases. `tests/server/deepseek.test.js` covers DeepSeek response normalization, retry behavior, context injection, QWeather date mapping, and the Open-Meteo fallback boundary. `tests/server/request-guard.test.js` covers request validation, rate-limit behavior, and public error shaping. `tests/api/generate.test.js` covers the Vercel route handler, and `tests/components/App.test.jsx` covers packing-list and custom-card interactions. Smoke and full browser E2E tests are not yet implemented.

## Conventions

- Test files live next to the code they test or under `tests/`.
- File naming: `*.test.js` or `*.spec.js`.
- Use `describe`/`it` blocks with clear intent.
- Assert behavior, not existence — avoid `expect(x).toBeDefined()`.
- Mock external dependencies (APIs, databases, environment variables).
- Server tests use `// @vitest-environment node`.
- Component tests use the default `jsdom` environment.
