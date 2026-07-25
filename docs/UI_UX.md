# UI/UX Specification

## Product tone

Calm, precise, and personal. Use neutral surfaces, one restrained accent, clear typography, generous whitespace, and short transitions. Avoid badges, points, leaderboards, guilt language, and noisy gradients. Motion is 150–220ms, ease-out, and disabled when the user disables animation or requests reduced motion.

## Navigation

Desktop: compact top bar with Retain wordmark, Dashboard, Statistics, Search, and Settings. Mobile: top bar with wordmark and menu button; navigation becomes a sheet. The primary Add Study action is visible on Dashboard and available with `N`.

## Dashboard

Order: local date, greeting, progress ring, mandatory queue, optional bonus area, recent completion context. Greeting is time-neutral (“Good to see you”) and may include the user's first name only if later added.

The ring shows mandatory completed / mandatory due. Below it show completed count and remaining count as text for screen readers. Each revision row shows subject, title, “Day N”, due state, and Complete. The row is keyboard reachable; completing advances focus to the next row.

States: first-use empty state with Add Study CTA; all-done celebration with “Great job. All mandatory revisions are complete.” and bonus prompt; loading skeleton; recoverable error with Retry; overloaded day with reassurance and no forced bonus.

## Add Study dialog

Fields are Subject and Title only. Subject is a combobox with previously used subjects, type-ahead, and free entry. Title is a text input. Save is disabled until both are valid. On success close the dialog, show a concise confirmation, and focus the dashboard queue or empty-state message. Escape closes without saving; unsaved changes are not lost silently if the user typed content.

## Bonus prompt

Show only after mandatory completion. Choices: No thanks, 10 minutes, 20 minutes, 30 minutes, 1 hour. Explain “about N topics based on your recent pace.” Never display bonus as overdue. A selected batch has a clear “Optional” label and can be ended without penalty.

## Statistics

Use cards with a title, one-line explanation, visualization, and accessible text summary. Include contribution heatmap, daily completions, daily topics added, weekly/monthly trend, completion rate, streaks, total topics, total revisions, mandatory/bonus split, subject distribution, most studied subject, most revised topic, average revisions/day, and consistency. Every chart has an empty state and a table/list equivalent.

## Settings

Sections: Appearance (theme and animation), Study (daily target and timezone display), Accessibility/shortcuts, Data (export/import), Danger zone (reset). Reset is visually separated and requires typing `RESET RETAIN`.

## Search

Global shortcut `/` focuses search. Search subject and title with case-insensitive fuzzy matching; return subject, title, created date, and maintenance/mandatory status. Debounce typing by 100ms. Empty query returns recent topics; no results explain the matching fields.

## Accessibility and responsive rules

- WCAG 2.2 AA contrast and visible focus indicators.
- Semantic headings, landmarks, labels, live region for save/completion feedback.
- Dialog focus trap, Escape close, and focus restoration.
- Do not encode meaning by color alone; chart patterns have labels.
- Touch targets at least 44px.
- At widths below 720px, use one column, sticky bottom Add Study action only when it does not cover content, and horizontally scrollable chart containers with summaries above them.
- Support keyboard shortcuts but never intercept typing inside inputs.

