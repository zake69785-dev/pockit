import { addDays, format, parseISO } from "date-fns";
import type { Data } from "./model";
import { unifiedEvents } from "./calendar";
import { budget } from "./budget";
import { manilaDay, studentData } from "./student";

export const pushCategories = {
  assignment: "Academic deadlines",
  class: "Class reminders",
  task: "Personal tasks",
  allowance: "Allowance reminders",
  funds: "Low funds warnings",
  briefing: "Daily briefing",
} as const;
export type PushCategory = keyof typeof pushCategories;
export type PushPreferences = Record<
  PushCategory,
  { enabled: boolean; minutes: number }
>;
export const defaultPushPreferences = (): PushPreferences =>
  Object.fromEntries(
    Object.keys(pushCategories).map((k) => [
      k,
      { enabled: false, minutes: k === "assignment" ? 60 : 15 },
    ]),
  ) as PushPreferences;
export type PushReminder = {
  id: string;
  category: PushCategory;
  title: string;
  body: string;
  route: string;
  sendAt: string;
  expiresAt: string;
};

// Pure projection: never writes to the ledger or the academic cache. A full
// replacement schedule lets the service cancel completed/deleted/edited items.
export function pushSchedule(
  data: Data,
  preferences: PushPreferences,
  now = Date.now(),
): PushReminder[] {
  const day = manilaDay(now),
    end = format(addDays(parseISO(day), 7), "yyyy-MM-dd"),
    student = studentData(data);
  const reminders: PushReminder[] = [];
  const safeData: Data = {
    ...data,
    student: {
      ...student,
      assessments: student.assessments.filter(
        (a) => a.origin !== "canvas" || Boolean(student.canvas.lastSync),
      ),
      events: student.events.filter(
        (e) => e.origin !== "canvas" || Boolean(student.canvas.lastSync),
      ),
    },
  };
  for (const event of unifiedEvents(safeData, day, end)) {
    const category = event.category as PushCategory;
    if (
      !["assignment", "class", "task", "allowance"].includes(category) ||
      !preferences[category]?.enabled
    )
      continue;
    if (category === "allowance" && event.name.endsWith(" (received)"))
      continue;
    const source = student.events.find(
      (e) => event.id === `event:${e.id}:${event.date}`,
    );
    if (source && source.repeat === "none" && source.date !== event.date)
      continue;
    const savedTime = source?.start || event.time;
    const time = /^\d{2}:\d{2}$/.test(savedTime) ? savedTime : "09:00";
    const due = Date.parse(`${event.date}T${time}:00+08:00`);
    const send = due - preferences[category].minutes * 60000;
    if (send <= now || !Number.isFinite(send)) continue;
    reminders.push({
      id: `${event.id}:${event.date}:${time}:${preferences[category].minutes}`,
      category,
      title: pushCategories[category],
      body:
        category === "allowance"
          ? "An allowance is expected. Confirm receipt in Pockit when it arrives."
          : category === "assignment"
            ? "Open Pockit to check an academic deadline."
            : category === "class"
              ? "Open Pockit to check your class schedule."
              : "Open Pockit to check a personal task.",
      route:
        category === "assignment"
          ? "/school"
          : category === "task"
            ? "/tasks"
            : category === "allowance"
              ? "/plan"
              : "/calendar",
      sendAt: new Date(send).toISOString(),
      expiresAt: new Date(due + 60000).toISOString(),
    });
  }
  // These depend on the current local financial snapshot, so never project
  // future balances. Expire today; opening/syncing Pockit refreshes them.
  for (const category of ["funds"] as const) {
    if (
      !preferences[category].enabled ||
      (category === "funds" && budget(data, day).shortfall <= 0)
    )
      continue;
    const send = now + preferences[category].minutes * 60000;
    const expiry = Date.parse(`${day}T23:59:59+08:00`);
    if (send >= expiry) continue;
    reminders.push({
      id: `${category}:${day}`,
      category,
      title: pushCategories[category],
      body: "Your last synced plan exceeds available money. Open Pockit to review.",
      route: "/money",
      sendAt: new Date(send).toISOString(),
      expiresAt: new Date(expiry).toISOString(),
    });
  }
  if (preferences.briefing.enabled)
    for (let offset = 0; offset < 7; offset++) {
      const date = format(addDays(parseISO(day), offset), "yyyy-MM-dd");
      const send =
        Date.parse(`${date}T09:00:00+08:00`) -
        preferences.briefing.minutes * 60000;
      if (send <= now) continue;
      reminders.push({
        id: `briefing:${date}`,
        category: "briefing",
        title: "Daily briefing",
        body: "Open Pockit for today’s latest local records.",
        route: "/",
        sendAt: new Date(send).toISOString(),
        expiresAt: new Date(`${date}T23:59:59+08:00`).toISOString(),
      });
    }
  return [...new Map(reminders.map((r) => [r.id, r])).values()].sort((a, b) =>
    a.sendAt.localeCompare(b.sendAt),
  );
}

