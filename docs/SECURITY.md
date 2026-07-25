# Security Requirements

## Threat model

Protect study content, database credentials, and destructive operations. Threats include accidental secret commit, unauthorized access to an unprotected private deployment, SQL injection, forged import files, CSRF on mutation endpoints, and denial of service from oversized searches/imports.

## Requirements

- Keep Turso credentials server-side and rotate exposed credentials immediately.
- Use parameterized SQL exclusively.
- Validate and bound all input, including import size and topic lengths.
- Use same-origin checks and CSRF protection when cookies/auth are introduced; prefer non-cookie installation protection for v1.
- Add rate limits to mutations and import/reset endpoints.
- Return generic errors to clients and log request ID plus safe context only.
- Escape rendered text; never render topic content as HTML.
- Require explicit confirmation for reset and replacement import.
- Restrict CORS to the app origin or disable it.
- Require OpenAuth email/password bearer-token verification on API routes in authenticated deployments.
- Configure a real transactional email provider for OpenAuth verification and password-reset codes; development console logging is not production-safe.
- Do not log titles/subjects by default.
- Back up/export before destructive migrations.

## Privacy

Study content is personal data. Explain storage and retention in deployment documentation. Exports contain all user content and must be treated as sensitive. A future hosted multi-user version requires authentication, authorization, tenant filters, account deletion, and audit review before launch.
