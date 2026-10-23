import { useState } from "react";
import { Section } from "./Common";
import { Select } from "./Select";
import { SelectionSheet } from "./SelectionSheet";
import type { Data } from "../domain/model";
import {
  enablePush,
  pushServiceRequest,
  loadPushPreferences,
  pushCategories,
  pushSchedule,
  type PushCategory,
} from "../domain/push";

// Only public configuration enters a Vite build. No remote API is called
// until the user explicitly pairs this device.
const gateway = import.meta.env.VITE_PUSH_GATEWAY as string | undefined;
const publicKey = import.meta.env.VITE_PUSH_PUBLIC_KEY as string | undefined;
export function NotificationSettings({ data }: { data: Data }) {
  const [preferences, setPreferences] = useState(loadPushPreferences);
  const [message, setMessage] = useState("Push service is not connected.");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const configured = Boolean(gateway?.startsWith("https://") && publicKey);
  const schedule = pushSchedule(data, preferences);
  async function request(path: string, body: unknown, authorization = token) {
    return pushServiceRequest(gateway ?? "", path, body, authorization);
  }

  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not connect. Retry when online.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="iPhone notifications" className="wide">
      <p>
        On iPhone, open Pockit in Safari, choose Share → Add to Home Screen,
        then open its Home Screen icon. Enable notifications here and grant
        permission.
      </p>
      <p className="hint">
        Delivery needs a network connection and permission in iOS Settings.
        Focus modes and device settings can delay notifications. Preferences
        below stay on this device; financial records are never uploaded by this
        panel.
      </p>
      <SelectionSheet
        label="Reminder categories"
        multiple
        options={Object.entries(pushCategories).map(([value, label]) => ({
          value,
          label,
        }))}
        value={(Object.keys(pushCategories) as PushCategory[]).filter(
          (key) => preferences[key].enabled,
        )}
        onChange={(values) => {
          const next = { ...preferences };
          for (const key of Object.keys(pushCategories) as PushCategory[])
            next[key] = { ...next[key], enabled: values.includes(key) };
          setPreferences(next);
          try {
            localStorage.setItem(
              "pockit-push-preferences",
              JSON.stringify(next),
            );
            setMessage(
              "Categories saved locally. Sync to update remote reminders.",
            );
          } catch {
            setMessage("Could not save preferences.");
          }
        }}
      />
      <div className="notification-options">
        {(Object.keys(pushCategories) as PushCategory[]).map((category) => (
          <div key={category} className="notification-option">
            <label className="check-row">
              <input
                type="checkbox"
                checked={preferences[category].enabled}
                onChange={(e) => {
                  const next = {
                    ...preferences,
                    [category]: {
                      ...preferences[category],
                      enabled: e.target.checked,
                    },
                  };
                  setPreferences(next);
                  try {
                    localStorage.setItem(
                      "pockit-push-preferences",
                      JSON.stringify(next),
                    );
                    setMessage(
                      "Preferences saved locally. Sync reminders to apply changes to the push service.",
                    );
                  } catch {
                    setMessage("Could not save preferences on this device.");
                  }
                }}
              />
              {pushCategories[category]}
            </label>
            <label>
              {category === "funds"
                ? "After sync"
                : category === "briefing"
                  ? "Before daily 9:00 AM briefing"
                  : "Remind before"}
              <Select
                aria-label={`${pushCategories[category]} timing`}
                value={preferences[category].minutes}
                onChange={(e) => {
                  const next = {
                    ...preferences,
                    [category]: {
                      ...preferences[category],
                      minutes: Number(e.target.value),
                    },
                  };
                  setPreferences(next);
                  try {
                    localStorage.setItem(
                      "pockit-push-preferences",
                      JSON.stringify(next),
                    );
                    setMessage(
                      "Timing saved locally. Sync reminders to apply it remotely.",
                    );
                  } catch {
                    setMessage("Could not save preferences.");
                  }
                }}
              >
                <option value="0">At the scheduled time</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="1440">1 day</option>
              </Select>
            </label>
          </div>
        ))}
      </div>
      <p className="hint">
        {schedule.length} upcoming reminders from your local records. Date-only
        reminders use 9:00 AM Manila time. Sync replaces the next seven days;
        completed or deleted items are removed on your next sync. Daily
        briefings run at 9:00 AM Manila, adjusted by your lead time. Low funds
        reminders cover today only.
      </p>
      {!configured ? (
        <p className="notice">
          Push service configuration is missing from this website build.
        </p>
      ) : (
        <>
          <label>
            One-time device pairing code
            <input
              value={code}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={busy || !code}
            onClick={() =>
              void act(async () => {
                const result = (await (
                  await request("/pair", { code }, "")
                ).json()) as { token?: string };
                if (typeof result.token !== "string" || !result.token)
                  throw new Error(
                    "The service returned an invalid pairing response.",
                  );
                setToken(result.token);
                setCode("");
                setMessage(
                  "Paired for this session. Tap Enable notifications next.",
                );
              })
            }
          >
            Pair device
          </button>
          <button
            className="primary"
            disabled={busy || !token}
            onClick={() => {
              // Permission is requested in this tap handler, before network work.
              const subscription = enablePush(publicKey!);
              void act(async () => {
                const sub = await subscription;
                await request("/subscription", {
                  subscription: sub.toJSON(),
                  reminders: schedule,
                });
                setLastSync(new Date().toISOString());
                setMessage(
                  "Subscribed and synced. Delivery remains subject to device settings.",
                );
              });
            }}
          >
            Enable notifications
          </button>
          <button
            className="secondary"
            disabled={busy || !token}
            onClick={() =>
              void act(async () => {
                const sub = await (
                  await navigator.serviceWorker.getRegistration()
                )?.pushManager.getSubscription();
                if (!sub) throw new Error("Enable notifications first.");
                await request("/subscription", {
                  subscription: sub.toJSON(),
                  reminders: schedule,
                });
                setLastSync(new Date().toISOString());
                setMessage("Reminder schedule synced.");
              })
            }
          >
            Sync reminders
          </button>
        </>
      )}
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          void act(async () => {
            const registration =
              "serviceWorker" in navigator
                ? await navigator.serviceWorker.getRegistration()
                : undefined;
            const sub = await registration?.pushManager.getSubscription();
            if (sub && !(await sub.unsubscribe()))
              throw new Error(
                "Could not unsubscribe. Retry or disable permission in iOS Settings.",
              );
            setMessage(
              "Device delivery disabled. Remote records are deleted after pairing and syncing removal, or when the endpoint expires.",
            );
            if (configured && token) {
              await request("/unsubscribe", {});
              setMessage(
                "Notifications disabled and remote subscription removed.",
              );
            }
          })
        }
      >
        Disable device notifications
      </button>
      <p role="status">{message}</p>
      <p className="hint">
        Last sync this session:{" "}
        {lastSync
          ? new Date(lastSync).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
            })
          : "Not synced"}
        . Reopen this panel and pair again to refresh a remote schedule.
      </p>
    </Section>
  );
}
