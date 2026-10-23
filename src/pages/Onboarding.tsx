import { Select } from "../components/Select";
import { useState, useEffect, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ArrowRight,
  Wallet,
  ShieldCheck,
  Sparkles,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import { db, completeSetup } from "../data/db";
import { newDraft, setupData, type SetupDraft } from "../domain/onboarding";
import { budget } from "../domain/budget";
import {
  cents,
  money,
  today,
  type Frequency,
  type Attendance,
} from "../domain/model";
import { RouteLegs } from "../components/RouteLegs";
const titles = [
  "A happier home for your money.",
  "Let’s start with what you have.",
  "Find your allowance rhythm.",
  "What does your week look like?",
  "Every journey, accounted for.",
  "Make room for the essentials.",
  "What are you looking forward to?",
  "Your money. Your way.",
  "Meet your personal pocket plan.",
];
const displayCents = (value: string) => {
  try {
    return cents(value || "0");
  } catch {
    return 0;
  }
};
const labels = [
  "Welcome",
  "Your money",
  "Allowance",
  "School",
  "Transport",
  "Essentials",
  "Savings",
  "Preferences",
  "Your plan",
];
export function Onboarding() {
  const draft = useLiveQuery(
    async () =>
      ((await db.drafts.get("onboarding"))?.value as SetupDraft | undefined) ??
      newDraft(),
    [],
  );
  if (!draft)
    return (
      <main className="loading" role="status">
        Getting your setup ready…
      </main>
    );
  return <Setup initial={draft} />;
}
function Setup({ initial }: { initial: SetupDraft }) {
  const [d, setD] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(true);
  const patch = (next: Partial<SetupDraft>) => {
    const updated = { ...d, ...next };
    setD(updated);
    setSaved(false);
    void db.drafts
      .put({ id: "onboarding", value: updated })
      .then(() => setSaved(true))
      .catch(() =>
        setError(
          "Could not save setup progress. Allow browser storage and try again.",
        ),
      );
  };
  useEffect(() => {
    document.title = `${labels[d.step]} · Set up Pockit`;
  }, [d.step]);
  let plan: ReturnType<typeof budget> | null = null;
  try {
    if (d.step === 8) plan = budget(setupData(d, false), today());
  } catch {
    /* shown on submit, with editable steps */
  }
  async function next(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      if (d.step === 1)
        [d.cash, d.wallet, d.separate].forEach((v) => cents(v || "0"));
      if (d.step === 6) {
        if (d.goalName.trim() && cents(d.goalTarget || "0") <= 0)
          throw new Error("Give your goal a target above zero.");
        if (cents(d.goalExisting || "0") > cents(d.separate || "0"))
          throw new Error(
            "Existing goal savings must come from your separately saved money.",
          );
      }
      if (d.step === 7) setupData(d, false);
      if (d.step === 8) {
        setBusy(true);
        await completeSetup(d);
      } else {
        const updated = { ...d, step: d.step + 1 };
        await db.drafts.put({ id: "onboarding", value: updated });
        setD(updated);
        window.scrollTo(0, 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const input = (
    label: string,
    key:
      | "cash"
      | "wallet"
      | "separate"
      | "allowance"
      | "goalTarget"
      | "goalExisting"
      | "emergencyAdd"
      | "goalAdd",
  ) => (
    <label>
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        required
        value={d[key]}
        onChange={(e) => patch({ [key]: e.target.value })}
      />
    </label>
  );
  return (
    <main className="setup-shell">
      <header className="setup-header">
        <Link className="brand" to="/">
          pockit
          <span className="brand-coin" />
        </Link>
        <span className="connection">
          {saved ? "Progress saved on this device" : "Saving…"}
        </span>
      </header>
      <div className="setup-progress" aria-label={`Step ${d.step + 1} of 9`}>
        {labels.map((label, i) => (
          <span
            title={label}
            key={label}
            className={i <= d.step ? "done" : ""}
          />
        ))}
      </div>
      <div className="setup-step-label">
        {d.step + 1} of 9 · {labels[d.step]}
      </div>
      <h1>{titles[d.step]}</h1>
      <form onSubmit={next} className="form-stack setup-form">
        {d.step === 0 && (
          <>
            <div className="welcome-pocket" aria-hidden="true">
              <div className="pocket-coin">₱</div>
              <div className="pocket-shape">
                <Wallet size={60} />
                <span>little by little.</span>
              </div>
              <Sparkles className="pocket-spark" />
            </div>
            <p className="intro-copy">
              A little plan for today. A little more possibility for tomorrow.
            </p>
            <p className="muted">
              Pockit helps your money last until your next allowance, with
              travel, essentials and savings already considered. Your records
              stay on this device.
            </p>
            <Link className="inline-link" to="/settings">
              Already have a backup? Restore it here <ArrowRight size={16} />
            </Link>
          </>
        )}
        {d.step === 1 && (
          <>
            <p className="muted">
              Count each peso once. Cash and digital wallet amounts below should
              exclude money already saved separately.
            </p>
            {input("Cash you can spend (PHP)", "cash")}
            {input("Digital wallet you can spend (PHP)", "wallet")}
            {input("Money saved separately (PHP)", "separate")}
            <div className="notice">
              <ShieldCheck size={20} /> Separate savings will be protected. You
              can assign some to a goal later.
            </div>
          </>
        )}
        {d.step === 2 && (
          <>
            {input("Normal allowance (PHP)", "allowance")}
            <label>
              How often?
              <Select
                value={d.frequency}
                onChange={(e) =>
                  patch({ frequency: e.target.value as Frequency })
                }
              >
                {["daily", "weekly", "biweekly", "monthly", "irregular"].map(
                  (f) => (
                    <option value={f} key={f}>
                      {f === "biweekly"
                        ? "Every two weeks"
                        : f[0].toUpperCase() + f.slice(1)}
                    </option>
                  ),
                )}
              </Select>
            </label>
            <label>
              Next allowance expected
              <input
                type="date"
                required
                value={d.nextDate}
                onChange={(e) => patch({ nextDate: e.target.value })}
              />
            </label>
            <p className="hint">
              Expected money is a reminder. It won’t enter your balance until
              you receive it.
            </p>
          </>
        )}
        {d.step === 3 && (
          <>
            <p className="muted">
              Only on-campus days reserve transportation. Holidays and one-off
              visits can be changed in your calendar anytime.
            </p>
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((day, i) => (
              <label className="schedule-row" key={day}>
                {day}
                <Select
                  aria-label={`${day} attendance`}
                  value={d.weekly[i]}
                  onChange={(e) =>
                    patch({
                      weekly: d.weekly.map((mode, j) =>
                        j === i ? (e.target.value as Attendance) : mode,
                      ),
                    })
                  }
                >
                  <option value="off">No classes</option>
                  <option value="campus">On campus</option>
                  <option value="online">Online</option>
                </Select>
              </label>
            ))}
          </>
        )}
        {d.step === 4 && (
          <>
            <p className="muted">
              Build each direction separately. Add every vehicle you use;
              walking is free. You can add alternative routes later.
            </p>
            <h2>Going to school</h2>
            <RouteLegs
              label="Outbound"
              legs={d.outLegs}
              onChange={(outLegs) => patch({ outLegs })}
            />
            <h2>Going home</h2>
            <RouteLegs
              label="Return"
              legs={d.backLegs}
              onChange={(backLegs) => patch({ backLegs })}
            />
          </>
        )}
        {d.step === 5 && (
          <>
            <p className="muted">
              Add only what you need. An empty list is okay. Reservations repeat
              only when you choose a frequency.
            </p>
            {d.essentials.map((b, i) => (
              <div className="setup-essential" key={i}>
                <label>
                  Essential name
                  <input
                    required
                    maxLength={120}
                    value={b.name}
                    onChange={(e) =>
                      patch({
                        essentials: d.essentials.map((v, j) =>
                          j === i ? { ...v, name: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
                <div className="form-columns">
                  <label>
                    Amount (PHP)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      required
                      value={b.amount}
                      onChange={(e) =>
                        patch({
                          essentials: d.essentials.map((v, j) =>
                            j === i ? { ...v, amount: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      type="date"
                      required
                      value={b.date}
                      onChange={(e) =>
                        patch({
                          essentials: d.essentials.map((v, j) =>
                            j === i ? { ...v, date: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Repeat
                  <Select
                    value={b.frequency}
                    onChange={(e) =>
                      patch({
                        essentials: d.essentials.map((v, j) =>
                          j === i
                            ? { ...v, frequency: e.target.value as Frequency }
                            : v,
                        ),
                      })
                    }
                  >
                    {["irregular", "daily", "weekly", "monthly"].map((f) => (
                      <option key={f} value={f}>
                        {f === "irregular" ? "Once" : f}
                      </option>
                    ))}
                  </Select>
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    patch({
                      essentials: d.essentials.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove essential
                </button>
              </div>
            ))}
            <div className="choice-chips">
              {[
                "Food",
                "School supplies",
                "Mobile data",
                "Subscriptions",
                "Bills",
                "Other",
              ].map((name) => (
                <button
                  className="secondary"
                  key={name}
                  type="button"
                  onClick={() =>
                    patch({
                      essentials: [
                        ...d.essentials,
                        {
                          name,
                          amount: "",
                          date: today(),
                          frequency: "irregular",
                        },
                      ],
                    })
                  }
                >
                  + {name}
                </button>
              ))}
            </div>
          </>
        )}
        {d.step === 6 && (
          <>
            <p className="muted">
              A goal is optional. Your emergency pocket is already ready for
              you.
            </p>
            <label>
              Goal name (optional)
              <input
                value={d.goalName}
                maxLength={120}
                placeholder="A new laptop, a trip, your next chapter…"
                onChange={(e) => patch({ goalName: e.target.value })}
              />
            </label>
            {d.goalName && (
              <>
                {input("Goal target (PHP)", "goalTarget")}
                {input("Already saved for this goal (PHP)", "goalExisting")}
                <p className="hint">
                  Included in your {money(displayCents(d.separate))} separate
                  savings, not added on top.
                </p>
                <label>
                  Target date (optional)
                  <input
                    type="date"
                    value={d.goalDate}
                    onChange={(e) => patch({ goalDate: e.target.value })}
                  />
                </label>
                <label>
                  Priority
                  <Select
                    value={d.priority}
                    onChange={(e) =>
                      patch({
                        priority: e.target.value as SetupDraft["priority"],
                      })
                    }
                  >
                    <option value="low">Someday</option>
                    <option value="normal">Steady progress</option>
                    <option value="high">A priority</option>
                  </Select>
                </label>
              </>
            )}
          </>
        )}
        {d.step === 7 && (
          <>
            <p className="muted">
              This shapes your suggestions. You always choose the actual
              amounts.
            </p>
            {(
              [
                {
                  id: "conservative",
                  name: "A little extra breathing room",
                  description:
                    "Suggest 15% of flexible money for emergencies and 5% for your goal.",
                },
                {
                  id: "balanced",
                  name: "A bit for now. A bit for later.",
                  description:
                    "Suggest 10% for emergencies and 10% for your goal.",
                },
                {
                  id: "savings",
                  name: "Make a little more progress",
                  description:
                    "Suggest 10% for emergencies and 25% for your goal, after commitments.",
                },
              ] as const
            ).map((p) => (
              <label
                key={p.id}
                className={`preference-option ${d.preference === p.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="preference"
                  checked={d.preference === p.id}
                  onChange={() => patch({ preference: p.id })}
                />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </span>
                {d.preference === p.id && <Check size={20} />}
              </label>
            ))}
          </>
        )}
        {d.step === 8 && (
          <>
            {plan ? (
              <>
                <div className="setup-review">
                  <span>Let’s make it last {plan.days} days.</span>
                  <strong>{money(plan.cash)}</strong>
                  <span>Money you actually have</span>
                  <dl className="breakdown">
                    {[
                      ["Already saved", plan.saved],
                      ["Upcoming transport", plan.transport],
                      ["Essential reservations", plan.essential],
                      [
                        "Flexible before new savings",
                        Math.max(0, plan.available),
                      ],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt>{label}</dt>
                        <dd>{money(Number(value))}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {plan.shortfall > 0 && (
                  <p className="error">
                    Your commitments exceed available money by{" "}
                    {money(plan.shortfall)}. Go back to adjust your plan; new
                    savings must stay at zero.
                  </p>
                )}
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    const free = Math.max(0, plan!.available);
                    patch({
                      emergencyAdd: (
                        Math.floor(
                          (free * (d.preference === "conservative" ? 15 : 10)) /
                            100,
                        ) / 100
                      ).toFixed(2),
                      goalAdd: d.goalName
                        ? (
                            Math.floor(
                              (free *
                                (d.preference === "savings"
                                  ? 25
                                  : d.preference === "balanced"
                                    ? 10
                                    : 5)) /
                                100,
                            ) / 100
                          ).toFixed(2)
                        : "0",
                    });
                  }}
                >
                  Use affordable savings suggestions
                </button>
                {input("Add to emergency reserve (PHP)", "emergencyAdd")}
                {d.goalName && input("Add to your goal (PHP)", "goalAdd")}
                <div className="notice">
                  <strong>
                    {money(
                      Math.floor(
                        Math.max(
                          0,
                          plan.available -
                            displayCents(d.emergencyAdd) -
                            displayCents(d.goalAdd),
                        ) / plan.days,
                      ),
                    )}
                  </strong>{" "}
                  safe discretionary spending per day after these allocations.
                </div>
                <p className="hint">
                  You can leave both allocations at zero. Nothing is transferred
                  until you confirm.
                </p>
              </>
            ) : (
              <p className="error">
                Check your earlier steps: one of the amounts or dates needs
                attention.
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="setup-actions">
          {d.step > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                patch({ step: d.step - 1 });
                setError("");
                window.scrollTo(0, 0);
              }}
            >
              <ArrowLeft size={18} />
              Back
            </button>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Saving your plan…"
              : d.step === 8
                ? "Start using Pockit"
                : d.step === 0
                  ? "Let’s make a little plan"
                  : "Continue"}
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </main>
  );
}
