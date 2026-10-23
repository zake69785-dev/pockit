import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { webcrypto, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildPushPayload } from "@block65/webcrypto-web-push";
globalThis.crypto ??= webcrypto;
const vars = Object.fromEntries(readFileSync(join(dirname(fileURLToPath(import.meta.url)), ".dev.vars"), "utf8").trim().split("\n").map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
const client = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const subscription = { endpoint: "https://web.push.apple.com/synthetic", expirationTime: null, keys: { p256dh: Buffer.from(await crypto.subtle.exportKey("raw", client.publicKey)).toString("base64url"), auth: randomBytes(16).toString("base64url") } };
const vapid = { subject: vars.VAPID_SUBJECT, publicKey: vars.VAPID_PUBLIC_KEY, privateKey: vars.VAPID_PRIVATE_KEY };
const samples = [];
for (let i = 0; i < 5; i++) {
  const start = performance.now();
  const payload = await buildPushPayload({ data: JSON.stringify({ id: "synthetic", title: "Pockit reminder", body: "Open Pockit.", route: "/", expiresAt: new Date(Date.now() + 60000).toISOString() }), options: { ttl: 60 } }, subscription, vapid);
  samples.push(performance.now() - start);
  assert.match(payload.headers.authorization, /^vapid /);
  assert.equal(payload.headers["content-encoding"], "aes128gcm");
}
samples.sort((a, b) => a - b);
console.log(`Real VAPID/aes128gcm construction passed locally; Node median ${samples[2].toFixed(1)} ms, maximum ${samples[4].toFixed(1)} ms. Cloudflare CPU is not measured by this test.`);
