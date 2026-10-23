import { addDays, format, parseISO } from "date-fns";
import type { Data } from "./model";
import { budget } from "./budget";
import { unifiedEvents } from "./calendar";
import { studentData } from "./student";
import { travel } from "./transport";
export function dailyBriefing(data: Data, day: string) {
  const b = budget(data, day),
    s = studentData(data),
    end = format(addDays(parseISO(day), 7), "yyyy-MM-dd");
  const events = unifiedEvents(data, day, end);
  const notifications = events
    .filter((e) =>
      ["assignment", "task", "class", "bill", "allowance", "study"].includes(
        e.category,
      ),
    )
    .map((e) => ({
      id: `notice:${e.id}`,
      name: e.name,
      date: e.date,
      link: e.link,
      urgent: e.date <= day,
    }));
  for (const task of s.tasks.filter((t) => !t.done && t.due && t.due < day))
    notifications.push({
      id: `overdue:${task.id}:${task.due}`,
      name: `Overdue: ${task.name}`,
      date: task.due,
      link: "/tasks",
      urgent: true,
    });
  for (const a of s.assessments.filter(
    (a) =>
      !a.submitted &&
      a.dueAt &&
      Date.parse(a.dueAt) < Date.parse(`${day}T00:00:00+08:00`),
  ))
    notifications.push({
      id: `overdue-assignment:${a.id}`,
      name: `Overdue: ${a.name}`,
      date: day,
      link: "/school",
      urgent: true,
    });
  if (b.shortfall > 0)
    notifications.push({
      id: `low-funds:${day}`,
      name: "Your planned allocations exceed available money.",
      date: day,
      link: "/money",
      urgent: true,
    });
  return {
    day,
    liquid: b.liquid,
    daily: b.daily,
    commute: travel(data, day).remaining,
    nextAllowance: data.settings.nextAllowance,
    classes: events.filter((e) => e.category === "class" && e.date === day),
    tasks: events.filter((e) => e.category === "task" && e.date === day),
    notifications: notifications
      .filter((n) => !s.dismissed.includes(n.id))
      .sort(
        (a, b) =>
          Number(b.urgent) - Number(a.urgent) || a.date.localeCompare(b.date),
      ),
    lastCanvasSync: s.canvas.lastSync,
  };
}
