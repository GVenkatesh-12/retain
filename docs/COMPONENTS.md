# Component Specification

## Foundations

Use Astryx components and neutral theme tokens as the base. Define Retain tokens only for semantic roles: background, surface, text, muted text, border, accent, success, warning, and danger. Do not hardcode repeated color or spacing values.

## Layout components

- `AppShell`: navigation, responsive container, skip link, global toast region.
- `PageHeader`: title, context, optional action.
- `Stack`, `Inline`, `Card`, `Divider`: small layout primitives only when Astryx does not provide equivalents.
- `ResponsiveChartFrame`: chart viewport plus accessible summary.

## Domain components

- `ProgressRing`: accepts completed, total, label; renders SVG plus text fallback.
- `RevisionRow`: topic metadata, day label, status, action, keyboard behavior.
- `RevisionList`: loading/empty/error/normal states and roving focus.
- `AddStudyDialog`: controlled form, subject suggestions, validation, submit state.
- `BonusPrompt`: time choices, estimate, optional copy.
- `TopicSearch`: debounced query and result list.
- `Heatmap`, `TrendChart`, `SubjectDistribution`: presentational components fed by typed statistics DTOs.
- `MetricCard`, `InsightCard`, `StreakCard`.

## State rules

Server state is fetched by route-level hooks. Keep form state local. Do not duplicate the entire dashboard in a global store. Mutations invalidate the affected query. Optimistic completion is allowed only if rollback is implemented; default implementation should use a pending button state and authoritative refetch.

## Component contract

Every interactive component documents keyboard behavior, loading behavior, error behavior, and accessible name. Every chart exposes a data table or textual summary. Components must not perform SQL, date scheduling, or navigation policy.

