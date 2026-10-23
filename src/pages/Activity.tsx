import { Select } from "../components/Select";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { categories, money, type Data, type Entry } from "../domain/model";
import { Section, Empty, EntryList } from "../components/Common";
export function Activity({
  data,
  day,
  edit,
}: {
  data: Data;
  day: string;
  edit: (e: Entry) => void;
}) {
  const [params, setParams] = useSearchParams(),
    [selected, setSelected] = useState(""),
    [limit, setLimit] = useState(30);
  const requested = params.get("month") ?? day.slice(0, 7),
    month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(requested)
      ? requested
      : day.slice(0, 7),
    query = params.get("q") ?? "",
    category = params.get("category") ?? "All";
  const monthDate = parseISO(`${month}-01`),
    entries = data.entries.filter((e) => e.date.startsWith(month)),
    expenses = entries.filter((e) => e.kind === "expense"),
    spent = expenses.reduce((s, e) => s + e.amount, 0),
    income = entries
      .filter((e) => e.kind === "income")
      .reduce((s, e) => s + e.amount, 0);
  const filtered = [...entries]
    .reverse()
    .filter(
      (e) =>
        (!selected || e.date === selected) &&
        (category === "All" ||
          e.kind === category ||
          e.category === category) &&
        e.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
    setLimit(30);
  };
  const shift = (delta: number) => {
    setSelected("");
    update("month", format(addMonths(monthDate, delta), "yyyy-MM"));
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>The bigger picture.</h1>
          <p>Notice your habits. Make space for better ones.</p>
        </div>
      </div>
      <div className="month-picker">
        <button
          aria-label="Previous month"
          className="icon-button"
          onClick={() => shift(-1)}
        >
          <ChevronLeft />
        </button>
        <h2>{format(monthDate, "MMMM yyyy")}</h2>
        <button
          aria-label="Next month"
          className="icon-button"
          onClick={() => shift(1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="dashboard-grid">
        <Section title="Where your money went">
          {!!data.finance?.adjustments?.some((a) =>
            a.date.startsWith(month),
          ) && (
            <p className="hint">
              Balance corrections this month:{" "}
              {money(
                data.finance.adjustments
                  .filter((a) => a.date.startsWith(month))
                  .reduce((sum, a) => sum + a.delta, 0),
              )}
              . Corrections and account transfers are excluded from income and
              spending. <Link to="/money">Review account history</Link>
            </p>
          )}
          <div className="analytics-totals">
            <div>
              <span>Spent</span>
              <strong>{money(spent)}</strong>
            </div>
            <div>
              <span>Received</span>
              <strong className="positive">{money(income)}</strong>
            </div>
          </div>
          {spent ? (
            <div className="chart" aria-label="Expenses by category">
              {categories.map((c) => {
                const sum = expenses
                  .filter((e) => e.category === c)
                  .reduce((s, e) => s + e.amount, 0);
                return (
                  <div className="bar-row" key={c}>
                    <div className="row">
                      <span>{c}</span>
                      <strong>{money(sum)}</strong>
                    </div>
                    <div className="bar-track">
                      <div style={{ width: `${(sum / spent) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>
              Your spending patterns will appear after your first expense this
              month.
            </Empty>
          )}
          <p className="hint">Savings transfers are excluded from spending.</p>
        </Section>
        <Section title="Browse your recorded days">
          <div className="calendar">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span className="weekday" key={i}>
                {d}
              </span>
            ))}
            {Array.from({ length: getDay(monthDate) }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {eachDayOfInterval({
              start: startOfMonth(monthDate),
              end: endOfMonth(monthDate),
            }).map((date) => {
              const key = format(date, "yyyy-MM-dd"),
                hasEntry = entries.some((e) => e.date === key);

              return (
                <button
                  className={`${key === day ? "today" : ""} ${selected === key ? "selected" : ""}`}
                  aria-pressed={selected === key}
                  aria-label={`${format(date, "MMMM d")}${hasEntry ? ", transactions" : ""}`}
                  key={key}
                  onClick={() => setSelected(selected === key ? "" : key)}
                >
                  {format(date, "d")}
                  <span className="calendar-dots">{hasEntry && <i />}</span>
                </button>
              );
            })}
          </div>
          <p className="hint">
            Dates with a dot have recorded transactions. Tap to filter.
          </p>
          {selected && (
            <button className="text-button" onClick={() => setSelected("")}>
              Show the whole month
            </button>
          )}
          <Link to="/calendar" className="inline-link">
            See your upcoming financial calendar
          </Link>
        </Section>
        <Section title="Transaction history" className="wide">
          <div className="filters">
            <label className="search-label">
              <Search size={18} />
              <input
                aria-label="Search transactions"
                placeholder="Search transactions…"
                value={query}
                onChange={(e) => update("q", e.target.value)}
              />
            </label>
            <label className="filter-select">
              <span className="sr-only">Filter transactions</span>
              <Select
                value={category}
                onChange={(e) => update("category", e.target.value)}
              >
                <option>All</option>
                <option value="income">Income</option>
                <option value="save">Savings in</option>
                <option value="withdraw">Savings out</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </label>
          </div>
          {filtered.length ? (
            <>
              <EntryList entries={filtered.slice(0, limit)} onEdit={edit} />
              {filtered.length > limit && (
                <button
                  className="secondary full"
                  onClick={() => setLimit(limit + 30)}
                >
                  Show more transactions
                </button>
              )}
            </>
          ) : (
            <Empty>
              No transactions match this view. Try another month or clear your
              filters.
            </Empty>
          )}
        </Section>
      </div>
    </>
  );
}
