import {
  manilaDay,
  type Assessment,
  type Course,
  type Student,
  type StudentEvent,
} from "./student";
import { validateStudent } from "./student-validation";
export const CANVAS_ORIGIN = "https://feu.instructure.com";
export class CanvasError extends Error {
  constructor(
    message: string,
    public code:
      "auth" | "permission" | "rate" | "network" | "server" | "invalid",
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}
export type CanvasGateway = (
  path: string,
  signal?: AbortSignal,
) => Promise<Response>;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CanvasError(
      "Canvas returned an invalid record. Your cached data is unchanged.",
      "invalid",
    );
  return value as Record<string, unknown>;
};
const canvasId = (value: unknown) => {
  const text = String(value);
  if (!/^\d{1,20}$/.test(text))
    throw new CanvasError("Canvas returned an invalid ID.", "invalid");
  return text;
};
function pathOf(value: string) {
  const url = new URL(value, CANVAS_ORIGIN);
  if (
    url.origin !== CANVAS_ORIGIN ||
    !url.pathname.startsWith("/api/v1/") ||
    url.username ||
    url.password ||
    url.searchParams.has("access_token")
  )
    throw new CanvasError(
      "Canvas returned an unsafe pagination link.",
      "invalid",
    );
  return url.pathname + url.search;
}
export async function canvasPages(
  gateway: CanvasGateway,
  initial: string,
  signal?: AbortSignal,
) {
  let path: string | null = pathOf(initial);
  const visited = new Set<string>(),
    result: Record<string, unknown>[] = [];
  while (path) {
    if (visited.has(path) || visited.size >= 100)
      throw new CanvasError(
        "Canvas pagination could not finish. Cached data is unchanged.",
        "invalid",
      );
    visited.add(path);
    let response: Response;
    try {
      response = await gateway(path, signal);
    } catch {
      throw new CanvasError(
        "Canvas is unavailable. Your offline cache is still available.",
        "network",
      );
    }
    if (response.status === 401)
      throw new CanvasError(
        "Canvas authorization expired. Reconnect through the protected service.",
        "auth",
      );
    if (response.status === 403)
      throw new CanvasError(
        "Canvas did not permit this read. Check the approved scopes.",
        "permission",
      );
    if (response.status === 429) {
      const retry = response.headers.get("Retry-After");
      const seconds = retry
        ? /^\d+$/.test(retry)
          ? Number(retry)
          : Math.ceil((Date.parse(retry) - Date.now()) / 1000)
        : NaN;
      throw new CanvasError(
        "Canvas is busy. Try syncing again later; cached data is unchanged.",
        "rate",
        Number.isFinite(seconds) ? Math.max(0, seconds) : null,
      );
    }
    if (!response.ok)
      throw new CanvasError(
        "Canvas could not finish syncing. Try again later.",
        "server",
      );
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CanvasError(
        "Canvas returned an unreadable response.",
        "invalid",
      );
    }
    if (!Array.isArray(payload) || result.length + payload.length > 10000)
      throw new CanvasError(
        "Canvas returned an oversized or invalid list.",
        "invalid",
      );
    result.push(...payload.map(object));
    const next = response.headers
      .get("Link")
      ?.match(/<([^>]+)>\s*;\s*rel="next"/i)?.[1];
    path = next ? pathOf(next) : null;
  }
  return result;
}
/** Stage an entire read-only refresh. Caller commits only after this resolves. */
export async function fetchCanvasSnapshot(
  gateway: CanvasGateway,
  selected: string[],
  signal?: AbortSignal,
) {
  const raw = await canvasPages(
    gateway,
    "/api/v1/courses?enrollment_type=student&enrollment_state=active&per_page=100",
    signal,
  );
  const courses: Course[] = [],
    assessments: Assessment[] = [];
  const announcements: Student["canvas"]["announcements"] = [];
  const events: StudentEvent[] = [];
  for (const c of raw) {
    const key = canvasId(c.id),
      courseId = `canvas:course:${key}`;
    const enrollment =
      Array.isArray(c.enrollments) && c.enrollments[0]
        ? object(c.enrollments[0])
        : {};
    courses.push({
      id: courseId,
      name: String(c.name ?? "Untitled Canvas course").slice(0, 120),
      origin: "canvas",
      categories: [],
      target: 75,
      canvasGrade:
        typeof enrollment.computed_current_score === "number"
          ? enrollment.computed_current_score
          : null,
    });
    if (selected.length && !selected.includes(courseId)) continue;
    const assignments = await canvasPages(
      gateway,
      `/api/v1/courses/${key}/assignments?include[]=submission&per_page=100`,
      signal,
    );
    for (const a of assignments) {
      const keyA = canvasId(a.id),
        submission = a.submission ? object(a.submission) : {};
      assessments.push({
        id: `canvas:assignment:${keyA}`,
        courseId,
        categoryId: "canvas",
        name: String(a.name ?? "Untitled assignment").slice(0, 120),
        max: typeof a.points_possible === "number" ? a.points_possible : 0,
        earned: typeof submission.score === "number" ? submission.score : null,
        dueAt: typeof a.due_at === "string" ? a.due_at : null,
        submitted: ["submitted", "graded", "pending_review"].includes(
          String(submission.workflow_state),
        ),
        origin: "canvas",
        url: `${CANVAS_ORIGIN}/courses/${key}/assignments/${keyA}`,
      });
    }
    const notices = await canvasPages(
      gateway,
      `/api/v1/announcements?context_codes[]=course_${key}&active_only=true&per_page=100`,
      signal,
    );
    for (const a of notices)
      announcements.push({
        id: `canvas:announcement:${canvasId(a.id)}`,
        title: String(a.title ?? "Canvas announcement").slice(0, 500),
        url: `${CANVAS_ORIGIN}/courses/${key}/discussion_topics/${canvasId(a.id)}`,
        date: String(a.posted_at ?? a.created_at),
      });
    const calendar = await canvasPages(
      gateway,
      `/api/v1/calendar_events?context_codes[]=course_${key}&type=event&all_events=true&per_page=100`,
      signal,
    );
    for (const e of calendar) {
      const instant = (v: unknown) =>
        new Date(String(v)).toLocaleTimeString("en-GB", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
        });
      const allDay = e.all_day === true;
      const date =
        allDay && typeof e.all_day_date === "string"
          ? e.all_day_date
          : manilaDay(String(e.start_at));
      const endDate = !allDay && e.end_at ? manilaDay(String(e.end_at)) : date;
      events.push({
        id: `canvas:event:${canvasId(e.id)}`,
        name: String(e.title ?? "Canvas event").slice(0, 120),
        date,
        endDate,
        start: allDay ? "" : instant(e.start_at),
        end: allDay ? "" : instant(e.end_at ?? e.start_at),
        category: "personal",
        repeat: "none",
        courseId,
        origin: "canvas",
        url: `${CANVAS_ORIGIN}/calendar?event_id=${canvasId(e.id)}`,
      });
    }
  }
  const unique = <T extends { id: string }>(items: T[]) => [
    ...new Map(items.map((item) => [item.id, item])).values(),
  ];
  return {
    courses: unique(courses),
    assessments: unique(assessments),
    events: unique(events),
    announcements: unique(announcements),
    lastSync: new Date().toISOString(),
  };
}
export function mergeCanvas(
  s: Student,
  snapshot: Awaited<ReturnType<typeof fetchCanvasSnapshot>>,
) {
  const merge = <T extends { id: string }>(
    existing: T[],
    incoming: T[],
  ): T[] => {
    const records = new Map(existing.map((item) => [item.id, item]));
    for (const item of incoming) {
      const old = records.get(item.id);
      if (old && "origin" in old && old.origin === "manual")
        throw new CanvasError(
          "A Canvas ID conflicts with a local record. Cached data is unchanged.",
          "invalid",
        );
      records.set(item.id, item);
    }
    return [...records.values()];
  };
  const next = {
    ...s,
    courses: merge(s.courses, snapshot.courses),
    assessments: merge(s.assessments, snapshot.assessments),
    events: merge(s.events, snapshot.events),
    canvas: {
      ...s.canvas,
      lastSync: snapshot.lastSync,
      announcements: merge(s.canvas.announcements, snapshot.announcements),
    },
  };
  validateStudent(next);
  return next;
}
/** Deployment must provide an authenticated, allowlisted backend. No token enters this client. */
export function protectedGateway(endpoint: string): CanvasGateway {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Canvas requires a configured HTTPS service.");
  return (path, signal) =>
    fetch(`${url.href}?path=${encodeURIComponent(pathOf(path))}`, {
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal,
    });
}
