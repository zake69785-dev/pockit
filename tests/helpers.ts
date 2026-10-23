import { expect, type Page, type Locator } from "@playwright/test";
export async function choose(
  control: Locator,
  value: string | { label: string },
) {
  await expect(control).toHaveAttribute("role", "combobox");
  const label =
    typeof value === "string"
      ? await control
          .locator("xpath=ancestor::label")
          .locator("select.select-native option")
          .evaluateAll(
            (options, selected) =>
              (options as HTMLOptionElement[]).find((o) => o.value === selected)
                ?.textContent ?? "",
            value,
          )
      : value.label;
  await control.click();
  await control
    .page()
    .getByRole("option", { name: label.trim(), exact: true })
    .click();
}
import { freshData, type Data } from "../src/domain/model";
export async function goSection(page: Page, name: string) {
  if (["Plan", "Goals", "Activity"].includes(name))
    await page.getByRole("link", { name: "Money", exact: true }).click();
  await page.getByRole("link", { name, exact: true }).click();
}

// Writes only to a fresh, isolated Playwright context, never the user's browser.
export async function returningUser(page: Page, data?: Data) {
  const fixture = data ?? freshData();
  fixture.onboardingComplete = true;
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("pockit-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put({ id: "main", data: value });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, fixture);
  await page.reload();
  await expect(page.getByTestId("total-cash")).toBeVisible();
}
