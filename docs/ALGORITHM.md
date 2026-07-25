# Scheduling and Metrics Algorithm

## Mandatory schedule

For a topic created on local calendar date `C`, create six mandatory revision rows with due dates `C + [3, 5, 7, 12, 20, 30]` days. “Day 3” therefore means three calendar days after creation, not 72 elapsed hours. Due status is `pending AND due_local_date <= today_local_date`. A late task remains due; it is never silently skipped or rescheduled.

If a user creates a topic after midnight in their configured timezone, the creation date is that local date. If timezone changes later, historical due dates remain instants calculated at creation; dashboard comparisons use the new timezone, and the settings UI explains this edge case.

## Completion

The user may complete any due mandatory revision. The UI normally presents due work ordered by due date, then topic creation date, then title. Completing early is disabled in v1 to preserve the simple promise and avoid schedule ambiguity. A completion mutation is idempotent.

## Maintenance transition

When the day-30 revision is completed, the topic is eligible for the maintenance pool. Eligibility is derived: all six mandatory rows completed. No recurring maintenance rows are generated. The topic's most recent completion is its last-revised date.

## Daily summary

1. Resolve today in the user's timezone.
2. Select all pending mandatory revisions with due local date on or before today.
3. Count completed mandatory and completed bonus events for today.
4. `completed_due_count` is the number of mandatory revisions whose due local date is on or before today and which are completed.
5. `remaining = mandatory_due_count - completed_due_count`; overdue pending items remain in the queue until complete.
6. `progress = completed_due_count / max(mandatory_due_count, 1)`, capped at 1 for the mandatory ring. A separate “completed today” count is shown for daily activity.
7. `bonus_capacity = max(daily_target - mandatory_due_count, 0)`.

The target is a comfort signal, not a hard cap. If mandatory work exceeds target, show the overload plainly and offer no bonus by default.

## Bonus recommendations

Bonus selection happens only after mandatory revisions are complete or the user explicitly opens the bonus prompt. It selects maintenance topics, never pending mandatory topics.

Candidate filters:

- topic has completed all mandatory revisions;
- topic is not completed as bonus yesterday;
- topic is not already selected in the current batch;
- topic is not archived.

For each candidate, compute normalized score components:

```text
recency = min(days_since_last_revision / 30, 1)
subject_balance = 1 - (subject_bonus_count_today / max(selected_count_today, 1))
yesterday_penalty = 0 if not yesterday else 1
novelty = deterministicRandom(topic_id, local_date) in [0, 1)
score = 0.50*recency + 0.25*subject_balance + 0.15*(1-yesterday_penalty) + 0.10*novelty
```

Use stable, seeded randomness so refreshing the prompt does not reshuffle the same day unexpectedly. Sort by score descending, then seeded value, then oldest last revision. Apply a per-subject soft cap: no subject may exceed `ceil(requested_count / 3)` selections while another subject remains eligible. If a single subject is all that exists, the cap is relaxed. The algorithm returns at most the number suggested by the selected time budget and the number of candidates.

## Time estimate

Initial average topic time is 2 minutes. In v1, retain this baseline because there is no mandatory timer and therefore no reliable duration data. If an optional timer is introduced later, use the median of the user's last 30 timed completed revisions after at least 10 samples; otherwise retain 2 minutes. Time choices map to counts using floor(minutes / average_minutes), with a minimum of 1 for any non-zero choice and a maximum of 20 per batch. The UI labels this as an estimate, not a promise.

## Streaks

- Current streak: consecutive local dates ending today or yesterday with at least one completed revision. A day with no due work still counts as a rest day only for perfect-week calculations, not current streak.
- Longest streak: maximum consecutive run of dates with at least one completion.
- Perfect week: a Monday–Sunday week where every day with mandatory due work has all due mandatory revisions completed, and at least one revision was completed during the week. Current partial weeks are not awarded.
- Perfect month: same rule across the calendar month.
- Recovery streak: consecutive dates after a missed completion date where the user completes at least one revision; it resets when another date is missed.

All streaks use completion events and the configured timezone. They are descriptive, not punitive; no streak-loss modal should interrupt study.
