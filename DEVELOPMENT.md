# Pockit 2.0 development and verification

## Architecture and data safety

React 19, TypeScript, Vite, Tailwind 4, HashRouter, Lucide, Motion, Dexie and date-fns remain in place. `src/domain` owns centavo calculations, transport, recurring occurrences, forecasts, onboarding construction, migrations and validation. `src/data` serializes every mutation in an IndexedDB transaction. Page components receive snapshots and call domain actions; future expected money never increases available cash.

The original `pockit-v1` database name is retained. Schema version 2 adds `drafts` and `recovery`; its transaction saves the original snapshot before upgrading. Transactions retain IDs, amounts, dates and order. Existing users bypass setup. Version 1 backups migrate before validation; restoring stores the current snapshot in the most recent pre-restore slot. Tests create separate databases/browser contexts and never reset the user's database. Skills and preparation files are unchanged.

Opening cash, wallet and separate savings are additive sources entered once. Existing goal savings split the separate-savings earmark, not the actual cash total. Setup confirmation is atomic and idempotent. Ordinary savings transfers retain the original ledger behavior; planned contributions additionally guard essential/travel reservations. Real expenses may exceed the plan and create a visible shortfall.

## Design and interaction decisions

`DESIGN.md` records the cream/blue/yellow/mint identity and navy dark theme. Pockit's original geometric pocket/coin mark supplies personality without copying the café reference. Mobile navigation has five labeled sections and safe-area spacing; Settings lives in the header. Simple forms use a native dialog with spring entrance, keyboard dismissal, focus containment and a draggable handle. Long configurations use full pages. Reduced motion disables travel and progress animation. Financial digits remain stationary and exact.

The seven prepared design, animation, React, accessibility and Playwright skills informed implementation. The explicit user brief overrides generic skill preferences against financial hero cards, rounded controls and tinted icons. No concept approval round was needed under the user's autonomous execution instruction.

## Verification

The original 24 financial/persistence tests and six workflow regressions remain. Added coverage includes real Dexie version upgrades, recovery snapshots, repeated setup confirmation, separately saved money, multi-leg/different-direction routes, online/cancelled/extra days, cheaper actual fares, occurrence-linked bills, end-of-month recurrence, stopped recurrences, expected-income receipt, contribution reservations and conservative forecasts.

The browser suite has 12 scenarios: six original workflows, four upgrade workflows, an accessibility sweep and a populated-ledger performance profile. It exercises the complete nine-step setup with reload/back navigation, routes and leg ordering, different return routes, favorites, actual travel, cancellation, recurring allowance receipt, planned savings, old backups, offline lazy routes, persisted expenses, themes, editing/deleting entries, small screens, reduced motion and keyboard cancellation. axe scans six routes plus the transaction sheet in both themes; onboarding and populated transportation have additional scans. Same-page axe mode avoids the installed Edge aggregator issue; there are no frames omitted.

Playwright uses isolated Windows Edge and WebKit 27.2 contexts at 414 × 896, with 375px checks and a 1440px desktop capture. WebKit is simulation, not physical iPhone Safari 18.7.10. The production Pages smoke test builds `/POCKIT/` separately and verifies assets, standalone manifest, service-worker scope, hash-route reload and offline lazy-route navigation. No deployment occurs in that script; scripts/verify-live.mjs separately verifies the published HTTPS site.

Impeccable's source detector reports no findings. Taste's app-source lint reports zero failures and five shadow warnings: real toast/dialog/navigation overlays and the today marker. A broad scan initially included test reports and bundled third-party skill sources; the reported source result is scoped to `src`. The prepared Taste CDP inspector is unavailable; Playwright captures and manual rendered review provide visual evidence. Reviewed Home at mobile/desktop, Welcome, route collection, Calendar, Goals and dark Settings. Accessibility findings in secondary blue-card text and hover opacity were corrected. A final WebKit route-cancellation scan also exposed fading on the Back to Plan link; the inherited global hover opacity was removed, and the affected route and theme scans were rerun in both engines.

## Performance evidence and limits

Production screens are split into lazy chunks; locally bundled fonts and service-worker precaching keep operation network-independent. The largest JavaScript chunk is approximately 222 KB before gzip; the complete offline precache is approximately 722 KiB. Motion is used for focused interactions, charts use SVG/native progress, and history is paginated in batches of 30.

The profile fixture has 1,000 ledger entries, 20 two-leg routes and 12 recurring bills, with motion enabled. An initial Edge run measured navigation/paint completion at 157–305 ms and a scroll-frame median/p95 of approximately 6.9/7.2 ms on this Windows machine. WebKit on the same Windows setup measured 771–1,183 ms and approximately 82/180 ms. These are wall-clock automation measurements with a 3× device scale and include browser rendering, not isolated React execution time. The WebKit measurements do **not** establish a 60 FPS result. Performance JSON is attached to the Playwright report; machine load changes results. Only a physical-device profile can establish iPhone frame pacing, keyboard behavior and battery impact.

## Deployment and device boundary

The user confirmed iOS 18.7.10. Dependencies' CSS baseline and Safari 18 platform features were checked against official documentation linked in README. Manifest/icons, viewport-fit, dynamic viewport heights, 16px input text, safe areas, offline caching, prepaint theme selection and deferred service-worker updates are implemented. A first upgrade can only learn an old preference after opening IndexedDB; subsequent startup uses its local theme cache.

No paid services, native iOS wrapper, API key, Mac or Apple Developer account is needed. The application is now published at https://zake69785-dev.github.io/pockit/ from https://github.com/zake69785-dev/pockit. The remaining device acceptance checks are explicitly in README: real Safari install, Home Screen launch, software keyboard, notch/home-indicator spacing, gestures, offline relaunch and Files backup/restore. Local storage and recovery slots are not external backups.

See `UPGRADE-2.md` for the delivery checklist and `README.md` for running, free GitHub Pages deployment and recovery steps.

## Delivery checks — October 23, 2026

Type checking, ESLint and production build pass. Vitest: **42 passed**. Browser coverage: **12 scenarios verified in Edge and 12 in simulated WebKit**, including accessibility and profiling. The final hover correction is covered by focused route-cancellation and light/dark accessibility reruns in both engines. GitHub Pages subpath/offline smoke test passes. GitHub Pages publication and live Edge/WebKit verification succeeded on October 23, 2026; see DEPLOYMENT.md for the release record. Physical iPhone installation and hardware checks remain owner/device actions.
