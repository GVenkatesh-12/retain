# Testing Strategy

## Unit tests

Test pure functions with fixed timezone and dates: schedule offsets, due calculations, late tasks, maintenance eligibility, bonus ranking, seeded tie behavior, subject caps, time estimates, streak boundaries, perfect weeks/months, and import validation.

## Database tests

Run migrations against a disposable SQLite/libSQL database. Verify constraints, indexes, transaction rollback, cascade behavior, duplicate completion protection, and export/import round trips.

## API tests

Test schema validation, status codes, error shape, idempotency, timezone conversion, scoped queries, and that raw database errors are not exposed.

## Browser tests

Critical journeys:

1. First visit → add topic → see future schedule.
2. Due day → complete each task → completion celebration.
3. Day 30 completion → select 10-minute bonus → complete one → no mandatory mutation.
4. Search subject/title with keyboard.
5. Change theme/target and reload.
6. Export → reset → import preview → restore.
7. Mobile viewport and keyboard-only navigation.

## Property and edge tests

Use generated dates around month/year boundaries, DST changes, leap days, long overdue periods, empty maintenance pool, one-subject pool, duplicate titles, Unicode, and a target below mandatory workload. Test the same seed twice and require identical bonus ordering.

## Acceptance gates

No release is acceptable with failing typecheck, migration tests, keyboard access on the main loop, or a mismatch between dashboard counts and completion events.

