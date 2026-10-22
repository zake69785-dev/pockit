import { describe, it, expect } from "vitest";
import { addDays, format, parseISO } from "date-fns";
import { freshData, today } from "./model";
import { receive, contribute } from "./actions";
import { budget } from "./budget";
import { forecast } from "./forecast";
import { validate } from "./validation";
describe("scheduled money", () => {
  it("receives allowance exactly once and advances the weekly budget boundary", () => {
    const d = freshData();
    d.allowance = { amount: 100000, frequency: "weekly", anchor: today() };
    receive(d, `allowance:${today()}`, today());
    expect(d.settings.nextAllowance).toBe(
      format(addDays(parseISO(today()), 7), "yyyy-MM-dd"),
    );
    expect(budget(d, today()).cash).toBe(100000);
    expect(() => receive(d, `allowance:${today()}`, today())).toThrow(
      /already/,
    );
  });
  it("replaces a contribution reservation with savings without reducing cash twice", () => {
    const d = freshData();
    d.entries = [
      {
        id: "cash",
        name: "Cash",
        amount: 100000,
        date: today(),
        kind: "income",
        category: "Other",
      },
    ];
    d.plannedSavings = [
      { id: "plan", goalId: "emergency", amount: 10000, date: today() },
    ];
    const before = budget(d, today());
    contribute(d, "plan");
    const after = budget(d, today());
    expect(after.available).toBe(before.available);
    expect(after.cash).toBe(before.cash);
    expect(after.saved).toBe(10000);
    expect(after.plannedSavings).toBe(0);
    expect(() => contribute(d, "plan")).toThrow(/already/);
    expect(validate(d)).toBe(d);
  });
  it("protects essentials from a scheduled savings transfer", () => {
    const d = freshData();
    d.entries = [
      {
        id: "cash",
        name: "Cash",
        amount: 10000,
        date: today(),
        kind: "income",
        category: "Other",
      },
    ];
    d.bills = [{ id: "bill", name: "Food", amount: 9000, date: today() }];
    d.plannedSavings = [
      { id: "plan", goalId: "emergency", amount: 2000, date: today() },
    ];
    expect(() => contribute(d, "plan")).toThrow(/reserved/);
    expect(d.entries).toHaveLength(1);
  });
  it("forecast excludes expected income and deducts each reservation once", () => {
    const d = freshData();
    d.entries = [
      {
        id: "cash",
        name: "Cash",
        amount: 100000,
        date: today(),
        kind: "income",
        category: "Other",
      },
    ];
    const tomorrow = format(addDays(parseISO(today()), 1), "yyyy-MM-dd");
    d.bills = [{ id: "b", name: "Supplies", amount: 10000, date: tomorrow }];
    d.expected = [
      { id: "future", name: "Expected", amount: 500000, date: tomorrow },
    ];
    d.plannedSavings = [
      { id: "p", goalId: "emergency", amount: 20000, date: tomorrow },
    ];
    expect(forecast(d, today(), tomorrow).map((x) => x.balance)).toEqual([
      100000, 70000,
    ]);
    contribute(d, "p");
    expect(forecast(d, today(), tomorrow).at(-1)?.balance).toBe(70000);
  });
});
