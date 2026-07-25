# Architecture Decision Records

## ADR-001: Fixed schedule before adaptive scheduling

Use day 3/5/7/12/20/30 exactly. It is understandable, testable, and consistent with the product's calm philosophy. Adaptive algorithms can be evaluated later without corrupting historical data.

## ADR-002: Store revision instances

Store six rows per topic rather than calculating all tasks at read time. This gives a clear completion target, supports idempotent mutations, enables analytics, and makes export understandable. The schedule definition remains centralized so future versions can be migrated deliberately.

## ADR-003: No recurring maintenance rows

Maintenance is a candidate pool derived from completed topics. This prevents workload inflation and makes bonus work genuinely optional.

## ADR-004: Same-origin server API

Keeping the browser away from Turso credentials is more secure and allows validation, transactions, and future authentication in one boundary. It adds a small server layer but avoids exposing database access.

## ADR-005: Derived statistics

Compute metrics from completion events and topics. Cached aggregates would improve scale but introduce reconciliation problems for a personal application.

## ADR-006: Single-user v1 with user scope columns

Authentication is outside the first release, but every user-owned row includes `user_id`. This preserves a straightforward migration path while keeping the first product simple.

