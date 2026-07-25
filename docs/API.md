# API Specification

All endpoints are same-origin JSON under `/api`. Responses use `{ data }` for success and `{ error: { code, message, requestId, fields? } }` for failure. Validate with a schema library at the boundary. Never return secrets or raw SQL errors.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | deployment/database health; no user data |
| GET | `/api/settings` | read settings |
| PATCH | `/api/settings` | update theme, target, animation, timezone |
| GET | `/api/dashboard?date=YYYY-MM-DD` | daily queue, counts, bonus availability |
| POST | `/api/topics` | create topic and six revisions |
| GET | `/api/topics?q=` | fuzzy-search topics |
| GET | `/api/topics/:id` | topic and revision history |
| POST | `/api/revisions/:id/complete` | complete pending revision idempotently |
| POST | `/api/bonus-batches` | select optional maintenance revisions |
| POST | `/api/bonus-batches/:id/complete` | complete selected bonus item |
| GET | `/api/statistics?from=&to=` | aggregates and chart series |
| GET | `/api/export` | versioned JSON export |
| POST | `/api/import/validate` | validate and preview import |
| POST | `/api/import` | commit validated import |
| POST | `/api/reset` | explicit destructive reset |

## Validation

Trim strings, reject control characters, reject empty/oversized input, and normalize subject only for comparison—not for display. Dates must be ISO calendar dates. Target is integer 1–100. Time budget is one of 0, 10, 20, 30, 60.

## Status codes

`200` read/update, `201` creation, `400` malformed input, `401/403` when auth/installation protection is added, `404` unknown resource, `409` duplicate/conflict/idempotency conflict, `422` valid shape but invalid domain value, `429` rate limit, `500` unexpected server error.

## Idempotency

Topic creation accepts an optional `Idempotency-Key`; server stores or safely detects duplicate requests. Completion is naturally idempotent by checking status and returning the existing completion result. Import uses a request ID and transaction.

