# iPhone push: deployed backend and unpublished frontend

Status: frontend and service-worker handlers implemented locally; the Cloudflare Worker is deployed to Workers Free at `https://pockit-push.sancheesekyle238.workers.dev`. The user-approved `schema.sql` is applied to the separate remote `pockit-push` D1 database; its five tables and one index were verified. A live authenticated pairing/revocation check passed; D1 has zero devices and reminders. The pending website build now contains the public Worker URL and public VAPID key, and its asset audit passes. **No real subscription or reminder has been uploaded. GitHub Pages has not been redeployed.** Worker instructions: [`cloudflare/README.md`](../cloudflare/README.md).

## Proposed service

One Cloudflare Worker, one D1 database, one minute-based Cron Trigger, and server-only VAPID secrets. The Worker sends encrypted standards-based Web Push to the browser subscription endpoint. D1 is essential: a Worker alone cannot persist subscriptions, schedules or delivery receipts. The cron is explicitly configured after approval; execution and delivery are not guaranteed to occur at an exact second.

Free plan facts checked 2026-10-23:

- Workers: 100,000 requests/day, 10ms CPU/request **and 10ms CPU/cron invocation**, 50 subrequests/request, five Cron Triggers/account. Network waits do not consume CPU. Crypto and payload processing must be benchmarked against this very small CPU budget before selecting this service for production. Use bounded batches; do not silently move to a paid plan. [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/)
- D1 Free: five million rows read/day, 100,000 rows written/day, five GB total storage. Index due-time queries to avoid table scans. Free-limit exhaustion causes failures; there is no permission to upgrade billing. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- Expected personal use is far below request/storage allowances, but CPU feasibility remains unverified. No required paid subscription is introduced. Provider limits may change.

## API contract for the implemented frontend

`VITE_PUSH_GATEWAY` is the deployed Worker HTTPS base URL; `VITE_PUSH_PUBLIC_KEY` is the public VAPID key. Both are in `.env.production`, which Vite uses for the pending GitHub Pages build. Never add a private VAPID key, Canvas token, signing secret or privileged API token to any Vite variable.

- `POST /pair {code}`: redeem a high-entropy, single-use, short-lived device pairing code created through an authenticated administrative channel. Rate limit attempts. Return a random scoped device bearer token; store only its hash server-side. The frontend keeps it in memory for this session.
- `POST /subscription {subscription, reminders}` with bearer authorization: validate endpoint and encryption keys, then atomically replace this device's pending schedule. A device may only manage its own subscription. Enforce body size, reminder count, title lengths, seven-day horizon and route/category allowlists. Never use arbitrary user URLs as network destinations: allow known push providers, reject private addresses, credentials, redirects and non-HTTPS endpoints to prevent SSRF.
- `POST /unsubscribe {}` with bearer authorization: delete device subscription, pending reminders and delivery metadata. Client also calls browser unsubscribe. If unreachable, local unsubscribe stops device delivery; remote cleanup waits for reconnect or provider expiry.
- Return 401 for expired authorization, 410 for expired subscription, 429 with Retry-After for throttling, and generic errors without personal data. CORS permits only the exact approved Pages origin. CORS is not authentication.

## Persistence and delivery design

Separate D1 tables for devices (hashed token, encrypted subscription, updated timestamp), reminders (device, deterministic ID, category, payload, UTC send/expiry, revision), and deliveries (unique device/reminder key, status, attempt count, next attempt, lease). This is unrelated to Pockit's existing IndexedDB schema.

Use a transactional claim/lease before sending; concurrent cron runs must not send the same item. Replacing a schedule cancels pending obsolete items. Preserve delivered IDs for at least the scheduling horizon; retries must not resurrect them. Recheck expiry and active subscription immediately before delivery. Retry transient 429/5xx with bounded exponential backoff and jitter, honoring Retry-After; remove subscriptions on 404/410. Never retry past expiry. Redact notification bodies, credentials, endpoints and subscription keys from logs. Store only status codes and opaque IDs. Define retention and authenticated revocation before launch.

Network send and database commit cannot be one transaction. Exactly-once delivery cannot be promised. The client worker additionally deduplicates the last 256 delivered IDs in a dedicated Cache Storage cache; it does not open or modify the financial database.

## What is implemented locally

Six independent categories, per-category timing, searchable multiselect, local preference persistence, user-tap permission flow, VAPID public-key validation, subscription creation/reuse, session pairing client, explicit schedule sync, unsubscribe, timeout/error feedback, push display, bounded duplicate suppression and safe notification-click routing under the Pages base path. Existing Workbox precaching and prompted updates are retained.

Scheduling is a pure read-only projection of saved data. Completed/submitted items and past reminder times are excluded. Canvas items require a successful stored sync; selected-course filtering is retained. Date-only items use 09:00 Manila; saved timed events use their real time. Allowance text says expected, never received. Financial alerts use the existing budget engine, contain no balance amounts and expire today. Daily briefings are generic reminders to open Pockit at 09:00 Manila, adjusted by the selected lead time, for the next seven calendar days. They do not invent future financial details. Low-funds alerts cover today only and are timed after explicit sync. Refresh the schedule within seven days to continue delivery.

Current limitations: schedules update only when explicitly synced from Settings; offline edits cannot cancel a remote reminder until synchronization. Pairing must be repeated each session. A local cache cannot see new Canvas changes while the app is closed. The backend must not imply it knows newer financial or academic state. Local API, Cron invocation, encryption and mocked retry/delivery are tested. Remote D1-backed pairing/revocation is verified. The single minute Cron trigger is configured, but a scheduled firing has not been observed. Actual provider delivery, Cloudflare CPU usage and physical iPhone behavior remain unverified.

## iPhone acceptance after approval and deployment

Open HTTPS Pockit in Safari → Share → Add to Home Screen → launch its icon → pair → tap Enable notifications → grant permission. iOS Home Screen web apps support Web Push; ordinary browser-tab contexts must not be presented as equivalent. [WebKit requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

Test a real future reminder with the app closed, a notification click, Focus/permission denial, offline edits, disabling, expired subscription and service failure. Use a synthetic reminder; never create financial entries to test delivery. WebKit automation does not verify an actual iPhone, its keyboard, safe-area behavior, suspension, push delivery or 60 FPS.

## Approval boundary

The user approved and completed Worker deployment, the remote D1 schema and five hidden Worker secrets. The local Pages build passed typecheck, lint, 87 unit tests, the notification Settings test in Edge and WebKit, and an asset audit against the actual local Worker secrets. Website publication still needs separate explicit authorization. Actual Cloudflare Free CPU usage and live delivery require verification on the iPhone. Do not enable paid services. No personal title, financial amount or Canvas credential is stored in D1.
