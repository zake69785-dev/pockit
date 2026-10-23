import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addDays, format } from "date-fns";
import { freshData, today } from "../src/domain/model";
import { returningUser, goSection } from "./helpers";

test("nine-step onboarding resumes and counts separate savings exactly once", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A happier home for your money.",
  );
  await page.screenshot({
    path: "test-results/welcome-v2.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .setLegacyMode()
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Let’s make a little plan" }).click();
  await page.getByLabel("Cash you can spend").fill("1000");
  await page.getByLabel("Digital wallet you can spend").fill("500");
  await page.getByLabel("Money saved separately").fill("300");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // The next heading appears after the IndexedDB step write commits.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find your allowance rhythm.",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find your allowance rhythm.",
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Cash you can spend")).toHaveValue("1000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Normal allowance").fill("2500");
  await page.getByLabel("How often?").selectOption("weekly");
  await page
    .getByLabel("Next allowance expected")
    .fill(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Monday attendance").selectOption("campus");
  await page.getByLabel("Tuesday attendance").selectOption("online");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add transport leg" }).first().click();
  await page.getByLabel("Outbound fare 1").fill("15");
  await page.getByRole("button", { name: "Add transport leg" }).first().click();
  await page.getByLabel("Outbound leg 2").selectOption("Bus");
  await page.getByLabel("Outbound fare 2").fill("30");
  await page.getByRole("button", { name: "Add transport leg" }).last().click();
  await page.getByLabel("Return fare 1").fill("40");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Mobile data", exact: true })
    .click();
  await page.getByLabel("Amount (PHP)", { exact: true }).fill("100");
  await page
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("monthly");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Goal name (optional)").fill("A new laptop");
  await page.getByLabel("Goal target").fill("30000");
  await page.getByLabel("Already saved for this goal").fill("100");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("high");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".setup-review")).toContainText("₱1,800.00");
  await expect(page.locator(".setup-review")).toContainText("₱85.00");
  await page
    .getByRole("button", { name: "Use affordable savings suggestions" })
    .click();
  await page.getByLabel("Add to emergency reserve").fill("0");
  await page.getByLabel("Add to your goal").fill("0");
  await page.screenshot({
    path: "test-results/setup-review-v2.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start using Pockit" }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,800.00");
  await expect(page.getByTestId("safe-spend")).toHaveText("₱187.85");
  await page.reload();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,800.00");
  await goSection(page, "Goals");
  await expect(page.locator(".savings-summary")).toContainText("₱300.00");
  await page.screenshot({ path: "test-results/goals-v2.png", fullPage: true });
});

