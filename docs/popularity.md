# Weekly category popularity

Wachoo records two actions: a code copy after the browser clipboard succeeds, and a click on an Open Netflix link. Popularity event members contain only a category ID, action type, and event time; they do not include an account, cookie, or device identifier. The API uses an HMAC of the request IP as a short-lived rate-limit key in Redis; it is not written into event or report records. An outbound link click records an attempted open, not confirmation that Netflix loaded or that someone watched a title.

The two rankings use a rolling seven-day window and are separate. Counts are user-triggered signals, not verified unique people, and can be manipulated by automated requests. Do not describe them as unique-user or viewing statistics.

## Storage

- Local development uses the Redis service in `docker-compose.yml`.
- A Vercel deployment requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the Vercel project environment. Connect an Upstash Redis database through the Vercel integration and redeploy after adding its environment variables.
- If production storage is missing, the API returns an unavailable response rather than inventing or showing sample rankings.

The current Vercel free Hobby plan is limited to personal, non-commercial use. Confirm the project's intended use and current provider terms before deploying.
