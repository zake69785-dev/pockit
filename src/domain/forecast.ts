import { addDays, format, parseISO } from "date-fns";
import { type Data } from "./model";
import { budget } from "./budget";
import { travel } from "./transport";
import { billOccurrences } from "./schedule";
export function forecast(data: Data, from: string, to: string) {
  const current = budget(data, from);
  let transport = 0;
  const bills = billOccurrences(data, "2000-01-01", to),
    planned = data.plannedSavings.filter(
      (p) => !data.entries.some((e) => e.source === `saving:${p.id}`),
    );
  const result: { date: string; balance: number }[] = [];
  for (let i = 0; i < 731; i++) {
    const date = format(addDays(parseISO(from), i), "yyyy-MM-dd");
    if (date > to) break;
    transport += travel(data, date).remaining;
    const essential = bills
        .filter((b) => b.date <= date)
        .reduce((s, b) => s + b.remaining, 0),
      saving = planned
        .filter((p) => p.date <= date)
        .reduce((s, p) => s + p.amount, 0);
    result.push({
      date,
      balance:
        current.liquid - transport - essential - current.leisure - saving,
    });
  }
  return result;
}
