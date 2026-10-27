# Wachoo

Wachoo is an entertainment discovery companion. It helps people find streaming categories by name, code, or mood and open them in the provider's browser experience. Wachoo does not host or stream titles.

## Workspace layout

- `apps/web` - responsive React web application.
- `apps/api` - Express API that serves the reviewed category seed data.
- `packages/shared` - shared category schema, types, and seed records.
- `apps/web/src/assets` - the logo asset used by the web app. Source brand exports remain local in the ignored `brand-identity` folder.
- `docs` - product and data-source notes.

## Local setup

Use Node.js 22.18 or newer and npm. Install workspace dependencies with `npm install`, then prepare the local PostgreSQL and Redis services:

```sh
cp apps/api/.env.example apps/api/.env
npm run infra:up
npm run db:migrate:dev --workspace=@wachoo/api -- --name init
npm run db:seed --workspace=@wachoo/api
```

Start the API and web app in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

The web app proxies `/api` requests to the API on port 3001. The database starts with a small reviewed seed, not a complete Netflix directory. A validated bulk import command is available for a reviewed JSON catalogue; no scraper or automatic verifier is included.

The backend stores categories, source evidence, reports, and admin credentials in PostgreSQL. Weekly copy/open events and expiring admin sessions use Redis. Local development uses Docker Compose; the Vercel deployment uses Prisma Postgres and Upstash Redis environment variables. See [backend setup](docs/backend.md) and [weekly popularity notes](docs/popularity.md).

## Data trust

Every category keeps its provider code, source evidence, verification status, and last direct-check date. A live check is limited to the page and browsing region observed on that date; it does not promise availability in Nigeria or elsewhere. Wachoo mood labels are editorial metadata, not Netflix claims.

Read [the category source notes](docs/data-sources.md) before expanding or refreshing the seed.
