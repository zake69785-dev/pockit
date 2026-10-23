import { choose } from "./helpers";
import { test, expect } from "@playwright/test";
import { addDays, format, parseISO } from "date-fns";
import { returningUser } from "./helpers";
import { today } from "../src/domain/model";

test("manual academics, grades and linked tasks persist offline", async ({
  page,
  context,
}) => {
  await returningUser(page);
  await page.getByRole("link", { name: "School", exact: true }).click();
  await page.getByText("Add a course", { exact: true }).click();
  await page.getByLabel("New course name").fill("Physics");
  await page.getByRole("button", { name: "Add course", exact: true }).click();
  await expect(
    page.getByText("Physics · No grades yet", { exact: true }),
  ).toBeVisible();
  await page.getByText("Add an assignment", { exact: true }).click();
  await page.getByLabel("New assignment name").fill("Lab report");
  await page.getByLabel("Maximum points", { exact: true }).fill("100");
  await page.getByLabel("Due date and time (Manila)").fill(`${today()}T23:30`);
  await page
    .getByRole("button", { name: "Add assignment", exact: true })
    .click();
  const assignment = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Lab report · To do" }),
  });
  await assignment.locator("summary").click();
  await assignment
    .getByLabel("Earned points (blank means ungraded)")
    .fill("80");
  await assignment.getByRole("button", { name: "Save assignment" }).click();
  await expect(
    page.getByText("Physics · 80.0% current", { exact: true }),
  ).toBeVisible();
  await assignment
    .getByRole("button", { name: "Create linked study task" })
    .click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Study: Lab report", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Study: Lab report", exact: true })
    .click();
  await choose(page.getByLabel("Task view"), "completed");
  await expect(
    page.getByRole("checkbox", { name: "Study: Lab report", exact: true }),
  ).toBeChecked();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await choose(page.getByLabel("Task view"), "completed");
  await expect(
    page.getByRole("checkbox", { name: "Study: Lab report", exact: true }),
  ).toBeChecked();
  await page.getByRole("link", { name: "School", exact: true }).click();
  await expect(
    page.getByText("Physics · 80.0% current", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sync Canvas", exact: true }).click();
  await expect(
    page.getByText(/FEU sync needs an approved protected service/),
  ).toBeVisible();
  await context.setOffline(false);
});

test("calendar ownership, recurring events and suspended study timer", async ({
  page,
}) => {
  const tomorrow = format(addDays(parseISO(today()), 1), "yyyy-MM-dd");
  await returningUser(page);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByText("Add or edit an event", { exact: true }).click();
  await page.getByLabel("Event name", { exact: true }).fill("Physics class");
  await page.getByLabel("Event date", { exact: true }).fill(tomorrow);
  await page.getByLabel("Start time (blank for all day)").fill("09:00");
  await page.getByLabel("End time (blank for all day)").fill("10:00");
  await choose(page.getByLabel("Repeat event"), "weekly");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Starting date").fill(tomorrow);
  await choose(page.getByLabel("Calendar view"), "day");
  await expect(
    page.locator(".unified-events").getByText("Physics class", { exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Edit event", exact: true }).click();
  await page.getByLabel("Event name", { exact: true }).fill("Physics lab");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(
    page.locator(".unified-events").getByText("Physics lab", { exact: true }),
  ).toHaveCount(1);
  for (const view of ["week", "month", "agenda"]) {
    await choose(page.getByLabel("Calendar view"), view);
    await expect(
      page
        .locator(".unified-events")
        .getByText("Physics lab", { exact: true })
        .first(),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByLabel("Duration (minutes)").fill("1");
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  // Simulate elapsed wall-clock time only in this isolated test database.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("pockit-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction("state", "readwrite"),
          store = tx.objectStore("state"),
          read = store.get("main");
        read.onsuccess = () => {
          const row = read.result;
          row.data.student.timer.startedAt = Date.now() - 120000;
          store.put(row);
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await expect(
    page.getByText("Total focus time: 1 minutes.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Total focus time: 1 minutes.", { exact: true }),
  ).toBeVisible();
});
