import { expect, type Page } from "@playwright/test";
import { freshData, type Data } from "../src/domain/model";

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
