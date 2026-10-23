import { format, isValid, parseISO } from "date-fns";
import type { Student } from "./student";
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const text = (v: unknown, max = 120) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const day = (v: unknown) =>
  typeof v === "string" &&
  /^20\d{2}-\d{2}-\d{2}$/.test(v) &&
  isValid(parseISO(v)) &&
  format(parseISO(v), "yyyy-MM-dd") === v;
const instant = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(v) &&
  /(Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v));
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const url = (v: unknown) => {
  try {
    const u = new URL(String(v));
    return (
      u.origin === "https://feu.instructure.com" && !u.username && !u.password
    );
  } catch {
    return false;
  }
};
export function validateStudent(s: Student) {
  check(s && s.version === 1, "Unsupported academic data version.");
  for (const list of [
    s.courses,
    s.assessments,
    s.tasks,
    s.events,
    s.sessions,
  ]) {
    check(
      Array.isArray(list) && list.length <= 10000,
      "Invalid academic collection.",
    );
    check(
      new Set(list.map((v) => v?.id)).size === list.length &&
        list.every((v) => v && text(v.id, 200)),
      "Invalid or duplicate academic IDs.",
    );
  }
  const course = (value: string) =>
    value === "" || s.courses.some((c) => c.id === value);
  for (const c of s.courses) {
    check(
      text(c.name) &&
        ["manual", "canvas"].includes(c.origin) &&
        finite(c.target, 0, 100) &&
        Array.isArray(c.categories) &&
        c.categories.length <= 30,
      "Invalid course.",
    );
    check(
      new Set(c.categories.map((v) => v?.id)).size === c.categories.length,
      "Duplicate grade categories.",
    );
    for (const category of c.categories)
      check(
        category &&
          text(category.id) &&
          text(category.name) &&
          finite(category.weight, 0, 100),
        "Invalid grade category.",
      );
    check(
      c.categories.reduce((sum, v) => sum + v.weight, 0) <= 100.001,
      "Grade category weights cannot exceed 100%.",
    );
    check(
      c.canvasGrade === undefined ||
        c.canvasGrade === null ||
        finite(c.canvasGrade, 0, 10000),
      "Invalid Canvas grade.",
    );
  }
  for (const a of s.assessments) {
    check(
      text(a.name) &&
        a.courseId !== "" &&
        course(a.courseId) &&
        ["manual", "canvas"].includes(a.origin) &&
        finite(a.max, a.origin === "canvas" ? 0 : 0.01, 1e8) &&
        (a.earned === null || finite(a.earned, 0, 1e8)) &&
        (a.dueAt === null || instant(a.dueAt)) &&
        typeof a.submitted === "boolean",
      "Invalid assessment.",
    );
    check(
      a.origin === "canvas" ||
        s.courses
          .find((c) => c.id === a.courseId)
          ?.categories.some((c) => c.id === a.categoryId),
      "Choose an existing grade category.",
    );
    check(a.url === undefined || url(a.url), "Invalid Canvas link.");
  }
  for (const t of s.tasks)
    check(
      text(t.name) &&
        (t.due === "" || day(t.due)) &&
        ["low", "normal", "high"].includes(t.priority) &&
        typeof t.notes === "string" &&
        t.notes.length <= 5000 &&
        typeof t.done === "boolean" &&
        finite(t.effort, 0, 100000) &&
        Number.isInteger(t.effort) &&
        course(t.courseId) &&
        ["none", "daily", "weekly", "monthly"].includes(t.repeat) &&
        (t.repeat === "none" || t.due !== ""),
      "Invalid task or recurring due date.",
    );
  const time = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  for (const t of s.tasks)
    check(
      t.assessmentId === undefined ||
        s.assessments.some((a) => a.id === t.assessmentId),
      "Linked assignment is missing.",
    );
  for (const e of s.events)
    check(
      text(e.name) &&
        day(e.date) &&
        (e.endDate === undefined || (day(e.endDate) && e.endDate >= e.date)) &&
        ((e.start === "" && e.end === "") ||
          (time(e.start) &&
            time(e.end) &&
            ((e.endDate !== undefined && e.endDate > e.date) ||
              e.start < e.end ||
              (e.origin === "canvas" && e.start === e.end)))) &&
        ["class", "exam", "personal", "study"].includes(e.category) &&
        ["none", "weekly"].includes(e.repeat) &&
        course(e.courseId) &&
        ["manual", "canvas"].includes(e.origin) &&
        (e.url === undefined || url(e.url)),
      "Invalid calendar event. End time must follow start time.",
    );
  for (const v of [...s.sessions, ...(s.timer ? [s.timer] : [])])
    check(
      v &&
        text(v.id) &&
        typeof v.taskId === "string" &&
        v.taskId.length <= 200 &&
        finite(v.startedAt, 0, 1e14) &&
        Number.isInteger(v.startedAt) &&
        finite(v.duration, 60000, 180 * 60000) &&
        Number.isInteger(v.duration) &&
        ["focus", "break"].includes(v.mode),
      "Invalid study timer.",
    );
  check(
    s.timer === null ||
      (typeof s.timer === "object" &&
        !s.sessions.some((v) => v.id === s.timer!.id)),
    "Invalid active timer.",
  );
  check(
    s.canvas &&
      (s.canvas.lastSync === null || instant(s.canvas.lastSync)) &&
      Array.isArray(s.canvas.selectedCourses) &&
      s.canvas.selectedCourses.length <= 500 &&
      s.canvas.selectedCourses.every((v) => text(v, 200)) &&
      Array.isArray(s.canvas.announcements) &&
      s.canvas.announcements.length <= 10000,
    "Invalid Canvas cache.",
  );
  for (const a of s.canvas.announcements)
    check(
      a &&
        text(a.id, 200) &&
        text(a.title, 500) &&
        url(a.url) &&
        instant(a.date),
      "Invalid Canvas announcement.",
    );
  check(
    Array.isArray(s.dismissed) &&
      s.dismissed.length <= 10000 &&
      s.dismissed.every((v) => text(v, 250)),
    "Invalid notification preferences.",
  );
}
