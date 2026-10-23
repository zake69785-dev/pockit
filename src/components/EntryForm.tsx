import { useState, type FormEvent } from "react";
import {
  cents,
  categories,
  id,
  today,
  type Data,
  type Entry,
} from "../domain/model";
import { budget, goalBalance } from "../domain/budget";
import { change } from "../data/db";

import { billOccurrences } from "../domain/schedule";
import { AccountSelect } from "./AccountSelect";
import { addDays, format, parseISO } from "date-fns";
export type FormKind = "transaction" | "goal" | "bill" | "expected" | "plan";
export function Field({
  label,
  name,
  type = "text",
  value = "",
  required = true,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={min}
        max={max}
        step={type === "number" ? "0.01" : undefined}
        inputMode={type === "number" ? "decimal" : undefined}
        maxLength={type === "text" ? 120 : undefined}
        autoComplete="off"
      />
    </label>
  );
}
export function EntryForm({
  kind,
  data,
  onDone,
  entry,
  goalId,
  initialKind,
  initialDate,
}: {
  kind: FormKind;
  data: Data;
  onDone: () => void;
  entry?: Entry;
  goalId?: string;
  initialKind?: Entry["kind"];
  initialDate?: string;
}) {
  const goal =
    kind === "goal" ? data.goals.find((g) => g.id === goalId) : undefined;
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [entryKind, setEntryKind] = useState<Entry["kind"]>(
      entry?.kind ?? initialKind ?? (goalId ? "save" : "expense"),
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget),
      str = (key: string) => String(form.get(key) ?? "").trim(),
      amt = (key = "amount") => cents(str(key));
    try {
      await change((d) => {
        if (kind === "transaction") {
          const item: Entry = {
            accountId: str("accountId") || entry?.accountId || "legacy",
            id: entry?.id ?? id(),
            name: str("name"),
            date: str("date"),
            amount: amt(),
            kind: entryKind,
            category: (str("category") || "Other") as Entry["category"],
          };
          if (entry?.source) {
            if (
              entryKind !== entry.kind ||
              (entry.source.startsWith("saving:") &&
                str("goalId") !== entry.goalId)
            )
              throw new Error(
                "Keep this scheduled transaction’s type and savings pocket. Delete it first to record a different transaction.",
              );
            item.source = entry.source;
          }
          if (entry?.trip) {
            if (
              entryKind !== "expense" ||
              item.date !== entry.date ||
              item.category !== "Transport"
            )
              throw new Error(
                "For a completed journey, edit its amount or description only. To change the travel date, delete it and record the journey again.",
              );
            item.trip = entry.trip;
          }
          if (entryKind === "save" || entryKind === "withdraw")
            item.goalId = str("goalId");
          if (entryKind === "expense" && str("billId")) {
            const [billId, billDate] = str("billId").split("|");
            item.billId = billId;
            if (billDate) item.billDate = billDate;
            item.category = "Essentials";
          }
          const originalIndex = entry
            ? d.entries.findIndex((x) => x.id === entry.id)
            : -1;
          if (entry && originalIndex < 0)
            throw new Error(
              "This transaction was removed in another window. Close this form and refresh.",
            );
          if (entry) d.entries = d.entries.filter((x) => x.id !== entry.id);
          if (entryKind === "save" && item.amount > budget(d, item.date).liquid)
            throw new Error(
              "This transfer exceeds your unprotected cash. Receive income or withdraw from another pocket first.",
            );
          if (
            entryKind === "withdraw" &&
            item.amount > goalBalance(d, item.goalId!, item.date)
          )
            throw new Error(
              "This pocket does not have enough saved on that date.",
            );
          if (originalIndex < 0) d.entries.push(item);
          else d.entries.splice(originalIndex, 0, item);
        } else if (kind === "goal") {
          const updated = {
            id: goal?.id ?? id(),
            name: str("name"),
            target: amt(),
            deadline: str("date"),
            emergency: goal?.emergency ?? false,
            priority: str("priority") as "low" | "normal" | "high",
            icon: str("icon") as
              "sparkles" | "laptop" | "plane" | "book" | "home",
          };
          if (goal)
            d.goals = d.goals.map((g) => (g.id === goal.id ? updated : g));
          else d.goals.push(updated);
        } else if (kind === "bill" || kind === "expected")
          d[kind === "bill" ? "bills" : "expected"].push({
            id: id(),
            name: str("name"),
            amount: amt(),
            date: str("date"),
            frequency: str("frequency") as Data["allowance"]["frequency"],
          });
        else {
          d.settings = {
            ...d.settings,
            nextAllowance: str("nextAllowance"),
            cycleStart: str("cycleStart"),
            leisure: amt("leisure"),
          };
          d.allowance = {
            amount: amt("normalAllowance"),
            frequency: str("frequency") as Data["allowance"]["frequency"],
            anchor: str("nextAllowance"),
          };
          d.preference = str("preference") as Data["preference"];
        }
      });
      onDone();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      {kind === "transaction" && (
        <AccountSelect
          data={data}
          value={entry?.accountId}
          label={entryKind === "income" ? "Receiving account" : "Account"}
        />
      )}
      {kind === "transaction" && (
        <label>
          Transaction type
          <select
            name="kind"
            value={entryKind}
            onChange={(e) => setEntryKind(e.target.value as Entry["kind"])}
          >
            <option value="expense">Expense</option>
            <option value="income">Received income</option>
            <option value="save">Transfer to savings</option>
            <option value="withdraw">Withdraw from savings</option>
          </select>
        </label>
      )}
      {kind === "plan" ? (
        <>
          <p className="muted">
            Your plan protects commitments before calculating a daily allowance.
            Future income is never included in available cash.
          </p>
          <Field
            label="Next allowance date"
            name="nextAllowance"
            type="date"
            value={data.settings.nextAllowance}
          />
          <Field
            label="Budget cycle start"
            name="cycleStart"
            type="date"
            value={data.settings.cycleStart}
            max={today()}
          />
          <Field
            label="Leisure budget for this cycle (PHP)"
            name="leisure"
            type="number"
            min="0"
            value={data.settings.leisure / 100}
          />
          <Field
            label="Normal allowance (PHP)"
            name="normalAllowance"
            type="number"
            min="0"
            value={data.allowance.amount / 100}
          />
          <label>
            Allowance frequency
            <select name="frequency" defaultValue={data.allowance.frequency}>
              {["daily", "weekly", "biweekly", "monthly", "irregular"].map(
                (f) => (
                  <option key={f} value={f}>
                    {f === "biweekly" ? "Every two weeks" : f}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Budget preference
            <select name="preference" defaultValue={data.preference}>
              <option value="conservative">
                Conservative · more breathing room
              </option>
              <option value="balanced">Balanced · now and later</option>
              <option value="savings">Savings-focused · more progress</option>
            </select>
          </label>
          <p className="hint">
            Changing the next date also updates the recurrence anchor. Recorded
            income is never changed.
          </p>
          <p className="hint">
            School days and routes can be edited in Plan → Transportation.
          </p>
        </>
      ) : (
        <>
          <Field
            label={kind === "goal" ? "Goal name" : "Description"}
            name="name"
            value={
              goal?.name ??
              entry?.name ??
              (goalId ? "Savings contribution" : "")
            }
          />
          <Field
            label={kind === "goal" ? "Target amount (PHP)" : "Amount (PHP)"}
            name="amount"
            type="number"
            min={entry?.trip ? "0" : "0.01"}
            value={goal ? goal.target / 100 : entry ? entry.amount / 100 : ""}
          />
          <Field
            label={
              kind === "goal"
                ? "Target date (optional)"
                : kind === "bill"
                  ? "Due date"
                  : kind === "expected"
                    ? "Expected date"
                    : "Date"
            }
            name="date"
            type="date"
            required={kind !== "goal"}
            value={
              goal?.deadline ??
              entry?.date ??
              initialDate ??
              (kind === "goal" ? "" : today())
            }
            max={kind === "transaction" ? today() : undefined}
          />
          {kind === "transaction" && entryKind === "expense" && (
            <>
              <label>
                Category
                <select
                  name="category"
                  defaultValue={entry?.category ?? "Food"}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Pay an essential (optional)
                <select
                  name="billId"
                  defaultValue={
                    entry?.billId
                      ? `${entry.billId}|${entry.billDate ?? data.bills.find((b) => b.id === entry.billId)?.date}`
                      : ""
                  }
                >
                  <option value="">No linked essential</option>
                  {billOccurrences(
                    data,
                    "2000-01-01",
                    format(addDays(parseISO(today()), 60), "yyyy-MM-dd"),
                  )
                    .filter((b) => b.remaining > 0 || b.id === entry?.billId)
                    .slice(-200)
                    .map((b) => (
                      <option
                        key={`${b.id}-${b.date}`}
                        value={`${b.id}|${b.date}`}
                      >
                        {b.name}
                        {b.frequency && b.frequency !== "irregular"
                          ? ` · ${b.date}`
                          : ""}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          {kind === "goal" && (
            <>
              <label>
                Goal priority
                <select
                  name="priority"
                  defaultValue={goal?.priority ?? "normal"}
                >
                  <option value="low">Someday</option>
                  <option value="normal">Steady progress</option>
                  <option value="high">A priority</option>
                </select>
              </label>
              <label>
                Goal icon
                <select name="icon" defaultValue={goal?.icon ?? "sparkles"}>
                  <option value="sparkles">Something special</option>
                  <option value="laptop">Tech</option>
                  <option value="plane">Travel</option>
                  <option value="book">Learning</option>
                  <option value="home">Home</option>
                </select>
              </label>
            </>
          )}
          {(kind === "bill" || kind === "expected") && (
            <label>
              Repeat
              <select name="frequency" defaultValue="irregular">
                <option value="irregular">One time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every two weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          )}
          {kind === "transaction" &&
            (entryKind === "save" || entryKind === "withdraw") && (
              <>
                <label>
                  Savings pocket
                  <select
                    name="goalId"
                    defaultValue={entry?.goalId ?? goalId ?? data.goals[0]?.id}
                    required
                  >
                    {data.goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="hint">
                  Transfers move money between your spending balance and a
                  protected pocket. They are not expenses.
                </p>
              </>
            )}
          {kind === "expected" && (
            <p className="hint">
              This is a reminder. Tap “Receive” when the money actually arrives.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy
          ? "Saving…"
          : kind === "plan"
            ? "Save budget plan"
            : kind === "goal"
              ? goal
                ? "Save goal"
                : "Create goal"
              : kind === "bill"
                ? "Reserve essential"
                : kind === "expected"
                  ? "Schedule income"
                  : "Save transaction"}
      </button>
    </form>
  );
}
