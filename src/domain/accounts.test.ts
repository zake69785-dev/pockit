import { describe, expect, it } from "vitest";
import { freshData, today } from "./model";
import {
  accountBalance,
  adjustBalance,
  addAccount,
  financialAccounts,
  transferAccounts,
} from "./accounts";
import { budget } from "./budget";
import { lowFunds, simulatePurchase } from "./assistance";
import { validate } from "./validation";
import { addDays, format, parseISO } from "date-fns";
import { recordTrip, travel } from "./transport";

function fixture() {
  const d = freshData();
  d.entries.push({
    id: "income",
    name: "Allowance",
    date: today(),
    amount: 10000,
    kind: "income",
    category: "Other",
  });
  d.entries.push({
    id: "saved",
    name: "Emergency",
    date: today(),
    amount: 2000,
    kind: "save",
    category: "Other",
    goalId: "emergency",
  });
  return d;
}
describe("account custody and assistance", () => {
  it("reconciles corrections without recording income or expense", () => {
    const d = fixture(),
      original = structuredClone(d.entries);
    adjustBalance(d, "legacy", 9000, "Counted wallet", "correction");
    expect(accountBalance(d, "legacy")).toBe(9000);
    expect(budget(d, today()).cash).toBe(9000);
    expect(d.entries).toEqual(original);
    expect(() =>
      adjustBalance(d, "legacy", 9000, "Retry", "correction"),
    ).toThrow(/already/);
    expect(validate(d)).toBe(d);
  });
  it("charges the selected commute account once and undo restores its reservation", () => {
    const d = fixture();
    addAccount(d, "GCash", "gcash");
    const wallet = d.finance!.accounts[1].id;
    transferAccounts(d, "legacy", wallet, 1000, today(), "fund-wallet");
    d.settings.schoolDays = [0, 1, 2, 3, 4, 5, 6];
    d.settings.outbound = 200;
    d.settings.inbound = 300;
    recordTrip(d, today(), "outbound", 150, wallet);
    expect(accountBalance(d, wallet)).toBe(850);
    expect(travel(d, today()).remaining).toBe(300);
    expect(() => recordTrip(d, today(), "outbound", 150, wallet)).toThrow(
      /already/,
    );
    expect(
      financialAccounts(d).accounts.reduce(
        (sum, a) => sum + accountBalance(d, a.id),
        0,
      ),
    ).toBe(budget(d, today()).cash);
    d.entries = d.entries.filter((e) => !e.trip);
    expect(accountBalance(d, wallet)).toBe(1000);
    expect(travel(d, today()).remaining).toBe(500);
  });
  it("retains intervening commute reservations when simulating a later purchase", () => {
    const d = fixture();
    d.settings.schoolDays = [0, 1, 2, 3, 4, 5, 6];
    d.settings.outbound = 100;
    d.settings.inbound = 100;
    const later = format(addDays(parseISO(today()), 2), "yyyy-MM-dd");
    const now = simulatePurchase(d, 1000, "legacy", today());
    const future = simulatePurchase(d, 1000, "legacy", later);
    expect(future.transport).toBe(now.transport);
    expect(future.available).toBe(now.available);
    expect(() => simulatePurchase(d, 100, "legacy", "bad-date")).toThrow();
  });
  it("preserves legacy cash including protected savings without inventing balances", () => {
    const d = fixture();
    delete d.finance;
    expect(accountBalance(d, "legacy")).toBe(10000);
    expect(budget(d, today()).liquid).toBe(8000);
    expect(financialAccounts(d).accounts).toHaveLength(1);
    expect(d.finance).toBeUndefined();
  });
  it("reconciles transfers, preserves income and savings, and rejects duplicate operations", () => {
    const d = fixture();
    addAccount(d, "GCash", "gcash");
    const gcash = d.finance!.accounts[1].id;
    const before = budget(d, today());
    transferAccounts(d, "legacy", gcash, 5001, today(), "transfer");
    expect(accountBalance(d, gcash)).toBe(5001);
    expect(accountBalance(d, "legacy")).toBe(4999);
    expect(budget(d, today())).toEqual(before);
    expect(() =>
      transferAccounts(d, "legacy", gcash, 100, today(), "transfer"),
    ).toThrow(/already/);
    expect(() =>
      transferAccounts(d, "legacy", gcash, 5000, today(), "other"),
    ).toThrow(/enough/);
    expect(() =>
      transferAccounts(d, gcash, gcash, 100, today(), "same"),
    ).toThrow(/different/);
    expect(validate(d)).toBe(d);
  });
  it("does not count save and withdraw as physical account movements", () => {
    const d = fixture();
    d.entries.push({
      id: "withdraw",
      name: "Release savings",
      amount: 1000,
      date: today(),
      kind: "withdraw",
      category: "Other",
      goalId: "emergency",
    });
    expect(accountBalance(d, "legacy")).toBe(budget(d, today()).cash);
    expect(budget(d, today()).saved).toBe(1000);
  });
  it("reports essentials shortfall independently from adjustable allocations", () => {
    const d = fixture();
    d.bills.push({ id: "bill", name: "Food", amount: 9000, date: today() });
    d.settings.leisure = 3000;
    const result = lowFunds(d, today());
    expect(result.active).toBe(true);
    expect(result.essentialShortfall).toBe(1000);
    expect(result.optionalRelief).toBe(3000);
    expect(result.shortfall).toBe(4000);
  });
  it("handles zero funds and manual mode without inventing future income", () => {
    const d = freshData();
    d.allowance.amount = 100000;
    expect(lowFunds(d, today()).liquid).toBe(0);
    d.finance!.lowFunds = true;
    expect(lowFunds(d, today()).active).toBe(true);
  });
  it("simulates a purchase without touching the ledger or protected savings", () => {
    const d = fixture(),
      copy = structuredClone(d);
    const result = simulatePurchase(d, 8500, "legacy", today());
    expect(result.remainingAccount).toBe(1500);
    expect(result.remainingMoney).toBe(-500);
    expect(result.saved).toBe(2000);
    expect(result.affordable).toBe(false);
    expect(result.shortfall).toBe(500);
    expect(d).toEqual(copy);
    expect(() => simulatePurchase(d, 0.1, "legacy", today())).toThrow();
  });
  it("detects insufficient selected account even with sufficient combined money", () => {
    const d = fixture();
    addAccount(d, "Cash", "cash");
    const result = simulatePurchase(d, 100, d.finance!.accounts[1].id, today());
    expect(result.available).toBe(7900);
    expect(result.accountShortfall).toBe(100);
    expect(result.affordable).toBe(false);
  });
  it("rejects malformed account references and transfer journals", () => {
    const d = fixture();
    d.entries[0].accountId = "missing";
    expect(() => validate(d)).toThrow(/account/);
    delete d.entries[0].accountId;
    d.finance!.transfers.push({
      id: "bad",
      from: "legacy",
      to: "missing",
      amount: 100,
      date: today(),
    });
    expect(() => validate(d)).toThrow(/transfer/);
  });
});
