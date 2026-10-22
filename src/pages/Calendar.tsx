import { useState } from "react";
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  parseISO,
  addDays,
  differenceInCalendarDays,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  BusFront,
  ArrowDownLeft,
  Sprout,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { type Data, type Entry, money, today } from "../domain/model";
import { expectedOccurrences, billOccurrences } from "../domain/schedule";
import { travel } from "../domain/transport";
import { forecast } from "../domain/forecast";
import { budget } from "../domain/budget";
import { receive, contribute } from "../domain/actions";
import { change } from "../data/db";
import { Section, EntryList, Empty } from "../components/Common";
import { DayEditor } from "./Transport";
export function Calendar({
  data,
  day,
  edit,
  add,
  run,
}: {
  data: Data;
  day: string;
  edit: (entry: Entry) => void;
  add: (date: string) => void;
  run: (fn: () => Promise<unknown>, message?: string) => void;
}) {
  const [month, setMonth] = useState(day.slice(0, 7)),
    [selected, setSelected] = useState(day);
  const date = parseISO(`${month}-01`),
    end = format(endOfMonth(date), "yyyy-MM-dd"),
    start = format(startOfMonth(date), "yyyy-MM-dd"),
    expected = expectedOccurrences(data, start, end),
    bills = billOccurrences(data, start, end),
    trip = travel(data, selected),
    entries = data.entries.filter((e) => e.date === selected),
    projection =
      selected >= day
        ? forecast(data, day, selected).find((p) => p.date === selected)
            ?.balance
        : budget(data, selected).liquid;
  const forecastEnd = format(addDays(parseISO(day), 30), "yyyy-MM-dd"),
    points = forecast(data, day, forecastEnd),
    low = points.find((p) => p.balance < 0),
    max = Math.max(1, ...points.map((p) => Math.abs(p.balance))),
    baseline = 72;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Good things on the horizon.</h1>
          <p>Your days, with money in mind.</p>
        </div>
        <CalendarDays className="heading-icon" size={34} />
      </div>
      <div className="allowance-banner">
        <span className="round-icon">
          <ArrowDownLeft />
        </span>
        <div>
          <strong>
            {Math.max(
              0,
              differenceInCalendarDays(
                parseISO(data.settings.nextAllowance),
                parseISO(day),
              ),
            )}{" "}
            days until your next allowance
          </strong>
          <small>
            {format(parseISO(data.settings.nextAllowance), "EEEE, MMMM d")} ·
            Expected, not spendable yet
          </small>
        </div>
      </div>
      <div className="dashboard-grid">
        <Section title="Your month">
          <div className="month-picker">
            <button
              aria-label="Previous month"
              className="icon-button"
              onClick={() => setMonth(format(addMonths(date, -1), "yyyy-MM"))}
            >
              <ChevronLeft />
            </button>
            <h2>{format(date, "MMMM yyyy")}</h2>
            <button
              aria-label="Next month"
              className="icon-button"
              onClick={() => setMonth(format(addMonths(date, 1), "yyyy-MM"))}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="calendar financial-calendar" key={month}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span className="weekday" key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: getDay(date) }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {eachDayOfInterval({
              start: startOfMonth(date),
              end: endOfMonth(date),
            }).map((d) => {
              const key = format(d, "yyyy-MM-dd"),
                school = travel(data, key).plan.mode === "campus",
                income =
                  expected.some((e) => e.date === key) ||
                  data.settings.nextAllowance === key,
                activity = data.entries.some((e) => e.date === key),
                bill = bills.some((e) => e.date === key),
                saving = data.plannedSavings.some((p) => p.date === key),
                boundary =
                  key === data.settings.cycleStart ||
                  key === data.settings.nextAllowance;
              return (
                <button
                  key={key}
                  className={`${key === day ? "today" : ""} ${selected === key ? "selected" : ""} ${income ? "allowance-day" : ""} ${boundary ? "cycle-boundary" : ""}`}
                  aria-pressed={selected === key}
                  aria-label={`${format(d, "MMMM d")}${school ? ", school" : ""}${income ? ", allowance or income" : ""}${bill ? ", bills" : ""}${saving ? ", planned savings" : ""}${activity ? ", activity" : ""}${boundary ? ", budget cycle boundary" : ""}`}
                  onClick={() => setSelected(key)}
                >
                  {format(d, "d")}
                  <span className="calendar-dots">
                    {school && <i className="school-dot" />}
                    {income && <i className="income-dot" />}
                    {(bill || activity) && <i />}
                    {saving && <i className="savings-dot" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="school-dot" />
              Campus
            </span>
            <span>
              <i className="income-dot" />
              Expected money
            </span>
            <span>
              <i />
              Bills / activity
            </span>
            <span>
              <i className="savings-dot" />
              Planned savings
            </span>
          </div>
          <p className="hint">
            Blue dates mark expected money; outlined dates mark your cycle
            boundaries. Select any day to see its plan.
          </p>
        </Section>
        <Section title={format(parseISO(selected), "EEEE, MMMM d")}>
          <div className="projection">
            <span>
              {selected < day
                ? "Historical unprotected balance"
                : "Projected unprotected money"}
            </span>
            <strong className={(projection ?? 0) < 0 ? "negative" : ""}>
              {projection === undefined
                ? "Beyond 2-year forecast"
                : money(projection)}
            </strong>
          </div>
          <p className="hint">
            {selected >= day
              ? "Current cash minus commitments and planned savings. No future income or unplanned purchases assumed."
              : "Uses recorded transactions through this date."}
          </p>
          <div className="day-events">
            {expected
              .filter((e) => e.date === selected)
              .map((e) => (
                <div className="event-row" key={e.source}>
                  <ArrowDownLeft />
                  <div>
                    <strong>{e.name}</strong>
                    <small>
                      {e.received ? "Received" : "Expected"} · {money(e.amount)}
                    </small>
                  </div>
                  {!e.received && (
                    <button
                      className="small-button"
                      onClick={() =>
                        run(
                          () => change((d) => receive(d, e.source, e.date)),
                          "Income received. Your balance is updated.",
                        )
                      }
                    >
                      Receive
                    </button>
                  )}
                </div>
              ))}
            {bills
              .filter((e) => e.date === selected)
              .map((e) => (
                <div className="event-row" key={`${e.id}-${e.date}`}>
                  <Receipt />
                  <div>
                    <strong>{e.name}</strong>
                    <small>
                      {e.remaining ? `${money(e.remaining)} reserved` : "Paid"}
                      {e.frequency && e.frequency !== "irregular"
                        ? ` · ${e.frequency}`
                        : ""}
                    </small>
                  </div>
                </div>
              ))}
            {trip.plan.mode === "campus" && (
              <div className="event-row">
                <BusFront />
                <div>
                  <strong>On-campus day</strong>
                  <small>{money(trip.remaining)} travel still reserved</small>
                </div>
                <Link
                  aria-label="Open transportation"
                  to={`/transport?date=${selected}`}
                >
                  <ArrowRight size={20} />
                </Link>
              </div>
            )}
            {data.plannedSavings
              .filter((p) => p.date === selected)
              .map((p) => (
                <div className="event-row" key={p.id}>
                  <Sprout />
                  <div>
                    <strong>
                      {data.goals.find((g) => g.id === p.goalId)?.name}
                    </strong>
                    <small>{money(p.amount)} planned savings</small>
                  </div>
                  {!data.entries.some((e) => e.source === `saving:${p.id}`) && (
                    <button
                      className="small-button"
                      onClick={() =>
                        run(() => change((d) => contribute(d, p.id)))
                      }
                    >
                      Contribute
                    </button>
                  )}
                </div>
              ))}
          </div>
          <details className="day-details">
            <summary>Adjust this school day</summary>
            <DayEditor data={data} date={selected} run={run} />
          </details>
          {entries.length ? (
            <EntryList entries={[...entries].reverse()} onEdit={edit} />
          ) : (
            <Empty>No recorded transactions on this day.</Empty>
          )}
          <button
            className="secondary full"
            disabled={selected > today()}
            onClick={() => add(selected)}
          >
            Add transaction on this date
          </button>
        </Section>
        <Section title="A look at the next 30 days" className="wide">
          <div className="forecast-header">
            <p className="muted">
              {low
                ? `Commitments could exceed available money from ${format(parseISO(low.date), "MMM d")}.`
                : "Your planned commitments fit within your current money over this period."}
            </p>
            <span className="pill">Future income excluded</span>
          </div>
          <svg
            className="forecast-chart"
            role="img"
            aria-label={`Projected unprotected balance from ${money(points[0]?.balance ?? 0)} to ${money(points.at(-1)?.balance ?? 0)} over 30 days`}
            viewBox="0 0 620 150"
          >
            <line
              x1="10"
              y1={baseline}
              x2="610"
              y2={baseline}
              stroke="var(--line)"
              strokeDasharray="4 5"
            />
            <polyline
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinejoin="round"
              points={points
                .map(
                  (p, i) =>
                    `${10 + (i * 600) / (points.length - 1)},${baseline - (p.balance / max) * 58}`,
                )
                .join(" ")}
            />
          </svg>
          <div className="row goal-meta">
            <span>
              {format(parseISO(day), "MMM d")} ·{" "}
              {money(points[0]?.balance ?? 0)}
            </span>
            <span>
              {format(parseISO(forecastEnd), "MMM d")} ·{" "}
              {money(points.at(-1)?.balance ?? 0)}
            </span>
          </div>
          <p className="hint">
            A commitment forecast, not a promise. Your real spending and future
            received income will change it.
          </p>
        </Section>
      </div>
    </>
  );
}
