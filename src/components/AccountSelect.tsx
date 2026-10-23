import { financialAccounts } from "../domain/accounts";
import type { Data } from "../domain/model";
export function AccountSelect({
  data,
  name = "accountId",
  label = "Payment account",
  value = "legacy",
}: {
  data: Data;
  name?: string;
  label?: string;
  value?: string;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} name={name} defaultValue={value} required>
        {financialAccounts(data).accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
