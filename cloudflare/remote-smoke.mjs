// Run only after the owner explicitly approves deploying and testing the Worker.
// Uses a synthetic, short-lived pairing and revokes it immediately. No push
// subscription or reminder is sent.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
const base = process.argv[2];
if (!base?.startsWith("https://")) throw new Error("Pass the approved Worker HTTPS URL.");
const vars = Object.fromEntries(readFileSync(join(dirname(fileURLToPath(import.meta.url)), ".dev.vars"), "utf8").trim().split("\n").map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
const origin = "https://zake69785-dev.github.io";
const post = (path, data, token, from = origin) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", Origin: from, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data), redirect: "error" });
assert.equal((await fetch(base + "/", { redirect: "error" })).status, 405);
assert.equal((await post("/pair", { code: "invalid" }, "", "https://invalid.example")).status, 403);
const issue = await post("/admin/code", {}, vars.ADMIN_TOKEN);
assert.equal(issue.status, 200, `admin pairing endpoint returned ${issue.status}`);
const { code } = await issue.json();
const pair = await post("/pair", { code });
assert.equal(pair.status, 200, `pairing endpoint returned ${pair.status}`);
const { token } = await pair.json();
assert.equal((await post("/unsubscribe", {}, token)).status, 200);
assert.equal((await post("/unsubscribe", {}, token)).status, 401);
console.log("Deployed Worker checks passed: running endpoint, origin restriction, authenticated D1-backed pairing, revocation. No subscription was created.");
