import { getDay, parseISO } from "date-fns";
import { type Data, type DayPlan, type RouteProfile, id } from "./model";
export const routeTotal = (route?: RouteProfile) =>
  route?.legs.reduce((sum, leg) => sum + leg.fare, 0) ?? 0;
export function dayPlan(data: Data, date: string): DayPlan {
  return (
    data.transport.exceptions.find((e) => e.date === date) ??
    data.transport.weekly[getDay(parseISO(date))] ?? {
      mode: data.settings.schoolDays.includes(getDay(parseISO(date)))
        ? "campus"
        : "off",
      outboundId: data.transport.outboundId,
      returnId: data.transport.returnId,
    }
  );
}
export function travel(data: Data, date: string) {
  const plan = dayPlan(data, date),
    campus = plan.mode === "campus";
  const out = data.transport.routes.find(
      (r) => r.id === (plan.outboundId || data.transport.outboundId),
    ),
    back = data.transport.routes.find(
      (r) => r.id === (plan.returnId || data.transport.returnId),
    );
  const outbound = campus
      ? out
        ? routeTotal(out)
        : data.settings.outbound
      : 0,
    inbound = campus ? (back ? routeTotal(back) : data.settings.inbound) : 0;
  const outboundUsed = data.entries.some(
      (e) => e.trip?.date === date && e.trip.direction === "outbound",
    ),
    returnUsed = data.entries.some(
      (e) => e.trip?.date === date && e.trip.direction === "return",
    );
  const genericPaid = data.entries
    .filter(
      (e) =>
        e.date === date &&
        e.kind === "expense" &&
        e.category === "Transport" &&
        !e.trip,
    )
    .reduce((s, e) => s + e.amount, 0);
  return {
    plan,
    out,
    back,
    outbound,
    inbound,
    outboundUsed,
    returnUsed,
    total: outbound + inbound,
    remaining: Math.max(
      0,
      (outboundUsed ? 0 : outbound) + (returnUsed ? 0 : inbound) - genericPaid,
    ),
  };
}
export function recordTrip(
  data: Data,
  date: string,
  direction: "outbound" | "return",
  actual: number,
) {
  const trip = travel(data, date),
    route = direction === "outbound" ? trip.out : trip.back;
  if (
    data.entries.some(
      (e) => e.trip?.date === date && e.trip.direction === direction,
    )
  )
    throw new Error("This journey is already recorded. Edit it in Activity.");
  data.entries.push({
    id: id(),
    date,
    name:
      route?.name ??
      (direction === "outbound" ? "Journey to school" : "Journey home"),
    amount: actual,
    kind: "expense",
    category: "Transport",
    trip: { date, direction, routeId: route?.id ?? "" },
  });
}
