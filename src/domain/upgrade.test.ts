import { describe, it, expect } from "vitest";
import { freshData, today } from "./model";
import { travel, recordTrip } from "./transport";
import { budget } from "./budget";
import { occurrences, billOccurrences } from "./schedule";
import { newDraft, setupData } from "./onboarding";
import { migrate } from "./migrate";
import { validate } from "./validation";
describe("Pockit 2 transport", () => {
  function fixture() {
    const d = freshData();
    d.transport.routes = [
      {
        id: "out",
        name: "School",
        favorite: true,
        legs: [
          { id: "a", mode: "Jeepney", label: "", fare: 1500 },
          { id: "b", mode: "Bus", label: "", fare: 3000 },
        ],
      },
      {
        id: "back",
        name: "Home",
        favorite: false,
        legs: [
          { id: "c", mode: "Mini Bus", label: "", fare: 2500 },
          { id: "d", mode: "Jeepney", label: "", fare: 1500 },
        ],
      },
    ];
    d.transport.outboundId = "out";
    d.transport.returnId = "back";
    d.transport.weekly = Array.from({ length: 7 }, () => ({
      mode: "campus",
      outboundId: "out",
      returnId: "back",
    }));
    return d;
  }
  it("adds multiple legs and different directions", () =>
    expect(travel(fixture(), today()).total).toBe(8500));
  it("releases the whole completed direction when actual fare is lower", () => {
    const d = fixture();
    recordTrip(d, today(), "outbound", 3000);
    expect(travel(d, today()).remaining).toBe(4000);
    expect(d.entries[0].amount).toBe(3000);
    expect(() => recordTrip(d, today(), "outbound", 3000)).toThrow(/already/);
  });
  it("cancels unused reservations without deleting recorded costs", () => {
    const d = fixture();
    recordTrip(d, today(), "outbound", 4500);
    d.transport.exceptions = [
      {
        date: today(),
        mode: "holiday",
        note: "Cancelled",
        outboundId: "out",
        returnId: "back",
      },
    ];
    expect(travel(d, today()).remaining).toBe(0);
    expect(d.entries).toHaveLength(1);
  });
  it("reserves no travel for online classes and supports extra campus visits", () => {
    const d = fixture();
    d.transport.weekly.forEach((p) => (p.mode = "online"));
    expect(travel(d, today()).remaining).toBe(0);
    d.transport.exceptions = [
      {
        date: today(),
        mode: "campus",
        note: "Library",
        outboundId: "back",
        returnId: "back",
      },
    ];
    expect(travel(d, today()).remaining).toBe(8000);
  });
  it("offsets legacy unlinked fares without double-counting", () => {
    const d = fixture();
    d.entries.push({
      id: "fare",
      name: "Fare",
      amount: 1500,
      kind: "expense",
      category: "Transport",
      date: today(),
    });
    expect(travel(d, today()).remaining).toBe(7000);
  });
});
describe("recurrence", () => {
  it("stops future bills while preserving prior unpaid occurrences", () => {
    const d = freshData();
    d.bills = [
      {
        id: "bill",
        name: "Mobile data",
        amount: 10000,
        date: "2026-01-01",
        frequency: "monthly",
        until: "2026-02-01",
      },
    ];
    expect(
      billOccurrences(d, "2026-01-01", "2026-12-31").map((b) => [
        b.date,
        b.remaining,
      ]),
    ).toEqual([
      ["2026-01-01", 10000],
      ["2026-02-01", 10000],
    ]);
  });
  it("anchors monthly dates instead of drifting after February", () =>
    expect(
      occurrences("2024-01-31", "monthly", "2024-01-01", "2024-04-30"),
    ).toEqual(["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]));
  it("links recurring bill payments to one occurrence", () => {
    const d = freshData();
    d.bills = [
      {
        id: "b",
        name: "Data",
        amount: 10000,
        date: "2026-01-01",
        frequency: "monthly",
      },
    ];
    d.entries = [
      {
        id: "p",
        name: "Paid",
        date: "2026-01-01",
        kind: "expense",
        category: "Essentials",
        billId: "b",
        amount: 10000,
      },
    ];
    expect(
      billOccurrences(d, "2026-01-01", "2026-02-01").map((b) => b.remaining),
    ).toEqual([0, 10000]);
  });
});
describe("opening balance safety", () => {
  it("adds separate money once and earmarks it without inflating cash", () => {
    const x = newDraft();
    Object.assign(x, {
      cash: "1000",
      wallet: "500",
      separate: "300",
      goalName: "Book",
      goalTarget: "1000",
      goalExisting: "100",
    });
    const d = setupData(x);
    expect(budget(d, today()).cash).toBe(180000);
    expect(budget(d, today()).saved).toBe(30000);
    expect(budget(d, today()).liquid).toBe(150000);
  });
  it("rejects duplicate or unaffordable savings allocations", () => {
    const x = newDraft();
    x.separate = "100";
    x.goalExisting = "200";
    expect(() => setupData(x)).toThrow();
    x.goalExisting = "0";
    x.emergencyAdd = "1";
    expect(() => setupData(x)).toThrow(/reserved/);
  });
  it("treats normal future allowance as expected only", () => {
    const x = newDraft();
    x.cash = "100";
    x.allowance = "10000";
    expect(budget(setupData(x), today()).cash).toBe(10000);
  });
  it("migrates legacy fares and history without changing balances", () => {
    const old = { ...freshData(), version: 1 };
    old.settings.outbound = 1500;
    old.settings.inbound = 2000;
    old.entries = [
      {
        id: "legacy",
        name: "Cash",
        date: today(),
        amount: 10000,
        category: "Other",
        kind: "income",
      },
    ];
    const migrated = validate(migrate(old));
    expect(migrated.entries).toEqual(old.entries);
    expect(migrated.onboardingComplete).toBe(true);
    expect(migrated.transport.routes[0].legs[0].fare).toBe(1500);
    expect(old.version).toBe(1);
  });
});
