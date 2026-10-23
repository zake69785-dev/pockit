import { addDays, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { budget, goalBalance } from "./budget";
import { money, type Data } from "./model";
import { routeTotal } from "./transport";

export type Range = "allowance" | "7d" | "30d" | "monthly";
export function rangeStart(data: Data, day: string, range: Range) {
  if (range === "allowance")
    return data.settings.cycleStart <= day ? data.settings.cycleStart : day;
  if (range === "monthly")
    return format(subMonths(startOfMonth(parseISO(day)), 11), "yyyy-MM-dd");
  return format(
    addDays(parseISO(day), range === "7d" ? -6 : -29),
    "yyyy-MM-dd",
  );
}
export function categorySpending(data: Data, start: string, end: string) {
  const totals = new Map<string, number>();
  for (const entry of data.entries)
    if (entry.kind === "expense" && entry.date >= start && entry.date <= end)
      totals.set(
        entry.category,
        (totals.get(entry.category) ?? 0) + entry.amount,
      );
  const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  return {
    total,
    rows: [...totals]
      .map(([name, amount]) => ({
        name,
        amount,
        percent: total ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}
export function monthlyFlow(data: Data, day: string) {
  const months = Array.from({ length: 12 }, (_, i) =>
    format(subMonths(startOfMonth(parseISO(day)), 11 - i), "yyyy-MM"),
  );
  return months.map((month) => ({
    month,
    income: data.entries
      .filter(
        (e) => e.kind === "income" && e.date.startsWith(month) && e.date <= day,
      )
      .reduce((s, e) => s + e.amount, 0),
    expense: data.entries
      .filter(
        (e) =>
          e.kind === "expense" && e.date.startsWith(month) && e.date <= day,
      )
      .reduce((s, e) => s + e.amount, 0),
  }));
}
export function historicalBalances(data: Data, day: string, range: Range) {
  const start = rangeStart(data, day, range);
  const dates = new Set([start, day]);
  for (const entry of data.entries)
    if (entry.date >= start && entry.date <= day) dates.add(entry.date);
  for (const adjustment of data.finance?.adjustments ?? [])
    if (adjustment.date >= start && adjustment.date <= day)
      dates.add(adjustment.date);
  if (range === "monthly")
    for (let i = 0; i < 12; i++)
      dates.add(
        format(subMonths(startOfMonth(parseISO(day)), i), "yyyy-MM-dd"),
      );
  return [...dates]
    .sort()
    .map((date) => ({ date, amount: budget(data, date).liquid }));
}
export function allocation(data: Data, day: string) {
  const b = budget(data, day);
  const emergency = Math.max(0, b.emergency);
  const savings = Math.max(0, b.saved - emergency) + b.plannedSavings;
  return {
    total: b.cash,
    shortfall: b.shortfall,
    rows: [
      { name: "Transportation", amount: b.transport },
      { name: "Essentials", amount: b.essential },
      { name: "Savings", amount: savings },
      { name: "Emergency reserve", amount: emergency },
      {
        name: "Flexible spending",
        amount: Math.max(0, b.available) + b.leisure,
      },
    ],
  };
}
export function goalProgress(data: Data, day: string) {
  return data.goals.map((g) => ({
    name: g.name,
    saved: goalBalance(data, g.id, day),
    target: g.target,
  }));
}
export function commuteComparison(data: Data) {
  const routes = [...data.transport.routes]
    .map((r) => ({ name: r.name, fare: routeTotal(r), id: r.id }))
    .sort((a, b) => a.fare - b.fare);
  const outbound = routes.find((r) => r.id === data.transport.outboundId);
  const inbound = routes.find((r) => r.id === data.transport.returnId);
  return {
    routes,
    outbound,
    inbound,
    roundTrip: outbound && inbound ? outbound.fare + inbound.fare : null,
    cheapest: routes[0],
    format: money,
  };
}