test("routes, ordered legs, actual fares and cancelled days update the same budget", async ({
  page,
}) => {
  const data = freshData();
  data.entries = [
    {
      id: "cash",
      name: "Opening cash",
      date: today(),
      amount: 100000,
      kind: "income",
      category: "Other",
    },
  ];
  await returningUser(page, data);
  await page.goto("/#/transport");
  await page.getByRole("button", { name: "New route" }).click();
  await page.getByLabel("Route name").fill("Jeepney and bus");
  await page.getByRole("button", { name: "Add transport leg" }).click();
  await page.getByLabel("Route fare 1").fill("15");
  await page.getByRole("button", { name: "Add transport leg" }).click();
  await page.getByLabel("Route leg 2").selectOption("Bus");
  await page.getByLabel("Route fare 2").fill("30");
  await page.getByRole("button", { name: "Move leg 2 up" }).click();
  await expect(page.getByLabel("Route leg 1")).toHaveValue("Bus");
  await page.getByRole("button", { name: "Save route", exact: true }).click();
  await page.getByRole("button", { name: "New route" }).click();
  await page.getByLabel("Route name").fill("Walk home");
  await page.getByRole("button", { name: "Add transport leg" }).click();
  await page.getByLabel("Route leg 1").selectOption("Walking");
  await expect(page.getByLabel("Route fare 1")).toBeDisabled();
  await page.getByRole("button", { name: "Save route", exact: true }).click();
  await page
    .getByLabel("Default outbound route")
    .selectOption({ label: "Jeepney and bus · ₱45.00" });
  await page
    .getByLabel("Default return route")
    .selectOption({ label: "Walk home · ₱0.00" });
  await page.getByLabel("Attendance for this date").selectOption("campus");
  await expect(page.locator(".day-editor")).toContainText(
    "₱45.00 still reserved",
  );
  await page
    .getByRole("button", { name: "Record outbound journey", exact: true })
    .click();
  await page.getByLabel("Actual fare paid").fill("30");
  await page
    .getByRole("button", { name: "Record actual journey", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Recorded outbound journey",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator(".day-editor")).toContainText(
    "₱0.00 still reserved",
  );
  await page.getByLabel("Attendance for this date").selectOption("holiday");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱970.00");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Jeepney and bus Transport/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/calendar-v2.png",
    fullPage: true,
  });
  await page.goto("/#/transport");
  await page
    .getByLabel("Travel date")
    .fill(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  await page.getByLabel("Attendance for this date").selectOption("campus");
  await expect(page.locator(".day-editor")).toContainText(
    "₱45.00 still reserved",
  );
  await page.getByLabel("Attendance for this date").selectOption("online");
  await expect(page.locator(".day-editor")).toContainText(
    "₱0.00 still reserved",
  );
  await page.locator("summary").filter({ hasText: "Jeepney and bus" }).click();
  await page
    .getByRole("button", { name: "Favorite Jeepney and bus", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Unfavorite Jeepney and bus",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit route", exact: true }).click();
  await page.getByRole("button", { name: "Move leg 1 down" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Close form" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Close form" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.screenshot({
    path: "test-results/transport-v2.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .setLegacyMode()
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("recurring income and planned savings keep cash and transfers separate", async ({
  page,
  context,
}) => {
  const data = freshData();
  data.allowance = { amount: 100000, frequency: "weekly", anchor: today() };
  data.settings.nextAllowance = today();
  await returningUser(page, data);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.locator(".day-events")).toContainText("Received");
  await expect(
    page.getByRole("button", { name: "Receive", exact: true }),
  ).toHaveCount(0);
  await goSection(page, "Goals");
  await page
    .getByRole("button", { name: "Plan contribution", exact: true })
    .click();
  await page.getByLabel("Contribution amount").fill("100");
  await page.getByRole("button", { name: "Save planned contribution" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,000.00");
  const safe = await page.getByTestId("safe-spend").textContent();
  await goSection(page, "Goals");
  await page.getByRole("button", { name: "Contribute", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Contribute", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,000.00");
  await expect(page.getByTestId("safe-spend")).toHaveText(safe!);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByTestId("total-cash")).toBeVisible();
  await context.setOffline(true);
  for (const route of [
    "Plan",
    "Calendar",
    "Goals",
    "Activity",
    "Settings",
    "Home",
  ]) {
    await goSection(page, route);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.reload();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,000.00");
});

test("version-one backup restores without setup or changes to history", async ({
  page,
}) => {
  const old = { ...freshData(), version: 1 };
  old.entries = [
    {
      id: "old-income",
      name: "Original income",
      amount: 150000,
      date: today(),
      kind: "income",
      category: "Other",
    },
  ];
  old.settings.outbound = 1500;
  old.settings.inbound = 2000;
  await page.goto("/");
  await page.getByRole("link", { name: /Already have a backup/ }).click();
  await page.getByLabel("Backup file").setInputFiles({
    name: "pockit-1.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.getByRole("button", { name: "Replace data with backup" }).click();
  await expect(
    page.getByRole("heading", { name: "Ready to restore" }),
  ).toBeHidden();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,500.00");
  await page.reload();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,500.00");
  await page.goto("/#/transport");
  await expect(page.locator(".route-profile")).toHaveCount(2);
});
