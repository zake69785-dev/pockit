import { test, expect } from "@playwright/test";
import { returningUser, goSection } from "./helpers";

test("student screens fit phone and desktop in both themes", async ({
  page,
}) => {
  await returningUser(page);
  for (const theme of ["light", "dark"]) {
    await goSection(page, "Settings");
    await page.getByLabel("Color theme").selectOption(theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 896 });
      for (const route of ["School", "Tasks", "Calendar"]) {
        await goSection(page, route);
        await expect(page.locator("h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/student-${route}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
});
