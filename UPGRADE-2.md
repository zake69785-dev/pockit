# Pockit 2.0 upgrade

- [x] Audit 1.0 source, domain rules, snapshot database, tests, skills and visual reference.
- [x] Introduce versioned, lossless migration and recovery snapshot; test v1 restore.
- [x] Establish cream/blue/yellow/mint design tokens and independently designed navy theme.
- [x] Build resumable nine-step onboarding with exact opening balance accounting.
- [x] Build route profiles, ordered legs, weekly attendance and date exceptions.
- [x] Integrate actual trips, reservations, recurrence and conservative projections.
- [x] Redesign Home, Plan, Calendar, Goals, Activity and Settings.
- [x] Add accessible motion, goal history, priorities and affordability guidance.
- [x] Check iOS 18.7.10 platform requirements, PWA configuration, offline operation and update safeguards; distinguish simulation from physical testing.
- [x] Pass financial/migration tests, lint, typecheck, Edge/WebKit workflows, accessibility and build.

## Data contract

The existing database name `pockit-v1` stays unchanged. IndexedDB schema v2 adds draft and recovery stores. Migration copies the complete original v1 snapshot to recovery before upgrading the main snapshot. Original transaction IDs, amounts, dates and order remain unchanged. Existing users skip first-launch setup. Old backup files remain importable. Restore snapshots current data before replacing it. No production database reset is used for development.

Opening balances: cash and digital wallet fields exclude money entered as separately saved. Separately saved money is added once as received opening money and simultaneously earmarked once; assigning part of it to a named goal only reallocates that opening earmark. No allowance forecast increases actual cash.

Transport: recurring attendance plus a dated override determine each day's routes. A recorded completed direction releases its entire estimate even when the actual fare is lower. Unlinked legacy Transport expenses continue offsetting that day's remaining estimate. A planned route never creates a transaction. Direction/date keys prevent duplicate trip recording.

Forecasts show current actual cash less future unpaid commitments, travel, and planned contributions; future income is shown separately and excluded. Recurring dates are anchored to the original day, including monthly end-of-month clamping. Recommendations never auto-transfer money.

## Visual contract

The reference contributes energetic blue, warm paper, friendly lettering and strong mobile hierarchy, not its café branding or mascot. Pockit's own signature is a rounded pocket mark with a yellow coin and a compact “money with a job” allocation ribbon. Financial amounts remain legible and stationary. No decorative mascot is necessary for the financial screens.

## Device target

User confirmed iPhone XS Max, iOS **18.7.10**. Windows Edge and simulated Playwright WebKit checks are distinct from physical iPhone tests. No real-device test or live deployment is claimed.

## Acceptance evidence

October 23, 2026: type checking, ESLint, production build and 42 unit/persistence tests pass. All 12 browser scenarios have passing results in Edge and simulated WebKit; final focused reruns cover the hover-contrast correction and route-edit cancellation. Accessibility scans report no WCAG A/AA violations in their tested views. The separate GitHub Pages path build passes asset, manifest, service-worker scope, deep-link and offline checks. Performance measurements and their limits are recorded in DEVELOPMENT.md.

## Device and hosting handoff

- [ ] Deploy to the owner's GitHub Pages repository and verify the live HTTPS URL. The workflow and instructions are prepared; no repository or deployment was created here.
- [ ] On the physical iPhone XS Max / iOS 18.7.10, verify Safari installation, safe areas, software keyboard, gestures, offline launch and Files backup/restore. Windows WebKit simulation is not this device test.
