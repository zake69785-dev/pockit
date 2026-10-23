import { budget } from "./budget";
import { accountBalance, financialAccounts } from "./accounts";
import { routeTotal, travel } from "./transport";
import { today, type Data } from "./model";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";

export function lowFunds(data: Data, day: string) {
  const b = budget(data, day);
  const essentialShortfall = Math.max(0, b.essential + b.transport - b.liquid);
  return {
    ...b,
    active: financialAccounts(data).lowFunds || essentialShortfall > 0,
    essentialShortfall,
    optionalRelief: b.leisure + b.plannedSavings,
    routes: [...data.transport.routes].sort(
      (a, c) => routeTotal(a) - routeTotal(c),
    ),
  };
}

/** Hypothetical expense only. Expected income is never treated as received. */
export function simulatePurchase(
  data: Data,
  price: number,
  accountId: string,
  day: string,
) {
  if (!Number.isSafeInteger(price) || price <= 0 || price > 100_000_000_000)
    throw new Error("Enter a positive purchase price.");
  if (!financialAccounts(data).accounts.some((a) => a.id === accountId))
    throw new Error("Choose an existing payment account.");
  const b = budget(data, day);
  const remainingAccount = accountBalance(data, accountId, day) - price;
  const start = today(),
    parsed = parseISO(day);
  if (
    !isValid(parsed) ||
    format(parsed, "yyyy-MM-dd") !== day ||
    day < start ||
    differenceInCalendarDays(parsed, parseISO(start)) > 730
  )
    throw new Error(
      "Choose a purchase date from today through the next two years.",
    );
  let priorTransport = 0;
  for (
    let date = start;
    date < day;
    date = format(addDays(parseISO(date), 1), "yyyy-MM-dd")
  )
    priorTransport += travel(data, date).remaining;
  const transport = b.transport + priorTransport;
  const remainingMoney = b.liquid - price;
  const available = b.available - priorTransport - price;
  return {
    remainingAccount,
    remainingMoney,
    available,
    daily: Math.floor(Math.max(0, available) / b.days),
    essentialShortfall: Math.max(0, b.essential + transport - remainingMoney),
    shortfall: Math.max(0, -available),
    accountShortfall: Math.max(0, -remainingAccount),
    transport,
    essentials: b.essential,
    saved: b.saved,
    plannedSavings: b.plannedSavings,
    affordable: available >= 0 && remainingAccount >= 0,
  };
}