export function loadPushPreferences(): PushPreferences {
  const defaults = defaultPushPreferences();
  try {
    const saved = JSON.parse(
      localStorage.getItem("pockit-push-preferences") ?? "{}",
    );
    for (const key of Object.keys(defaults) as PushCategory[]) {
      if (
        typeof saved[key]?.enabled === "boolean" &&
        [0, 15, 30, 60, 1440].includes(saved[key].minutes)
      )
        defaults[key] = saved[key];
    }
  } catch {
    /* Unavailable/invalid local preferences never affect finance. */
  }
  return defaults;
}

export function vapidBytes(key: string): Uint8Array<ArrayBuffer> {
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4)
    throw new Error("The push service public key is invalid.");
  return bytes;
}
export async function enablePush(publicKey: string) {
  if (
    !("Notification" in window) ||
    !("PushManager" in window) ||
    !("serviceWorker" in navigator)
  )
    throw new Error(
      "Install Pockit on your Home Screen, then open it there to enable notifications.",
    );
  const key = vapidBytes(publicKey);
  // Called directly from a tap, before waiting for the service worker.
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Notifications are blocked. You can change this in your device’s notification settings.",
    );
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active)
    throw new Error(
      "Pockit is not ready offline yet. Reopen it online and retry.",
    );
  return (
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    }))
  );
}

export async function pushServiceRequest(
  gateway: string,
  path: string,
  body: unknown,
  token: string,
) {
  if (!gateway.startsWith("https://"))
    throw new Error("A secure push service must be configured first.");
  let response: Response;
  try {
    response = await fetch(`${gateway.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "Push service unreachable. Your local records are safe. Retry when online.",
    );
  }
  if (response.status === 410) {
    const subscription = await (
      await navigator.serviceWorker.getRegistration()
    )?.pushManager.getSubscription();
    if (subscription && !(await subscription.unsubscribe()))
      throw new Error(
        "Subscription expired and could not be removed. Disable notifications in device settings, then retry.",
      );
    throw new Error("Subscription expired. Enable notifications again.");
  }
  if (!response.ok) {
    if (path === "/pair" && response.status === 401)
      throw new Error(
        "This code is invalid, expired, or already used. Obtain a fresh code and try again within five minutes.",
      );
    if (response.status === 401)
      throw new Error(
        "Pair this device again. The session expired; obtain a new one-time code.",
      );
    if (response.status === 429)
      throw new Error(
        "Too many pairing attempts. Wait 15 minutes, then use a fresh code.",
      );
    if (response.status === 403)
      throw new Error(
        "This website is not allowed by the push service. Open the current Pockit site or contact the administrator.",
      );
    if (response.status === 400)
      throw new Error(
        "The push service rejected this request. Check that the code or reminder count is valid, then retry.",
      );
    throw new Error(
      "Push service error. Your local records are safe. Retry later.",
    );
  }
  return response;
}
