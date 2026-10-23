import { choose } from "./helpers";
import { test, expect } from "@playwright/test";
import { returningUser, goSection } from "./helpers";

test("student screens fit phone and desktop in both themes", async ({
  page,
}) => {
  test.setTimeout(120000); // Twelve full-page captures can exceed 30s in Windows WebKit.
  await returningUser(page);
  for (const theme of ["light", "dark"]) {
    await goSection(page, "Settings");
    await choose(page.getByLabel("Color theme"), theme);
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
