import { useState, useRef } from "react";
import { Download, Upload, Smartphone, ShieldCheck } from "lucide-react";
import { change, exportFile, restore, db } from "../data/db";
import { migrate } from "../domain/migrate";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { validate } from "../domain/validation";
import type { Data } from "../domain/model";
import { Section } from "../components/Common";
export function Settings({
  data,
  run,
}: {
  data: Data;
  run: (fn: () => Promise<unknown>, message?: string) => void;
}) {
  const [pending, setPending] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [storage, setStorage] = useState(""),
    input = useRef<HTMLInputElement>(null);
  const recovery = useLiveQuery(() => db.recovery.toArray(), []);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Make yourself at home.</h1>
          <p>Your preferences, your data, your Pockit.</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <Section title="Your personal setup">
          <p className="muted">
            Your opening balances stay in Activity so setup never adds them
            twice. Edit allowances and preferences in Plan; change routes and
            attendance in Transportation.
          </p>
          <div className="button-row">
            <Link className="secondary" to="/plan">
              Your plan
            </Link>
            <Link className="secondary" to="/transport">
              School & travel
            </Link>
          </div>
          {!data.onboardingComplete && (
            <Link className="primary full" to="/">
              Continue first-time setup
            </Link>
          )}
        </Section>
        <Section title="Appearance">
          <label>
            Color theme
            <select
              value={data.settings.theme}
              onChange={(e) => {
                const theme = e.target.value as Data["settings"]["theme"];
                run(() =>
                  change((d) => {
                    d.settings.theme = theme;
                  }),
                );
              }}
            >
              <option value="system">Match device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <p className="hint">
            Motion follows your device’s Reduce Motion preference.
          </p>
        </Section>
        <Section
          title="Your data stays with you"
          action={<ShieldCheck size={22} />}
        >
          <p>
            Pockit saves on this device, in this browser. No account, bank
            connection, or subscription.
          </p>
          <p className="muted">
            Browser data can be cleared or evicted. Keep a backup somewhere you
            trust, especially before changing devices. Backups contain your
            financial and academic records as plain JSON.
          </p>
          <button
            className="secondary full"
            onClick={async () => {
              try {
                const result = await navigator.storage?.persist?.();
                setStorage(
                  result
                    ? "Persistent storage granted. Keep making backups."
                    : "Your browser manages storage. Regular backups are still important.",
                );
              } catch {
                setStorage(
                  "Storage protection is unavailable. Please keep regular backups.",
                );
              }
            }}
          >
            Request storage protection
          </button>
          <p role="status" className="hint">
            {storage}
          </p>
        </Section>
        <Section title="Backup & restore">
          <p className="hint">
            Version 3 backups include accounts, courses, assignments, tasks,
            calendar events and study history. Restore them with Pockit 3.0;
            older builds do not support this format.
          </p>
          <button className="primary full" onClick={() => exportFile(data)}>
            <Download size={18} />
            Export financial backup
          </button>
          <button
            className="secondary full"
            onClick={() => input.current?.click()}
          >
            <Upload size={18} />
            Choose backup to restore
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            aria-label="Backup file"
            className="sr-only"
            onChange={async (e) => {
              setError("");
              setPending(null);
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 20_000_000)
                  throw new Error("Backup is too large (20 MB maximum).");
                setPending(validate(migrate(JSON.parse(await file.text()))));
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not read this backup.",
                );
              }
              e.target.value = "";
            }}
          />
          {pending && (
            <div className="restore-preview">
              <h3>Ready to restore</h3>
              <p>
                {pending.entries.length} transactions · {pending.goals.length}{" "}
                savings pockets · {pending.bills.length} essentials
              </p>
              <p>
                {pending.student?.courses.length ?? 0} courses ·{" "}
                {pending.student?.tasks.length ?? 0} tasks ·{" "}
                {pending.student?.events.length ?? 0} calendar events
              </p>
              <p>
                This replaces all current Pockit data. Export your current data
                before continuing.
              </p>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await restore(pending);
                      setPending(null);
                      setError("");
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Restore failed. Current data was preserved.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Restoring…" : "Replace data with backup"}
                </button>
                <button
                  className="text-button"
                  onClick={() => setPending(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </Section>
        {!!recovery?.length && (
          <Section title="Recovery copies">
            <p className="muted">
              Pockit keeps the pre-upgrade data and the most recent pre-restore
              copy on this device. Download one before restoring it.
            </p>
            {recovery.map((copy) => (
              <button
                key={copy.id}
                className="secondary full"
                onClick={() => exportFile(copy.data)}
              >
                <Download size={18} />
                {copy.id === "before-v2"
                  ? "Download Pockit 1.0 recovery"
                  : copy.id === "before-v3" || copy.id === "before-v3-format"
                    ? `Download ${copy.id} recovery`
                    : "Download pre-restore recovery"}
              </button>
            ))}
          </Section>
        )}
        <Section
          title="Keep Pockit in your pocket"
          action={<Smartphone size={22} />}
        >
          <ol className="install-steps">
            <li>Open your deployed Pockit link in Safari.</li>
            <li>Tap Share, then Add to Home Screen.</li>
            <li>Open Pockit from its icon while online once.</li>
            <li>
              After “Ready offline” appears, you can budget without a
              connection.
            </li>
          </ol>
          <p className="hint">
            Use the same installed app for consistent storage. Safari and the
            installed app may keep separate data; export and restore if needed.
          </p>
        </Section>
      </div>
      <p className="footnote">
        Pockit 3.0 · A little plan for money, school and life.
      </p>
    </>
  );
}
