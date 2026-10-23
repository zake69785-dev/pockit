import { useEffect, useMemo, useState } from "react";
import { id, type Data } from "../domain/model";
import {
  editStudent,
  finishTimer,
  planStudy,
  sortedTasks,
  startTimer,
  studentData,
  toggleTask,
  type Task,
} from "../domain/student";
import { Section } from "../components/Common";
import { Field } from "../components/EntryForm";
import {
  FormFeedback,
  formText as text,
  useLocalMutation,
} from "../components/LocalForms";

export function Tasks({ data, day }: { data: Data; day: string }) {
  const s = studentData(data),
    mutation = useLocalMutation();
  const [view, setView] = useState("today"),
    [course, setCourse] = useState("all"),
    [now, setNow] = useState(Date.now),
    [start, setStart] = useState(9),
    [end, setEnd] = useState(18);
  useEffect(() => {
    const tick = () => setNow(Date.now()),
      timer = setInterval(tick, s.timer ? 1000 : 60000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, [s.timer]);
  const remaining = s.timer
    ? Math.max(
        0,
        Math.ceil((s.timer.startedAt + s.timer.duration - now) / 1000),
      )
    : 0;
  const tasks = sortedTasks(s.tasks).filter(
    (t) =>
      (course === "all" || t.courseId === course) &&
      (view === "completed"
        ? t.done
        : !t.done &&
          (view === "all" ||
            (view === "today" && (!t.due || t.due === day)) ||
            (view === "upcoming" && t.due > day) ||
            (view === "overdue" && t.due !== "" && t.due < day))),
  );
  const minute = Math.floor(now / 60000);
  const suggestions = useMemo(
    () => planStudy(s, day, { start, end }, minute * 60000).slice(0, 12),
    [s, day, start, end, minute],
  );
  function taskFields(t?: Task) {
    return (
      <>
        <Field label="Task name" name="name" value={t?.name} />
        <Field
          label="Due date"
          name="due"
          type="date"
          value={t?.due}
          required={false}
        />
        <label>
          Priority
          <select name="priority" defaultValue={t?.priority ?? "normal"}>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
        <Field
          label="Estimated effort (minutes)"
          name="effort"
          type="number"
          min="0"
          max="100000"
          value={t?.effort ?? 25}
        />
        <label>
          Course association
          <select name="courseId" defaultValue={t?.courseId ?? ""}>
            <option value="">Personal</option>
            {s.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repeat task
          <select name="repeat" defaultValue={t?.repeat ?? "none"}>
            <option value="none">Do not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>
          Notes
          <textarea
            name="notes"
            defaultValue={t?.notes ?? ""}
            maxLength={5000}
            rows={3}
          />
        </label>
      </>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>One thing at a time.</h1>
          <p>Keep track, make room to study, and take a break.</p>
        </div>
      </div>
      <FormFeedback {...mutation} />
      <div className="dashboard-grid student-grid">
        <Section title="Your tasks">
          <div className="button-row">
            <label>
              Task view
              <select value={view} onChange={(e) => setView(e.target.value)}>
                {["today", "upcoming", "overdue", "completed", "all"].map(
                  (v) => (
                    <option key={v} value={v}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Course filter
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              >
                <option value="all">All courses</option>
                <option value="">Personal</option>
                {s.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!tasks.length && <p>No tasks in this view.</p>}
          {tasks.map((t) => (
            <div className="student-item" key={t.id}>
              <label className="task-check">
                <input
                  type="checkbox"
                  checked={t.done}
                  disabled={mutation.busy}
                  onChange={() =>
                    void mutation.save(
                      (d) => toggleTask(d, t.id),
                      t.done ? "Task reopened." : "Task completed.",
                    )
                  }
                />
                {t.name}
              </label>
              <p className="hint">
                {t.due || "No due date"} · {t.priority} priority · {t.effort}{" "}
                min
              </p>
              <details>
                <summary>Edit task</summary>
                <form
                  className="form-stack"
                  onSubmit={mutation.submit((d, f) => {
                    const task = editStudent(d).tasks.find(
                      (v) => v.id === t.id,
                    );
                    if (!task) throw new Error("Task no longer exists.");
                    Object.assign(task, {
                      name: text(f, "name"),
                      due: text(f, "due"),
                      priority: text(f, "priority"),
                      effort: Number(text(f, "effort")),
                      courseId: text(f, "courseId"),
                      repeat: text(f, "repeat"),
                      notes: text(f, "notes"),
                    });
                  })}
                >
                  {taskFields(t)}
                  <button className="secondary" disabled={mutation.busy}>
                    Save task
                  </button>
                </form>
              </details>
            </div>
          ))}
          <details>
            <summary>Add a task</summary>
            <form
              className="form-stack"
              onSubmit={mutation.submit(
                (d, f) =>
                  editStudent(d).tasks.push({
                    id: id(),
                    name: text(f, "name"),
                    due: text(f, "due"),
                    priority: text(f, "priority") as Task["priority"],
                    effort: Number(text(f, "effort")),
                    courseId: text(f, "courseId"),
                    repeat: text(f, "repeat") as Task["repeat"],
                    notes: text(f, "notes"),
                    done: false,
                  }),
                "Task added. Find it in the matching date view.",
              )}
            >
              {taskFields()}
              <button className="primary" disabled={mutation.busy}>
                Add task
              </button>
            </form>
          </details>
        </Section>
        <Section title="Study timer">
          {s.timer ? (
            <>
              <p>{s.timer.mode === "focus" ? "Focus session" : "Break"}</p>
              <p
                className="timer-display"
                role="timer"
                aria-label="Time remaining"
              >
                {Math.floor(remaining / 60)
                  .toString()
                  .padStart(2, "0")}
                :{(remaining % 60).toString().padStart(2, "0")}
              </p>
              <p className="hint">
                The timer uses saved timestamps. Reopen Pockit to check it after
                your phone sleeps; background alerts are not scheduled.
              </p>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={mutation.busy || remaining > 0}
                  onClick={() =>
                    void mutation.save((d) => finishTimer(d), "Session saved.")
                  }
                >
                  Finish session
                </button>
                <button
                  className="text-button"
                  disabled={mutation.busy}
                  onClick={() =>
                    void mutation.save((d) => {
                      editStudent(d).timer = null;
                    }, "Timer cancelled.")
                  }
                >
                  Cancel timer
                </button>
              </div>
            </>
          ) : (
            <form
              className="form-stack"
              onSubmit={mutation.submit(
                (d, f) =>
                  startTimer(
                    d,
                    Number(text(f, "minutes")),
                    text(f, "mode") as "focus" | "break",
                    text(f, "taskId"),
                  ),
                "Timer started. Your start time is saved.",
              )}
            >
              <label>
                Session type
                <select name="mode">
                  <option value="focus">Focus</option>
                  <option value="break">Break</option>
                </select>
              </label>
              <Field
                label="Duration (minutes)"
                name="minutes"
                type="number"
                min="1"
                max="180"
                value={25}
              />
              <label>
                Linked task or assignment
                <select name="taskId">
                  <option value="">Unlinked session</option>
                  {s.tasks
                    .filter((t) => !t.done)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  {s.assessments
                    .filter((a) => !a.submitted)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="primary" disabled={mutation.busy}>
                Start timer
              </button>
            </form>
          )}
          <p>
            Total focus time:{" "}
            {Math.floor(
              s.sessions
                .filter((v) => v.mode === "focus")
                .reduce((sum, v) => sum + v.duration, 0) / 60000,
            )}{" "}
            minutes.
          </p>
          <details>
            <summary>Study history ({s.sessions.length})</summary>
            {s.sessions.length ? (
              [...s.sessions]
                .reverse()
                .slice(0, 100)
                .map((v) => (
                  <p key={v.id}>
                    {new Date(v.startedAt).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}{" "}
                    · {v.mode} · {v.duration / 60000} min ·{" "}
                    {s.tasks.find((t) => t.id === v.taskId)?.name ??
                      s.assessments.find((a) => a.id === v.taskId)?.name ??
                      "Unlinked session"}
                  </p>
                ))
            ) : (
              <p>No completed sessions yet.</p>
            )}
          </details>
        </Section>
        <Section title="Make time to study">
          <p className="hint">
            Suggestions use task deadlines, remaining effort and calendar
            commitments over the next 14 days. Add class times in Calendar for
            better suggestions.
          </p>
          <div className="button-row">
            <label>
              Available from
              <select
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
            <label>
              Available until
              <select
                value={end}
                onChange={(e) => setEnd(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!suggestions.length && (
            <p>
              No available suggestions. Check your hours, deadlines and
              estimated effort.
            </p>
          )}
          {suggestions.map((v) => (
            <div
              key={`${v.taskId}:${v.date}:${v.start}`}
              className="student-item"
            >
              <strong>{v.name}</strong>
              <p>
                {v.date} · {v.start}–{v.end} Manila
              </p>
              <button
                className="small-button"
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.save((d) => {
                    const current = editStudent(d);
                    const key = `study:${v.taskId}:${v.date}:${v.start}`;
                    if (current.events.some((e) => e.id === key))
                      throw new Error("This session is already planned.");
                    if (
                      !planStudy(current, day, { start, end }).some(
                        (slot) =>
                          slot.taskId === v.taskId &&
                          slot.date === v.date &&
                          slot.start === v.start,
                      )
                    )
                      throw new Error(
                        "This time is no longer available. Choose another suggestion.",
                      );
                    current.events.push({
                      id: key,
                      name: `Study: ${v.name}`,
                      date: v.date,
                      start: v.start,
                      end: v.end,
                      category: "study",
                      repeat: "none",
                      courseId:
                        current.tasks.find((t) => t.id === v.taskId)
                          ?.courseId ?? "",
                      origin: "manual",
                    });
                  }, "Study time added to Calendar.")
                }
              >
                Plan this session
              </button>
            </div>
          ))}
        </Section>
      </div>
    </>
  );
}
