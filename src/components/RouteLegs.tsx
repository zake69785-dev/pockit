import {
  BusFront,
  Bus,
  CarFront,
  CarTaxiFront,
  Car,
  Footprints,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
} from "lucide-react";
import {
  cents,
  id,
  money,
  type RouteProfile,
  type TransportMode,
} from "../domain/model";
export function TransportIcon({ mode }: { mode: TransportMode }) {
  const Icon = {
    Bus: BusFront,
    "Mini Bus": Bus,
    "UV Express": CarFront,
    Jeepney: CarTaxiFront,
    Walking: Footprints,
    Custom: Car,
  }[mode];
  return <Icon size={22} aria-hidden="true" />;
}
export function RouteLegs({
  legs,
  onChange,
  label = "Route",
}: {
  legs: RouteProfile["legs"];
  onChange: (legs: RouteProfile["legs"]) => void;
  label?: string;
}) {
  const update = (
    index: number,
    patch: Partial<RouteProfile["legs"][number]>,
  ) => onChange(legs.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const move = (index: number, delta: number) => {
    const next = [...legs];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <div className="route-builder">
      <div className="route-endpoint">
        <span />
        Start
      </div>
      {legs.map((leg, index) => (
        <div className="route-leg" key={leg.id}>
          <div className="route-marker">
            <TransportIcon mode={leg.mode} />
          </div>
          <div className="route-leg-fields">
            <label>
              {label} leg {index + 1}
              <select
                value={leg.mode}
                onChange={(e) =>
                  update(index, {
                    mode: e.target.value as TransportMode,
                    ...(e.target.value === "Walking" ? { fare: 0 } : {}),
                  })
                }
              >
                {[
                  "Bus",
                  "Mini Bus",
                  "UV Express",
                  "Jeepney",
                  "Walking",
                  "Custom",
                ].map((mode) => (
                  <option key={mode}>{mode}</option>
                ))}
              </select>
            </label>
            <label>
              Fare (PHP)
              <input
                aria-label={`${label} fare ${index + 1}`}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                required
                defaultValue={leg.fare / 100}
                key={`${leg.id}-${leg.mode}`}
                disabled={leg.mode === "Walking"}
                onChange={(e) => {
                  try {
                    update(index, { fare: cents(e.target.value || "0") });
                    e.target.setCustomValidity("");
                  } catch {
                    e.target.setCustomValidity("Use up to two decimal places.");
                  }
                }}
              />
            </label>
            <label className="route-leg-note">
              Stop or custom name (optional)
              <input
                maxLength={120}
                value={leg.label}
                onChange={(e) => update(index, { label: e.target.value })}
              />
            </label>
            <div className="route-leg-tools">
              <button
                type="button"
                className="icon-button"
                aria-label={`Move leg ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move leg ${index + 1} down`}
                disabled={index === legs.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove leg ${index + 1}`}
                onClick={() => onChange(legs.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
      <div className="route-endpoint">
        <span />
        Destination{" "}
        <strong>{money(legs.reduce((sum, l) => sum + l.fare, 0))}</strong>
      </div>
      <button
        type="button"
        className="secondary full"
        disabled={legs.length >= 12}
        onClick={() =>
          onChange([...legs, { id: id(), mode: "Jeepney", label: "", fare: 0 }])
        }
      >
        <Plus size={17} />
        Add transport leg
      </button>
    </div>
  );
}
