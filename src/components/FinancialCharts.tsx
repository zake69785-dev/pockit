import { useState } from "react";
import { Section } from "./Common";
import { Select } from "./Select";
import { money, type Data } from "../domain/model";
import {
  allocation,
  categorySpending,
  commuteComparison,
  goalProgress,
  historicalBalances,
  monthlyFlow,
  rangeStart,
  type Range,
} from "../domain/analytics";

const hues = ["#3265d8", "#2c8464", "#9a5c28", "#7657b8", "#c2545e"];
function Bars({ rows }: { rows: { name: string; amount: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <div className="chart-rows">
      {rows.map((row, index) => (
        <div className="chart-row" key={row.name}>
          <div className="chart-row-label">
            <span>{row.name}</span>
            <strong>{money(row.amount)}</strong>
          </div>
          <div className="chart-track">
            <span
              style={{
                width: `${(Math.max(0, row.amount) / max) * 100}%`,
                backgroundColor: hues[index % hues.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
function BalanceLine({ rows }: { rows: { date: string; amount: number }[] }) {
  const values = rows.map((row) => row.amount),
    min = Math.min(...values),
    max = Math.max(...values),
    span = Math.max(1, max - min);
  const first = Date.parse(rows[0].date),
    duration = Math.max(
      1,
      Date.parse(rows.at(-1)?.date ?? rows[0].date) - first,
    );
  const points = rows
    .map(
      (row) =>
        `${((Date.parse(row.date) - first) / duration) * 100},${max === min ? 50 : 95 - ((row.amount - min) / span) * 90}`,
    )
    .join(" ");
  return (
    <div className="balance-chart">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Recorded balance from ${rows[0].date} to ${rows.at(-1)?.date}: ${money(rows[0].amount)} to ${money(rows.at(-1)?.amount ?? 0)}`}
      >
        <line
          x1="0"
          y1="95"
          x2="100"
          y2="95"
          stroke="currentColor"
          opacity=".3"
          strokeWidth=".5"
        />
        {rows.length === 1 ? (
          <circle cx="50" cy="50" r="3" fill="var(--accent)" />
        ) : (
          <polyline
            points={points}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="chart-row-label">
        <span>
          {rows[0].date} · {money(rows[0].amount)}
        </span>
        <strong>
          {rows.at(-1)?.date} · {money(rows.at(-1)?.amount ?? 0)}
        </strong>
      </div>
    </div>
  );
}
export function FinancialCharts({ data, day }: { data: Data; day: string }) {
  const [range, setRange] = useState<Range>("allowance");
  const start = rangeStart(data, day, range);
  const spending = categorySpending(data, start, day);
  const balances = historicalBalances(data, day, range);
  const allocations = allocation(data, day);
  const commute = commuteComparison(data);
  const goals = goalProgress(data, day);
  const flow = monthlyFlow(data, day);
  const activeFlow = flow.filter((row) => row.income || row.expense);
  return (
    <section className="finance-insights" aria-label="Financial insights">
      <h2>Money at a glance</h2>
      <p className="hint">
        All figures come from recorded entries. Expected income and account
        transfers are excluded.
      </p>
      <label className="insight-period">
        Period
        <Select
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
        >
          <option value="allowance">Current allowance period</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="monthly">Monthly history</option>
        </Select>
      </label>
      <div className="dashboard-grid insight-grid">
        <Section title="Spending by category">
          {spending.total ? (
            <>
              <p className="chart-total">{money(spending.total)} spent</p>
              <Bars rows={spending.rows} />
              <ul className="chart-breakdown">
                {spending.rows.map((row) => (
                  <li key={row.name}>
                    {row.name}: {money(row.amount)} ({row.percent.toFixed(1)}%)
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hint">No recorded spending in this period.</p>
          )}
        </Section>
        <Section title="Balance over time">
          <p className="hint">
            Recorded money on hand after saved amounts. Historical, not a
            projection.
          </p>
          <BalanceLine rows={balances} />
        </Section>
        <Section title="Current budget allocation">
          <p className="hint">
            Reserved amounts are parts of your recorded cash, not extra money.
          </p>
          <Bars rows={allocations.rows} />
          <p className="hint">
            {allocations.shortfall
              ? `Shortfall: ${money(allocations.shortfall)}. Planned needs exceed available money.`
              : `Unallocated: ${money(Math.max(0, allocations.total - allocations.rows.reduce((s, row) => s + row.amount, 0)))}.`}
          </p>
        </Section>
        <Section title="Saved commute routes">
          {commute.routes.length ? (
            <>
              <p className="hint">
                Lowest saved one-way fare: {commute.cheapest.name} ·{" "}
                {money(commute.cheapest.fare)}.
              </p>
              <Bars
                rows={commute.routes.map((route) => ({
                  name: route.name,
                  amount: route.fare,
                }))}
              />
              <p className="hint">
                Selected outbound:{" "}
                {commute.outbound
                  ? `${commute.outbound.name} · ${money(commute.outbound.fare)}`
                  : "No route selected"}
                . Return:{" "}
                {commute.inbound
                  ? `${commute.inbound.name} · ${money(commute.inbound.fare)}`
                  : "No route selected"}
                . Round trip:{" "}
                {commute.roundTrip === null
                  ? "Select both routes"
                  : money(commute.roundTrip)}
                .
              </p>
            </>
          ) : (
            <p className="hint">
              Save commute routes in Transportation to compare actual fares.
            </p>
          )}
        </Section>
        <Section title="Savings goals">
          {goals.length ? (
            <div className="chart-rows">
              {goals.map((goal) => (
                <div className="chart-row" key={goal.name}>
                  <div className="chart-row-label">
                    <span>{goal.name}</span>
                    <strong>
                      {money(goal.saved)} / {money(goal.target)}
                    </strong>
                  </div>
                  <div className="chart-track">
                    <span
                      style={{
                        width: `${goal.target > 0 ? Math.min(100, Math.max(0, (goal.saved / goal.target) * 100)) : 100}%`,
                        backgroundColor: "var(--mint-ink)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">No savings goals yet.</p>
          )}
        </Section>
        <Section title="Monthly income and expenses">
          {activeFlow.length ? (
            <div className="chart-rows">
              {flow.map((row) => (
                <div className="monthly-row" key={row.month}>
                  <strong>{row.month}</strong>
                  <div className="monthly-values">
                    <span>
                      Income {money(row.income)}
                      <i
                        style={{
                          width: `${(row.income / Math.max(1, ...flow.flatMap((item) => [item.income, item.expense]))) * 100}%`,
                        }}
                      />
                    </span>
                    <span>
                      Spent {money(row.expense)}
                      <i
                        style={{
                          width: `${(row.expense / Math.max(1, ...flow.flatMap((item) => [item.income, item.expense]))) * 100}%`,
                        }}
                      />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">
              No recorded income or spending in the last 12 months.
            </p>
          )}
          <p className="hint">
            Savings moves and account transfers are excluded. Zero-income months
            remain visible when spending was recorded.
          </p>
        </Section>
      </div>
    </section>
  );
}
