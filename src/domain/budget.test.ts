import { describe, it, expect } from "vitest";
import { budget, goalBalance } from "./budget";
import { cents, freshData, type Entry } from "./model";
import { validate } from "./validation";
const day = "2026-01-05";
function fixture() {
  const d = freshData();
  d.settings = { ...d.settings, nextAllowance: "2026-01-12", cycleStart: day };
  d.entries = [
    {
      id: "income",
      date: day,
      name: "Allowance",
      kind: "income",
      amount: 100000,
      category: "Other",
    },
  ];
  return d;
}
const expense = (
  amount: number,
  category: Entry["category"] = "Food",
): Entry => ({
  id: "e",
  date: day,
  name: "Lunch",
  kind: "expense",
  amount,
  category,
});
describe("centavo arithmetic", () => {
  it("parses decimal strings exactly", () => {
    expect(cents("0.29")).toBe(29);
    expect(cents("1234.5")).toBe(123450);
    expect(cents("0001.01")).toBe(101);
  });
  it.each(["1.001", "-1", "NaN", "1e6", "", "1,000", "9007199254740991"])(
    "rejects unsafe input %s",
    (input) => expect(() => cents(input)).toThrow(),
  );
});
describe("budget", () => {
  it("uses received cash only and excludes the next allowance day", () => {
    const d = fixture();
    d.expected.push({
      id: "future",
      name: "Next allowance",
      date: "2026-01-12",
      amount: 1000000,
    });
    const b = budget(d, day);
    expect(b.cash).toBe(100000);
    expect(b.days).toBe(7);
    expect(b.daily).toBe(14285);
    expect(b.daily * b.days).toBeLessThanOrEqual(b.available);
  });
  it("counts outbound and return trips for school days, releasing paid fares", () => {
    const d = fixture();
    d.settings.schoolDays = [1, 3, 5];
    d.settings.outbound = 2000;
    d.settings.inbound = 2500;
    expect(budget(d, day).transport).toBe(13500);
    d.entries.push(expense(2000, "Transport"));
    expect(budget(d, day).transport).toBe(11500);
    expect(budget(d, day).available).toBe(86500);
  });
  it("reserves overdue and partial essentials once, excluding bills at the boundary", () => {
    const d = fixture();
    d.bills = [
      { id: "bill", name: "Tuition", date: "2026-01-01", amount: 20000 },
      { id: "later", name: "Book", date: "2026-01-12", amount: 5000 },
    ];
    d.entries.push({ ...expense(5000, "Essentials"), billId: "bill" });
    const b = budget(d, day);
    expect(b.essential).toBe(15000);
    expect(b.available).toBe(80000);
  });
  it("keeps transfers out of cash and expenses and carries savings across months", () => {
    const d = fixture();
    d.entries.push(
      {
        id: "save",
        name: "Rainy day",
        kind: "save",
        goalId: "emergency",
        date: day,
        amount: 20000,
        category: "Other",
      },
      {
        id: "withdraw",
        name: "Move back",
        kind: "withdraw",
        goalId: "emergency",
        date: "2026-02-01",
        amount: 5000,
        category: "Other",
      },
    );
    expect(budget(d, day).cash).toBe(100000);
    expect(budget(d, day).saved).toBe(20000);
    expect(goalBalance(d, "emergency")).toBe(15000);
    expect(budget(d, "2026-03-01").saved).toBe(15000);
  });
  it("rebudgets immediately after discretionary spending", () => {
    const d = fixture();
    d.entries.push(expense(3000));
    expect(budget(d, day).daily).toBe(13857);
  });
  it("protects leisure once and ignores previous cycle spending", () => {
    const d = fixture();
    d.settings.leisure = 10000;
    d.entries.push(
      { ...expense(2000, "Leisure"), id: "old", date: "2026-01-04" },
      expense(3000, "Leisure"),
    );
    const b = budget(d, day);
    expect(b.leisure).toBe(7000);
    expect(b.available).toBe(88000);
  });
  it("handles overspending and an overdue allowance without negative daily limits", () => {
    const d = fixture();
    d.entries.push(expense(120000));
    d.settings.nextAllowance = day;
    const b = budget(d, day);
    expect(b.days).toBe(1);
    expect(b.daily).toBe(0);
    expect(b.shortfall).toBe(20000);
    expect(b.overdue).toBe(true);
  });
  it("handles a leap-day horizon", () => {
    const d = fixture();
    d.settings.nextAllowance = "2024-03-01";
    expect(budget(d, "2024-02-28").days).toBe(2);
  });
});
describe("backup validation", () => {
  it("accepts a valid state and rejects versions and missing structure", () => {
    expect(validate(fixture()).version).toBe(2);
    expect(() => validate({ version: 2 })).toThrow();
    expect(() => validate(null)).toThrow();
  });
  it("rejects future received income and fractional centavos", () => {
    const d = fixture();
    d.entries[0].date = "2099-01-01";
    expect(() => validate(d)).toThrow();
    d.entries[0].date = day;
    d.entries[0].amount = 0.5;
    expect(() => validate(d)).toThrow();
  });
  it("rejects duplicate IDs, impossible dates and dangling references", () => {
    const d = fixture();
    d.entries.push({ ...d.entries[0] });
    expect(() => validate(d)).toThrow();
    d.entries.pop();
    d.entries[0].date = "2026-02-30";
    expect(() => validate(d)).toThrow();
    d.entries[0] = { ...expense(1, "Essentials"), billId: "missing" };
    expect(() => validate(d)).toThrow();
  });
  it("rejects a withdrawal before its deposit even when final balance is positive", () => {
    const d = fixture();
    d.entries.push(
      {
        id: "out",
        name: "Withdrawal",
        kind: "withdraw",
        goalId: "emergency",
        amount: 100,
        category: "Other",
        date: day,
      },
      {
        id: "in",
        name: "Saving",
        kind: "save",
        goalId: "emergency",
        amount: 200,
        category: "Other",
        date: "2026-01-06",
      },
    );
    expect(() => validate(d)).toThrow(/withdrawal/);
  });
});
