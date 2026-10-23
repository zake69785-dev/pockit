# External integrations — pending, not deployed

Reviewed 2026-10-23. User supplied institution URL: https://feu.instructure.com/.

## FEU Canvas

The public [FEU Canvas login](https://feu.instructure.com/) redirects to Microsoft sign-in via SAML. This establishes the interactive sign-in provider, not permission for third-party API access. FEU's developer-key policy, personal-token availability and CORS policy remain unverified without institutional confirmation. Do not ask for a password or paste a token into chat.

[Canvas OAuth documentation](https://sso.canvaslms.com/doc/api/file.oauth.html) describes institution-scoped developer keys. Preferred design: FEU-approved read-only OAuth scopes, state validation, exact callback allowlist and a protected backend keeping client secrets and refresh tokens off the public PWA. Never automate Microsoft login or forward its session cookies. Personal tokens are a fallback only if FEU permits them and the user explicitly approves a secure credential connection; no public proxy and no token in URLs, exports, IndexedDB or service-worker caches.

The local gateway adapter now implements the client-side read/cache contract below, with mocked tests. The authenticated backend and real connection remain pending:
- Backend authorizes the user on every request, pins the upstream to FEU, allows only read endpoints and rejects redirects or pagination URLs to other origins.
- Read courses, assignments/submission states, announcements, events and available grades. Stable namespaced IDs include institution, resource type and Canvas ID. Imported items remain read-only.
- Follow opaque [Canvas pagination links](https://developerdocs.instructure.com/services/canvas/basics/file.pagination) subject to origin/path validation, a visited-URL set and page limits. Do not assume the first page is complete.
- Manual sync uses one in-flight operation, stages all pages, validates the payload, and atomically merges cache on success. A failed/partial fetch must not erase cache or advance last-success time. Course filtering is local until a complete scoped refresh succeeds.
- Distinguish 401/expired credentials, 403/permission failure, 429/throttling, network/offline and server errors. Honor Retry-After and stop bounded retries. Avoid logging upstream bodies or credentials.
- Persist UTC due timestamps and render them in Asia/Manila; null due dates stay undated. Keep all-day date strings separate from instants. Missing grades stay ungraded.
- Incremental updates only on endpoints with documented support; otherwise fetch pages and upsert by stable ID. Never infer deletion from an incomplete filtered result.
- Manual academic entry must remain available offline regardless of Canvas status.

## Optional cloud sync comparison

Public limits verified from official sources; limits can change before deployment.

| Option | Free allowance | Security / maintenance assessment |
|---|---|---|
| [Supabase Free](https://supabase.com/pricing) | 500 MB database, 50,000 monthly active users, 5 GB egress; projects may pause after a week inactive | Candidate for PostgreSQL transactions and auth. Requires tested per-user RLS on every exposed table and storage object. No service-role key in the browser. Pausing requires robust local operation. |
| [Firebase / Firestore](https://firebase.google.com/docs/firestore/quotas) | 1 GiB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 10 GiB outbound/month | Candidate with authentication and security rules. Explicit revision conflicts still required; document synchronization alone does not protect financial invariants. Stay on Spark; do not enable billing-dependent backup/PITR features. |
| [Cloudflare D1](https://developers.cloudflare.com/d1/platform/pricing/) + [Workers Free](https://developers.cloudflare.com/workers/platform/limits/) | D1: 5 million rows read/day, 100,000 written/day, 5 GB total storage. Workers: 100,000 requests/day, 10 ms CPU/request | More custom work: authentication, authorization, sessions, rate limits, ownership queries and recovery are application responsibilities. No database binding or privileged token shipped to the PWA. |

No provider selected and no resources created. Supabase is the initial evaluation candidate, not a completed integration or guarantee of perpetual free service.

Required before enabling sync: authenticated user ownership enforced server-side; HTTPS; transactional local outbox with operation IDs; incremental revision cursor; idempotent replay; atomic multi-record transfers; explicit conflicts on concurrent financial edits; tombstones for deletions; retry/reconnect tests; export and deletion flow; authorization tests with two isolated users. The existing single-document state must not be synchronized using blind last-write-wins. Prefer immutable financial events plus compensating corrections; existing mutable history requires a migration design before remote writes. Evaluate client encryption together with key recovery, never silently lose data if a key is lost.

Deployment and real credential connection require explicit user approval after implementation and review. Local-only operation remains the default. Background push remains a separate, unimplemented infrastructure feature.
