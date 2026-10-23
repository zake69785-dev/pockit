import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
const vars = Object.fromEntries(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), ".dev.vars"),
    "utf8",
  )
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const url = "http://127.0.0.1:8787";
const origin = "https://zake69785-dev.github.io";
const post = (path, data, token = "", from = origin) =>
  fetch(url + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: from,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
assert.equal(
  (await post("/pair", { code: "wrong" }, "", "https://evil.example")).status,
  403,
);
assert.equal((await post("/admin/code", {}, "wrong")).status, 401);
const issued = await post("/admin/code", {}, vars.ADMIN_TOKEN);
assert.equal(issued.status, 200);
const { code } = await issued.json();
const paired = await post("/pair", { code });
assert.equal(paired.status, 200);
const { token } = await paired.json();
assert.equal((await post("/pair", { code })).status, 401);
assert.equal((await post("/subscription", {}, "wrong")).status, 401);
const subscription = {
  endpoint: "https://web.push.apple.com/test-synthetic-endpoint",
  expirationTime: null,
  keys: {
    p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString(
      "base64url",
    ),
    auth: randomBytes(16).toString("base64url"),
  },
};
const now = Date.now();
const reminders = [
  {
    id: "synthetic",
    category: "task",
    route: "/tasks",
    title: "should be discarded",
    body: "private fixture",
    sendAt: new Date(now + 600000).toISOString(),
    expiresAt: new Date(now + 1200000).toISOString(),
  },
];
assert.equal(
  (
    await post(
      "/subscription",
      {
        subscription: { ...subscription, endpoint: "https://evil.example" },
        reminders,
      },
      token,
    )
  ).status,
  400,
);
const saved = await post("/subscription", { subscription, reminders }, token);
assert.equal(saved.status, 200, await saved.text());
assert.equal(
  (await post("/subscription", { subscription, reminders }, token)).status,
  200,
);
assert.equal((await post("/unsubscribe", {}, token)).status, 200);
assert.equal(
  (await post("/subscription", { subscription, reminders }, token)).status,
  401,
);
const cron = await fetch(url + "/cdn-cgi/local/scheduled");
assert.equal(cron.status, 200);
const rateClient = `test-${randomBytes(8).toString("hex")}`;
for (let attempt = 0; attempt < 6; attempt++) {
  const response = await fetch(url + "/pair", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": rateClient,
    },
    body: JSON.stringify({ code: "invalid" }),
  });
  assert.equal(response.status, attempt === 5 ? 429 : 401);
}
console.log(
  "Local Worker checks passed: origin, admin auth, one-time pairing, five-attempt rate limit, device auth, endpoint validation, schedule replacement, revocation, Cron.",
);
