# Contributing

## Working principles

Favor the smallest change that preserves the product contract. Keep domain rules pure and documented. Do not add a dependency for functionality already available in the platform or Astryx. Do not mix schema changes, broad refactors, and UI changes in one pull request unless the vertical slice requires it.

## Code conventions

- TypeScript strict mode.
- Named exports for domain and service functions.
- Explicit DTOs at API boundaries; never leak database row shapes to UI.
- Validate at boundaries and trust only validated domain inputs.
- Use semantic HTML and accessible names.
- Keep SQL close to the data module and parameterized.
- Add tests for every new scheduling or metric rule.
- Use the generated Astryx agent documentation as the source for component conventions.

## Pull requests

Describe user-visible behavior, data changes, tests run, accessibility impact, and rollback considerations. Include screenshots for UI changes and sample migration output for schema changes. A reviewer must be able to verify that mandatory and bonus behavior remain separate.

## Commit guidance

Use concise imperative commits, for example `Add day-30 maintenance eligibility` or `Document import conflict policy`. Never commit `.env` files, database tokens, exports containing real study data, or generated build output.

