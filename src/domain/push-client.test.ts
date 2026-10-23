import { afterEach, describe, it, expect, vi } from "vitest";
import { enablePush, pushServiceRequest } from "./push";
const key = btoa(String.fromCharCode(4, ...Array(64).fill(1)));
afterEach(() => vi.unstubAllGlobals());
function browser(permission: string, existing: object | null = null) {
  const subscribe = vi.fn(async () => ({
    endpoint: "https://push.example.test/mock",
  }));
  const requestPermission = vi.fn(async () => permission);
  vi.stubGlobal("window", { Notification: {}, PushManager: {} });
  vi.stubGlobal("Notification", { requestPermission });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({
        active: {},
        pushManager: { getSubscription: async () => existing, subscribe },
      }),
    },
  });
  return { subscribe, requestPermission };
}
describe("push subscription permission boundary", () => {
  it("requests permission and subscribes with only the public key", async () => {
    const b = browser("granted");
    expect(await enablePush(key)).toHaveProperty("endpoint");
    expect(b.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
  });
  it("denial never creates a subscription", async () => {
    const b = browser("denied");
    await expect(enablePush(key)).rejects.toThrow("blocked");
    expect(b.subscribe).not.toHaveBeenCalled();
  });
  it("reuses a valid browser subscription", async () => {
    const subscription = { endpoint: "https://push.example.test/existing" };
    const b = browser("granted", subscription);
    expect(await enablePush(key)).toBe(subscription);
    expect(b.subscribe).not.toHaveBeenCalled();
  });
  it("handles unsupported browser contexts", async () => {
    vi.stubGlobal("window", {});
    await expect(enablePush(key)).rejects.toThrow("Home Screen");
  });
  it("reports backend unavailability without changing local data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(
      pushServiceRequest(
        "https://example.test",
        "/subscription",
        {},
        "device-token",
      ),
    ).rejects.toThrow("unreachable");
  });
  it("removes expired subscriptions before asking to enable again", async () => {
    const unsubscribe = vi.fn(async () => true);
    browser("granted", { unsubscribe });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 410 })),
    );
    await expect(
      pushServiceRequest(
        "https://example.test",
        "/subscription",
        {},
        "device-token",
      ),
    ).rejects.toThrow("expired");
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("requires new pairing when authorization expires", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(
      pushServiceRequest(
        "https://example.test",
        "/subscription",
        {},
        "device-token",
      ),
    ).rejects.toThrow("Pair");
  });
});
