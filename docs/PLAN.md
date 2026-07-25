# Project Plan

## Delivery strategy

Build in vertical slices so every phase leaves a usable product. Avoid implementing statistics, theming, or bonus sophistication before the core revision loop is reliable.

### Phase 0 — Foundation

- Initialize Vite + React + TypeScript.
- Install `@astryxdesign/core`, `@astryxdesign/theme-neutral`, and `@astryxdesign/cli`; run `npx @astryxdesign/cli init` and commit the generated agent documentation.
- Establish formatting, linting, type checking, unit tests, and environment validation.
- Create the server boundary and Turso connection using server-only environment variables.
- Add the first migration and a health endpoint.

Exit gate: a deployed empty shell can connect to Turso without exposing credentials.

### Phase 1 — Core study loop

- Add topic dialog with subject autocomplete and title validation.
- Generate six deterministic revision instances.
- Build dashboard, revision queue, complete action, and empty/loading/error states.
- Add keyboard navigation and mobile layout.

Exit gate: a user can add a topic, see its day-3 task, complete it, refresh, and retain the result.

### Phase 2 — Maintenance and daily experience

- Implement day-30 transition.
- Add target setting and bonus time choices.
- Implement deterministic bonus candidate ranking with seeded tie-breaking.
- Add celebration, opt-out, and bonus completion tracking.

Exit gate: mandatory work never depends on bonus work and bonus work is always optional.

### Phase 3 — Statistics and settings

- Add aggregate queries and statistics page.
- Add theme, animation, target, shortcuts, export, import, and reset flows.
- Add data validation and import preview.

Exit gate: all visible metrics reconcile with revision records and a complete export can recreate user data.

### Phase 4 — Hardening

- Accessibility audit, responsive QA, browser tests, load tests, migration rehearsal, and Vercel preview checks.
- Add observability and operational runbook.

## Non-goals for v1

Authentication, multi-user accounts, AI generation, flashcards, OCR, PDF import, voice, calendar integration, offline sync, notifications, and PWA packaging are deferred. The v1 deployment is a private single-user application; if the app becomes multi-user, authentication and tenant isolation must be designed before adding accounts.

