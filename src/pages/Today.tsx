import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ShieldCheck,
  Plus,
  ArrowDownLeft,
  Sprout,
  BusFront,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { budget, goalBalance } from "../domain/budget";
import { travel } from "../domain/transport";
import { billOccurrences } from "../domain/schedule";
import { money, type Data, type Entry } from "../domain/model";
import { Section, Empty, EntryList } from "../components/Common";
import { Briefing } from "../components/Briefing";
export function Today({
  data,
  day,
  add,
  plan,
  edit,
}: {
  data: Data;
  day: string;
  add: (kind?: Entry["kind"]) => void;
  plan: () => void;
  edit: (e: Entry) => void;
}) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const greeting =
    hour < 12
      ? "Good morning."
      : hour < 18
        ? "Good afternoon."
        : "Good evening.";
  const b = budget(data, day),
    recent = [...data.entries]
      .reverse()
      .sort((a, c) => c.date.localeCompare(a.date))
      .slice(0, 3),
    goals = data.goals.filter((g) => !g.emergency).slice(0, 2);
  const allocations = [
    ["Travel", b.transport, "blue"],
    ["Essentials", b.essential, "yellow"],
    ["Savings", b.saved - b.emergency, "mint"],
    ["Emergency", b.emergency, "lavender"],
    ["Leisure", b.leisure, "peach"],
  ] as const;
  const nextTrip = Array.from({ length: 14 }, (_, i) =>
      format(addDays(parseISO(day), i), "yyyy-MM-dd"),
    ).find((date) => travel(data, date).plan.mode === "campus"),
    bills = billOccurrences(
      data,
      day,
      format(addDays(parseISO(day), 14), "yyyy-MM-dd"),
    )
      .filter((b) => b.remaining > 0)
      .slice(0, 2),
    spentToday = data.entries
      .filter((e) => e.date === day && e.kind === "expense")
      .reduce((s, e) => s + e.amount, 0);
  return (
    <>
      <div className="page-heading home-heading">
        <div>
          <p className="date-label">{format(parseISO(day), "EEEE, MMMM d")}</p>
          <h1>
            {greeting}
            <br />A little plan for today.
          </h1>
        </div>
        <div className="sun-mark" aria-hidden="true">
          <Sparkles size={32} />
        </div>
      </div>
      <div className="dashboard-grid home-grid">
        <section className="spend-card">
          <div className="row">
            <span>Safe to spend today</span>
            <span className="health-pill">
              {b.shortfall
                ? "Needs a little care"
                : b.daily > 0
                  ? "Looking good"
                  : "Let’s make a plan"}
            </span>
          </div>
          <div className="daily-amount" data-testid="safe-spend">
            {money(b.daily)}
          </div>
          <p>For your everyday extras. Your commitments come first.</p>
          <div className="card-stats">
            <div>
              <span>Money remaining</span>
              <strong data-testid="total-cash">{money(b.cash)}</strong>
            </div>
            <div>
              <span>Until next allowance</span>
              <strong>
                {b.days} {b.days === 1 ? "day" : "days"}
              </strong>
            </div>
          </div>
          <div className="spend-card-footer">
            <ShieldCheck size={17} />
            <span>Travel, essentials & pockets protected</span>
          </div>
          <button className="add-transaction" onClick={() => add("expense")}>
            <Plus size={20} />
            Add transaction
            <ArrowUpRight size={18} />
          </button>
        </section>
        <div className="home-side">
          <div className="quick-actions" aria-label="Quick actions">
            <button onClick={() => add("expense")}>
              <span className="quick-icon blue">
                <Plus />
              </span>
              <span>
                Add
                <br />
                expense
              </span>
            </button>
            <button onClick={() => add("income")}>
              <span className="quick-icon yellow">
                <ArrowDownLeft />
              </span>
              <span>
                Add
                <br />
                income
              </span>
            </button>
            <button onClick={() => add("save")}>
              <span className="quick-icon mint">
                <Sprout />
              </span>
              <span>
                Add
                <br />
                savings
              </span>
            </button>
            <Link to="/transport">
              <span className="quick-icon peach">
                <BusFront />
              </span>
              <span>
                Your
                <br />
                travel
              </span>
            </Link>
            <button onClick={plan}>
              <span className="quick-icon lavender">
                <SlidersHorizontal />
              </span>
              <span>
                Adjust
                <br />
                budget
              </span>
            </button>
          </div>
          <Section
            title="Every peso has a place"
            action={
              <button className="text-button" onClick={plan}>
                Adjust
              </button>
            }
          >
            <div className="allocation-strip" aria-hidden="true">
              {allocations.map(([label, value, color]) => (
                <span
                  key={label}
                  className={`allocation-${color}`}
                  style={{ flex: Math.max(0, value) }}
                />
              ))}
              <span
                className="segment-free"
                style={{ flex: Math.max(1, b.available) }}
              />
            </div>
            <div className="allocation-list">
              {allocations.map(([label, value, color]) => (
                <div key={label}>
                  <span className={`allocation-dot allocation-${color}`} />
                  <span>{label}</span>
                  <strong>{money(value)}</strong>
                </div>
              ))}
            </div>
            {b.plannedSavings > 0 && (
              <p className="hint">
                Plus {money(b.plannedSavings)} in planned contributions.
              </p>
            )}
            <div className="row flexible-row">
              <span>Flexible money</span>
              <strong>{money(Math.max(0, b.available))}</strong>
            </div>
          </Section>
        </div>
        <Briefing data={data} day={day} />
        {(b.shortfall > 0 || b.overdue) && (
          <div className="notice warning wide">
            {b.shortfall > 0 && (
              <p>
                <strong>{money(b.shortfall)} overcommitted.</strong> Adjust
                commitments or add money you’ve received. Your daily guide stays
                at zero.
              </p>
            )}
            {b.overdue && (
              <p>
                Your allowance date has arrived. Receive it when it lands, then
                update your plan.
              </p>
            )}
          </div>
        )}
        <Section
          title="Little by little"
          action={
            <Link to="/pockets">
              Your goals <ArrowUpRight size={15} />
            </Link>
          }
        >
          {goals.length ? (
            goals.map((g) => {
              const saved = goalBalance(data, g.id);
              return (
                <Link className="home-goal" to="/pockets" key={g.id}>
                  <span className="goal-symbol mint">
                    <Sprout size={23} />
                  </span>
                  <div>
                    <strong>{g.name}</strong>
                    <small>
                      {money(saved)} of {money(g.target)}
                    </small>
                    <progress
                      value={saved}
                      max={g.target}
                      aria-label={`${g.name} progress`}
                    />
                  </div>
                  <ArrowRight size={18} />
                </Link>
              );
            })
          ) : (
            <div className="goal-invitation">
              <span className="goal-symbol yellow">
                <Sparkles />
              </span>
              <h3>Something worth looking forward to?</h3>
              <p className="muted">
                Big dreams start with small, comfortable steps.
              </p>
              <Link className="inline-link" to="/pockets">
                Make your first goal <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </Section>
        <Section
          title="Coming up"
          action={
            <Link to="/calendar">
              View calendar <ArrowUpRight size={15} />
            </Link>
          }
        >
          <div className="event-row">
            <span className="event-icon blue">
              <ArrowDownLeft />
            </span>
            <div>
              <strong>Next allowance</strong>
              <small>
                {format(parseISO(data.settings.nextAllowance), "MMM d")} ·
                Expected
                {data.allowance.amount
                  ? ` · ${money(data.allowance.amount)}`
                  : ""}
              </small>
            </div>
          </div>
          {nextTrip && (
            <Link to="/transport" className="event-row">
              <span className="event-icon yellow">
                <BusFront />
              </span>
              <div>
                <strong>Your next school day</strong>
                <small>
                  {format(parseISO(nextTrip), "EEE, MMM d")} ·{" "}
                  {money(travel(data, nextTrip).remaining)}
                </small>
              </div>
              <ArrowRight size={17} />
            </Link>
          )}
          {bills.map((item) => (
            <div className="event-row" key={item.id + item.date}>
              <span className="event-icon peach">
                <ShieldCheck />
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {format(parseISO(item.date), "MMM d")} ·{" "}
                  {money(item.remaining)}
                </small>
              </div>
            </div>
          ))}
          {data.plannedSavings
            .filter(
              (p) => !data.entries.some((e) => e.source === `saving:${p.id}`),
            )
            .slice(0, 1)
            .map((p) => (
              <div className="event-row" key={p.id}>
                <span className="event-icon mint">
                  <Sprout />
                </span>
                <div>
                  <strong>Planned savings</strong>
                  <small>
                    {format(parseISO(p.date), "MMM d")} · {money(p.amount)}
                  </small>
                </div>
              </div>
            ))}
        </Section>
        <Section
          title="Your latest little updates"
          action={
            <Link to="/activity">
              View all <ArrowUpRight size={15} />
            </Link>
          }
        >
          {recent.length ? (
            <EntryList entries={recent} onEdit={edit} />
          ) : (
            <Empty>
              Record your first expense or received income. Your story starts
              with the money you actually have.
            </Empty>
          )}
        </Section>
        <Section title="A little perspective">
          <div className="insight-line">
            <Sparkles size={24} />
            <p>
              {spentToday ? (
                <>
                  You’ve recorded <strong>{money(spentToday)}</strong> in
                  expenses today. Your daily guide has already adjusted.
                </>
              ) : (
                <>
                  No expenses recorded today. Add them as you go for a plan you
                  can trust.
                </>
              )}
            </p>
          </div>
          <div className="row leisure-number">
            <strong>{money(b.leisure)}</strong>
            <span>left for little joys</span>
          </div>
          <p className="hint">
            Leisure is already set aside. Savings transfers never count as
            expenses.
          </p>
        </Section>
      </div>
      <p className="footnote">Small steps count. Your plan changes with you.</p>
    </>
  );
}
