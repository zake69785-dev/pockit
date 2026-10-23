import { useState } from "react";
import type { Data } from "../domain/model";
import { financialAccounts } from "../domain/accounts";
import { change } from "../data/db";
import { receive } from "../domain/actions";

export function ReceiveIncome({
  data,
  source,
  date,
  run,
}: {
  data: Data;
  source: string;
  date: string;
  run: (fn: () => Promise<unknown>, message?: string) => void;
}) {
  const [account, setAccount] = useState("legacy");
  return (
    <div className="form-stack">
      <label>
        Receive into
        <select
          aria-label="Receive into"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          {financialAccounts(data).accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="small-button"
        onClick={() =>
          run(
            () => change((d) => receive(d, source, date, account)),
            "Income received. Your balance is updated.",
          )
        }
      >
        Receive
      </button>
    </div>
  );
}
