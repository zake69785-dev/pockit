import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it, expect, vi } from "vitest";

function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const receipts = new Map<string, Response>();
  const showNotification = vi.fn(async () => {}),
    openWindow = vi.fn(async () => {});
  runInNewContext(readFileSync("public/push-handler.js", "utf8"), {
    self: {
      addEventListener: (name: string, fn: (event: unknown) => void) =>
        (listeners[name] = fn),
      registration: { scope: "https://example.test/pockit/", showNotification },
      clients: { matchAll: async () => [], openWindow },
    },
    URL,
    Response,
    Date,
    caches: {
      open: async () => ({
        match: async (key: URL) => receipts.get(String(key)),
        put: async (key: URL, value: Response) =>
          receipts.set(String(key), value),
        keys: async () => [...receipts.keys()],
        delete: async (key: string) => receipts.delete(key),
      }),
    },
  });
  async function push(message: unknown) {
    let work: Promise<void> | undefined;
    listeners.push({
      data: { json: () => message },
      waitUntil: (p: Promise<void>) => (work = p),
    });
    await work;
  }
  async function click(url: string) {
    let work: Promise<void> | undefined;
    listeners.notificationclick({
      notification: { close: vi.fn(), data: { url } },
      waitUntil: (p: Promise<void>) => (work = p),
    });
    await work;
  }
  return { push, click, showNotification, openWindow };
}
describe("real service worker push handlers with mocked browser services", () => {
  const message = {
    id: "task:1",
    title: "Task reminder",
    body: "Real saved task",
    route: "/tasks",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  it("shows a notification and suppresses repeat delivery", async () => {
    const w = worker();
    await w.push(message);
    await w.push(message);
    expect(w.showNotification).toHaveBeenCalledTimes(1);
    expect(w.showNotification.mock.calls[0]).toEqual([
      "Task reminder",
      expect.objectContaining({
        data: { url: "https://example.test/pockit/#/tasks" },
      }),
    ]);
  });
  it("rejects malformed and expired notifications", async () => {
    const w = worker();
    await w.push({});
    await w.push({ ...message, expiresAt: "2000-01-01" });
    expect(w.showNotification).not.toHaveBeenCalled();
  });
  it("contains notification click navigation inside the application scope", async () => {
    const w = worker();
    await w.click("https://untrusted.test/");
    expect(w.openWindow).toHaveBeenLastCalledWith(
      "https://example.test/pockit/",
    );
    await w.click("https://example.test/pockit/#/tasks");
    expect(w.openWindow).toHaveBeenLastCalledWith(
      "https://example.test/pockit/#/tasks",
    );
  });
});
