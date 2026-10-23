import { test, expect } from "@playwright/test";
import { returningUser, choose } from "./helpers";
import { freshData, freshFinance, today } from "../src/domain/model";
import { freshStudent } from "../src/domain/student";
// Layout is measured in CSS pixels; 1x captures avoid tripling huge stress pages.
test.use({ deviceScaleFactor: 1 });

test("onboarding themes and landscape calendar keep controls in view", async ({
  page,
}, info) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [360, 414, 1280, 1600]) {
      await page.setViewportSize({ width, height: 896 });
      await page.goto("/");
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`onboarding-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await returningUser(page);
  await page.setViewportSize({ width: 896, height: 414 });
  await page.goto("/#/calendar");
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("calendar-landscape.png"),
    fullPage: true,
  });
});

for (const theme of ["light", "dark"] as const)
  for (const width of [360, 414, 1280, 1600]) {
    test(`Lovable layout ${theme} ${width}: long and empty states`, async ({
      page,
    }, info) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 896 });
      const data = freshData();
      data.settings.theme = theme;
      data.student = freshStudent();
      data.entries = [
        {
          id: "large",
          name: "Opening balance",
          date: today(),
          amount: 99999999999,
          kind: "income",
          category: "Other",
        },
        ...Array.from({ length: 300 }, (_, i) => ({
          id: `expense-${i}`,
          name: `Long purchase description ${"description ".repeat(15)}${i}`,
          date: today(),
          amount: 100,
          kind: "expense" as const,
          category: "Food" as const,
        })),
      ];
      data.student.courses = [
        {
          id: "long",
          name:
            "A very long course title: " +
            "Interdisciplinary Studies ".repeat(12),
          origin: "manual",
          categories: [],
          target: 80,
        },
      ];
      data.student.tasks = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i}`,
        name: "Long task " + "word".repeat(30),
        due: today(),
        priority: "high" as const,
        notes: "",
        done: false,
        effort: 15,
        courseId: "long",
        repeat: "none" as const,
      }));
      await returningUser(page, data);
      for (const route of [
        "/",
        "/money",
        "/school",
        "/calendar",
        "/tasks",
        "/pockets",
        "/transport",
        "/plan",
        "/activity",
        "/settings",
      ]) {
        await page.goto(`/#${route}`);
        await expect(page.locator("h1")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() =>
          Array.from(
            document.querySelectorAll(
              "main .panel, main button, main input, main .spend-card, main .student-item",
            ),
          )
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
            })
            .map((el) => ({
              tag: el.tagName,
              class: el.className,
              text: el.textContent?.slice(0, 60),
            })),
        );
        expect(overflow, route).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route,
        ).toBe(true);
        const name = route.slice(1) || "home";
        const height = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        if (height > 16000) {
          // WebKit cannot encode a bitmap dimension above 32767px. Preserve
          // the complete fixture and sample long lists without changing layout.
          for (const [part, fraction] of [
            ["top", 0],
            ["middle", 0.5],
            ["bottom", 1],
          ] as const) {
            await page.evaluate(
              (y) => window.scrollTo(0, y),
              fraction * height,
            );
            await page.screenshot({
              path: info.outputPath(`${name}-${part}.png`),
            });
          }
          await page.evaluate(() => window.scrollTo(0, 0));
        } else {
          await page.screenshot({
            path: info.outputPath(`${name}.png`),
            fullPage: true,
          });
        }
        if (route === "/")
          await page.screenshot({ path: info.outputPath("home-viewport.png") });
      }
    });
  }

test("selector keyboard, cancellation and notification preferences", async ({
  page,
}) => {
  await returningUser(page);
  await page.goto("/#/settings");
  const theme = page.getByLabel("Color theme");
  await theme.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(theme).toBeFocused();
  await choose(theme, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Academic deadlines", { exact: true }).check();
  await page.reload();
  await expect(
    page.getByLabel("Academic deadlines", { exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("One-time device pairing code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable notifications" })).toBeDisabled();
  await page.getByRole("button", { name: /Reminder categories/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Reminder categories" }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search Reminder categories" })
    .fill("class");
  await page.getByRole("dialog").getByLabel("Class reminders").check();
  await page.getByRole("button", { name: "Use selection" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByLabel("Class reminders", { exact: true }),
  ).toBeChecked();
});

test("searchable account sheet preserves ledger until confirmation", async ({
  page,
}, info) => {
  const data = freshData();
  data.finance = freshFinance();
  data.finance.accounts.push(
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `account-${i}`,
      name: `Account ${i} with a long descriptive name`,
      type: "custom" as const,
    })),
  );
  await returningUser(page, data);
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page.getByRole("button", { name: /Find account/ }).click();
  await page
    .getByRole("searchbox", { name: "Search Find account" })
    .fill("Account 11");
  await page
    .getByRole("radio", { name: "Account 11 with a long descriptive name" })
    .check();
  await page.screenshot({ path: info.outputPath("account-sheet.png") });
  await page.getByRole("button", { name: "Use selection" }).click();
  await expect(page.getByLabel("Account", { exact: true })).toContainText(
    "Account 11",
  );
  const entries = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const r = indexedDB.open("pockit-v1");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const get = db.transaction("state").objectStore("state").get("main");
          get.onsuccess = () => {
            resolve(get.result.data.entries.length);
            db.close();
          };
        };
      }),
  );
  expect(entries).toBe(0);
  const dismissal = page.waitForEvent("dialog").then(async (confirmation) => {
    expect(confirmation.message()).toContain("Discard");
    await confirmation.accept();
  });
  await Promise.all([
    dismissal,
    page.getByRole("button", { name: "Close form" }).click(),
  ]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
