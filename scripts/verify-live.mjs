import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

const url = new URL(
  process.env.POCKIT_LIVE_URL || "https://zake69785-dev.github.io/pockit/",
);
assert.equal(url.protocol, "https:");
assert(url.pathname.endsWith("/"), "Production URL must end with a slash.");
const response = await fetch(url);
assert.equal(response.status, 200, `Site returned HTTP ${response.status}`);
assert.equal(new URL(response.url).protocol, "https:");
const manifestResponse = await fetch(new URL("manifest.webmanifest", url));
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.display, "standalone");
assert.equal(new URL(manifest.scope, url).href, url.href);
assert.equal(new URL(manifest.start_url, url).href, url.href);

const browser =
  process.env.POCKIT_BROWSER === "webkit"
    ? await webkit.launch()
    : await chromium.launch(
        process.platform === "win32" ? { channel: "msedge" } : {},
      );
try {
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url.href, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "A happier home for your money." })
    .waitFor();
  assert(await page.evaluate(() => window.isSecureContext));
  const apple = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  const icons = [
    ...manifest.icons.map((i) => ({
      src: i.src,
      size: Number(i.sizes.split("x")[0]),
    })),
    { src: apple, size: 180 },
  ];
  for (const icon of icons) {
    const asset = new URL(icon.src, url);
    assert(
      asset.pathname.startsWith(url.pathname),
      `Icon outside app path: ${asset.pathname}`,
    );
    assert.equal((await fetch(asset)).status, 200);
    const dimensions = await page.evaluate(
      (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
          img.onerror = () => reject(new Error("Icon could not load"));
          img.src = src;
        }),
      asset.href,
    );
    assert.deepEqual(dimensions, [icon.size, icon.size]);
  }
  await page.getByRole("button", { name: "Let’s make a little plan" }).click();
  for (let step = 1; step < 8; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Start using Pockit" }).click();
  await page.getByTestId("total-cash").waitFor();
  const registration = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return { scope: r.scope, script: r.active?.scriptURL };
  });
  assert.equal(registration.scope, url.href);
  assert.equal(registration.script, new URL("sw.js", url).href);
  for (const route of [
    "Plan",
    "Calendar",
    "Goals",
    "Activity",
    "Settings",
    "Home",
  ]) {
    await page.getByRole("link", { name: route, exact: true }).click();
    await page.locator("main h1").waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow on ${route}`,
    );
  }
  await page.goto(new URL("#/calendar", url).href);
  await page.reload();
  await page
    .getByRole("heading", { name: "Good things on the horizon." })
    .waitFor();
  assert(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  );
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("heading", { name: "Good things on the horizon." })
    .waitFor();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("link", { name: "Open transportation planner" }).click();
  await page
    .getByRole("heading", { name: /Little journeys\.\s*All planned out\./ })
    .waitFor();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  assert.equal(await page.getByTestId("total-cash").textContent(), "₱0.00");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        url: url.href,
        browser:
          process.env.POCKIT_BROWSER === "webkit"
            ? "WebKit simulation"
            : "Chromium/Edge",
        https: true,
        manifest: true,
        icons: icons.length,
        scope: registration.scope,
        routes: true,
        directReload: true,
        offlineReload: true,
        offlineTransport: true,
        consoleErrors: errors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
