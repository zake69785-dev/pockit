import { choose } from "./helpers";
import { returningUser, goSection } from "./helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("WCAG AA checks across light and dark routes and transaction sheet", async ({
  page,
}) => {
  test.setTimeout(180_000); // Twelve scans. Same-page mode avoids Edge blank-page aggregation hangs; Pockit has no frames.
  await returningUser(page);
  for (const theme of ["light", "dark"]) {
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await choose(page.getByLabel("Color theme"), theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const name of [
      "Home",
      "School",
      "Money",
      "Tasks",
      "Plan",
      "Calendar",
      "Goals",
      "Activity",
      "Settings",
    ]) {
      await goSection(page, name);
      await expect(page.locator("h1")).toBeVisible();
      const scan = await new AxeBuilder({ page })
        .setLegacyMode()
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        scan.violations,
        `${theme} ${name}: ${JSON.stringify(scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
    }
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page
      .getByRole("button", { name: "Add transaction", exact: true })
      .click();
    const scan = await new AxeBuilder({ page })
      .setLegacyMode()
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await page.getByRole("button", { name: "Close form" }).click();
  }
});
