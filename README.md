# Pockit 2.0

A private, offline-first personal budgeting app. Built with React, TypeScript, Vite, Tailwind CSS, React Router, Lucide, Motion, Dexie/IndexedDB and date-fns. Optimized for the iPhone XS Max's 414 × 896 CSS-pixel viewport, with responsive desktop layouts and light/dark themes.

## Run on Windows

Install Node.js 24 LTS, then open PowerShell:

```powershell
cd C:\path\to\pockit
npm.cmd ci
npm.cmd run dev
```

Open the localhost URL printed by Vite. To test the production PWA:

```powershell
npm.cmd run build
npm.cmd run preview
```

Open `http://localhost:4173`. Service workers work on localhost; a phone visiting a PC's plain HTTP LAN address cannot install a fully working offline PWA. Use the HTTPS deployment below for your iPhone. Development mode intentionally does not register a service worker.

## First use and the 2.0 upgrade

New users get a nine-step setup: current cash, wallet money, separately saved money, allowance rhythm, school attendance, multi-leg journeys, essentials, a goal, preferences and a review. Progress saves on this device between steps. Cash and wallet fields **exclude** money entered as separately saved. Existing goal savings come from that separate amount; they are never added twice. Suggested transfers are optional and must fit after commitments.

Existing 1.0 users skip setup. The database keeps its original name and saves a recovery copy before a transactional migration. Original entry IDs, dates, amounts, order and savings balances stay intact. Export a backup before upgrading. No personal browser data is used by tests.

- **Home:** daily spending guide, protected allocations, quick entry and upcoming events.
- **Plan:** next allowance, normal amount/frequency, cycle start, preferences, leisure and recurring essentials. Expected money becomes cash only when you tap Receive. Receiving a recurring allowance advances the cycle; irregular reminders do not automatically choose your next date.
- **Plan → Open transportation planner:** name routes, add/reorder/remove legs, set fares, favorite alternatives and choose each direction. Weekly campus days reserve travel; online/off days do not. Date overrides cover holidays, cancelled trips and extra visits. Record each direction only after travelling; edit or delete it in Activity.
- **Calendar:** select a date for income, bills, school routes, planned contributions and recorded transactions. Outlined dates mark cycle boundaries. The forecast uses current cash only; it does not assume expected money will arrive.
- **Goals:** create/edit targets, icons and priorities. Move money saves or withdraws without creating an expense. Plan contribution reserves money and waits for your explicit confirmation. History, milestones, monthly guidance and progress projections carry across months.
- **Activity:** month/day browsing, category analytics, search, filters, transaction editing and deletion. Editing an opening entry updates your setup balance without adding it again.
- **Settings** (header gear): Light, Dark or Match device; backup, restore, recovery copies, storage protection and installation instructions.

To change a recurring essential price, stop its future repetitions and add a replacement. Earlier payments and outstanding amounts remain. Each payment links to a particular occurrence. To end an expected-income schedule, remove its reminder; received transactions stay in Activity.

## Budgeting rules

All monetary values are integer centavos. Decimal input is parsed from text rather than multiplied as a floating-point amount.

`cash = received income − actual expenses`

`flexible = cash − saved pockets − unpaid essentials − remaining transport − remaining leisure − planned savings`

`daily safe limit = floor(max(0, flexible) / remaining calendar days)`

The horizon runs from today through the day before the next allowance. If overdue, a one-day horizon and warning replace it. Expected income is never spendable. Unpaid overdue essentials remain reserved. Essentials and planned savings due on or after the next allowance are shown but not yet reserved. Monthly recurrences retain their original day, clamping at month end without drifting after February.

Transport adds every leg of both directions on remaining campus days. Date exceptions override the weekly schedule. A completed direction removes that whole direction's estimate and deducts its actual expense, releasing any cheaper-fare difference. Cancelling a day releases unused reservations while retaining actual expenses. Old unlinked Transport expenses offset that day's remaining travel estimate. Do not enter the same fare both as an ordinary expense and as a completed journey. Walking can be recorded at zero. No sample fares ship as personal data.

