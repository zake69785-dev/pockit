import { addDays, addMonths, format, parseISO } from "date-fns";
import { type Data, type Frequency } from "./model";
export function occurrences(
  anchor: string,
  frequency: Frequency | undefined,
  from: string,
  to: string,
): string[] {
  if (anchor > to) return [];
  if (!frequency || frequency === "irregular")
    return anchor >= from ? [anchor] : [];
  const start = parseISO(anchor),
    result: string[] = [];
  // Domain dates are bounded to 2000–2100, so at most 37k daily iterations.
  for (let i = 0; i < 37000; i++) {
    const date = format(
      frequency === "monthly"
        ? addMonths(start, i)
        : addDays(
            start,
            i * (frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 14),
          ),
      "yyyy-MM-dd",
    );
    if (date > to) break;
    if (date >= from) result.push(date);
  }
  return result;
}
export function billOccurrences(data: Data, from: string, to: string) {
  return data.bills.flatMap((b) =>
    occurrences(
      b.date,
      b.frequency,
      from,
      b.until && b.until < to ? b.until : to,
    ).map((date) => {
      const paid = data.entries
        .filter(
          (e) =>
            e.kind === "expense" &&
            e.billId === b.id &&
            (e.billDate ?? b.date) === date,
        )
        .reduce((sum, e) => sum + e.amount, 0);
      return { ...b, date, paid, remaining: Math.max(0, b.amount - paid) };
    }),
  );
}
export function expectedOccurrences(data: Data, from: string, to: string) {
  const expected = data.expected.flatMap((e) =>
    occurrences(e.date, e.frequency, from, to).map((date) => ({
      ...e,
      date,
      source: `expected:${e.id}:${date}`,
    })),
  );
  if (data.allowance.amount > 0)
    expected.push(
      ...occurrences(
        data.allowance.anchor,
        data.allowance.frequency,
        from,
        to,
      ).map((date) => ({
        id: "allowance",
        name: "Allowance",
        date,
        amount: data.allowance.amount,
        source: `allowance:${date}`,
      })),
    );
  return expected.map((e) => ({
    ...e,
    received: data.entries.some(
      (t) => t.kind === "income" && t.source === e.source,
    ),
  }));
}
