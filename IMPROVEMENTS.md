# Improvements and roadmap

Curated list of improvements for TinyEnginy. Each item has been reviewed by hand: either verified
in the code or kept as a deliberate proposal.

Status tags: **[verified]** confirmed in the code · **[proposal]** worth doing, not a defect ·
**[open]** open question to discuss as a team · **[discarded]** considered and not worth it
(with the reason).

## Backend

- **Atomic reads and writes**: wrap multi-row operations (bulk import, bulk updates, paginated
  reads) in transactions so a failure never leaves partial data or an inconsistent page.
- **Global error handling**: one error middleware and one error shape for every endpoint, so the
  frontend can always show a clear message.
- **[open] Backend architecture**: today all routes and logic live in one `index.ts`. Discuss
  moving to DDD with bounded contexts (leads, enrichment, messaging) and an event-driven flow;
  clear module boundaries also make AI-assisted changes safer.
- **[verified] Data cleanup for invalid values**: existing leads hold country codes that
  look valid but are not ISO 3166-1 (for example `UK` instead of `GB`, or `XXX` in the
  CSV samples). Validate on import, and run a cleanup job for existing rows.
  [open] One-off script, cron, or a Temporal Schedule?

## Frontend

- **[open] Frontend architecture**: today the code is grouped by type (`components/`, `api/`,
  `utils/`). Discuss Feature-Sliced Design: more files, but easier refactors per feature.

## Temporal / workflows

- **[open] Scheduled jobs**: decide where cron-like tasks live; Temporal Schedules may cover
  them without a separate cron service.

## Testing

- **[verified] Endpoints are not tested**: the only tests are two unit tests
  (`messageGenerator`, `csvParser`). Add API integration tests (for example supertest)
  against a test database.
- **[open] Testing strategy**: agree on the approach (TDD or not) and the test pyramid:
  which logic gets unit tests, which flows get integration tests, and what runs in CI.
- **Frontend end-to-end tests**: cover the main flows (import, verify, generate messages)
  with Playwright.

## DX / tooling

- **Docker and container images**: a Dockerfile per service (API, worker, frontend) and a
  Compose file to run the whole stack locally, Temporal included.

## Security

- **[verified] Authentication**: today there is none, so every endpoint is open. Pick a
  provider (OAuth/OIDC such as Google, or a managed service such as Auth0 or Clerk). The
  frontend sends the session cookie or bearer token on every request, and the backend
  rejects requests that lack it (401).
- **Public vs. protected routes**: split the routes explicitly. Only health checks and the
  login callback stay public; everything under `/leads` requires auth. One middleware
  enforces it.
- **Dependency and supply-chain checks**: run `pnpm audit` (or a scanner such as Snyk or
  Socket) in CI, block installs of freshly published versions (pnpm `minimumReleaseAge`),
  and review dependency PRs before merging. Dependabot is already on, but it only proposes
  bumps.

## Observability and analytics

- **Error tracking**: report frontend and backend errors to one tool (Sentry, New Relic or the
  team's choice), linked to the global error handling.
- **Product analytics**: track key user actions (import, verify, enrich, generate messages)
  with the tool the team picks.

## Performance

## Deployment

- **[open] Hosting and infrastructure as code**: decide where it runs (AWS or other) and manage
  it with Terraform; agree on the flavor (plain Terraform, OpenTofu, Terragrunt).
- **Split into logical services**: API, Temporal worker, frontend (static, behind a CDN),
  database and Temporal (self-hosted or Temporal Cloud), each deployed on its own.
- **[open] Managed database**: move from SQLite to a separate managed service (for example
  Postgres on AWS RDS), with migrations run on deploy and automated backups.

## Roadmap
