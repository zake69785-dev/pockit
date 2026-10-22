import { useState } from "react";
import {
  ShieldCheck,
  Sprout,
  ArrowUpRight,
  Sparkles,
  Laptop,
  Plane,
  BookOpen,
  House,
  Check,
} from "lucide-react";
import {
  differenceInCalendarMonths,
  differenceInCalendarDays,
  addMonths,
  addDays,
  format,
  parseISO,
} from "date-fns";
import { goalBalance, budget } from "../domain/budget";
import { money, cents, id, type Data } from "../domain/model";
import { Section, AddButton, EntryList, Empty } from "../components/Common";
import { Sheet } from "../components/Sheet";
import { change } from "../data/db";
import { contribute } from "../domain/actions";
export function Pockets({
  data,
  day,
  add,
  transfer,
  editGoal,
  run,
}: {
  data: Data;
  day: string;
  add: () => void;
  transfer: (id: string) => void;
  editGoal: (id: string) => void;
  run: (fn: () => Promise<unknown>, message?: string) => void;
}) {
  const [planGoal, setPlanGoal] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    b = budget(data, day);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>For your next little big thing.</h1>
          <p>No rush. Every comfortable step counts.</p>
        </div>
        <AddButton label="New goal" onClick={add} />
      </div>
      <div className="savings-summary">
        <span className="goal-symbol mint">
          <Sprout size={30} />
        </span>
        <div>
          <span>All your pockets, growing together</span>
          <strong>{money(b.saved)}</strong>
        </div>
        <p>
          Saved for later.
          <br />
          Protected from everyday spending.
        </p>
      </div>
      <div className="dashboard-grid">
        {[...data.goals]
          .sort(
            (a, c) =>
              ({ high: 0, normal: 1, low: 2 })[a.priority ?? "normal"] -
              { high: 0, normal: 1, low: 2 }[c.priority ?? "normal"],
          )
          .map((g) => {
            const saved = goalBalance(data, g.id),
              percent = Math.min(100, Math.floor((saved / g.target) * 100)),
              months = g.deadline
                ? Math.max(
                    1,
                    differenceInCalendarMonths(
                      parseISO(g.deadline),
                      parseISO(day),
                    ) + 1,
                  )
                : 0,
              recommended = months
                ? Math.ceil(Math.max(0, g.target - saved) / months)
                : 0,
              history = data.entries.filter((e) => e.goalId === g.id),
              recent = history.filter(
                (e) =>
                  e.date >= format(addDays(parseISO(day), -90), "yyyy-MM-dd"),
              ),
              net = recent.reduce(
                (s, e) => s + (e.kind === "save" ? e.amount : -e.amount),
                0,
              ),
              first = recent.map((e) => e.date).sort()[0],
              rate = first
                ? Math.floor(
                    (Math.max(0, net) * 30) /
                      Math.max(
                        30,
                        differenceInCalendarDays(
                          parseISO(day),
                          parseISO(first),
                        ) + 1,
                      ),
                  )
                : 0,
              eta =
                rate > 0
                  ? format(
                      addMonths(
                        parseISO(day),
                        Math.min(
                          1200,
                          Math.ceil(Math.max(0, g.target - saved) / rate),
                        ),
                      ),
                      "MMM yyyy",
                    )
                  : "More history needed";
            const Icon = g.emergency
              ? ShieldCheck
              : {
                  sparkles: Sparkles,
                  laptop: Laptop,
                  plane: Plane,
                  book: BookOpen,
                  home: House,
                }[g.icon ?? "sparkles"];
            return (
              <Section
                className={`goal-card ${g.emergency ? "emergency-card" : ""}`}
                key={g.id}
                title={g.name}
                action={
                  <span
                    className={`goal-symbol ${g.emergency ? "lavender" : "mint"}`}
                  >
                    <Icon size={23} />
                  </span>
                }
              >
                <div className="row">
                  <span className="pill">
                    {g.emergency
                      ? "Peace of mind"
                      : g.priority === "high"
                        ? "A priority"
                        : g.priority === "low"
                          ? "Someday"
                          : "Steady progress"}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => editGoal(g.id)}
                  >
                    Edit target
                  </button>
                </div>
                <div className="goal-amount">
                  <strong>{money(saved)}</strong>
                  <span>of {money(g.target)}</span>
                </div>
                <div
                  className="animated-progress"
                  role="progressbar"
                  aria-label={`${g.name} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ transform: `scaleX(${percent / 100})` }} />
                </div>
                <div className="row goal-meta">
                  <span>{percent}% of the way</span>
                  <span>
                    {g.deadline
                      ? `Target ${format(parseISO(g.deadline), "MMM yyyy")}`
                      : "At your own pace"}
                  </span>
                </div>
                <div className="milestone-row" aria-label="Savings milestones">
                  {[25, 50, 75, 100].map((n) => (
                    <span className={percent >= n ? "reached" : ""} key={n}>
                      {percent >= n && <Check size={12} />} {n}%
                    </span>
                  ))}
                </div>
                <p className="muted">
                  {saved >= g.target
                    ? "You made it. This little dream is funded."
                    : g.emergency
                      ? "A soft landing for life’s unexpected moments."
                      : months
                        ? `${money(recommended)} per month toward your target.`
                        : "Your goal carries on when the month changes."}
                </p>
                {!g.emergency && saved < g.target && (
                  <>
                    <p className="hint">
                      {g.deadline && g.deadline < day
                        ? "Your target date has passed. You can choose a new one."
                        : recommended > Math.max(0, b.available)
                          ? "The monthly target exceeds your current flexible money. A smaller contribution is okay."
                          : `${money(Math.max(0, b.available))} is flexible this cycle; contributions are your choice.`}
                    </p>
                    <details className="goal-outlook">
                      <summary>Your progress outlook</summary>
                      <p className="hint">
                        Estimated finish: {eta}. Based on net contributions in
                        the last 90 days; not guaranteed. Estimates are capped
                        at 100 years.
                      </p>
                      <div className="goal-projection">
                        {[1, 2, 3].map((n) => (
                          <div key={n}>
                            <span>
                              {format(addMonths(parseISO(day), n), "MMM")}
                            </span>
                            <strong>
                              {money(Math.min(g.target, saved + rate * n))}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </details>
                  </>
                )}
                <div className="goal-actions">
                  <button className="primary" onClick={() => transfer(g.id)}>
                    Move money <ArrowUpRight size={16} />
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setError("");
                      setPlanGoal(g.id);
                    }}
                  >
                    Plan contribution
                  </button>
                </div>
                <details className="goal-history">
                  <summary>Contribution history · {history.length}</summary>
                  {history.length ? (
                    <EntryList entries={[...history].reverse().slice(0, 20)} />
                  ) : (
                    <Empty>Your first little step will appear here.</Empty>
                  )}
                </details>
                {data.plannedSavings
                  .filter(
                    (p) =>
                      p.goalId === g.id &&
                      !data.entries.some((e) => e.source === `saving:${p.id}`),
                  )
                  .map((p) => (
                    <div className="planned-contribution" key={p.id}>
                      <div>
                        <strong>{money(p.amount)}</strong>
                        <small>
                          Planned {format(parseISO(p.date), "MMM d")}
                        </small>
                      </div>
                      <button
                        className="small-button"
                        onClick={() =>
                          run(() => change((d) => contribute(d, p.id)))
                        }
                      >
                        Contribute
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          if (confirm("Cancel this planned contribution?"))
                            run(() =>
                              change((d) => {
                                d.plannedSavings = d.plannedSavings.filter(
                                  (x) => x.id !== p.id,
                                );
                              }),
                            );
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                {!g.emergency &&
                  !history.length &&
                  !data.plannedSavings.some((p) => p.goalId === g.id) && (
                    <button
                      className="text-button"
                      onClick={() => {
                        if (confirm("Remove this empty savings goal?"))
                          run(() =>
                            change((d) => {
                              if (
                                d.entries.some((e) => e.goalId === g.id) ||
                                d.plannedSavings.some((p) => p.goalId === g.id)
                              )
                                throw new Error("This goal has contributions.");
                              d.goals = d.goals.filter((x) => x.id !== g.id);
                            }),
                          );
                      }}
                    >
                      Remove goal
                    </button>
                  )}
              </Section>
            );
          })}
      </div>
      {planGoal && (
        <Sheet
          title="A little step, planned ahead"
          onClose={() => setPlanGoal("")}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                await change((d) => {
                  d.plannedSavings.push({
                    id: id(),
                    goalId: planGoal,
                    amount: cents(String(form.get("amount"))),
                    date: String(form.get("date")),
                  });
                });
                setPlanGoal("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Contribution amount (PHP)
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
                inputMode="decimal"
              />
            </label>
            <label>
              Planned date
              <input
                name="date"
                type="date"
                required
                min={day}
                defaultValue={day}
              />
            </label>
            <p className="hint">
              Reserves money inside your budget cycle; it does not transfer
              money. An unaffordable plan shows a shortfall. Contribute waits
              until essentials are covered.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save planned contribution"}
            </button>
          </form>
        </Sheet>
      )}
    </>
  );
}
