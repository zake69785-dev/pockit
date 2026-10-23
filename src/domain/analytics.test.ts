import { describe, expect, it } from "vitest";
import { freshData } from "./model";
import {
  allocation,
  categorySpending,
  historicalBalances,
  monthlyFlow,
} from "./analytics";

describe("recorded financial insights", () => {
  it("counts only actual income and spending, without transfers or saving twice", () => {
    const data = freshData();
    data.entries = [
      {
        id: "i",
        date: "2026-10-01",
        name: "Allowance",
        amount: 100000,
        kind: "income",
        category: "Other",
      },
      {
        id: "f",
        date: "2026-10-02",
        name: "Lunch",
        amount: 25000,
        kind: "expense",
        category: "Food",
      },
      {
        id: "s",
        date: "2026-10-03",
        name: "Saving",
        amount: 10000,
        kind: "save",
        category: "Other",
        goalId: "emergency",
      },
    ];
    data.finance!.transfers.push({
      id: "t",
      from: "legacy",
      to: "cash",
      amount: 5000,
      date: "2026-10-04",
    });
    expect(categorySpending(data, "2026-10-01", "2026-10-04")).toMatchObject({
      total: 25000,
      rows: [{ name: "Food", amount: 25000, percent: 100 }],
    });
    const october = monthlyFlow(data, "2026-10-04").at(-1);
    expect(october).toMatchObject({ income: 100000, expense: 25000 });
    expect(historicalBalances(data, "2026-10-04", "7d").at(-1)?.amount).toBe(
      65000,
    );
    expect(
      allocation(data, "2026-10-04").rows.find(
        (r) => r.name === "Emergency reserve",
      )?.amount,
    ).toBe(10000);
  });
  it("handles empty data and zero-income months", () => {
    const data = freshData();
    data.entries.push({
      id: "e",
      date: "2026-10-04",
      name: "Fare",
      amount: 300,
      kind: "expense",
      category: "Transport",
    });
    expect(categorySpending(data, "2026-09-01", "2026-09-30").total).toBe(0);
    expect(monthlyFlow(data, "2026-10-04").at(-1)).toMatchObject({
      income: 0,
      expense: 300,
    });
  });
});
