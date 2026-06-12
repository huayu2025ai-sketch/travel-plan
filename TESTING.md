# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

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
| Integration | API route handlers, service boundaries | `tests/server/**/*.test.js` | When touching server code |
| Smoke | App starts and renders without crashing | `tests/smoke/*.test.js` | Before deploys |
| E2E | (not set up yet) Full user flows | `e2e/` | Add when user flows stabilize |

## Conventions

- Test files live next to the code they test or under `tests/`.
- File naming: `*.test.js` or `*.spec.js`.
- Use `describe`/`it` blocks with clear intent.
- Assert behavior, not existence — avoid `expect(x).toBeDefined()`.
- Mock external dependencies (APIs, databases, environment variables).
- Server tests use `// @vitest-environment node`.
- Component tests use the default `jsdom` environment.