Savings are protected portions of cash, not additional bank accounts. Save/withdraw entries change the allocation without changing cash or spending analytics. Goals do not reset each month. A deficit is shown honestly; real expenses may exceed the plan, but the daily safe amount never goes negative. The monthly goal suggestion divides the remaining target across the inclusive remaining calendar months; it is guidance, not an automatic transfer.

## Deploy to free GitHub Pages

No paid API, Apple account, Mac, or subscription is required. Use a **public** GitHub repository for the free Pages path. Publishing the app does not publish browser financial data.

1. Create a public repository (for example `pockit`) in your GitHub account.
2. Upload/commit this project's application files, `package.json`, `package-lock.json`, `public`, `src`, `tests`, `scripts`, configuration files and `.github/workflows/deploy.yml`. Do not upload exported financial backups. The existing skills and preparation files are not needed by the deployed app and can remain local. The deployment target is `zake69785-dev/pockit`; use the checks below before publishing updates.
3. If using Git on Windows:

   ```powershell
   git init
   git branch -M main
   git add src public tests scripts .github package.json package-lock.json index.html vite.config.ts tsconfig.json playwright.config.ts eslint.config.js .gitignore README.md PRODUCT.md DESIGN.md DEVELOPMENT.md UPGRADE-2.md
   git commit -m "Build Pockit 2 budgeting PWA"
   git remote add origin https://github.com/zake69785-dev/pockit.git
   git push -u origin main
   ```

4. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → Verify and deploy Pockit → Run workflow**, or push to `main`. The workflow checks types, lint, unit and browser tests, builds with the correct repository base path, and deploys only `dist`.
6. Open the deployment URL shown by the workflow, typically `https://zake69785-dev.github.io/pockit/`. Enable Enforce HTTPS in Pages settings if available.

The workflow uses Pages' reported base path rather than assuming the repository name. Hash routing keeps every screen reloadable without a server rewrite. For a manual repository-path build:

```powershell
$env:BASE_PATH='/pockit/'
npm.cmd run build
Remove-Item Env:BASE_PATH
```

See the [official Vite Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages) for GitHub's deployment setup.

## Install on iPhone and use offline

1. Open the HTTPS URL in **Safari**, not an in-app social browser.
2. Tap **Share → Add to Home Screen → Add** (enable “Open as Web App” if offered).
3. Launch Pockit from its Home Screen icon while online. Wait for **Ready offline**.
4. Turn on Airplane Mode, reopen Pockit, and record a small transaction to verify your device. All data entry and reports work offline.
5. When a newer version is available, finish any open form, then tap **Update Pockit**. Stored data survives app updates.

Safari, installed web apps, different domains, and different browsers can have separate storage. Export from the old context and restore in the intended one. The app requests no notification, location, camera, or bank permissions.

## Backups and recovery

**Settings → Export financial backup** saves a versioned JSON file. Keep a copy in Files/iCloud Drive or another trusted location. Backups are readable, unencrypted financial data, so share them carefully.

To restore, choose the JSON file in **Settings → Choose backup to restore**. Pockit validates its version, dates, integer amounts, identifiers, references and savings balances before showing a preview. Export the current data first, then choose **Replace data with backup**. Restore replaces the whole dataset atomically; it does not merge. Both 1.0 and 2.0 financial backups are accepted. Invalid backups leave current data untouched.

**Recovery copies** in Settings lets you download the original pre-upgrade snapshot and the most recent pre-restore snapshot. Download the desired copy, choose it as a backup, review, then restore. Keep an external copy before restoring again: the pre-restore slot holds only the most recent replacement. Recovery copies share the same browser storage and cannot survive clearing that storage. Unconfirmed setup drafts save locally but are not part of financial JSON exports.

IndexedDB is durable local storage but not a backup. Clearing site data, uninstalling the app, private browsing, or browser storage eviction may remove records. Settings offers a browser-managed storage protection request; denial does not affect app use. There is no cloud sync or account recovery.

## Verify

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
node scripts/check-pages.mjs

