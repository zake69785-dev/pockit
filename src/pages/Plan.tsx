import { Link } from "react-router-dom";
import {
  CalendarDays,
  BusFront,
  ArrowDownLeft,
  ArrowRight,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { money, type Data } from "../domain/model";
import { budget } from "../domain/budget";
import { expectedOccurrences, billOccurrences } from "../domain/schedule";
import { receive } from "../domain/actions";
import { change } from "../data/db";
import { Section, Empty, AddButton } from "../components/Common";
import type { FormKind } from "../components/EntryForm";
export function Plan({
  data,
  day,
  open,
  run,
}: {
  data: Data;
  day: string;
  open: (kind: FormKind) => void;
  run: (fn: () => Promise<unknown>, message?: string) => void;
}) {
  const b = budget(data, day),
    expected = expectedOccurrences(
      data,
      "2000-01-01",
      format(addDays(parseISO(day), 30), "yyyy-MM-dd"),
    )
      .filter((e) => !e.received)
      .slice(0, 20),
    bills = billOccurrences(
      data,
      "2000-01-01",
      format(addDays(parseISO(day), 30), "yyyy-MM-dd"),
    )
      .filter((item) => item.remaining > 0 || item.date >= day)
      .slice(0, 30);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A little plan goes a long way.</h1>
          <p>Room for what you need, and what comes next.</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <Section
          title="Your allowance rhythm"
          action={
            <button className="text-button" onClick={() => open("plan")}>
              Edit plan
            </button>
          }
        >
          <div className="detail-row">
            <CalendarDays />
            <div>
              <strong>
                {format(parseISO(data.settings.nextAllowance), "EEEE, MMMM d")}
              </strong>
              <p>
                Next allowance ·{" "}
                {data.allowance.frequency === "irregular"
                  ? "Irregular"
                  : data.allowance.frequency}
                {data.allowance.amount
                  ? ` · ${money(data.allowance.amount)}`
                  : ""}
              </p>
            </div>
          </div>
          <dl className="breakdown">
            <div>
              <dt>Flexible daily guide</dt>
              <dd>{money(b.daily)}</dd>
            </div>
            <div>
              <dt>Leisure left this cycle</dt>
              <dd>{money(b.leisure)}</dd>
            </div>
            <div>
              <dt>Budget preference</dt>
              <dd>
                {data.preference === "savings"
                  ? "Savings-focused"
                  : data.preference}
              </dd>
            </div>
          </dl>
          <p className="hint">
            Recurring allowances are reminders. They only become available after
            you receive them.
          </p>
        </Section>
        <Section title="Your ways to get there">
          <div className="transport-teaser">
            <BusFront size={35} />
            <div>
              <strong>{money(b.transport)}</strong>
              <span>protected for upcoming journeys</span>
            </div>
          </div>
          <p className="muted">
            Multi-leg routes, different ways home, and a school schedule that
            can change with your week.
          </p>
          <Link className="primary full" to="/transport">
            Open transportation planner <ArrowRight size={18} />
          </Link>
        </Section>
        <Section
          title="Expected income"
          action={<AddButton onClick={() => open("expected")} />}
        >
          {expected.length ? (
            expected.map((item) => (
              <div className="planned-item" key={item.source}>
                <div className="row">
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      {format(parseISO(item.date), "MMM d, yyyy")} · Expected
                    </p>
                  </div>
                  <strong>{money(item.amount)}</strong>
                </div>
                <div className="button-row">
                  <button
                    className="small-button"
                    onClick={() =>
                      run(
                        () => change((d) => receive(d, item.source, item.date)),
                        "Income received. Your budget is updated.",
                      )
                    }
                  >
                    <ArrowDownLeft size={16} />
                    Receive
                  </button>
                  {item.id !== "allowance" && (
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          confirm(
                            "Remove this expected income and future repetitions? Received history stays unchanged.",
                          )
                        )
                          run(() =>
                            change((d) => {
                              d.expected = d.expected.filter(
                                (x) => x.id !== item.id,
                              );
                            }),
                          );
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Empty>
              Add a reminder for money you expect. It won’t affect your
              available balance.
            </Empty>
          )}
          <p className="hint">
            Up to 20 pending occurrences. Explore other dates in Calendar.
          </p>
        </Section>
        <Section
          title="Essential reservations"
          action={<AddButton onClick={() => open("bill")} />}
        >
          {bills.length ? (
            bills.map((item) => (
              <div className="planned-item" key={item.id + item.date}>
                <div className="row">
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      Due {format(parseISO(item.date), "MMM d, yyyy")} ·{" "}
                      {item.remaining
                        ? `${money(item.remaining)} remaining`
                        : "Paid"}
                      {item.frequency && item.frequency !== "irregular"
                        ? ` · ${item.frequency}`
                        : ""}
                    </p>
                  </div>
                  <strong>{money(item.amount)}</strong>
                </div>
                {!data.entries.some((e) => e.billId === item.id) && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        confirm(
                          "Remove this reservation and future repetitions?",
                        )
                      )
                        run(() =>
                          change((d) => {
                            if (d.entries.some((e) => e.billId === item.id))
                              throw new Error(
                                "This essential has payment history.",
                              );
                            d.bills = d.bills.filter((x) => x.id !== item.id);
                          }),
                        );
                    }}
                  >
                    Remove reservation
                  </button>
                )}
                {item.frequency &&
                  item.frequency !== "irregular" &&
                  !item.until && (
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          confirm(
                            "Stop future repetitions? Existing payments and outstanding bills through today stay unchanged.",
                          )
                        )
                          run(() =>
                            change((d) => {
                              const bill = d.bills.find(
                                (b) => b.id === item.id,
                              );
                              if (bill)
                                bill.until = [
                                  day,
                                  ...d.entries
                                    .filter((e) => e.billId === item.id)
                                    .map((e) => e.billDate ?? bill.date),
                                ]
                                  .sort()
                                  .at(-1)!;
                            }),
                          );
                      }}
                    >
                      Stop future repetitions
                    </button>
                  )}
                {item.until && (
                  <p className="hint">
                    Repetitions ended {item.until}. Earlier unpaid amounts stay
                    reserved.
                  </p>
                )}
              </div>
            ))
          ) : (
            <Empty>
              Food, supplies, mobile data, bills. Reserve what you need, and
              link each payment so it counts only once.
            </Empty>
          )}
          <button
            className="secondary full"
            onClick={() => open("transaction")}
          >
            Record an essential payment
          </button>
          <p className="hint">
            For a new recurring price, stop future repetitions and add a
            replacement reservation. Recorded payments stay unchanged.
          </p>
        </Section>
      </div>
    </>
  );
}
