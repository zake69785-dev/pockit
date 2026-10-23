import { freshFinance, id, today, type Account, type Data } from "./model";

export const financialAccounts = (data: Data) => data.finance ?? freshFinance();

/** Custody only: savings allocations never create a second asset. */
export function accountBalance(data: Data, accountId: string, day = today()) {
  const entries = data.entries.reduce((sum, entry) => {
    if ((entry.accountId ?? "legacy") !== accountId || entry.date > day)
      return sum;
    return (
      sum +
      (entry.kind === "income"
        ? entry.amount
        : entry.kind === "expense"
          ? -entry.amount
          : 0)
    );
  }, 0);
  const adjustments =
    financialAccounts(data)
      .adjustments?.filter((a) => a.accountId === accountId && a.date <= day)
      .reduce((sum, a) => sum + a.delta, 0) ?? 0;
  return (
    adjustments +
    financialAccounts(data).transfers.reduce((sum, transfer) => {
      if (transfer.date > day) return sum;
      return (
        sum +
        (transfer.to === accountId ? transfer.amount : 0) -
        (transfer.from === accountId ? transfer.amount : 0)
      );
    }, entries)
  );
}
export function adjustBalance(
  data: Data,
  accountId: string,
  target: number,
  reason: string,
  operationId: string,
) {
  data.finance ??= freshFinance();
  data.finance.adjustments ??= [];
  if (data.finance.adjustments.some((a) => a.id === operationId))
    throw new Error("This adjustment was already recorded.");
  if (
    !data.finance.accounts.some((a) => a.id === accountId) ||
    !Number.isSafeInteger(target) ||
    target < 0 ||
    target > 100_000_000_000
  )
    throw new Error("Choose an account and a valid actual balance.");
  const delta = target - accountBalance(data, accountId);
  if (!delta)
    throw new Error("This account already matches the actual balance.");
  data.finance.adjustments.push({
    id: operationId,
    accountId,
    delta,
    date: today(),
    reason: reason.trim(),
  });
}

export function addAccount(data: Data, name: string, type: Account["type"]) {
  if (type === "legacy") throw new Error("The legacy account already exists.");
  data.finance ??= freshFinance();
  data.finance.accounts.push({ id: id(), name: name.trim(), type });
}

export function transferAccounts(
  data: Data,
  from: string,
  to: string,
  amount: number,
  date: string,
  operationId: string,
) {
  data.finance ??= freshFinance();
  if (data.finance.transfers.some((t) => t.id === operationId))
    throw new Error("This transfer was already recorded.");
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000_000)
    throw new Error("Enter a positive transfer amount in centavos.");
  if (
    from === to ||
    ![from, to].every((key) => data.finance!.accounts.some((a) => a.id === key))
  )
    throw new Error("Choose two different existing accounts.");
  if (amount > accountBalance(data, from, date))
    throw new Error("The sending account does not have enough money.");
  data.finance.transfers.push({ id: operationId, from, to, amount, date });
}
