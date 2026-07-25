# Architecture

## Overview

Use a small full-stack TypeScript application deployed to Vercel. The browser renders React views and calls same-origin server endpoints. Server handlers validate input, execute parameterized SQL against Turso/libSQL, and return JSON. Scheduling is a pure domain module shared by API tests and server handlers; it does not depend on React or the database.

```text
Browser
  ├─ React routes and UI state
  ├─ API client
  └─ local display preferences
        │ HTTPS / same origin
Vercel server functions
  ├─ request validation and single-user guard
  ├─ topic/revision/settings/statistics services
  ├─ pure scheduler and metrics modules
  └─ Turso/libSQL client
        │ parameterized SQL
Turso SQLite
```

## Boundaries

- `ui`: presentation, interaction, accessibility, optimistic state only where safe.
- `api`: HTTP parsing, status codes, serialization, request IDs.
- `domain`: schedule dates, queue selection, bonus ranking, streak calculations.
- `data`: SQL statements, migrations, row mapping, transaction helpers.
- `shared`: schemas, enums, date and formatting utilities.

Do not add a generic repository framework, event bus, global state library, or microservices. A service function per use case is sufficient.

## Runtime behavior

The dashboard requests today's summary. The server derives due mandatory revisions from stored revision rows and the user's timezone. Completing a revision is a transaction that updates one revision, records a completion event, and returns the updated summary. The client refetches after mutations; this keeps derived counts authoritative.

## Date and time

Store instants as UTC ISO strings or integer epoch milliseconds. Store the user's IANA timezone in settings. Convert `created_at` and `completed_at` to local calendar dates only inside domain queries/calculations. Never use server timezone or browser locale as the source of truth.

## Single-user assumption

OpenAuth provides the email/password identity boundary. The API verifies the bearer token and scopes every data query to the stable subject `user_id`. The configured installation-user fallback is retained only for unauthenticated local smoke tests and must not be enabled in production.
