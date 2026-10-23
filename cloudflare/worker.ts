import {
  buildPushPayload,
  type PushSubscription,
} from "@block65/webcrypto-web-push";

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  ADMIN_TOKEN: string;
  DATA_KEY: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}
type Reminder = {
  id: string;
  category: string;
  route: string;
  sendAt: string;
  expiresAt: string;
};
type Due = {
  device_hash: string;
  reminder_hash: string;
  category: string;
  route: string;
  send_at: number;
  expires_at: number;
  attempts: number;
  subscription_cipher: string;
};
const encoder = new TextEncoder();
const categories = new Set([
  "assignment",
  "class",
  "task",
  "allowance",
  "funds",
  "briefing",
]);
const routes = new Set([
  "/",
  "/school",
  "/tasks",
  "/plan",
  "/money",
  "/calendar",
]);
const generic: Record<string, string> = {
  assignment: "Open Pockit to check an academic deadline.",
  class: "Open Pockit to check your class schedule.",
  task: "Open Pockit to check a personal task.",
  allowance: "An allowance is expected. Confirm receipt in Pockit.",
  funds: "Open Pockit to review your last synced plan.",
  briefing: "Open Pockit for your latest local briefing.",
};
function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function bytes(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
async function hash(value: string) {
  return base64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
function random() {
  return base64(crypto.getRandomValues(new Uint8Array(32)));
}
async function dataKey(env: Env) {
  const key = bytes(env.DATA_KEY);
  if (key.length !== 32) throw new Error("Invalid encryption key");
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
async function encrypt(value: unknown, env: Env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await dataKey(env),
      encoder.encode(JSON.stringify(value)),
    ),
  );
  return `${base64(iv)}.${base64(cipher)}`;
}
async function decrypt(value: string, env: Env): Promise<PushSubscription> {
  const [iv, cipher] = value.split(".");
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes(iv) },
        await dataKey(env),
        bytes(cipher),
      ),
    ),
  );
}
function reply(status: number, data: unknown, origin?: string) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(origin
        ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
        : {}),
    },
  });
}
function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      return false;
    return (
      u.hostname === "fcm.googleapis.com" ||
      u.hostname === "updates.push.services.mozilla.com" ||
      u.hostname === "wns2-pn1p.notify.windows.com" ||
      u.hostname === "web.push.apple.com" ||
      u.hostname.endsWith(".push.apple.com") ||
      u.hostname.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
function validSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<PushSubscription>;
  if (
    !validEndpoint(s.endpoint) ||
    !s.keys ||
    typeof s.keys.p256dh !== "string" ||
    typeof s.keys.auth !== "string"
  )
    return false;
  try {
    const key = bytes(s.keys.p256dh);
    return (
      key.length === 65 && key[0] === 4 && bytes(s.keys.auth).length === 16
    );
  } catch {
    return false;
  }
}
function validReminders(value: unknown, now: number): value is Reminder[] {
  return (
    Array.isArray(value) &&
    value.length <= 250 &&
    value.every((r) => {
      if (
        !r ||
        typeof r.id !== "string" ||
        r.id.length > 300 ||
        !categories.has(r.category) ||
        !routes.has(r.route)
      )
        return false;
      const send = Date.parse(r.sendAt),
        expiry = Date.parse(r.expiresAt);
      return (
        Number.isFinite(send) &&
        Number.isFinite(expiry) &&
        send > now &&
        send <= now + 8 * 86400000 &&
        expiry > send &&
        expiry <= now + 9 * 86400000
      );
    })
  );
}
async function body(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 100000)
    throw new Error("body too large");
  const raw = await request.text();
  if (raw.length > 100000) throw new Error("body too large");
  return JSON.parse(raw);
}
async function device(request: Request, env: Env) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{40,60})$/)?.[1];
  if (!token) return null;
  const tokenHash = await hash(token);
  const row = await env.DB.prepare(
    "SELECT token_hash FROM devices WHERE token_hash = ?",
  )
    .bind(tokenHash)
    .first();
  return row ? tokenHash : null;
}
export async function handle(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("origin");
  const allowed = origin === env.ALLOWED_ORIGIN;
  const path = new URL(request.url).pathname;
  if (request.method === "OPTIONS")
    return allowed
      ? new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin!,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Max-Age": "600",
            Vary: "Origin",
          },
        })
      : reply(403, { error: "Forbidden" });
  if (request.method !== "POST")
    return reply(405, { error: "Method not allowed" });
  if (path === "/admin/code") {
    const admin = request.headers.get("authorization")?.slice(7) ?? "";
    if (
      !env.ADMIN_TOKEN ||
      admin.length !== env.ADMIN_TOKEN.length ||
      (await hash(admin)) !== (await hash(env.ADMIN_TOKEN))
    )
      return reply(401, { error: "Unauthorized" });
    const code = random(),
      now = Date.now();
    await env.DB.prepare(
      "INSERT INTO pairing_codes(code_hash, expires_at) VALUES (?, ?)",
    )
      .bind(await hash(code), now + 300000)
      .run();
    return reply(200, {
      code,
      expiresAt: new Date(now + 300000).toISOString(),
    });
  }
  if (!allowed) return reply(403, { error: "Forbidden" });
  try {
    if (path === "/pair") {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const clientHash = await hash(ip + env.ADMIN_TOKEN);
      const now = Date.now();
      const attempt = await env.DB.prepare(
        "SELECT count, window_start FROM pairing_attempts WHERE client_hash = ?",
      )
        .bind(clientHash)
        .first<{ count: number; window_start: number }>();
      if (attempt && attempt.window_start > now - 900000 && attempt.count >= 5)
        return reply(429, { error: "Try again later" }, origin!);
      await env.DB.prepare(
        "INSERT INTO pairing_attempts VALUES (?, 1, ?) ON CONFLICT(client_hash) DO UPDATE SET count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END, window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END",
      )
        .bind(clientHash, now, now - 900000, now - 900000)
        .run();
      const input = await body(request);
      if (
        typeof input.code !== "string" ||
        !/^[A-Za-z0-9_-]{40,60}$/.test(input.code)
      )
        return reply(401, { error: "Invalid code" }, origin!);
      const codeHash = await hash(input.code);
      const consumed = await env.DB.prepare(
        "DELETE FROM pairing_codes WHERE code_hash = ? AND expires_at > ? RETURNING code_hash",
      )
        .bind(codeHash, now)
        .first();
      if (!consumed) return reply(401, { error: "Invalid code" }, origin!);
      const token = random();
      await env.DB.prepare(
        "INSERT INTO devices(token_hash, created_at, updated_at) VALUES (?, ?, ?)",
      )
        .bind(await hash(token), now, now)
        .run();
      return reply(200, { token }, origin!);
    }
    if (path !== "/subscription" && path !== "/unsubscribe")
      return reply(404, { error: "Not found" }, origin!);
    const tokenHash = await device(request, env);
    if (!tokenHash) return reply(401, { error: "Unauthorized" }, origin!);
    if (path === "/unsubscribe") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM reminders WHERE device_hash = ?").bind(
          tokenHash,
        ),
        env.DB.prepare("DELETE FROM deliveries WHERE device_hash = ?").bind(
          tokenHash,
        ),
        env.DB.prepare("DELETE FROM devices WHERE token_hash = ?").bind(
          tokenHash,
        ),
      ]);
      return reply(200, { ok: true }, origin!);
    }
    const input = await body(request),
      now = Date.now();
    if (
      !validSubscription(input.subscription) ||
      !validReminders(input.reminders, now) ||
      input.reminders.length > 40
    )
      return reply(
        400,
        { error: "Invalid subscription or reminders (40 maximum)" },
        origin!,
      );
    const encrypted = await encrypt(input.subscription, env);
    const statements = [
      env.DB.prepare(
        "UPDATE devices SET subscription_cipher = ?, updated_at = ? WHERE token_hash = ?",
      ).bind(encrypted, now, tokenHash),
      env.DB.prepare(
        "DELETE FROM reminders WHERE device_hash = ? AND status != 'delivered'",
      ).bind(tokenHash),
    ];
    for (const r of input.reminders as Reminder[]) {
      const id = await hash(`${tokenHash}:${r.id}`);
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO reminders(device_hash, reminder_hash, category, route, send_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(
          tokenHash,
          id,
          r.category,
          r.route,
          Date.parse(r.sendAt),
          Date.parse(r.expiresAt),
        ),
      );
    }
    await env.DB.batch(statements);
    return reply(200, { ok: true, count: input.reminders.length }, origin!);
  } catch {
    return reply(400, { error: "Invalid request" }, origin!);
  }
}

