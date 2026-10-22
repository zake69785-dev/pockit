import { afterEach, describe, expect, it } from "vitest";
import { PockitDB, change, read, restore } from "./db";
import { today } from "../domain/model";
import { freshData } from "../domain/model";
import Dexie from "dexie";
import { completeSetup } from "./db";
import { newDraft } from "../domain/onboarding";
const databases: PockitDB[] = [];
const make = () => {
  const db = new PockitDB(`test-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
};
afterEach(async () => {
  await Promise.all(databases.splice(0).map((d) => d.delete()));
});
describe("IndexedDB persistence", () => {
  it("upgrades a real version 1 database and keeps its recovery snapshot", async () => {
    const name = `migration-${crypto.randomUUID()}`,
      old = new Dexie(name);
    old.version(1).stores({ state: "id" });
    const legacy = { ...freshData(), version: 1 };
    legacy.entries = [
      {
        id: "old",
        name: "Existing allowance",
        kind: "income",
        category: "Other",
        date: today(),
        amount: 12345,
      },
      {
        id: "old-save",
        name: "Existing savings",
        kind: "save",
        category: "Other",
        goalId: "emergency",
        date: today(),
        amount: 5000,
      },
      {
        id: "old-withdraw",
        name: "Existing withdrawal",
        kind: "withdraw",
        category: "Other",
        goalId: "emergency",
        date: today(),
        amount: 1000,
      },
    ];
    await old.table("state").put({ id: "main", data: legacy });
    old.close();
    const upgraded = new PockitDB(name);
    databases.push(upgraded);
    const d = await read(upgraded);
    expect(d.version).toBe(2);
    expect(d.entries).toEqual(legacy.entries);
    expect(d.goals).toEqual(legacy.goals);
    expect((await upgraded.recovery.get("before-v2"))?.data).toEqual(legacy);
    await completeSetup(newDraft(), upgraded);
    expect((await read(upgraded)).entries).toEqual(legacy.entries);
  });
  it("finishes setup once even when confirmation is repeated", async () => {
    const db = make(),
      draft = newDraft();
    draft.cash = "100";
    await change((d) => {
      d.settings.theme = "dark";
    }, db);
    await db.drafts.put({ id: "onboarding", value: draft });
    await Promise.all([completeSetup(draft, db), completeSetup(draft, db)]);
    expect((await read(db)).entries).toHaveLength(1);
    expect((await read(db)).settings.theme).toBe("dark");
    expect(await db.drafts.get("onboarding")).toBeUndefined();
  });
  it("persists across close and reopen", async () => {
    const db = make();
    await change((d) => {
      d.entries.push({
        id: "one",
        name: "Allowance",
        kind: "income",
        category: "Other",
        date: today(),
        amount: 10000,
      });
    }, db);
    db.close();
    await db.open();
    expect((await read(db)).entries[0].amount).toBe(10000);
  });
  it("rolls back an invalid mutation", async () => {
    const db = make();
    await change((d) => {
      d.settings.leisure = 100;
    }, db);
    await expect(
      change((d) => {
        d.settings.leisure = -1;
      }, db),
    ).rejects.toThrow();
    expect((await read(db)).settings.leisure).toBe(100);
  });
  it("serializes simultaneous writes without lost updates", async () => {
    const db = make();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        change((d) => {
          d.entries.push({
            id: String(i),
            name: "Income",
            kind: "income",
            date: today(),
            amount: 100,
            category: "Other",
          });
        }, db),
      ),
    );
    expect((await read(db)).entries).toHaveLength(10);
  });
  it("restores a backup atomically and preserves data on malformed input", async () => {
    const db = make();
    await change((d) => {
      d.settings.leisure = 123;
    }, db);
    const backup = JSON.parse(JSON.stringify(await read(db)));
    await change((d) => {
      d.settings.leisure = 456;
    }, db);
    await restore(backup, db);
    expect((await read(db)).settings.leisure).toBe(123);
    expect((await db.recovery.get("before-restore"))?.data).toMatchObject({
      settings: { leisure: 456 },
    });
    await expect(restore({ ...backup, entries: [{}] }, db)).rejects.toThrow();
    expect((await read(db)).settings.leisure).toBe(123);
  });
});
