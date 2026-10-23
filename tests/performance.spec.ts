import { test, expect } from "@playwright/test";
import { addDays, format } from "date-fns";
import { freshData, today } from "../src/domain/model";
import { returningUser, goSection } from "./helpers";

test.use({ reducedMotion: "no-preference" });
test("profile navigation and rendering with 1000 ledger records", async ({
  page,
  browserName,
}, testInfo) => {
  const d = freshData();
  d.entries = [
    {
      id: "opening",
      name: "Opening cash",
      date: format(addDays(new Date(), -180), "yyyy-MM-dd"),
      amount: 10000000,
      kind: "income",
      category: "Other",
    },
    ...Array.from({ length: 999 }, (_, i) => ({
      id: `expense-${i}`,
      name: `Recorded purchase ${i}`,
      date: format(addDays(new Date(), -(i % 180)), "yyyy-MM-dd"),
      amount: 1000,
      kind: "expense" as const,
      category: "Food" as const,
    })),
  ];
  d.bills = Array.from({ length: 12 }, (_, i) => ({
    id: `bill-${i}`,
    name: `Reservation ${i}`,
    amount: 10000,
    date: today(),
    frequency: "monthly" as const,
  }));
  d.transport.routes = Array.from({ length: 20 }, (_, i) => ({
    id: `route-${i}`,
    name: `Saved route ${i}`,
    favorite: false,
    legs: [
      { id: "jeep", mode: "Jeepney" as const, label: "", fare: 1500 },
      { id: "bus", mode: "Bus" as const, label: "", fare: 3000 },
    ],
  }));
  d.transport.outboundId = "route-0";
  d.transport.returnId = "route-1";
  d.transport.weekly = Array.from({ length: 7 }, () => ({
    mode: "campus" as const,
    outboundId: "route-0",
    returnId: "route-1",
  }));
  await returningUser(page, d);
  const timings: Record<string, number> = {};
  for (const route of ["Calendar", "Goals", "Activity", "Plan", "Home"]) {
    const start = Date.now();
    await goSection(page, route);
    await expect(page.locator(".route-view h1")).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    timings[route] = Date.now() - start;
    expect(timings[route]).toBeLessThan(3000);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const intervals: number[] = [];
        let last = performance.now();
        function frame(now: number) {
          intervals.push(now - last);
          last = now;
          window.scrollBy(0, 8);
          if (intervals.length < 60) requestAnimationFrame(frame);
          else resolve(intervals);
        }
        requestAnimationFrame(frame);
      }),
  );
  const sorted = frames.slice(1).sort((a, b) => a - b);
  const report = {
    browser: browserName,
    environment: "Windows automated browser; not iPhone hardware",
    records: 1000,
    routes: 20,
    recurringBills: 12,
    navigationMs: timings,
    scrollFrameMedianMs: sorted[Math.floor(sorted.length / 2)],
    scrollFrameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
  };
  await testInfo.attach("performance.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  console.log(JSON.stringify(report));
});
