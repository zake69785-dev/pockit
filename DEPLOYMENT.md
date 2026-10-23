# Pockit GitHub Pages deployment

- Repository: https://github.com/zake69785-dev/pockit
- Live production URL: https://zake69785-dev.github.io/pockit/
- Publication: GitHub Actions, from `main`, with the Pages source set to Actions.
- Status: published and verified on October 23, 2026. HTTPS is enforced.

The workflow obtains the Pages base path from GitHub and passes it to Vite as `BASE_PATH`. HashRouter keeps screen reloads inside `/pockit/`. Manifest start/scope and icon paths are relative; the generated service worker registers under this same path. The local subpath check uses the exact lowercase `/pockit/` directory.

Only application source, tests, assets, configuration and documentation are committed. Local skills/preparation, dependencies, build output, browser reports, financial backups, private database files and secrets are excluded. Browser financial records live in IndexedDB, outside the repository. Publishing source code does not copy those records.

## iPhone XS Max installation

1. In Safari on iOS 18.7.10, open https://zake69785-dev.github.io/pockit/ while online.
2. Tap Share → Add to Home Screen → Add. Enable Open as Web App if offered.
3. Open Pockit from the new icon and wait for Ready offline. Complete setup or restore your financial backup.
4. Turn on Airplane Mode, reopen the installed app and check that pages load. Turn connectivity back on afterward.
5. In Settings, export financial backups to Files regularly. To restore, choose the JSON file, review it, then confirm replacement.

If moving from the local preview or another browser, export from the old app first. GitHub Pages has separate browser storage; your previous records are not uploaded or transferred automatically. Restore into the installed app you intend to keep using. A restore replaces the destination dataset, so export anything already there first.

This is a PWA. Automated Edge/WebKit testing does not replace physical iPhone checks of installation, software keyboard, safe areas, gestures and Files integration.

## Future updates

Run type checking, lint, unit tests, production build and `node scripts/check-pages.mjs`. Review `git status` and the staged diff, commit only intended application changes, then `git push origin main`. The Verify and deploy Pockit workflow checks the app and publishes `dist`. Monitor https://github.com/zake69785-dev/pockit/actions until the deployment is green, then verify the live HTTPS URL.

To rerun deployment without changing files, open Actions → Verify and deploy Pockit → Run workflow on `main`. Never force-push. Do not clear browser data to update the app; finish open forms and use Update Pockit when offered.

## Live verification

`node scripts/verify-live.mjs` opens a new isolated browser context and verifies HTTPS, the `/pockit/` scope, manifest, icon dimensions, app routes, direct route reloads and offline reload/navigation. Its zero-balance setup is local to that temporary context. It never reads or changes a user's browser profile or financial records.

## Verified release — October 23, 2026

The [successful workflow](https://github.com/zake69785-dev/pockit/actions/runs/39877230803) built and deployed commit `30e9dfe20bd4dcac0534ad1791026c2591337979`. Type checking, lint, 42 unit/persistence tests, and both 12-scenario Chromium/WebKit browser suites passed the deployment gate.

Live verification passed in isolated Windows Edge and simulated WebKit contexts: HTTPS, standalone manifest, all three PNG icons (192, 512 and Apple 180 pixels), `/pockit/` service-worker scope, all navigation routes, a direct Calendar reload, offline reload and first-time offline Transportation navigation. Both browsers reported zero application console errors. Physical iPhone installation remains a device check.

Deployment changes were limited to Git exclusions, repository/Pages configuration, deployment documentation, verification scripts and CI synchronization/infrastructure. Application screens, the financial engine and user financial records were not modified. The CI harness waits for saved-state transitions, allows one CI retry, retains failure diagnostics, uses Ubuntu's primary HTTPS package mirror and bounds setup/job durations.
