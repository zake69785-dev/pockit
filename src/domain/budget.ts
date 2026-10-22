import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Data } from "./model";
import { travel } from "./transport";
import { billOccurrences } from "./schedule";
export const goalBalance = (data: Data, goalId: string, day = "9999-12-31") =>
  data.entries
    .filter((e) => e.goalId === goalId && e.date <= day)
    .reduce(
      (sum, e) =>
        sum +
        (e.kind === "save" ? e.amount : e.kind === "withdraw" ? -e.amount : 0),
      0,
    );
export function budget(data: Data, day: string) {
  const entries = data.entries.filter((e) => e.date <= day);
  const cash = entries.reduce(
    (sum, e) =>
      sum +
      (e.kind === "income" ? e.amount : e.kind === "expense" ? -e.amount : 0),
    0,
  );
  const saved = data.goals.reduce(
    (sum, g) => sum + goalBalance(data, g.id, day),
    0,
  );
  const days = Math.max(
    1,
    differenceInCalendarDays(
      parseISO(data.settings.nextAllowance),
      parseISO(day),
    ),
  );
  const end = format(addDays(parseISO(day), days), "yyyy-MM-dd");
  const essential = billOccurrences(
    { ...data, entries },
    "2000-01-01",
    format(addDays(parseISO(end), -1), "yyyy-MM-dd"),
  ).reduce((sum, b) => sum + b.remaining, 0);
  let transport = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(parseISO(day), i),
      key = format(date, "yyyy-MM-dd");
    transport += travel({ ...data, entries }, key).remaining;
  }
  const leisureSpent = entries
    .filter(
      (e) =>
        e.kind === "expense" &&
        e.category === "Leisure" &&
        e.date >= data.settings.cycleStart,
    )
    .reduce((s, e) => s + e.amount, 0);
  const leisure = Math.max(0, data.settings.leisure - leisureSpent);
  const plannedSavings = data.plannedSavings
    .filter(
      (p) =>
        p.date < end && !entries.some((e) => e.source === `saving:${p.id}`),
    )
    .reduce((sum, p) => sum + p.amount, 0);
  const liquid = cash - saved,
    available = liquid - essential - transport - leisure - plannedSavings;
  return {
    cash,
    saved,
    liquid,
    essential,
    transport,
    leisure,
    leisureSpent,
    plannedSavings,
    emergency: data.goals
      .filter((g) => g.emergency)
      .reduce((s, g) => s + goalBalance(data, g.id, day), 0),
    available,
    days,
    daily: Math.floor(Math.max(0, available) / days),
    shortfall: Math.max(0, -available),
    overdue: data.settings.nextAllowance <= day,
  };
}
