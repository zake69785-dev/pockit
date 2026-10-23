import { addDays, format, parseISO } from "date-fns";
import type { Data } from "./model";
import { billOccurrences, expectedOccurrences } from "./schedule";
import { eventOnDate, manilaDay, studentData } from "./student";
import { travel } from "./transport";
export type UnifiedEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  category: string;
  link: string;
  ownedId?: string;
  amount?: number;
};
export function unifiedEvents(
  data: Data,
  from: string,
  to: string,
): UnifiedEvent[] {
  const events: UnifiedEvent[] = [],
    s = studentData(data);
  const inRange = (date: string) => date >= from && date <= to;
  for (const a of s.assessments)
    if (
      a.dueAt &&
      !a.submitted &&
      (a.origin !== "canvas" ||
        !s.canvas.selectedCourses.length ||
        s.canvas.selectedCourses.includes(a.courseId))
    ) {
      const date = manilaDay(a.dueAt);
      if (inRange(date))
        events.push({
          id: `assignment:${a.id}`,
          name: a.name,
          date,
          time: new Date(a.dueAt).toLocaleTimeString("en-GB", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
          }),
          category: "assignment",
          link: "/school",
        });
    }
  for (const t of s.tasks)
    if (!t.done && t.due && inRange(t.due))
      events.push({
        id: `task:${t.id}`,
        name: t.name,
        date: t.due,
        time: "",
        category: "task",
        link: "/tasks",
      });
  for (
    let date = from, count = 0;
    date <= to && count < 732;
    date = format(addDays(parseISO(date), 1), "yyyy-MM-dd"), count++
  ) {
    for (const e of s.events)
      if (
        eventOnDate(e, date) &&
        (e.origin !== "canvas" ||
          !s.canvas.selectedCourses.length ||
          s.canvas.selectedCourses.includes(e.courseId))
      )
        events.push({
          id: `event:${e.id}:${date}`,
          ownedId: e.origin === "manual" ? e.id : undefined,
          name: e.name,
          date,
          time:
            date === e.date
              ? e.start
              : date === e.endDate && e.end
                ? `Until ${e.end}`
                : "",
          category: e.category,
          link: e.url ?? "/calendar",
        });
    const trip = travel(data, date);
    if (trip.plan.mode === "campus")
      events.push({
        id: `transport:${date}`,
        name: "Planned commute",
        date,
        time: "",
        category: "transport",
        link: `/transport?date=${date}`,
        amount: trip.remaining,
      });
  }
  for (const e of expectedOccurrences(data, from, to))
    events.push({
      id: `income:${e.source}`,
      name: `${e.name}${e.received ? " (received)" : " (expected)"}`,
      date: e.date,
      time: "",
      category: "allowance",
      link: "/plan",
      amount: e.amount,
    });
  for (const e of billOccurrences(data, from, to))
    events.push({
      id: `bill:${e.id}:${e.date}`,
      name: e.name,
      date: e.date,
      time: "",
      category: "bill",
      link: "/plan",
      amount: e.remaining,
    });
  for (const e of data.plannedSavings)
    if (inRange(e.date))
      events.push({
        id: `saving:${e.id}`,
        name: "Planned savings contribution",
        date: e.date,
        time: "",
        category: "savings",
        link: "/pockets",
        amount: e.amount,
      });
  for (const g of data.goals)
    if (g.deadline && inRange(g.deadline))
      events.push({
        id: `goal:${g.id}`,
        name: `${g.name} target date`,
        date: g.deadline,
        time: "",
        category: "savings",
        link: "/pockets",
      });
  return [...new Map(events.map((e) => [e.id, e])).values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.time.localeCompare(b.time) ||
      a.id.localeCompare(b.id),
  );
}
