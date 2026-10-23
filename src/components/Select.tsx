import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  useEffect,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import * as Primitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

// Keep existing form values and native validation. Radix owns focus, typeahead,
// keyboard navigation, scroll locking and the portalled listbox.
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    native = useRef<HTMLSelectElement>(null);
  const [portal, setPortal] = useState<HTMLElement | undefined>(undefined);
  useEffect(() => {
    setPortal(trigger.current?.closest("dialog") ?? undefined);
  }, []);
  const options: { value: string; label: ReactNode; disabled?: boolean }[] = [];
  function collect(nodes: ReactNode) {
    Children.forEach(nodes, (child) => {
      if (
        !isValidElement<{
          value?: string | number;
          children?: ReactNode;
          disabled?: boolean;
        }>(child)
      )
        return;
      if (child.type === "option")
        options.push({
          value: String(child.props.value ?? child.props.children ?? ""),
          label: child.props.children,
          disabled: child.props.disabled,
        });
      else collect(child.props.children);
    });
  }
  collect(children);
  const [local, setLocal] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const selected = value === undefined ? local : String(value);
  const initial = String(defaultValue ?? options[0]?.value ?? "");
  useEffect(() => {
    const label = trigger.current?.closest("label");
    if (label) label.htmlFor = trigger.current?.id ?? "";
    const form = trigger.current?.closest("form");
    const reset = () => setLocal(initial);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial]);
  const empty = "__pockit_empty_option__";
  return (
    <>
      <select
        ref={native}
        className="select-native"
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        required={required}
        disabled={disabled}
        value={selected}
        onInvalid={() => trigger.current?.focus()}
        onChange={(event) => {
          setLocal(event.target.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
      <Primitive.Root
        disabled={disabled}
        value={selected || empty}
        onValueChange={(next) => {
          const actual = next === empty ? "" : next;
          if (native.current) {
            Object.getOwnPropertyDescriptor(
              HTMLSelectElement.prototype,
              "value",
            )?.set?.call(native.current, actual);
            native.current.dispatchEvent(
              new Event("change", { bubbles: true }),
            );
          }
        }}
      >
        <Primitive.Trigger
          ref={trigger}
          id={props.id ?? id}
          aria-label={props["aria-label"]}
          aria-describedby={props["aria-describedby"]}
          className={`select-trigger ${props.className ?? ""}`}
        >
          <Primitive.Value />
          <Primitive.Icon>
            <ChevronDown size={18} aria-hidden />
          </Primitive.Icon>
        </Primitive.Trigger>
        <Primitive.Portal container={portal}>
          <Primitive.Content
            className="select-menu"
            position="popper"
            sideOffset={8}
            collisionPadding={16}
          >
            <Primitive.ScrollUpButton className="select-scroll">
              <ChevronUp size={18} />
            </Primitive.ScrollUpButton>
            <Primitive.Viewport>
              {options.map((option) => (
                <Primitive.Item
                  className="select-option"
                  key={option.value}
                  value={option.value || empty}
                  disabled={option.disabled}
                >
                  <Primitive.ItemText>{option.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator>
                    <Check size={18} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.Viewport>
            <Primitive.ScrollDownButton className="select-scroll">
              <ChevronDown size={18} />
            </Primitive.ScrollDownButton>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </>
  );
}
