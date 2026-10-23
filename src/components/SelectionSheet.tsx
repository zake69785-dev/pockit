import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SelectionOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};
export function SelectionSheet({
  label,
  options,
  value,
  onChange,
  multiple = false,
  name,
  icon,
}: {
  label: string;
  options: SelectionOption[];
  value: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  name?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState(value);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const element = dialog.current,
      returnFocus = trigger.current;
    const previous = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    const fit = () => {
      if (element)
        element.style.maxHeight = `${(viewport?.height ?? innerHeight) - 24}px`;
    };
    fit();
    viewport?.addEventListener("resize", fit);
    return () => {
      element?.close();
      document.body.style.overflow = previous;
      viewport?.removeEventListener("resize", fit);
      returnFocus?.focus();
    };
  }, [open]);
  const visible = options.filter((o) =>
    `${o.label} ${o.description ?? ""}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="selection-field">
      <span id={`${id}-label`}>{label}</span>
      {name &&
        value.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      <button
        ref={trigger}
        className="select-trigger"
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft(value);
          setQuery("");
          setOpen(true);
        }}
      >
        {icon}
        <span id={`${id}-value`}>
          {multiple
            ? `${value.length} selected`
            : (options.find((o) => o.value === value[0])?.label ??
              "Choose an option")}
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>
      {open &&
        createPortal(
          <dialog
            className="selection-sheet"
            ref={dialog}
            aria-labelledby={`${id}-title`}
            onCancel={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          >
            <header className="row">
              <h2 id={`${id}-title`}>{label}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close selection"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
            </header>
            <label className="selection-search">
              <Search size={18} aria-hidden />
              <span className="sr-only">Search {label}</span>
              <input
                autoFocus
                type="search"
                value={query}
                placeholder="Search options…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <fieldset className="selection-list">
              <legend className="sr-only">{label}</legend>
              {visible.map((option) => (
                <label className="selection-row" key={option.value}>
                  <input
                    type={multiple ? "checkbox" : "radio"}
                    name={`${id}-choice`}
                    checked={draft.includes(option.value)}
                    disabled={option.disabled}
                    onChange={() => {
                      const next = multiple
                        ? draft.includes(option.value)
                          ? draft.filter((v) => v !== option.value)
                          : [...draft, option.value]
                        : [option.value];
                      setDraft(next);
                    }}
                  />
                  {option.icon}
                  <span>
                    {option.label}
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {draft.includes(option.value) && (
                    <Check size={18} aria-hidden />
                  )}
                </label>
              ))}
              {!visible.length && (
                <p role="status">No matching options. Try a shorter search.</p>
              )}
            </fieldset>
            <button
              type="button"
              className="primary full"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Use selection
            </button>
          </dialog>,
          document.body,
        )}
    </div>
  );
}
