import { useRef, useState, type FormEvent } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { change } from "../data/db";
import {
  accountBalance,
  adjustBalance,
  addAccount,
  financialAccounts,
  transferAccounts,
} from "../domain/accounts";
import { lowFunds, simulatePurchase } from "../domain/assistance";
import {
  cents,
  freshFinance,
  id,
  money,
  today,
  type Account,
  type Data,
} from "../domain/model";
import { routeTotal } from "../domain/transport";
import { Section } from "../components/Common";
import { Field } from "../components/EntryForm";
import { AccountSelect } from "../components/AccountSelect";

export function Money({ data, day }: { data: Data; day: string }) {
  const finance = financialAccounts(data),
    assistance = lowFunds(data, day);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const transferOperation = useRef("");
  const [purchase, setPurchase] = useState<{
    name: string;
    price: number;
    accountId: string;
    date: string;
    id: string;
  } | null>(null);
  const result =
    purchase &&
    purchase.date >= day &&
    finance.accounts.some((a) => a.id === purchase.accountId) &&
    !data.entries.some((e) => e.id === purchase.id)
      ? simulatePurchase(
          data,
          purchase.price,
          purchase.accountId,
          purchase.date,
        )
      : null;
  async function update(action: (d: Data) => void, success: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await change(action);
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function transfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    transferOperation.current ||= id();
    const operationId = transferOperation.current;
    void update(
      (d) =>
        transferAccounts(
          d,
          String(f.get("from")),
          String(f.get("to")),
          cents(String(f.get("amount"))),
          day,
          operationId,
        ),
      "Transfer recorded. Your total money is unchanged.",
    );
  }
  function simulate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const item = {
        name: String(f.get("name")).trim(),
        price: cents(String(f.get("price"))),
        accountId: String(f.get("accountId")),
        date: String(f.get("date")),
        id: id(),
      };
      simulatePurchase(data, item.price, item.accountId, item.date);
      setPurchase(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the purchase details.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your money, in place.</h1>
          <p>Know where it is and what it needs to cover.</p>
        </div>
      </div>
      <nav className="money-links" aria-label="Money tools">
        <Link to="/plan">Plan</Link>
        <Link to="/pockets">Goals</Link>
        <Link to="/transport">Record Commute</Link>
        <Link to="/activity">Activity</Link>
      </nav>
      <div role="status">{message}</div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="dashboard-grid money-grid">
        <Section title="Your accounts">
          <dl className="breakdown">
            {finance.accounts.map((a) => (
              <div key={a.id}>
                <dt>{a.name}</dt>
                <dd>{money(accountBalance(data, a.id, day))}</dd>
              </div>
            ))}
            <div>
              <dt>Total money</dt>
              <dd>{money(assistance.cash)}</dd>
            </div>
          </dl>
          <p className="hint">
            Legacy holds money whose original account is unknown. Transfer it to
            your actual accounts to reconcile. Savings pockets protect part of
            this total; they are not extra money.
          </p>
          <details>
            <summary>Add an account</summary>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void update(
                  (d) =>
                    addAccount(
                      d,
                      String(f.get("name")),
                      String(f.get("type")) as Account["type"],
                    ),
                  "Account added with a zero balance. Transfer existing money into it.",
                );
              }}
            >
              <Field label="Account name" name="name" />
              <label>
                Account type
                <select name="type">
                  {(
                    [
                      "cash",
                      "gcash",
                      "maya",
                      "bank",
                      "savings",
                      "custom",
                    ] as const
                  ).map((t) => (
                    <option key={t} value={t}>
                      {
                        {
                          cash: "Cash",
                          gcash: "GCash",
                          maya: "Maya",
                          bank: "Bank",
                          savings: "Savings",
                          custom: "Custom",
                        }[t]
                      }
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" disabled={busy}>
                Add account
              </button>
            </form>
          </details>
          <details>
            <summary>Transfer between accounts</summary>
            <form
              className="form-stack"
              onSubmit={transfer}
              onChange={() => {
                transferOperation.current = "";
              }}
            >
              <AccountSelect data={data} name="from" label="From account" />
              <AccountSelect data={data} name="to" label="To account" />
              <Field
                label="Transfer amount (PHP)"
                name="amount"
                type="number"
                min="0.01"
              />
              <p className="hint">
                Transfer money you already own. Record new money through Receive
                income on Home.
              </p>
              <button
                className="primary"
                disabled={busy || finance.accounts.length < 2}
              >
                Confirm transfer
              </button>
            </form>
          </details>
          {finance.transfers.length > 0 && (
            <details>
              <summary>Transfer history ({finance.transfers.length})</summary>
              <ul className="money-history">
                {[...finance.transfers].reverse().map((t) => (
                  <li key={t.id}>
                    {t.date} ·{" "}
                    {finance.accounts.find((a) => a.id === t.from)?.name} →{" "}
                    {finance.accounts.find((a) => a.id === t.to)?.name}
                    <strong>{money(t.amount)}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <details>
            <summary>Reconcile an actual balance</summary>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  operation = id();
                void update(
                  (d) =>
                    adjustBalance(
                      d,
                      String(f.get("accountId")),
                      cents(String(f.get("target"))),
                      String(f.get("reason")),
                      operation,
                    ),
                  "Balance reconciled. Income and spending totals are unchanged.",
                );
              }}
            >
              <AccountSelect data={data} label="Account to reconcile" />
              <Field
                label="Actual balance (PHP)"
                name="target"
                type="number"
                min="0"
              />
              <Field label="Reason for correction" name="reason" />
              <p className="hint">
                Use this only to correct your records. For money received or
                spent, record a transaction instead. Corrections stay in the
                history below.
              </p>
              <button className="primary" disabled={busy}>
                Confirm balance correction
              </button>
            </form>
          </details>
          {!!finance.adjustments?.length && (
            <details>
              <summary>Balance correction history</summary>
              <ul className="money-history">
                {[...finance.adjustments].reverse().map((a) => (
                  <li key={a.id}>
                    {a.date} ·{" "}
                    {
                      finance.accounts.find(
                        (account) => account.id === a.accountId,
                      )?.name
                    }{" "}
                    · {a.reason}
                    <strong>{money(a.delta)}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>
        <Section title="Low Funds Mode">
          <p>
            {assistance.active
              ? "Let’s make room for your essentials."
              : "Your recorded funds cover the essentials currently planned."}
          </p>
          <dl className="breakdown">
            <div>
              <dt>Money outside savings</dt>
              <dd>{money(assistance.liquid)}</dd>
            </div>
            <div>
              <dt>Essential expenses</dt>
              <dd>{money(assistance.essential)}</dd>
            </div>
            <div>
              <dt>Upcoming transportation</dt>
              <dd>{money(assistance.transport)}</dd>
            </div>
            <div>
              <dt>Essentials shortfall</dt>
              <dd>{money(assistance.essentialShortfall)}</dd>
            </div>
            <div>
              <dt>Optional allocations</dt>
              <dd>{money(assistance.optionalRelief)}</dd>
            </div>
          </dl>
          <p className="hint">
            Next expected allowance: {data.settings.nextAllowance}. It may
            arrive later or change. Only received income is available.
          </p>
          <p>
            Review {money(assistance.leisure)} of leisure and{" "}
            {money(assistance.plannedSavings)} of planned savings before
            reducing essentials. Existing savings stay protected.
          </p>
          <Link to="/plan">Adjust your budget plan</Link>
          {assistance.routes.length > 0 && (
            <p>
              Lowest saved fare: {assistance.routes[0].name} ·{" "}
              {money(routeTotal(assistance.routes[0]))}. Check that this route
              fits your journey. <Link to="/transport">Compare routes</Link>
            </p>
          )}
          <button
            className="text-button"
            disabled={busy}
            aria-pressed={finance.lowFunds}
            onClick={() =>
              void update((d) => {
                d.finance ??= freshFinance();
                d.finance.lowFunds = !d.finance.lowFunds;
              }, "Low funds preference saved.")
            }
          >
            {finance.lowFunds ? "Turn off manual mode" : "Enable manual mode"}
          </button>
          {assistance.essentialShortfall > 0 && (
            <p className="hint">
              Automatic mode stays on while essentials exceed available money.
            </p>
          )}
        </Section>
        <Section title="Can I afford this?">
          <form className="form-stack" onSubmit={simulate}>
            <Field label="Item name" name="name" />
            <Field label="Price (PHP)" name="price" type="number" min="0.01" />
            <AccountSelect data={data} />
            <Field
              label="Intended purchase date"
              name="date"
              type="date"
              value={day}
              min={day}
              max={format(addDays(parseISO(day), 730), "yyyy-MM-dd")}
            />
            <button className="primary">Check affordability</button>
          </form>
          {purchase && result && (
            <div className="purchase-result" aria-live="polite">
              <h3>
                {purchase.name} · {money(purchase.price)}
              </h3>
              <p>
                {result.affordable
                  ? "This fits your current plan."
                  : "This would need a change to your plan or payment account."}
              </p>
              <dl className="breakdown">
                <div>
                  <dt>Payment account after purchase</dt>
                  <dd>{money(result.remainingAccount)}</dd>
                </div>
                <div>
                  <dt>Money outside savings after purchase</dt>
                  <dd>{money(result.remainingMoney)}</dd>
                </div>
                <div>
                  <dt>Safe spending after purchase</dt>
                  <dd>{money(result.available)}</dd>
                </div>
                <div>
                  <dt>Transportation to protect</dt>
                  <dd>{money(result.transport)}</dd>
                </div>
                <div>
                  <dt>Essentials to protect</dt>
                  <dd>{money(result.essentials)}</dd>
                </div>
                <div>
                  <dt>Protected savings, unchanged</dt>
                  <dd>{money(result.saved)}</dd>
                </div>
                <div>
                  <dt>Plan shortfall</dt>
                  <dd>{money(result.shortfall)}</dd>
                </div>
                <div>
                  <dt>Payment account shortfall</dt>
                  <dd>{money(result.accountShortfall)}</dd>
                </div>
              </dl>
              <p className="hint">
                Estimate for {purchase.date} using recorded money and planned
                commitments. No purchase has been recorded. Future income is not
                included. If you wait until {data.settings.nextAllowance}, check
                again when the allowance actually arrives.
              </p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void update((d) => {
                    if (d.goals.some((g) => g.id === purchase.id))
                      throw new Error("This purchase goal already exists.");
                    d.goals.push({
                      id: purchase.id,
                      name: purchase.name,
                      target: purchase.price,
                      deadline: "",
                      emergency: false,
                    });
                  }, "Purchase goal created. Add contributions in Savings goals when you’re ready.")
                }
              >
                Save toward this purchase
              </button>
              <button
                className="text-button"
                onClick={() =>
                  setPurchase({
                    ...purchase,
                    date:
                      data.settings.nextAllowance > day
                        ? data.settings.nextAllowance
                        : day,
                  })
                }
              >
                Check at next allowance date
              </button>
              <button
                className="primary"
                disabled={busy || purchase.date !== day}
                onClick={() =>
                  void update((d) => {
                    if (purchase.date !== today())
                      throw new Error("Run the simulation again for today.");
                    if (d.entries.some((e) => e.id === purchase.id))
                      throw new Error("This purchase is already recorded.");
                    const check = simulatePurchase(
                      d,
                      purchase.price,
                      purchase.accountId,
                      purchase.date,
                    );
                    if (check.accountShortfall > 0 || check.remainingMoney < 0)
                      throw new Error(
                        "This purchase exceeds the payment account or would use protected savings.",
                      );
                    d.entries.push({
                      id: purchase.id,
                      name: purchase.name,
                      amount: purchase.price,
                      date: purchase.date,
                      kind: "expense",
                      category: "Other",
                      accountId: purchase.accountId,
                    });
                  }, "Purchase recorded in Activity.")
                }
              >
                Confirm purchase made today
              </button>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
