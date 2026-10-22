import { spawn, spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const vite = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
const env = { ...process.env, BASE_PATH: "/pockit/" };
const build = spawnSync(
  process.execPath,
  [vite, "build", "--outDir", "dist-pages"],
  { cwd: root, env, stdio: "inherit", windowsHide: true, timeout: 120000 },
);
if (build.status !== 0) throw new Error("Repository-path build failed.");
const server = spawn(
  process.execPath,
  [
    vite,
    "preview",
    "--outDir",
    "dist-pages",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  { cwd: root, env, stdio: "pipe", windowsHide: true },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:4174/pockit/")).ok;
    } catch {
      /* server startup */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "Preview server did not start.");
  browser = await chromium.launch(
    process.platform === "win32" ? { channel: "msedge" } : {},
  );
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/pockit/");
  await page.getByRole("button", { name: "Let’s make a little plan" }).click();
  for (let step = 1; step < 8; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Start using Pockit" }).click();
  await page.getByTestId("total-cash").waitFor();
  const manifest = await (
    await fetch("http://127.0.0.1:4174/pockit/manifest.webmanifest")
  ).json();
  assert.equal(manifest.display, "standalone");
  const registration = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return { scope: r.scope, script: r.active?.scriptURL };
  });
  assert.equal(registration.scope, "http://127.0.0.1:4174/pockit/");
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await page.reload();
  await page.getByRole("heading", { name: "The bigger picture." }).waitFor();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "The bigger picture." }).waitFor();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Make yourself at home." }).waitFor();
  console.log(
    "PASS: /pockit/ assets, manifest, service-worker scope, deep-link reload and offline lazy routes.",
  );
} finally {
  await browser?.close();
  server.kill();
}
