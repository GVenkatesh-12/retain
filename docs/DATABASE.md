# Database Specification

## Principles

Keep the source of truth small. Topics contain only user-entered content and creation time. Revision instances and completion events are operational records, not duplicated topic metadata. Statistics are derived by SQL or domain calculations; no cached counters are required in v1.

## Tables

### `app_settings`

One row per installation/user.

| Column | Type | Rules |
|---|---|---|
| `user_id` | TEXT | primary key; v1 configured installation identity |
| `timezone` | TEXT | valid IANA zone; default `UTC` until configured |
| `daily_target` | INTEGER | 1–100, default 15 |
| `theme` | TEXT | `system`, `light`, or `dark` |
| `animations_enabled` | INTEGER | 0/1, default 1 |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

### `topics`

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT | primary key, UUID/ULID |
| `user_id` | TEXT | required, indexed |
| `subject` | TEXT | required, trimmed, 1–120 Unicode chars |
| `title` | TEXT | required, trimmed, 1–240 Unicode chars |
| `created_at` | TEXT | required UTC timestamp |
| `archived_at` | TEXT | nullable; reserved for future UI |

### `revisions`

One row for each generated mandatory revision.

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT | primary key |
| `topic_id` | TEXT | foreign key to topics, cascade delete |
| `user_id` | TEXT | denormalized for safe/indexed scoping |
| `sequence` | INTEGER | 1–6 |
| `offset_days` | INTEGER | one of 3, 5, 7, 12, 20, 30 |
| `due_at` | TEXT | UTC instant representing the due local date at generation time |
| `kind` | TEXT | `mandatory` or `bonus` |
| `bonus_batch_id` | TEXT | nullable; identifies the optional batch |
| `status` | TEXT | `pending` or `completed` |
| `completed_at` | TEXT | nullable UTC timestamp |
| `duration_seconds` | INTEGER | nullable; reserved for a future optional timer |
| `created_at` | TEXT | UTC timestamp |

Unique constraint: `(topic_id, sequence, kind, bonus_batch_id)`. Mandatory rows are generated once. Bonus rows are created only when selected; they reference the topic and a `bonus_batch_id`. A bonus row may be marked completed or abandoned when the user ends a batch; abandoned rows must not count as completed revisions.

### `completion_events`

Immutable audit/analytics record.

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT | primary key |
| `user_id` | TEXT | required |
| `revision_id` | TEXT | required |
| `topic_id` | TEXT | required |
| `kind` | TEXT | copied from revision at completion |
| `completed_at` | TEXT | UTC timestamp |
| `local_date` | TEXT | date in user's timezone at completion |
| `bonus_batch_id` | TEXT | nullable |

## Indexes

- `topics(user_id, created_at DESC)`
- `topics(user_id, subject COLLATE NOCASE)`
- `revisions(user_id, status, kind, due_at)`
- `revisions(topic_id, sequence)`
- `completion_events(user_id, local_date)`
- `completion_events(user_id, completed_at)`

## Transactions and deletion

Adding a topic inserts the topic and all six mandatory revisions in one transaction. Completing a revision checks it is pending, updates it, and inserts exactly one completion event in one transaction. A retry must return the already-completed result rather than double-counting. Reset requires an explicit confirmation phrase and deletes settings, topics, revisions, and events in a transaction; export must be offered first.

## Import/export format

Export JSON version `1` contains `schemaVersion`, `exportedAt`, `settings`, `topics`, `revisions`, and `completionEvents`. Import validates the whole document before writing. Default behavior is merge by IDs with conflict rejection; replacement is a separate, explicit destructive action.
