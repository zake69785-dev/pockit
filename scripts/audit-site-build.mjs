import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "dist");
const production = readFileSync(join(root, ".env.production"), "utf8");
const entries = production.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
const config = Object.fromEntries(entries.map(line => {
  const at = line.indexOf("=");
  assert(at > 0, "Invalid production environment line");
  return [line.slice(0, at), line.slice(at + 1)];
}));
assert.deepEqual(Object.keys(config).sort(), ["VITE_PUSH_GATEWAY", "VITE_PUSH_PUBLIC_KEY"]);
assert.equal(config.VITE_PUSH_GATEWAY, "https://pockit-push.sancheesekyle238.workers.dev");
assert.match(config.VITE_PUSH_PUBLIC_KEY, /^[A-Za-z0-9_-]{87}$/);
assert(existsSync(output), "Build the website before auditing it");

const localSecrets = join(root, "cloudflare", ".dev.vars");
const secrets = existsSync(localSecrets)
  ? Object.fromEntries(readFileSync(localSecrets, "utf8").split(/\r?\n/).filter(Boolean).map(line => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }))
  : {};
if (secrets.VAPID_PUBLIC_KEY)
  assert.equal(config.VITE_PUSH_PUBLIC_KEY, secrets.VAPID_PUBLIC_KEY, "Public key must match the deployed keypair");

const privateValues = ["ADMIN_TOKEN", "DATA_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]
  .map(name => secrets[name] ?? process.env[name])
  .filter(value => typeof value === "string" && value.length > 8);
const forbiddenMarkers = [
  "VAPID_PRIVATE_KEY", "ADMIN_TOKEN", "DATA_KEY", "CLOUDFLARE_API_TOKEN",
  "7563fe18-090b-437f-aa0c-6f0da989dcac", "sancheesekyle238@gmail.com",
];
const files = [];
function visit(folder) {
  for (const item of readdirSync(folder)) {
    const path = join(folder, item);
    if (statSync(path).isDirectory()) visit(path);
    else files.push(path);
  }
}
visit(output);
for (const path of files) {
  const name = relative(output, path).replaceAll("\\", "/");
  assert(!/(^|\/)(\.env|\.dev\.vars|.*(?:backup|financial|recovery).*(?:\.json|\.db)|.*\.(?:sqlite|sqlite3|db|pem|key|p12|pfx))$/i.test(name), `Sensitive file in website build: ${name}`);
  if (!/\.(?:js|html|css|json|webmanifest|txt|svg)$/i.test(name)) continue;
  const content = readFileSync(path, "utf8");
  for (const marker of forbiddenMarkers)
    assert(!content.includes(marker), `Private configuration marker found in ${name}`);
  for (const value of privateValues)
    assert(!content.includes(value), `Private secret value found in ${name}`);
}
const scripts = files.filter(path => path.endsWith(".js")).map(path => readFileSync(path, "utf8")).join("\n");
assert(scripts.includes(config.VITE_PUSH_GATEWAY), "Worker URL missing from website build");
assert(scripts.includes(config.VITE_PUSH_PUBLIC_KEY), "Public VAPID key missing from website build");
console.log(`Website build audit passed (${files.length} assets): public Worker settings present; no private values, credentials, database files, or backup files found.`);
