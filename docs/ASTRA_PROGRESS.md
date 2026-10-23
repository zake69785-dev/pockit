# Astra development progress

## Current phase
Phases 0–6 implemented locally; Phase 8 navigation/mobile integration implemented. Phase 9 automated verification passed; physical-device acceptance remains pending. Phase 7 cloud sync and live FEU credential connection remain pending. Nothing pushed or deployed.

## Architecture and safety
- React / TypeScript / Vite / Dexie / Motion stack preserved; no dependencies added. Verified 17 installed skills; selectively used React, Playwright, Taste, Impeccable, mobile-native and animate.
- Database remains `pockit-v1`. IndexedDB schema 4; data/export version 3. Schema 3 adds account recovery (`before-v3`); schema 4 upgrades the intermediate development format and saves `before-v3-format`. Original v1 recovery remains `before-v2`.
- Pure v1/v2→v3 migration, transactional upgrades and restore. Historical IDs, amounts, dates, savings histories and preferences stay unchanged. Failed upgrades roll back. Old application versions reject v3 backups instead of silently ignoring new domains.
- Accounts track custody; goals protect portions of total assets. Missing historical payment accounts resolve to Legacy / unassigned. No invented payment source or opening balance. Transfers and balance corrections use separate journals, excluded from income/expense analytics. Corrections have explicit reasons and history.
- All writes validate inside the existing state transaction. Export includes academics and finance. Before release, export a real user backup; never reset IndexedDB. Only isolated synthetic test databases have been used here.
- Local dates default to Asia/Manila; assignment instants preserve UTC, all-day events retain date ownership. PWA prompted updates, offline caching and themes retained.

## Implemented
- Money: cash/GCash/Maya/bank/savings/custom accounts, transfers with stable submission IDs, balance reconciliation, history, scheduled-income account selection, Low Funds Mode, purchase-date scenarios, explicit purchase confirmation and savings-goal creation.
- Transportation: paying account selection, sorted route-fare comparison, prominent Home/Money action and direct undo restoring the reservation. Existing multi-leg planner preserved.
- School: manual courses and assignments, editable deadlines/submission states/grades, configurable weighted categories and targets, current grade excluding ungraded work, best/worst/required-score projections. Linked study tasks.
- Canvas: FEU read-only gateway adapter for courses, assignments/submission states, announcements and course events; pagination validation, deduplication, 401/403/429/offline/server failures, staged atomic cache update, last-sync display and course filtering. No token accepted/stored in the client. Protected backend is NOT deployed or implemented; no real credential connection.
- Calendar: combined academic, tasks, classes, exams, study, transportation, allowance, bills and savings events; month/week/day/agenda ranges and category filters; editable user events; original financial month/day/forecast views retained.
- Tasks: today/upcoming/overdue/completed/course views, priorities, notes, effort, recurrence and completion; timestamp-persisted focus/break timer and study history; deadline-first study suggestions avoid calendar conflicts and require explicit acceptance.
- Home: deterministic real-data briefing cached locally; classes, tasks, safe spending, commute, next allowance and warning links; dismissible in-app notification center. No background push claims.
- Navigation: Home / School / Money / Calendar / Tasks; legacy Plan / Goals / Activity / transportation reachable through Money; Settings retained. Existing route/sheet/button/savings motion and reduced-motion behavior reused.

## Tests and verification
- Baseline before edits: 42 unit tests, typecheck, lint, build and 12 Edge workflows passed.
- Integrated production build/typecheck, lint and all 69 unit tests pass. Coverage includes migrations/rollback, v3 academic restore, account reconciliation, Canvas pagination/errors/atomic cache/ownership/all-day dates, grade calculations, timer resume, recurrence, planning conflicts and briefing notifications.
- Edge: 15/16 workflows passed initially. Task completion test assumed the checkbox stayed in Today after completion; changed it to assert persistence in Completed. Both academic workflows and the added layout workflow then passed (all 17 distinct workflows verified).
- WebKit: all 17 browser workflows passed against the unchanged production build.
- Axe checks pass in both themes across all primary and legacy routes. Money checked at 390/768/1440px; School/Tasks/Calendar checked at 390/1440px in both themes with no horizontal overflow. Mobile School/Calendar and desktop dark Tasks screenshots reviewed. Impeccable detector reports no findings on new screens.
- Synthetic 1,000-record profile: Edge scroll frame median 6.9ms / p95 7.1ms; WebKit median 34ms / p95 80ms. WebKit on Windows is slower; these results do not establish physical iPhone performance or 60 FPS.
- Tests use isolated browser databases. No real user database reset. Local elevated runners were needed because Windows sandbox blocked esbuild configuration reads.

## Remaining work
1. Local automated verification complete; export a real backup before any release.
2. Live FEU authentication and protected backend remain unimplemented/unconnected; institutional authorization and explicit credential/infrastructure approval are required. Optional cloud sync remains research/design only. See INTEGRATION_PLAN.md.
3. Physical iPhone XS Max acceptance and WebKit performance investigation remain release gates. No push or deployment without explicit approval.

## Files
Existing finance/domain/database/components/pages/styles and tests updated. Added account/assistance/student/Canvas/calendar/briefing domains; Money/School/Tasks pages; account, receive-income, form, briefing and unified-calendar components; corresponding unit/browser tests. Package/PWA metadata now identify 3.0. Detailed file list: `git status --short`.