# Safari-engine simulation on Windows (one-time browser installation):
npx.cmd playwright install webkit
$env:POCKIT_BROWSER='webkit'
npm.cmd run test:e2e -- --output=test-results-webkit
Remove-Item Env:POCKIT_BROWSER
```

Windows browser tests use installed Microsoft Edge. Linux/macOS use Chromium: run `npx playwright install chromium` once. Tests use a clean isolated browser context; no personal data is touched. Playwright verifies workflows, backups, mobile widths, dark mode, reduced motion, and service-worker offline reloads. Browser automation on Windows is not physical iPhone Safari verification.

The accessibility suite scans all routes and the entry sheet in both themes with axe. The Pages check creates a separate `dist-pages` build and verifies repository-path routing and offline behavior; it does not deploy. Review `DEVELOPMENT.md` for verification notes and the few environment-specific testing choices.

## Project map

- `src/domain`: pure centavo budgeting and validation rules, with unit tests.
- `src/data`: atomic Dexie persistence and recovery tests.
- `src/components`: accessible form and bottom-sheet primitives.
- `src/pages`: Home (Today), Plan, Calendar, Goals (Pockets), Transportation, Onboarding, Activity and Settings.
- `tests`: production-browser workflow tests.
- `public/icons`: offline PWA and Apple touch icons.
- `DEVELOPMENT.md`: assumptions, checklist and verification record.
- `.agents/skills` and `skill-preparation`: preserved third-party skills and preparation material.

## iPhone compatibility and practical limits

The requested target is **iPhone XS Max on iOS 18.7.10**. The app uses IndexedDB, service workers, native dialogs, safe-area insets, dynamic viewport units and locally bundled fonts. Its Tailwind 4 CSS baseline is Safari 16.4+, below this target ([Tailwind compatibility](https://tailwindcss.com/docs/compatibility), [Safari 18 features](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/), [Apple iOS 18 releases](https://support.apple.com/en-us/121161)). Large input text avoids automatic focus zoom; sheets scroll within the viewport, support keyboard dismissal and protect unsaved edits.

Automated checks use Windows Edge and Playwright WebKit 27.2, **not the exact Safari 18.7.10 binary or physical iPhone hardware**. After HTTPS deployment, verify Home Screen launch, notch/home-indicator spacing, the software keyboard, sheet gestures, offline reopening, backup download into Files and restore from Files on your phone. Physical iPhone installation and device frame rate require checks on the actual phone.

This is a PWA, with no bank connection, background income posting or cloud sync. It protects portions of a single cash ledger; cash and wallet opening entries are sources, not ongoing per-account balances. Forecasts exclude unplanned future purchases and future income; they cover at most two years. Goal estimates use observed net contributions from the last 90 days, with at least a 30-day denominator, and are guidance rather than promises. A one-time opening savings deposit can influence early estimates. Allowances with changing amounts should be edited for future dates or entered as separate reminders. Holidays are entered manually. Keep regular exported backups; local storage is not guaranteed against browser eviction ([Dexie Safari notes](https://dexie.org/docs/IndexedDB-on-Safari)).

## Publish future updates

The production repository is [zake69785-dev/pockit](https://github.com/zake69785-dev/pockit) and the site is [Pockit](https://zake69785-dev.github.io/pockit/). GitHub Actions publishes the `main` branch after checks pass. See [DEPLOYMENT.md](DEPLOYMENT.md) for the deployment checklist, iPhone installation and migration from a local preview.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
node scripts/check-pages.mjs
git status
git add src public scripts tests .github package.json package-lock.json index.html vite.config.ts tsconfig.json playwright.config.ts eslint.config.js README.md DEPLOYMENT.md .gitignore
git diff --cached --stat
git commit -m "Describe the update"
git push origin main
```

Check [Actions](https://github.com/zake69785-dev/pockit/actions) for the green deployment before testing the live site. Review staged files; never add exported financial backups, credentials or `.env` files. Users finish open forms and tap **Update Pockit** when offered. Financial records stay in their browser across application updates.
