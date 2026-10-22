import Dexie, { type Table } from "dexie";
import { freshData, type Data } from "../domain/model";
import { validate } from "../domain/validation";
import { migrate } from "../domain/migrate";
import { setupData, type SetupDraft } from "../domain/onboarding";
export class PockitDB extends Dexie {
  state!: Table<{ id: string; data: Data }, string>;
  drafts!: Table<{ id: string; value: unknown }, string>;
  recovery!: Table<{ id: string; data: unknown; createdAt: string }, string>;
  constructor(name = "pockit-v1") {
    super(name);
    this.version(1).stores({ state: "id" });
    this.version(2)
      .stores({ state: "id", drafts: "id", recovery: "id" })
      .upgrade(async (tx) => {
        const old = await tx.table("state").get("main");
        if (old) {
          await tx.table("recovery").put({
            id: "before-v2",
            data: old.data,
            createdAt: new Date().toISOString(),
          });
          await tx
            .table("state")
            .put({ id: "main", data: validate(migrate(old.data)) });
        }
      });
  }
}
export const db = new PockitDB();
export async function read(database = db): Promise<Data> {
  return (await database.state.get("main"))?.data ?? freshData();
}
export async function change(update: (data: Data) => void, database = db) {
  await database.transaction("rw", database.state, async () => {
    const data = await read(database);
    update(data);
    validate(data);
    await database.state.put({ id: "main", data });
  });
}
export async function restore(input: unknown, database = db) {
  const data = validate(migrate(input));
  await database.transaction(
    "rw",
    database.state,
    database.recovery,
    database.drafts,
    async () => {
      const current = await database.state.get("main");
      if (current)
        await database.recovery.put({
          id: "before-restore",
          data: current.data,
          createdAt: new Date().toISOString(),
        });
      await database.state.put({ id: "main", data });
      await database.drafts.delete("onboarding");
    },
  );
}
export async function completeSetup(draft: SetupDraft, database = db) {
  await database.transaction(
    "rw",
    database.state,
    database.drafts,
    async () => {
      const current = await database.state.get("main");
      if (current?.data.onboardingComplete) return;
      if (current?.data.entries.length)
        throw new Error(
          "Existing transactions were found. Setup will not replace them.",
        );
      const data = setupData(draft);
      if (current) data.settings.theme = current.data.settings.theme;
      await database.state.put({ id: "main", data });
      await database.drafts.delete("onboarding");
    },
  );
}
export function exportFile(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `pockit-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
