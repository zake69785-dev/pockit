import { addDays, format, parseISO } from "date-fns";
import { type Data, id, today } from "./model";
import { expectedOccurrences, occurrences } from "./schedule";
import { budget } from "./budget";
export function receive(
  data: Data,
  source: string,
  date: string,
  accountId?: string,
) {
  const item = expectedOccurrences(data, date, date).find(
    (e) => e.source === source,
  );
  if (!item || item.received)
    throw new Error("This expected income was already received or changed.");
  data.entries.push({
    ...(accountId ? { accountId } : {}),
    id: id(),
    date: today(),
    name: item.name,
    amount: item.amount,
    kind: "income",
    category: "Other",
    source,
  });
  if (item.id === "allowance" && data.allowance.frequency !== "irregular") {
    const after = date > today() ? date : today();
    const next = occurrences(
      data.allowance.anchor,
      data.allowance.frequency,
      format(addDays(parseISO(after), 1), "yyyy-MM-dd"),
      format(addDays(parseISO(after), 730), "yyyy-MM-dd"),
    )[0];
    if (next) data.settings.nextAllowance = next;
    data.settings.cycleStart = today();
  }
  // One-off expected reminders retain their original removal behavior.
  if (
    item.id !== "allowance" &&
    (!item.frequency || item.frequency === "irregular")
  )
    data.expected = data.expected.filter((e) => e.id !== item.id);
}
export function contribute(data: Data, plannedId: string) {
  const item = data.plannedSavings.find((p) => p.id === plannedId);
  if (!item || data.entries.some((e) => e.source === `saving:${plannedId}`))
    throw new Error("This contribution was already recorded.");
  const available = budget(
    {
      ...data,
      plannedSavings: data.plannedSavings.filter((p) => p.id !== plannedId),
    },
    today(),
  ).available;
  if (item.amount > Math.max(0, available))
    throw new Error(
      "This contribution would use money reserved for essentials or travel. Adjust the amount or plan first.",
    );
  data.entries.push({
    id: id(),
    name: "Planned savings contribution",
    amount: item.amount,
    kind: "save",
    goalId: item.goalId,
    category: "Other",
    date: today(),
    source: `saving:${item.id}`,
  });
}
