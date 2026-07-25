# Performance Strategy

## Budgets

- Initial route JavaScript: target under 180 KB compressed.
- Dashboard API p95: under 300ms for personal-scale data.
- First meaningful dashboard render on mid-range mobile: under 2s on a warm deployment.
- Completion interaction feedback: under 100ms visual response; authoritative result under 500ms p95.

## Practices

- Keep dashboard query set small and aggregate in SQL where practical.
- Fetch statistics only on the statistics route.
- Lazy-load charting code.
- Debounce search and cap results.
- Use skeletons instead of blocking spinners.
- Avoid polling; refetch after mutation and on explicit visibility return.
- Index due-queue and completion-date queries.
- Keep animations transform/opacity-based and honor reduced motion.

## Scale boundary

The design is comfortable for one user and tens of thousands of topics/revisions. If data grows substantially, add pre-aggregated daily metrics, pagination, background statistics, and query plans before adding complexity to the core scheduling path.