export async function deliver(env: Env, now = Date.now(), send = fetch) {
  const due = await env.DB.prepare(
    "SELECT r.*, d.subscription_cipher FROM reminders r JOIN devices d ON d.token_hash = r.device_hash WHERE r.status = 'pending' AND r.send_at <= ? AND r.expires_at > ? AND r.lease_until < ? ORDER BY r.send_at LIMIT 1",
  )
    .bind(now, now, now)
    .all<Due>();
  for (const r of due.results) {
    const claimed = await env.DB.prepare(
      "UPDATE reminders SET lease_until = ?, attempts = attempts + 1 WHERE device_hash = ? AND reminder_hash = ? AND status = 'pending' AND lease_until < ? RETURNING attempts",
    )
      .bind(now + 120000, r.device_hash, r.reminder_hash, now)
      .first<{ attempts: number }>();
    if (!claimed) continue;
    try {
      const subscription = await decrypt(r.subscription_cipher, env);
      if (!validSubscription(subscription))
        throw new Error("Invalid stored subscription");
      const payload = await buildPushPayload(
        {
          data: JSON.stringify({
            id: r.reminder_hash,
            category: r.category,
            title: "Pockit reminder",
            body: generic[r.category],
            route: r.route,
            expiresAt: new Date(r.expires_at).toISOString(),
          }),
          options: {
            ttl: Math.max(0, Math.floor((r.expires_at - now) / 1000)),
          },
        },
        subscription,
        {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
      );
      const response = await send(subscription.endpoint, {
        ...payload,
        redirect: "error",
      });
      if (response.ok) {
        await env.DB.batch([
          env.DB.prepare(
            "INSERT OR IGNORE INTO deliveries VALUES (?, ?, ?)",
          ).bind(r.device_hash, r.reminder_hash, now),
          env.DB.prepare(
            "UPDATE reminders SET status = 'delivered', lease_until = 0 WHERE device_hash = ? AND reminder_hash = ?",
          ).bind(r.device_hash, r.reminder_hash),
        ]);
      } else if (response.status === 404 || response.status === 410) {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM reminders WHERE device_hash = ?").bind(
            r.device_hash,
          ),
          env.DB.prepare("DELETE FROM devices WHERE token_hash = ?").bind(
            r.device_hash,
          ),
        ]);
      } else if (response.status === 429 || response.status >= 500) {
        const retry = Number(response.headers.get("Retry-After"));
        if (Number.isFinite(retry) && retry > 0) {
          await env.DB.prepare(
            "UPDATE reminders SET send_at = ?, lease_until = 0, status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END WHERE device_hash = ? AND reminder_hash = ?",
          )
            .bind(
              now + Math.min(retry * 1000, 3600000),
              r.device_hash,
              r.reminder_hash,
            )
            .run();
          continue;
        }
        throw new Error("Transient push failure");
      } else {
        await env.DB.prepare(
          "UPDATE reminders SET status = 'failed', lease_until = 0 WHERE device_hash = ? AND reminder_hash = ?",
        )
          .bind(r.device_hash, r.reminder_hash)
          .run();
      }
    } catch {
      const delay = Math.min(
        3600000,
        60000 * 2 ** Math.min(claimed.attempts, 6),
      );
      await env.DB.prepare(
        "UPDATE reminders SET send_at = ?, lease_until = 0, status = CASE WHEN attempts >= 5 OR expires_at <= ? THEN 'failed' ELSE 'pending' END WHERE device_hash = ? AND reminder_hash = ?",
      )
        .bind(now + delay, now + delay, r.device_hash, r.reminder_hash)
        .run();
    }
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM reminders WHERE expires_at < ?").bind(
      now - 86400000,
    ),
    env.DB.prepare("DELETE FROM deliveries WHERE delivered_at < ?").bind(
      now - 9 * 86400000,
    ),
    env.DB.prepare("DELETE FROM pairing_codes WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM pairing_attempts WHERE window_start < ?").bind(
      now - 900000,
    ),
  ]);
}
export default {
  fetch: handle,
  scheduled: (
    _controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ) => {
    context.waitUntil(deliver(env));
  },
} satisfies ExportedHandler<Env>;
