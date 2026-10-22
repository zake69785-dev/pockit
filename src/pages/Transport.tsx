import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Star, ArrowRight, Check, BusFront } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import {
  type Data,
  type RouteProfile,
  type DayPlan,
  type Attendance,
  id,
  cents,
  money,
  today,
} from "../domain/model";
import { travel, routeTotal, recordTrip } from "../domain/transport";
import { change } from "../data/db";
import { Sheet } from "../components/Sheet";
import { RouteLegs, TransportIcon } from "../components/RouteLegs";
import { Section, AddButton, Empty } from "../components/Common";
export function RouteSelect({
  label,
  value,
  data,
  onChange,
}: {
  label: string;
  value: string;
  data: Data;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No saved route</option>
        {data.transport.routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} · {money(routeTotal(r))}
          </option>
        ))}
      </select>
    </label>
  );
}
export function DayEditor({
  data,
  date,
  run,
}: {
  data: Data;
  date: string;
  run: (fn: () => Promise<unknown>, message?: string) => void;
}) {
  const selected = travel(data, date),
    p = selected.plan;
  const update = (patch: Partial<DayPlan>) =>
    run(
      () =>
        change((d) => {
          const exception = {
            ...p,
            date,
            note:
              d.transport.exceptions.find((e) => e.date === date)?.note ?? "",
            ...patch,
          };
          d.transport.exceptions = d.transport.exceptions.filter(
            (e) => e.date !== date,
          );
          d.transport.exceptions.push(exception);
        }),
      "School day updated. Unused reservations recalculated.",
    );
  return (
    <div className="day-editor">
      <label>
        Attendance for this date
        <select
          value={p.mode}
          onChange={(e) => update({ mode: e.target.value as Attendance })}
        >
          <option value="campus">On campus / extra visit</option>
          <option value="online">Online classes</option>
          <option value="holiday">Holiday / cancelled trip</option>
          <option value="off">No classes</option>
        </select>
      </label>
      {p.mode === "campus" && (
        <div className="form-columns">
          <RouteSelect
            label="Going to school"
            value={p.outboundId || data.transport.outboundId}
            data={data}
            onChange={(outboundId) => update({ outboundId })}
          />
          <RouteSelect
            label="Going home"
            value={p.returnId || data.transport.returnId}
            data={data}
            onChange={(returnId) => update({ returnId })}
          />
        </div>
      )}
      <p className="hint">
        {money(selected.remaining)} still reserved. Recorded expenses stay in
        your history even if a trip is cancelled.
      </p>
      {data.transport.exceptions.some((e) => e.date === date) && (
        <button
          className="text-button"
          onClick={() =>
            run(() =>
              change((d) => {
                d.transport.exceptions = d.transport.exceptions.filter(
                  (e) => e.date !== date,
                );
              }),
            )
          }
        >
          Use usual weekly schedule
        </button>
      )}
    </div>
  );
}
export function Transport({
  data,
  run,
}: {
  data: Data;
  run: (fn: () => Promise<unknown>, message?: string) => void;
}) {
  const [params] = useSearchParams();
  const [route, setRoute] = useState<RouteProfile | null>(null),
    [date, setDate] = useState(() => {
      const candidate = params.get("date") ?? "";
      return /^\d{4}-\d{2}-\d{2}$/.test(candidate) &&
        isValid(parseISO(candidate)) &&
        candidate >= "2000-01-01" &&
        candidate <= "2100-12-31"
        ? candidate
        : today();
    }),
    [direction, setDirection] = useState<"outbound" | "return" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const trip = travel(data, date);
  const saveRoute = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await change((d) => {
        if (!route?.legs.length)
          throw new Error(
            "Add at least one leg, including Walking for a free route.",
          );
        const index = d.transport.routes.findIndex((r) => r.id === route.id);
        if (index < 0) d.transport.routes.push(route);
        else d.transport.routes[index] = route;
      });
      setRoute(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save route.");
    } finally {
      setBusy(false);
    }
  };
  const updateWeek = (index: number, patch: Partial<DayPlan>) =>
    run(() =>
      change((d) => {
        if (d.transport.weekly.length !== 7)
          d.transport.weekly = Array.from({ length: 7 }, (_, i) => ({
            mode: d.settings.schoolDays.includes(i) ? "campus" : "off",
            outboundId: d.transport.outboundId,
            returnId: d.transport.returnId,
          }));
        d.transport.weekly[index] = { ...d.transport.weekly[index], ...patch };
        d.settings.schoolDays = d.transport.weekly.flatMap((p, i) =>
          p.mode === "campus" ? [i] : [],
        );
      }),
    );
  return (
    <>
      <Link className="inline-link" to="/plan">
        <ArrowLeft size={18} />
        Back to Plan
      </Link>
      <div className="page-heading">
        <div>
          <h1>
            Little journeys.
            <br />
            All planned out.
          </h1>
          <p>Every leg, every fare, one less thing to think about.</p>
        </div>
        <BusFront className="heading-icon" size={35} />
      </div>
      <div className="dashboard-grid">
        <Section
          title="Your route collection"
          action={
            <AddButton
              label="New route"
              onClick={() => {
                setError("");
                setRoute({ id: id(), name: "", favorite: false, legs: [] });
              }}
            />
          }
        >
          {data.transport.routes.length ? (
            [...data.transport.routes]
              .sort((a, b) => Number(b.favorite) - Number(a.favorite))
              .map((r) => (
                <details className="route-profile" key={r.id}>
                  <summary>
                    <span>
                      <strong>{r.name}</strong>
                      <small>
                        {r.legs.length} {r.legs.length === 1 ? "leg" : "legs"}
                        {r.favorite ? " · Favorite" : ""}
                      </small>
                    </span>
                    <strong>{money(routeTotal(r))}</strong>
                  </summary>
                  <div className="route-chain">
                    {r.legs.map((leg, i) => (
                      <span key={leg.id}>
                        <TransportIcon mode={leg.mode} />
                        <small>{leg.label || leg.mode}</small>
                        <strong>{money(leg.fare)}</strong>
                        {i < r.legs.length - 1 && <ArrowRight size={14} />}
                      </span>
                    ))}
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary"
                      onClick={() => {
                        setError("");
                        setRoute(structuredClone(r));
                      }}
                    >
                      Edit route
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${r.favorite ? "Unfavorite" : "Favorite"} ${r.name}`}
                      onClick={() =>
                        run(() =>
                          change((d) => {
                            const current = d.transport.routes.find(
                              (x) => x.id === r.id,
                            );
                            if (current) current.favorite = !current.favorite;
                          }),
                        )
                      }
                    >
                      <Star
                        size={19}
                        fill={r.favorite ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          confirm(
                            "Remove this route? Historical fares will be preserved.",
                          )
                        )
                          run(() =>
                            change((d) => {
                              if (
                                [
                                  d.transport.outboundId,
                                  d.transport.returnId,
                                  ...d.transport.weekly.flatMap((p) => [
                                    p.outboundId,
                                    p.returnId,
                                  ]),
                                  ...d.transport.exceptions.flatMap((p) => [
                                    p.outboundId,
                                    p.returnId,
                                  ]),
                                ].includes(r.id)
                              )
                                throw new Error(
                                  "Choose replacement routes in your defaults, weekly schedule and date exceptions before removing this route.",
                                );
                              d.transport.routes = d.transport.routes.filter(
                                (x) => x.id !== r.id,
                              );
                            }),
                          );
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </details>
              ))
          ) : (
            <Empty>
              One jeepney or a few connections? Save your usual journeys here.
              No fares are assumed.
            </Empty>
          )}
        </Section>
        <Section title="Your usual round trip">
          <RouteSelect
            label="Default outbound route"
            data={data}
            value={data.transport.outboundId}
            onChange={(outboundId) =>
              run(() =>
                change((d) => {
                  const old = d.transport.outboundId;
                  d.transport.outboundId = outboundId;
                  d.transport.weekly = d.transport.weekly.map((p) => ({
                    ...p,
                    outboundId:
                      p.outboundId === old ? outboundId : p.outboundId,
                  }));
                  d.settings.outbound = 0;
                }),
              )
            }
          />
          <RouteSelect
            label="Default return route"
            data={data}
            value={data.transport.returnId}
            onChange={(returnId) =>
              run(() =>
                change((d) => {
                  const old = d.transport.returnId;
                  d.transport.returnId = returnId;
                  d.transport.weekly = d.transport.weekly.map((p) => ({
                    ...p,
                    returnId: p.returnId === old ? returnId : p.returnId,
                  }));
                  d.settings.inbound = 0;
                }),
              )
            }
          />
          <p className="hint">
            Defaults fill in days without a different route. Set both
            directions, including a walking route when needed.
          </p>
        </Section>
        <Section title="School rhythm">
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((label, i) => {
            const p = data.transport.weekly[i] ?? {
              mode: data.settings.schoolDays.includes(i) ? "campus" : "off",
              outboundId: data.transport.outboundId,
              returnId: data.transport.returnId,
            };
            return (
              <details className="week-plan" key={label}>
                <summary>
                  <span>{label}</span>
                  <span className="pill">
                    {p.mode === "campus"
                      ? "On campus"
                      : p.mode === "online"
                        ? "Online"
                        : p.mode === "holiday"
                          ? "Holiday"
                          : "No classes"}
                  </span>
                </summary>
                <label>
                  {label} attendance
                  <select
                    value={p.mode}
                    onChange={(e) =>
                      updateWeek(i, { mode: e.target.value as Attendance })
                    }
                  >
                    <option value="off">No classes</option>
                    <option value="online">Online</option>
                    <option value="campus">On campus</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </label>
                {p.mode === "campus" && (
                  <>
                    <RouteSelect
                      label={`${label} outbound`}
                      data={data}
                      value={p.outboundId}
                      onChange={(outboundId) => updateWeek(i, { outboundId })}
                    />
                    <RouteSelect
                      label={`${label} return`}
                      data={data}
                      value={p.returnId}
                      onChange={(returnId) => updateWeek(i, { returnId })}
                    />
                  </>
                )}
              </details>
            );
          })}
        </Section>
        <Section title="One day at a time">
          <label>
            Travel date
            <input
              type="date"
              value={date}
              required
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
          <DayEditor data={data} date={date} run={run} />
          {trip.plan.mode === "campus" && (
            <div className="trip-actions">
              {(["outbound", "return"] as const).map((dir) => {
                const used =
                  dir === "outbound" ? trip.outboundUsed : trip.returnUsed;
                return (
                  <button
                    key={dir}
                    className="secondary full"
                    disabled={used || date > today()}
                    onClick={() => {
                      setError("");
                      setDirection(dir);
                    }}
                  >
                    {used ? <Check size={18} /> : <BusFront size={18} />}{" "}
                    {used ? "Recorded" : date > today() ? "Planned" : "Record"}{" "}
                    {dir === "outbound" ? "outbound" : "return"} journey
                  </button>
                );
              })}
            </div>
          )}
          <p className="hint">
            A planned journey never charges your balance. Record it only after
            travelling. If your actual fare is lower, the unused reservation is
            released.
          </p>
        </Section>
      </div>
      {route && (
        <Sheet
          title={
            data.transport.routes.some((r) => r.id === route.id)
              ? "Edit your route"
              : "A new way to get there"
          }
          onClose={() => setRoute(null)}
          hasChanges={
            JSON.stringify(route) !==
            JSON.stringify(
              data.transport.routes.find((r) => r.id === route.id) ?? {
                id: route.id,
                name: "",
                favorite: false,
                legs: [],
              },
            )
          }
        >
          <form className="form-stack" onSubmit={saveRoute}>
            <label>
              Route name
              <input
                required
                maxLength={120}
                value={route.name}
                onChange={(e) => setRoute({ ...route, name: e.target.value })}
              />
            </label>
            <RouteLegs
              legs={route.legs}
              onChange={(legs) => setRoute({ ...route, legs })}
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save route"}
            </button>
          </form>
        </Sheet>
      )}
      {direction && (
        <Sheet
          title={`Record ${direction} journey`}
          onClose={() => setDirection(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                await change((d) =>
                  recordTrip(
                    d,
                    date,
                    direction,
                    cents(String(form.get("amount"))),
                  ),
                );
                setDirection(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not record journey.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              {format(parseISO(date), "MMMM d")} ·{" "}
              {direction === "outbound" ? trip.out?.name : trip.back?.name}
            </p>
            <label>
              Actual fare paid (PHP)
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                required
                inputMode="decimal"
                defaultValue={
                  (direction === "outbound" ? trip.outbound : trip.inbound) /
                  100
                }
              />
            </label>
            <p className="hint">
              This completes the whole direction, including all its legs.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Recording…" : "Record actual journey"}
            </button>
          </form>
        </Sheet>
      )}
    </>
  );
}
