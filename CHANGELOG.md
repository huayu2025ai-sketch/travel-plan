# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Added optional QWeather geocoding and forecast integration for domestic travel planning.
- Added automatic fallback to Open-Meteo when QWeather is not configured or unavailable.
- Added regression tests for weather branches, API route behavior, request guards, and key frontend interactions.

### Changed
- Fixed seven-day weather date mapping by matching forecast records to calendar dates and falling back when QWeather cannot cover the complete itinerary.
- Split the frontend entry point into `App.jsx`, reusable components, hooks, date/plan/storage/export utilities, and a minimal `main.jsx` mount module.
- Updated project documentation to reflect the current weather-provider fallback chain, deployment variables, and test coverage.
- Added open-access API protection with process-local rate limiting, request-size validation, input limits, and consolidated public errors.
- Added Docker Compose deployment for a static Nginx frontend, Node API container, and shared external `npm-network`.

## [0.1.1.0] - 2026-06-13

### Added
- Packing list summary card is now clickable and scrolls smoothly to the packing list section.
- Contextual trip refinement: follow-up messages now reshape the existing plan instead of starting over.
- Test framework bootstrapped with Vitest for server and component tests.
- Added tests covering `generateTravelPlan` context injection, retry logic, and error paths.
- GitHub Actions workflow to run tests on push and pull requests.
- gstack skill routing rules in `CLAUDE.md`.

### Changed
- Packing list card now shows a "查看清单" (view list) hint and hover states.
- README expanded with project structure, environment variables, and deployment notes.

## [0.1.0.0] - 2026-06-13

### Added
- Initial release of the travel planning application.
