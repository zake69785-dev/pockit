import { useState } from "react";
import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { Link } from "react-router-dom";
import { id, money, type Data } from "../domain/model";
import { editStudent, studentData, type StudentEvent } from "../domain/student";
import { unifiedEvents } from "../domain/calendar";
import { Section } from "./Common";
import { Field } from "./EntryForm";
import { FormFeedback, formText as text, useLocalMutation } from "./LocalForms";
export function StudentCalendar({
  data,
  day: date,
  onDate: setDate,
}: {
  data: Data;
  day: string;
  onDate: (date: string) => void;
}) {
  const [view, setView] = useState("agenda"),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState<string | null>(null);
  const s = studentData(data),
    mutation = useLocalMutation(),
    parsed = parseISO(date);
  const from =
    view === "week"
      ? format(startOfWeek(parsed), "yyyy-MM-dd")
      : view === "month"
        ? format(startOfMonth(parsed), "yyyy-MM-dd")
        : date;
  const to =
    view === "week"
      ? format(endOfWeek(parsed), "yyyy-MM-dd")
      : view === "month"
        ? format(endOfMonth(parsed), "yyyy-MM-dd")
        : view === "agenda"
          ? format(addDays(parsed, 30), "yyyy-MM-dd")
          : date;
  const events = unifiedEvents(data, from, to).filter(
      (e) => filter === "all" || e.category === filter,
    ),
    current = s.events.find((e) => e.id === editing);
  return (
    <Section title="School, life & money" className="wide">
      <FormFeedback {...mutation} />
      <div className="button-row">
        <label>
          Calendar view
          <select value={view} onChange={(e) => setView(e.target.value)}>
            {["month", "week", "day", "agenda"].map((v) => (
              <option key={v} value={v}>
                {v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Starting date
          <input
            type="date"
            value={date}
            min="2000-01-01"
            max="2099-12-01"
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <label>
          Event category
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {[
              "all",
              "class",
              "assignment",
              "exam",
              "task",
              "study",
              "personal",
              "transport",
              "allowance",
              "bill",
              "savings",
            ].map((v) => (
              <option key={v} value={v}>
                {v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">
        {from} – {to} · Asia/Manila. All-day dates stay on their selected day.
        Expected income is a reminder.
      </p>
      {!events.length && <p>No events in this view.</p>}
      <div
        className={`unified-events ${view === "month" || view === "week" ? "event-columns" : ""}`}
      >
        {events.map((e) => (
          <article key={e.id} className="student-item">
            <p className="hint">
              {e.date} · {e.time || "All day"} · {e.category}
            </p>
            <strong>{e.name}</strong>
            {e.amount !== undefined && <p>{money(e.amount)}</p>}
            <div className="button-row">
              <Link to={e.link}>Open {e.category}</Link>
              {e.ownedId && (
                <button
                  className="text-button"
                  onClick={() => setEditing(e.ownedId!)}
                >
                  Edit event
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <details open={editing !== null || undefined}>
        <summary
          onClick={() => {
            if (editing) setEditing(null);
          }}
        >
          Add or edit an event
        </summary>
        <form
          key={editing ?? "new"}
          className="form-stack"
          onSubmit={mutation.submit((d, f) => {
            const state = editStudent(d),
              previous = editing
                ? state.events.find((e) => e.id === editing)
                : null;
            if (editing && (!previous || previous.origin !== "manual"))
              throw new Error("This event is unavailable or read-only.");
            const item: StudentEvent = {
              id: previous?.id ?? id(),
              name: text(f, "name"),
              date: text(f, "date"),
              start: text(f, "start"),
              end: text(f, "end"),
              category: text(f, "category") as StudentEvent["category"],
              repeat: text(f, "repeat") as StudentEvent["repeat"],
              courseId: text(f, "courseId"),
              origin: "manual",
            };
            if (previous) Object.assign(previous, item);
            else state.events.push(item);
          })}
        >
          <Field label="Event name" name="name" value={current?.name} />
          <Field
            label="Event date"
            name="date"
            type="date"
            value={current?.date ?? date}
          />
          <Field
            label="Start time (blank for all day)"
            name="start"
            type="time"
            required={false}
            value={current?.start}
          />
          <Field
            label="End time (blank for all day)"
            name="end"
            type="time"
            required={false}
            value={current?.end}
          />
          <label>
            Event type
            <select name="category" defaultValue={current?.category ?? "class"}>
              {["class", "exam", "personal", "study"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Repeat event
            <select name="repeat" defaultValue={current?.repeat ?? "none"}>
              <option value="none">One time</option>
              <option value="weekly">Every week</option>
            </select>
          </label>
          <label>
            Related course
            <select name="courseId" defaultValue={current?.courseId ?? ""}>
              <option value="">No course</option>
              {s.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={mutation.busy}>
            {editing ? "Save event" : "Add event"}
          </button>
          {editing && (
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(null)}
            >
              Finish editing
            </button>
          )}
        </form>
      </details>
    </Section>
  );
}
