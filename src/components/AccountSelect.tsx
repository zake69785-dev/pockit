import { Select } from "./Select";
import { SelectionSheet } from "./SelectionSheet";
import { useState, useRef, useEffect } from "react";
import { Wallet } from "lucide-react";
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
  const [selected, setSelected] = useState(value);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = wrapper.current?.closest("form");
    const reset = () => setSelected(value);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [value]);
  const accounts = financialAccounts(data).accounts;
  return (
    <div ref={wrapper}>
      <label>
        {label}
        <Select
          aria-label={label}
          name={name}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </label>
      {accounts.length > 5 && (
        <SelectionSheet
          label={`Find ${label.toLowerCase()}`}
          options={accounts.map((a) => ({
            value: a.id,
            label: a.name,
            icon: <Wallet size={18} aria-hidden />,
          }))}
          value={[selected]}
          onChange={(values) => {
            const native = wrapper.current?.querySelector("select");
            if (native) {
              Object.getOwnPropertyDescriptor(
                HTMLSelectElement.prototype,
                "value",
              )?.set?.call(native, values[0] ?? value);
              native.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }}
          icon={<Wallet size={18} aria-hidden />}
        />
      )}
    </div>
  );
}
