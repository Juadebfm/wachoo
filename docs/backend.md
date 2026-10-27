# Backend setup and data model

## Storage

- PostgreSQL, managed by Prisma, is the source of truth for categories, evidence, parent-category links, reports, and the single administrator account.
- Redis stores rolling seven-day popularity events, expiring admin sessions, and short-lived rate-limit counters. Local development uses the Redis service in Docker Compose; Vercel uses Upstash Redis.
- The local `.env` file is based on `apps/api/.env.example` and is ignored by Git. Never copy its local-only database password into a hosted environment.

## Local setup

From the repository root:

```sh
cp apps/api/.env.example apps/api/.env
npm run build --workspace=@wachoo/shared
npm run infra:up
npm run db:migrate:dev --workspace=@wachoo/api -- --name init
npm run db:seed --workspace=@wachoo/api
```

Run `npm run dev:api` and `npm run dev:web` in separate terminals. Stop local services with `npm run infra:down`; Docker volumes keep local database data between stops. To remove the local data as well, use `docker compose down --volumes` only when you intend to erase it.

## Catalogue data

`npm run db:seed --workspace=@wachoo/api` inserts or updates the reviewed records in `packages/shared/src/categories.seed.ts`.

For a reviewed catalogue file, use:

```sh
npm run db:import --workspace=@wachoo/api -- /path/to/categories.json
```

The file must be a JSON array using the fields in `categoryAdminInputSchema` (without an internal ID). Every row is validated and duplicate Netflix codes are rejected before writing. Rows with multiple source-listed parents must be represented once, with each parent in `parentCategories`. Imports are idempotent and written in batches of 100. The official-source batch is `apps/api/prisma/data/netflix-tudum-2025.json` (44 codes); the current merged import is `apps/api/prisma/data/netflix-catalogue-2026.json` (**1,870 unique codes**, imported locally on 2026-10-27). Netflix Tudum says Netflix's internal code list exceeded 36,000 in May 2025, but does not publish that complete list. What's on Netflix advertises over 2,200, while its current downloadable CSV contained 1,835 unique codes when checked. Netflix-Codes.com added 23 codes not already in the merged catalogue. See [the catalogue review](catalogue-review.md) and [the source policy](data-sources.md) for the count method and evidence limits.

## Administrator setup

Create or rotate the one administrator account against the selected database:

```sh
npm run admin:set-credentials --workspace=@wachoo/api
```

The password prompt is hidden. Passwords are hashed with Argon2id; there is no public registration or password-reset route. Re-running the command for the same email rotates the password and invalidates existing sessions.

## API outline

- `GET /api/v1/categories` — verified-first search with optional `q`, `mood`, `page`, and `pageSize` filters.
- `GET /api/v1/categories/suggestions?ids=<comma-separated category IDs>` — optional TMDB movie posters selected by broad genre match. At most 24 category IDs are accepted per request. The API token stays server-side; without it the response is `{ configured: false, data: ... }` and the interface uses a Wachoo placeholder. Suggestions are illustrative and do not claim that a title belongs to the exact Netflix category.
- `GET /api/v1/categories/:id` — category details.
- `POST /api/v1/reports` — anonymous report submission; no email field is accepted.
- `GET /api/v1/popular?metric=copies|opens` and `POST /api/v1/popularity-events` — rolling seven-day rankings and event capture.
- `/api/v1/admin/*` — password login, session status/logout, category management, soft-disable, and report review.
- `GET /health/live` — process liveness; `GET /health` — PostgreSQL and Redis readiness.

Admin writes require the configured `APP_ORIGIN` and a same-origin request. Session cookies are HTTP-only, SameSite Strict, Secure in production, and expire after 12 hours. Public report, event, and login requests have bounded payloads and short-lived rate limits. A rate-limit key contains an HMAC of the client address, expires, and is not attached to catalogue, report, or popularity records.

## Vercel environment

Set `DATABASE_URL` to the pooled PostgreSQL connection string and `DIRECT_URL` to the direct connection string used by Prisma migrations. Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `APP_ORIGIN`, and a random `RATE_LIMIT_HASH_KEY` in Vercel's environment settings. Do not paste values into source control or chat. Run `prisma migrate deploy` as a release step; do not run development migrations against production.

`TMDB_API_READ_ACCESS_TOKEN` is optional and belongs only in the API environment (or local `apps/api/.env`). Poster suggestions use TMDB Discover Movies, grouped by broad genre and cached in Redis for 12 hours. The footer includes TMDB's required non-endorsement wording and service link. Add TMDB's approved logo to the Credits area before production launch; no approved TMDB logo asset is currently present in this repository. This project is for personal non-commercial use; review current TMDB terms and licensing again before any commercial use.

No cloud database or Vercel project has been created or connected by this repository setup.
