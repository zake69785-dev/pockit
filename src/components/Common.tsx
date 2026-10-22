import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ReactNode } from "react";
import { money, type Entry } from "../domain/model";
export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="row section-heading">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
export function AddButton({
  onClick,
  label = "Add",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="small-button" onClick={onClick}>
      <Plus size={16} />
      {label}
    </button>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function EntryList({
  entries,
  onEdit,
}: {
  entries: Entry[];
  onEdit?: (entry: Entry) => void;
}) {
  return (
    <div className="entries">
      {entries.map((e) => (
        <button
          className="entry"
          key={e.id}
          onClick={() => onEdit?.(e)}
          disabled={!onEdit}
        >
          <span
            className={`entry-symbol ${e.kind === "income" ? "positive" : ""}`}
          >
            {e.kind === "income" ? (
              <ArrowDownLeft size={20} />
            ) : e.kind === "expense" ? (
              <ArrowUpRight size={20} />
            ) : (
              <ArrowLeftRight size={20} />
            )}
          </span>
          <span className="entry-copy">
            <strong>{e.name}</strong>
            <span>
              {e.kind === "expense"
                ? e.category
                : e.kind === "income"
                  ? "Income"
                  : "Savings transfer"}{" "}
              · {format(parseISO(e.date), "MMM d")}
            </span>
          </span>
          <strong className={e.kind === "income" ? "positive" : ""}>
            {e.kind === "income" ? "+" : e.kind === "expense" ? "−" : ""}
            {money(e.amount)}
          </strong>
        </button>
      ))}
    </div>
  );
}
