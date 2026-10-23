import { Select } from "../components/Select";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { id, type Data } from "../domain/model";
import {
  editStudent,
  gradeProjection,
  localDue,
  manilaDay,
  studentData,
} from "../domain/student";
import {
  fetchCanvasSnapshot,
  mergeCanvas,
  protectedGateway,
} from "../domain/canvas";
import { Section } from "../components/Common";
import { Field } from "../components/EntryForm";
import {
  FormFeedback,
  formText as text,
  useLocalMutation,
} from "../components/LocalForms";

export function School({ data }: { data: Data }) {
  const s = studentData(data),
    mutation = useLocalMutation();
  const [course, setCourse] = useState(""),
    [filter, setFilter] = useState("all"),
    [syncStatus, setSyncStatus] = useState(""),
    [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const manual = s.courses.filter((c) => c.origin === "manual"),
    selected = manual.find((c) => c.id === course) ?? manual[0];
  const assignments = s.assessments
    .filter(
      (a) =>
        (filter === "all" || a.courseId === filter) &&
        (a.origin !== "canvas" ||
          !s.canvas.selectedCourses.length ||
          s.canvas.selectedCourses.includes(a.courseId)),
    )
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  async function sync() {
    if (syncingRef.current) return;
    const endpoint = import.meta.env.VITE_CANVAS_GATEWAY;
    if (!endpoint) {
      setSyncStatus(
        "FEU sync needs an approved protected service. Your manual courses and offline data remain available.",
      );
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    setSyncStatus("");
    try {
      const snapshot = await fetchCanvasSnapshot(
        protectedGateway(endpoint),
        s.canvas.selectedCourses,
      );
      const saved = await mutation.save((d) => {
        const current = editStudent(d);
        if (
          JSON.stringify(current.canvas.selectedCourses) !==
          JSON.stringify(s.canvas.selectedCourses)
        )
          throw new Error(
            "Your course filter changed while syncing. Sync again with the new selection.",
          );
        d.student = mergeCanvas(current, snapshot);
      }, "Canvas cache updated.");
      if (saved) setSyncStatus("Canvas sync complete.");
    } catch (e) {
      setSyncStatus(
        e instanceof Error
          ? e.message
          : "Sync failed. Cached data is unchanged.",
      );
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A little closer to done.</h1>
          <p>Your courses, deadlines and grades, available offline.</p>
        </div>
      </div>
      <FormFeedback {...mutation} />
      <div className="dashboard-grid student-grid">
        <Section title="Courses & grades">
          {!s.courses.length && (
            <p>Add your first course to track assignments and grades.</p>
          )}
          {s.courses.map((c) => {
            const grade = gradeProjection(c, s.assessments);
            return (
              <details key={c.id} className="student-item">
                <summary>
                  {c.name} ·{" "}
                  {c.origin === "canvas"
                    ? "Canvas"
                    : grade.current === null
                      ? "No grades yet"
                      : `${grade.current.toFixed(1)}% current`}
                </summary>
                {c.origin === "canvas" ? (
                  <p>
                    Canvas reported grade:{" "}
                    {c.canvasGrade == null
                      ? "Not available"
                      : `${c.canvasGrade}%`}
                    . Imported records are read-only. Local projections are not
                    substituted for Canvas grading rules.
                  </p>
                ) : (
                  <>
                    <p className="hint">
                      Current grade excludes ungraded work and normalizes the
                      weights of graded categories. Final projections use all
                      listed assessments; unlisted future work is unknown.
                    </p>
                    <dl className="breakdown">
                      <div>
                        <dt>Target</dt>
                        <dd>{c.target}%</dd>
                      </div>
                      <div>
                        <dt>Remaining listed points</dt>
                        <dd>{grade.remainingPoints}</dd>
                      </div>
                      <div>
                        <dt>Worst / best projection</dt>
                        <dd>
                          {grade.configured
                            ? `${grade.worst!.toFixed(1)}% / ${grade.best!.toFixed(1)}%`
                            : "Set weights to 100%"}
                        </dd>
                      </div>
                      <div>
                        <dt>Required remaining score</dt>
                        <dd>
                          {grade.required === null
                            ? "Not available"
                            : grade.required > 100
                              ? "Above 100% — target exceeds listed work"
                              : `${grade.required.toFixed(1)}%`}
                        </dd>
                      </div>
                    </dl>
                    {grade.incomplete && (
                      <p className="hint">
                        Some categories have no assessments. Their final
                        contribution is still unknown.
                      </p>
                    )}
                    <form
                      className="form-stack"
                      onSubmit={mutation.submit((d, f) => {
                        const item = editStudent(d).courses.find(
                          (v) => v.id === c.id,
                        );
                        if (!item || item.origin !== "manual")
                          throw new Error(
                            "This course changed. Refresh and retry.",
                          );
                        item.name = text(f, "name");
                        item.target = Number(text(f, "target"));
                        item.categories = item.categories.map((category) => ({
                          ...category,
                          weight: Number(text(f, category.id)),
                        }));
                      })}
                    >
                      <Field label="Course name" name="name" value={c.name} />
                      <Field
                        label="Target grade (%)"
                        name="target"
                        type="number"
                        min="0"
                        max="100"
                        value={c.target}
                      />
                      {c.categories.map((category) => (
                        <Field
                          key={category.id}
                          label={`${category.name} weight (%)`}
                          name={category.id}
                          type="number"
                          min="0"
                          max="100"
                          value={category.weight}
                        />
                      ))}
                      <button className="secondary" disabled={mutation.busy}>
                        Save grading settings
                      </button>
                    </form>
                    <form
                      className="form-stack"
                      onSubmit={mutation.submit((d, f) => {
                        const item = editStudent(d).courses.find(
                          (v) => v.id === c.id,
                        );
                        if (!item || item.origin !== "manual")
                          throw new Error("Course unavailable.");
                        item.categories.push({
                          id: id(),
                          name: text(f, "name"),
                          weight: 0,
                        });
                      })}
                    >
                      <Field label="New assessment category" name="name" />
                      <button className="text-button" disabled={mutation.busy}>
                        Add grade category
                      </button>
                    </form>
                    <p className="hint">
                      New categories start at 0%. Adjust all weights together,
                      then save.
                    </p>
                  </>
                )}
              </details>
            );
          })}
          <details>
            <summary>Add a course</summary>
            <form
              className="form-stack"
              onSubmit={mutation.submit((d, f) =>
                editStudent(d).courses.push({
                  id: id(),
                  name: text(f, "name"),
                  origin: "manual",
                  categories: [{ id: id(), name: "Coursework", weight: 100 }],
                  target: 75,
                }),
              )}
            >
              <Field label="New course name" name="name" />
              <button className="primary" disabled={mutation.busy}>
                Add course
              </button>
            </form>
          </details>
          <p>
            <Link to="/calendar">Add classes and exams to Calendar</Link>
          </p>
        </Section>
        <Section title="Assignments">
          <label>
            Filter by course
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All courses</option>
              {s.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          {!assignments.length && (
            <p>
              No assignments here yet. Add one below or connect an approved
              Canvas service.
            </p>
          )}
          {assignments.map((a) => (
            <details key={a.id} className="student-item">
              <summary>
                {a.name} · {a.submitted ? "Submitted" : "To do"}
              </summary>
              <p>
                {s.courses.find((c) => c.id === a.courseId)?.name} ·{" "}
                {a.dueAt
                  ? new Date(a.dueAt).toLocaleString("en-PH", {
                      timeZone: "Asia/Manila",
                    })
                  : "No deadline"}{" "}
                · {a.earned === null ? "Ungraded" : `${a.earned} / ${a.max}`}
              </p>
              {a.origin === "canvas" ? (
                <a href={a.url} target="_blank" rel="noreferrer">
                  Open in Canvas
                </a>
              ) : (
                <form
                  className="form-stack"
                  onSubmit={mutation.submit((d, f) => {
                    const item = editStudent(d).assessments.find(
                      (v) => v.id === a.id,
                    );
                    if (!item || item.origin !== "manual")
                      throw new Error("Assignment unavailable.");
                    item.name = text(f, "name");
                    item.earned =
                      text(f, "earned") === ""
                        ? null
                        : Number(text(f, "earned"));
                    item.max = Number(text(f, "max"));
                    item.submitted = f.has("submitted");
                    item.dueAt = localDue(text(f, "due"));
                  })}
                >
                  <Field label="Assignment name" name="name" value={a.name} />
                  <Field
                    label="Earned points (blank means ungraded)"
                    name="earned"
                    type="number"
                    min="0"
                    required={false}
                    value={a.earned ?? ""}
                  />
                  <Field
                    label="Maximum points"
                    name="max"
                    type="number"
                    min="0.01"
                    value={a.max}
                  />
                  <Field
                    label="Due date and time (Manila)"
                    name="due"
                    type="datetime-local"
                    required={false}
                    value={
                      a.dueAt
                        ? new Date(Date.parse(a.dueAt) + 8 * 3600000)
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                  />
                  <label>
                    <input
                      name="submitted"
                      type="checkbox"
                      defaultChecked={a.submitted}
                    />{" "}
                    Submitted
                  </label>
                  <button className="secondary" disabled={mutation.busy}>
                    Save assignment
                  </button>
                </form>
              )}
              <button
                className="text-button"
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.save((d) => {
                    const state = editStudent(d),
                      key = `assignment-task:${a.id}`;
                    if (state.tasks.some((t) => t.id === key))
                      throw new Error(
                        "This assignment already has a study task.",
                      );
                    state.tasks.push({
                      id: key,
                      name: `Study: ${a.name}`,
                      due: a.dueAt ? manilaDay(a.dueAt) : "",
                      priority: "normal",
                      notes: "",
                      done: false,
                      effort: 60,
                      courseId: a.courseId,
                      repeat: "none",
                      assessmentId: a.id,
                    });
                  }, "Study task created. Adjust its effort in Tasks.")
                }
              >
                Create linked study task
              </button>
            </details>
          ))}
          <details>
            <summary>Add an assignment</summary>
            {selected ? (
              <form
                className="form-stack"
                onSubmit={mutation.submit((d, f) => {
                  editStudent(d).assessments.push({
                    id: id(),
                    name: text(f, "name"),
                    courseId: selected.id,
                    categoryId: text(f, "category"),
                    max: Number(text(f, "max")),
                    earned: null,
                    dueAt: localDue(text(f, "due")),
                    submitted: false,
                    origin: "manual",
                  });
                })}
              >
                <label>
                  Course
                  <Select
                    value={selected.id}
                    onChange={(e) => setCourse(e.target.value)}
                  >
                    {manual.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  Grade category
                  <Select key={selected.id} name="category">
                    {selected.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <Field label="New assignment name" name="name" />
                <Field
                  label="Maximum points"
                  name="max"
                  type="number"
                  min="0.01"
                />
                <Field
                  label="Due date and time (Manila)"
                  name="due"
                  type="datetime-local"
                  required={false}
                />
                <button className="primary" disabled={mutation.busy}>
                  Add assignment
                </button>
              </form>
            ) : (
              <p>Add a manual course first.</p>
            )}
          </details>
        </Section>
        <Section title="FEU Canvas">
          <p>
            <a
              href="https://feu.instructure.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open FEU Canvas
            </a>
          </p>
          <p>
            Last successful sync:{" "}
            {s.canvas.lastSync
              ? new Date(s.canvas.lastSync).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })
              : "Never"}
            . Cached information may be out of date.
          </p>
          <p className="hint">
            No Canvas credentials are stored in Pockit. Live sync needs an
            institution-approved connection and a protected service. Manual
            entries work offline now.
          </p>
          {s.courses
            .filter((c) => c.origin === "canvas")
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={
                    !s.canvas.selectedCourses.length ||
                    s.canvas.selectedCourses.includes(c.id)
                  }
                  onChange={(e) => {
                    const checked = e.target.checked;
                    void mutation.save((d) => {
                      const current = editStudent(d);
                      const all = current.courses
                        .filter((v) => v.origin === "canvas")
                        .map((v) => v.id);
                      const selected = current.canvas.selectedCourses.length
                        ? current.canvas.selectedCourses
                        : all;
                      current.canvas.selectedCourses = checked
                        ? [...new Set([...selected, c.id])]
                        : selected.filter((v) => v !== c.id);
                      if (!current.canvas.selectedCourses.length)
                        current.canvas.selectedCourses = ["none"];
                    });
                  }}
                />
                {c.name}
              </label>
            ))}
          <button
            className="secondary"
            disabled={syncing}
            onClick={() => void sync()}
          >
            {syncing ? "Syncing…" : "Sync Canvas"}
          </button>
          <p role="status">{syncStatus}</p>
          {s.canvas.announcements.map((a) => (
            <p key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer">
                {a.title}
              </a>
            </p>
          ))}
        </Section>
      </div>
    </>
  );
}
