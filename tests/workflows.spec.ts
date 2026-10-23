import { returningUser, goSection } from "./helpers";
import { test, expect, type Page } from "@playwright/test";
import { addDays, format } from "date-fns";
test.beforeEach(async ({ page }) => {
  await returningUser(page);
});
const today = format(new Date(), "yyyy-MM-dd");
async function transaction(
  page: Page,
  type: string,
  name: string,
  amount: string,
) {
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByLabel("Transaction type").selectOption(type);
  await page.getByLabel("Description", { exact: true }).fill(name);
  await page.getByLabel("Amount (PHP)", { exact: true }).fill(amount);
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
test("received income, budget, expenses, goals, transfers and persistence", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("total-cash")).toHaveText("₱0.00");
  await transaction(page, "income", "Weekly allowance", "3500");
  await expect(page.getByTestId("total-cash")).toHaveText("₱3,500.00");
  await page.getByRole("button", { name: "Adjust budget" }).click();
  await page
    .getByLabel("Next allowance date")
    .fill(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  await page.getByLabel("Leisure budget").fill("350");
  await page.getByRole("button", { name: "Save budget plan" }).click();
  await expect(page.getByTestId("safe-spend")).toHaveText("₱450.00");
  await transaction(page, "expense", "Lunch", "70");
  await expect(page.getByTestId("safe-spend")).toHaveText("₱440.00");
  await goSection(page, "Goals");
  await page.getByRole("button", { name: "New goal" }).click();
  await page.getByLabel("Goal name").fill("New laptop");
  await page.getByLabel("Target amount").fill("30000");
  await page.getByRole("button", { name: "Create goal" }).click();
  const goal = page.locator("section").filter({
    has: page.getByRole("heading", { name: "New laptop", exact: true }),
  });
  await goal.getByRole("button", { name: "Move money" }).click();
  await page.getByLabel("Amount (PHP)", { exact: true }).fill("500");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(goal).toContainText("₱500.00");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱3,430.00");
  await expect(page.getByTestId("safe-spend")).toHaveText("₱368.57");
  await page.reload();
  await expect(page.getByTestId("safe-spend")).toHaveText("₱368.57");
  await page.screenshot({
    path: "test-results/pockit-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/pockit-desktop.png",
    fullPage: true,
  });
});
test("expected income does not inflate cash and receiving is idempotent", async ({
  page,
}) => {
  await page.goto("/#/plan");
  await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Expected income", exact: true }),
    })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByLabel("Description").fill("Next allowance");
  await page.getByLabel("Amount (PHP)").fill("2000");
  await page
    .getByLabel("Expected date")
    .fill(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  await page.getByRole("button", { name: "Schedule income" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱0.00");
  await goSection(page, "Plan");
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Receive", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱2,000.00");
});
test("essential payment, history editing and delete", async ({ page }) => {
  await page.goto("/");
  await transaction(page, "income", "Cash", "1000");
  await goSection(page, "Plan");
  await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Essential reservations" }),
    })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByLabel("Description").fill("School books");
  await page.getByLabel("Amount (PHP)").fill("200");
  await page.getByRole("button", { name: "Reserve essential" }).click();
  await page
    .getByRole("button", { name: "Record an essential payment" })
    .click();
  await page.getByLabel("Description").fill("Books paid");
  await page.getByLabel("Amount (PHP)").fill("200");
  await page
    .getByLabel("Pay an essential")
    .selectOption({ label: "School books" });
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByText(/· Paid/)).toBeVisible();
  await goSection(page, "Activity");
  await page.getByRole("button", { name: /Books paid Essentials/ }).click();
  await page.getByLabel("Amount (PHP)").fill("150");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Books paid Essentials/ }),
  ).toContainText("₱150.00");
  await page.getByRole("button", { name: /Books paid Essentials/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete transaction" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Books paid Essentials/ }),
  ).toHaveCount(0);
});
test("validated backup export and restore, theme and offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await transaction(page, "income", "Backup allowance", "1234.56");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Color theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export financial backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await transaction(page, "expense", "After backup", "100");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Backup file").setInputFiles(path!);
  await page.getByRole("button", { name: "Replace data with backup" }).click();
  await expect(
    page.getByRole("heading", { name: "Ready to restore" }),
  ).toBeHidden();
  await page.getByLabel("Backup file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("Unsupported");
  await page.screenshot({
    path: "test-results/pockit-dark.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,234.56");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,234.56");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,234.56");
  await transaction(page, "expense", "Offline snack", "25");
  await page.reload();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,209.56");
});
test("small screens, reduced motion, form cancellation and no console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).not.toHaveURL(/#main/);
  for (const label of ["Home", "Plan", "Goals", "Activity", "Settings"]) {
    await goSection(page, label);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByLabel("Description").fill("Unsaved");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Close form" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(today).toMatch(/^\d{4}/);
});

test("emergency target, withdrawal limits and editing an earlier savings transfer", async ({
  page,
}) => {
  await page.goto("/");
  await transaction(page, "income", "Opening balance", "1000");
  await goSection(page, "Goals");
  await page.getByRole("button", { name: "Edit target" }).click();
  await page.getByLabel("Target amount").fill("10000");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("of ₱10,000.00")).toBeVisible();
  await page.getByRole("button", { name: "Move money" }).click();
  await page.getByLabel("Amount (PHP)").fill("200");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".goal-amount")).toContainText("₱200.00");
  await page.getByRole("button", { name: "Move money" }).click();
  await page.getByLabel("Transaction type").selectOption("withdraw");
  await page.getByLabel("Description").fill("Emergency withdrawal");
  await page.getByLabel("Amount (PHP)").fill("300");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("does not have enough");
  await page.getByLabel("Amount (PHP)").fill("50");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".goal-amount")).toContainText("₱150.00");
  await goSection(page, "Activity");
  await expect(
    page.getByRole("heading", { name: "The bigger picture." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Savings contribution Savings transfer/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Description").fill("First emergency deposit");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("total-cash")).toHaveText("₱1,000.00");
});
