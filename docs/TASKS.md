# Development Checklist

## Setup

- [x] Initialize Vite React TypeScript project.
- [ ] Install Astryx packages and run CLI init.
- [ ] Read and commit generated agent docs.
- [ ] Add lint, format, typecheck, unit, and browser-test commands.
- [x] Add `.env.example`; keep secrets out of Git.

## Backend and data

- [x] Add migration runner and schema.
- [x] Add Turso/libSQL client and health check.
- [x] Implement typed row mappers and parameterized queries.
- [x] Implement topic creation transaction.
- [x] Implement completion transaction and idempotency.
- [x] Implement settings and timezone validation.

## Domain

- [x] Implement date-safe mandatory schedule.
- [x] Implement dashboard summary.
- [x] Implement maintenance eligibility.
- [x] Implement seeded bonus ranking and time estimates.
- [x] Implement streak and statistics queries/calculations.

## Frontend

- [x] Build shell and routes.
- [x] Build dashboard states and revision flow.
- [x] Build add dialog and saved-subject dropdown.
- [x] Build bonus prompt.
- [x] Build statistics charts with text summaries.
- [x] Build settings, search, import/export UI.
- [x] Add keyboard and reduced-motion support.

## Quality and release

- [ ] Unit tests for all pure domain rules.
- [ ] API contract tests and migration test.
- [ ] Browser tests for first study, completion, bonus, import/export, reset.
- [ ] Mobile and keyboard QA.
- [ ] Verify preview and production environment separation.
- [x] Remove exposed credential material from local environment examples; rotate any real credential at the provider.
