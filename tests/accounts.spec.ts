import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { returningUser } from "./helpers";
import { freshData, today } from "../src/domain/model";

test("accounts reconcile, simulations stay read-only and confirmation persists offline", async ({
  page,
  context,
}) => {
  const d = freshData();
  d.entries.push({
    id: "income",
    name: "Recorded allowance",
    date: today(),
    kind: "income",
    category: "Other",
    amount: 100000,
  });
  await returningUser(page, d);
  await page
    .getByRole("link", {
      name: "Accounts · Low Funds Mode · Can I afford this?",
    })
    .click();
  await page.getByText("Add an account", { exact: true }).click();
  await page.getByLabel("Account name").fill("GCash");
  await page.getByLabel("Account type").selectOption("gcash");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Account added" }),
  ).toBeVisible();
  await page.getByText("Transfer between accounts", { exact: true }).click();
  await page
    .getByLabel("To account", { exact: true })
    .selectOption({ label: "GCash" });
  await page.getByLabel("Transfer amount (PHP)").fill("400.01");
  await page.getByRole("button", { name: "Confirm transfer" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Transfer recorded" }),
  ).toBeVisible();
  const accounts = page
    .getByRole("heading", { name: "Your accounts", exact: true })
    .locator("..")
    .locator("..");
  await expect(accounts.locator("dl")).toContainText("₱599.99");
  await expect(accounts.locator("dl")).toContainText("₱400.01");
  await expect(accounts.locator("dl")).toContainText("₱1,000.00");
  await page.getByRole("button", { name: "Confirm transfer" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "This transfer was already recorded.",
  );
  await expect(accounts.locator("dl")).toContainText("₱400.01");
  await page.getByLabel("Item name").fill("Notebook");
  await page.getByLabel("Price (PHP)", { exact: true }).fill("99.99");
  await page
    .getByLabel("Payment account", { exact: true })
    .selectOption({ label: "GCash" });
  await page.getByRole("button", { name: "Check affordability" }).click();
  await expect(
    page.getByText("This fits your current plan.", { exact: true }),
  ).toBeVisible();
  await expect(accounts.locator("dl")).toContainText("₱400.01");
  await page
    .getByRole("button", { name: "Confirm purchase made today" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Purchase recorded" }),
  ).toBeVisible();
  await expect(accounts.locator("dl")).toContainText("₱300.02");
  await expect(
    page.getByRole("button", { name: "Confirm purchase made today" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(accounts.locator("dl")).toContainText("₱900.01");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(accounts.locator("dl")).toContainText("₱300.02");
  await context.setOffline(false);
});

test("money tools handle empty funds, themes, mobile layout and accessibility", async ({
  page,
}) => {
  await returningUser(page);
  for (const theme of ["light", "dark"]) {
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByLabel("Color theme").selectOption(theme);
    await page.goto("/#/money");
    await expect(
      page.getByRole("heading", { name: "Your money, in place." }),
    ).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .setLegacyMode()
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 896 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/money-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole("button", { name: "Enable manual mode" }).click();
  await expect(
    page.getByRole("button", { name: "Turn off manual mode" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Turn off manual mode" }),
  ).toBeVisible();
});
