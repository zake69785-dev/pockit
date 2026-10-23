import { addDays, addMonths, format, parseISO } from "date-fns";
import { id, today, type Data } from "./model";

export type Course = {
  id: string;
  name: string;
  origin: "manual" | "canvas";
  categories: { id: string; name: string; weight: number }[];
  target: number;
  canvasGrade?: number | null;
};
export type Assessment = {
  id: string;
  courseId: string;
  categoryId: string;
  name: string;
  max: number;
  earned: number | null;
  dueAt: string | null;
  submitted: boolean;
  origin: "manual" | "canvas";
  url?: string;
};
export type Task = {
  id: string;
  name: string;
  due: string;
  priority: "low" | "normal" | "high";
  notes: string;
  done: boolean;
  effort: number;
  courseId: string;
  repeat: "none" | "daily" | "weekly" | "monthly";
  assessmentId?: string;
};
export type StudentEvent = {
  id: string;
  name: string;
  date: string;
  start: string;
  end: string;
  category: "class" | "exam" | "personal" | "study";
  repeat: "none" | "weekly";
  courseId: string;
  origin: "manual" | "canvas";
  url?: string;
  endDate?: string;
};
export type StudySession = {
  id: string;
  taskId: string;
  startedAt: number;
  duration: number;
  mode: "focus" | "break";
};
export type Student = {
  version: 1;
  courses: Course[];
  assessments: Assessment[];
  tasks: Task[];
  events: StudentEvent[];
  sessions: StudySession[];
  timer: StudySession | null;
  canvas: {
    lastSync: string | null;
    selectedCourses: string[];
    announcements: { id: string; title: string; url: string; date: string }[];
  };
  dismissed: string[];
};
export const freshStudent = (): Student => ({
  version: 1,
  courses: [],
  assessments: [],
  tasks: [],
  events: [],
  sessions: [],
  timer: null,
  canvas: { lastSync: null, selectedCourses: [], announcements: [] },
  dismissed: [],
});
export const studentData = (d: Data) => d.student ?? freshStudent();
export function editStudent(d: Data) {
  return (d.student ??= freshStudent());
}
export function manilaDay(instant: string | number = Date.now()) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date.");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function localDue(value: string) {
  return value ? new Date(`${value}:00+08:00`).toISOString() : null;
}
export function toggleTask(d: Data, taskId: string) {
  const s = editStudent(d),
    task = s.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("This task was removed. Refresh the list.");
  task.done = !task.done;
  if (!task.done || task.repeat === "none" || !task.due) return;
  const due = format(
    task.repeat === "monthly"
      ? addMonths(parseISO(task.due), 1)
      : addDays(parseISO(task.due), task.repeat === "daily" ? 1 : 7),
    "yyyy-MM-dd",
  );
  const nextId = `${task.id.split("@repeat:")[0]}@repeat:${due}`;
  if (!s.tasks.some((t) => t.id === nextId))
    s.tasks.push({ ...task, id: nextId, due, done: false });
}
export function startTimer(
  d: Data,
  minutes: number,
  mode: "focus" | "break",
  taskId: string,
  now = Date.now(),
) {
  const s = editStudent(d);
  if (s.timer) throw new Error("Finish or cancel the current timer first.");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180)
    throw new Error("Choose 1–180 minutes.");
  s.timer = {
    id: id(),
    taskId,
    startedAt: now,
    duration: minutes * 60000,
    mode,
  };
}
export function finishTimer(d: Data, now = Date.now()) {
  const s = editStudent(d),
    timer = s.timer;
  if (!timer) return;
  if (now < timer.startedAt + timer.duration)
    throw new Error("This session is still running.");
  if (!s.sessions.some((v) => v.id === timer.id)) s.sessions.push(timer);
  s.timer = null;
}
export function gradeProjection(course: Course, assessments: Assessment[]) {
  const configured =
    Math.abs(course.categories.reduce((sum, c) => sum + c.weight, 0) - 100) <
    0.001;
  let current = 0,
    currentWeight = 0,
    worst = 0,
    remainingWeight = 0,
    remainingPoints = 0;
  for (const c of course.categories) {
    const items = assessments.filter(
      (a) => a.courseId === course.id && a.categoryId === c.id,
    );
    const graded = items.filter((a) => a.earned !== null);
    const earned = graded.reduce((sum, a) => sum + a.earned!, 0),
      gradedMax = graded.reduce((sum, a) => sum + a.max, 0),
      total = items.reduce((sum, a) => sum + a.max, 0);
    if (gradedMax > 0) {
      current += (earned / gradedMax) * c.weight;
      currentWeight += c.weight;
    }
    if (total > 0) {
      worst += (earned / total) * c.weight;
      remainingWeight += ((total - gradedMax) / total) * c.weight;
      remainingPoints += total - gradedMax;
    } else remainingWeight += c.weight;
  }
  return {
    configured,
    current: currentWeight ? (current / currentWeight) * 100 : null,
    worst: configured ? worst : null,
    best: configured ? worst + remainingWeight : null,
    required:
      configured && remainingWeight > 0
        ? Math.max(0, ((course.target - worst) / remainingWeight) * 100)
        : null,
    remainingPoints,
    incomplete: course.categories.some(
      (c) =>
        !assessments.some(
          (a) => a.courseId === course.id && a.categoryId === c.id,
        ),
    ),
  };
}
export function sortedTasks(tasks: Task[]) {
  const rank = { high: 0, normal: 1, low: 2 };
  return [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      (a.due || "9999").localeCompare(b.due || "9999") ||
      rank[a.priority] - rank[b.priority] ||
      a.id.localeCompare(b.id),
  );
}
export function eventOnDate(e: StudentEvent, day: string) {
  return (
    e.date === day ||
    (e.endDate !== undefined && day >= e.date && day <= e.endDate) ||
    (e.repeat === "weekly" &&
      day >= e.date &&
      parseISO(day).getDay() === parseISO(e.date).getDay())
  );
}
/** Greedy deadline-first suggestions. It never records a study session automatically. */
export function planStudy(
  s: Student,
  day = today(),
  hours = { start: 9, end: 18 },
  now = Date.now(),
) {
  const slots: {
    taskId: string;
    name: string;
    date: string;
    start: string;
    end: string;
  }[] = [];
  for (const t of sortedTasks(s.tasks).filter((t) => !t.done && t.effort > 0)) {
    const studied = s.sessions
      .filter((v) => v.taskId === t.id && v.mode === "focus")
      .reduce((sum, v) => sum + v.duration / 60000, 0);
    const planned = s.events
      .filter((e) => e.id.startsWith(`study:${t.id}:`) && e.date >= day)
      .reduce(
        (sum, e) =>
          sum +
          (Date.parse(`${e.date}T${e.end}:00+08:00`) -
            Date.parse(`${e.date}T${e.start}:00+08:00`)) /
            60000,
        0,
      );
    let left = Math.max(0, t.effort - studied - planned);
    for (let i = 0; i < 14 && left > 0; i++) {
      const date = format(addDays(parseISO(day), i), "yyyy-MM-dd");
      if (t.due && date > t.due) break;
      const occupied = [
        ...s.events.filter((e) => eventOnDate(e, date)),
        ...slots.filter((v) => v.date === date),
      ];
      for (
        let minute = hours.start * 60;
        minute + 25 <= hours.end * 60 && left > 0;
        minute += 30
      ) {
        const time = (m: number) =>
          `${Math.floor(m / 60)
            .toString()
            .padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
        const start = time(minute),
          end = time(minute + Math.min(25, left));
        if (Date.parse(`${date}T${start}:00+08:00`) < now) continue;
        if (
          occupied.some(
            (e) =>
              !e.start ||
              ("endDate" in e && e.endDate && e.endDate !== e.date) ||
              (start < e.end && end > e.start),
          )
        )
          continue;
        slots.push({ taskId: t.id, name: t.name, date, start, end });
        left -= Math.min(25, left);
      }
    }
  }
  return slots;
}
