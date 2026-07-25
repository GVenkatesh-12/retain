# Retain Documentation

Retain is a personal spaced-repetition study assistant. The product turns a minimal study entry—subject and title—into a manageable revision plan. It is intentionally simpler than Anki: users do not tune cards, intervals, or algorithms. Retain quietly schedules the work, makes mandatory work visible, and offers optional maintenance only when the daily load is comfortable.

## Documentation map

| Document | Purpose |
|---|---|
| [PLAN.md](PLAN.md) | Phased delivery roadmap and acceptance gates |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System boundaries, runtime architecture, and data flow |
| [DATABASE.md](DATABASE.md) | SQLite schema, indexes, migrations, and derived data |
| [ALGORITHM.md](ALGORITHM.md) | Mandatory schedule, bonus ranking, and streak rules |
| [UI_UX.md](UI_UX.md) | Screen-by-screen product and interaction specification |
| [COMPONENTS.md](COMPONENTS.md) | Reusable component and frontend module contract |
| [API.md](API.md) | HTTP API, validation, errors, and idempotency |
| [TASKS.md](TASKS.md) | Build checklist for an implementation agent |
| [DECISIONS.md](DECISIONS.md) | Architectural decisions and trade-offs |
| [TESTING.md](TESTING.md) | Test pyramid, fixtures, and acceptance scenarios |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local, Turso, and Vercel deployment instructions |
| [SECURITY.md](SECURITY.md) | Threat model and security requirements |
| [AUTH.md](AUTH.md) | Email/password authentication and OpenAuth setup |
| [PERFORMANCE.md](PERFORMANCE.md) | Performance budgets and optimization strategy |
| [FUTURE.md](FUTURE.md) | Explicitly deferred features |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Engineering conventions and contribution workflow |

## Product contract

- A topic consists of a subject, a title, and a creation timestamp.
- A new topic creates mandatory revisions on day 3, 5, 7, 12, 20, and 30 after creation.
- Completing the day-30 revision moves the topic to maintenance; no automatic daily maintenance task is created.
- A revision is complete only after the user explicitly marks it complete.
- The calendar day is evaluated in the user's configured IANA timezone.
- The daily target controls comfort and bonus capacity; it never delays mandatory revisions.
- Bonus revisions are opt-in, are recorded separately, and never change the mandatory schedule.

## Source references

The implementation should verify current vendor instructions before setup. Turso's current quickstart documents the CLI shell and SQL workflow: <https://docs.turso.tech/tursodb/quickstart>. Astryx setup follows the project brief's referenced guide: <https://astryx.atmeta.com/docs/getting-started>.
