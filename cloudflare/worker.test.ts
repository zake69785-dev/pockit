import { describe, expect, it, vi } from "vitest";
vi.mock("@block65/webcrypto-web-push", () => ({
  buildPushPayload: vi.fn(async () => ({
    method: "POST",
    headers: {},
    body: "encrypted",
  })),
}));
import { deliver, type Env } from "./worker";

async function fixture() {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const subscription = {
    endpoint: "https://web.push.apple.com/synthetic",
    keys: {
      p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString(
        "base64url",
      ),
      auth: Buffer.alloc(16, 1).toString("base64url"),
    },
  };
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "encrypt",
  ]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(subscription)),
    ),
  );
  const encoded = (v: Uint8Array) => Buffer.from(v).toString("base64url");
  const now = Date.now();
  const row = {
    device_hash: "device",
    reminder_hash: "reminder",
    category: "assignment",
    route: "/school",
    send_at: now - 1000,
    expires_at: now + 60000,
    attempts: 0,
    subscription_cipher: `${encoded(iv)}.${encoded(cipher)}`,
  };
  let status = "pending",
    sendAt = row.send_at,
    attempts = 0;
  const query = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      all: async () => ({
        results:
          sql.startsWith("SELECT r.*") && status === "pending" && sendAt <= now
            ? [row]
            : [],
      }),
      first: async () =>
        sql.startsWith("UPDATE reminders SET lease_until")
          ? { attempts: ++attempts }
          : null,
      run: async () => {
        if (sql.includes("status = 'failed'")) status = "failed";
        if (sql.includes("SET send_at")) sendAt = Number(params[0]);
        return {};
      },
    }),
  });
  const statements: string[] = [];
  const env = {
    DATA_KEY: encoded(rawKey),
    VAPID_SUBJECT: "mailto:test@example.com",
    VAPID_PUBLIC_KEY: "public",
    VAPID_PRIVATE_KEY: "private",
    DB: {
      prepare: (sql: string) => {
        statements.push(sql);
        return query(sql);
      },
      batch: async () => {
        if (statements.some((s) => s.includes("status = 'delivered'")))
          status = "delivered";
        return [];
      },
    },
  } as unknown as Env;
  return { env, now, state: () => ({ status, sendAt, attempts }) };
}
describe("scheduled delivery", () => {
  it("sends generic encrypted payload once and retains a delivery receipt", async () => {
    const f = await fixture(),
      send = vi.fn(async () => new Response(null, { status: 201 }));
    await deliver(f.env, f.now, send);
    expect(send).toHaveBeenCalledOnce();
    expect(f.state().status).toBe("delivered");
    await deliver(f.env, f.now, send);
    expect(send).toHaveBeenCalledOnce();
  });
  it("backs off after a temporary push failure", async () => {
    const f = await fixture();
    await deliver(
      f.env,
      f.now,
      async () =>
        new Response(null, { status: 503, headers: { "Retry-After": "120" } }),
    );
    expect(f.state().sendAt).toBe(f.now + 120000);
    expect(f.state().status).toBe("pending");
  });
});
