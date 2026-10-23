# Pockit push Worker

Deployed to Cloudflare Workers Free on 2026-10-23 at `https://pockit-push.sancheesekyle238.workers.dev` (version `2ea281e3-7afe-41bb-b294-1e668ec07746`). GitHub Pages continues to host Pockit; the website has not been deployed with the push frontend.

## What exists

- `worker.ts`: origin-restricted API, authenticated one-time pairing, device token hashing, encrypted subscription storage, schedule replacement, revocation, one-at-a-time Cron delivery, retry/backoff, expired subscription removal and retention cleanup.
- `schema.sql`: separate D1 tables. No finance database or IndexedDB schema is touched.
- `wrangler.jsonc`: Workers Free configuration with one UTC Cron trigger each minute and the owner's `pockit-push` D1 database ID.
- Local smoke tests cover API boundaries and Cron, mocked delivery tests cover success and retry, and `crypto-smoke.mjs` uses real VAPID signing and `aes128gcm` with synthetic browser keys.

The backend stores only category, route and timing for reminders. It discards client title/body and hashes reminder IDs. Browser subscription endpoint and keys are encrypted with AES-256-GCM before D1 storage. D1 still sees timing/category metadata. The Worker decrypts the subscription only for delivery. Do not log subscription data or the private key.

## Local checks

From the repository root, run `node cloudflare/generate-local-secrets.mjs` once. It writes ignored `cloudflare/.dev.vars`; it refuses to overwrite existing keys. This file is only for local development. The generator starts with a test `VAPID_SUBJECT`; the current ignored local file has the owner's chosen contact address. The public VAPID key printed by the script is not secret. Never paste `.dev.vars`, `DATA_KEY`, `ADMIN_TOKEN`, or `VAPID_PRIVATE_KEY` into chat, a Vite variable or Git.

Initialize only the local D1 emulator:

```powershell
$env:XDG_CONFIG_HOME = Join-Path (Get-Location) '.wrangler-config'
npx wrangler d1 execute pockit-push --local --config cloudflare/wrangler.jsonc --file cloudflare/schema.sql
npx wrangler dev --config cloudflare/wrangler.jsonc --local --port 8787
```

In another terminal: `npm run push:local-smoke`, `node cloudflare/crypto-smoke.mjs`, `npm run push:typecheck`, and `npm test`. These tests use fake subscriptions and do not contact Apple or store real data. The local smoke test invokes the emulator's scheduled handler with no due push endpoint.

## Production state and remaining gates

1. Confirm the account is Workers Free. Current published limits: 100,000 requests/day; 10 ms CPU per HTTP **and Cron** invocation; 50 subrequests/invocation; five Cron triggers/account. D1 Free: five million rows read/day, 100,000 written/day, up to ten databases, **500 MB per database** and 5 GB total storage. At limit, free operations fail rather than silently upgrading. Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
2. The real D1 database ID is in `wrangler.jsonc`. The owner approved `schema.sql`, and it was applied to the remote D1 database on 2026-10-23. A read-only `sqlite_master` check verified exactly the five intended application tables and one explicit index. Do not rerun the schema unless a later migration calls for it.
3. The approved deployment uploaded `ADMIN_TOKEN`, `DATA_KEY`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` as hidden Worker secrets from ignored `cloudflare/.dev.vars`. `VAPID_SUBJECT` uses the owner's `mailto:` contact. Retain `DATA_KEY` securely; losing it makes stored subscriptions unreadable. Never use public `vars` for secrets. [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
4. The deployed `/admin/code` endpoint requires `Authorization: Bearer <ADMIN_TOKEN>` and should only be called from a trusted terminal. The response contains a five-minute, one-use pairing code. Never place the admin token in the Pockit browser. Rate limits constrain code guesses. The device receives a separate random scoped token after pairing. A remote synthetic pairing and immediate revocation succeeded; no subscription was created.
5. Benchmark actual Worker CPU for API and scheduled delivery on Workers Free before real use. Local Node timing is only a preliminary signal. One reminder is sent per Cron run to bound work. If a real invocation consistently exceeds 10 ms, stop and redesign delivery on the free tier; do not upgrade billing.
6. The pending GitHub Pages build now gets only `VITE_PUSH_GATEWAY` and `VITE_PUSH_PUBLIC_KEY` from tracked `.env.production`. The former is the Worker HTTPS base URL; the latter is public. `npm run audit:site-build` checks the built assets, and the Pages workflow runs that audit before upload. Publishing the website still requires separate approval; hosting stays on GitHub Pages.
7. Pair and enable from the iPhone Home Screen PWA after separate website publication approval. Test a synthetic future reminder with the app closed, click handling, denial, offline sync and disabling. Do not claim physical iPhone delivery from automated WebKit tests.

The deployment output confirmed D1 binding `DB`, all five hidden secrets, the Worker URL, and the single `* * * * *` Cron schedule. A live API smoke test confirmed the Worker, origin restriction, D1-backed pairing and token revocation. A read-only remote D1 query confirmed zero devices and reminders. A scheduled Cron firing has not been observed yet; Cloudflare may take up to 15 minutes to propagate trigger changes. Do not claim live provider delivery or measured Cloudflare CPU until tested.

## Limits and known behavior

At most 40 reminders are accepted per sync to stay below Workers Free's 50-subrequest ceiling. The client currently shows the complete local count; if it exceeds 40, the server returns 400 and no schedule is replaced. Schedules refresh only when the user explicitly syncs. Device pairing lasts for the browser session. Cron delivery is at least once with duplicate suppression in both D1 and the service worker; network delivery cannot be guaranteed exactly once. Push provider responses 404/410 revoke subscriptions; 429/5xx use bounded retry. Live provider delivery and actual Worker CPU remain unverified.
