import { describe, expect, it } from "vitest";
import { freshData } from "./model";
import {
  editStudent,
  eventOnDate,
  finishTimer,
  freshStudent,
  gradeProjection,
  localDue,
  manilaDay,
  planStudy,
  startTimer,
  toggleTask,
} from "./student";
import { validateStudent } from "./student-validation";
import { unifiedEvents } from "./calendar";
describe("offline student tools", () => {
  it("keeps ungraded work out of the current grade and projects weighted remaining work", () => {
    const course = {
      id: "course",
      name: "Math",
      origin: "manual" as const,
      target: 80,
      categories: [
        { id: "q", name: "Quizzes", weight: 40 },
        { id: "e", name: "Exams", weight: 60 },
      ],
    };
    const base = {
      courseId: "course",
      name: "Assessment",
      submitted: false,
      origin: "manual" as const,
      dueAt: null,
    };
    const grade = gradeProjection(course, [
      { ...base, id: "a", categoryId: "q", max: 20, earned: 18 },
      { ...base, id: "b", categoryId: "e", max: 100, earned: null },
    ]);
    expect(grade.current).toBe(90);
    expect(grade.worst).toBe(36);
    expect(grade.best).toBe(96);
    expect(grade.required).toBeCloseTo(73.333333);
    expect(grade.remainingPoints).toBe(100);
    expect(
      gradeProjection(
        { ...course, categories: [{ id: "q", name: "Q", weight: 30 }] },
        [],
      ).configured,
    ).toBe(false);
    expect(gradeProjection(course, []).current).toBeNull();
  });
  it("uses Manila instants and preserves all-day dates", () => {
    expect(localDue("2026-10-23T09:00")).toBe("2026-10-23T01:00:00.000Z");
    expect(manilaDay("2026-10-22T16:30:00Z")).toBe("2026-10-23");
    expect(
      eventOnDate(
        {
          id: "class",
          name: "Class",
          date: "2026-10-23",
          start: "",
          end: "",
          category: "class",
          repeat: "weekly",
          origin: "manual",
          courseId: "",
        },
        "2026-10-30",
      ),
    ).toBe(true);
  });
  it("creates each recurring task occurrence once", () => {
    const d = freshData(),
      s = editStudent(d);
    s.tasks.push({
      id: "task",
      name: "Review",
      due: "2026-10-23",
      priority: "high",
      effort: 25,
      notes: "",
      done: false,
      courseId: "",
      repeat: "daily",
    });
    toggleTask(d, "task");
    toggleTask(d, "task");
    toggleTask(d, "task");
    expect(s.tasks).toHaveLength(2);
    expect(s.tasks[1].due).toBe("2026-10-24");
    validateStudent(s);
  });
  it("resumes timer timestamps after suspension and logs completion idempotently", () => {
    const d = freshData();
    startTimer(d, 25, "focus", "", 1000000);
    const restored = structuredClone(d);
    expect(() => finishTimer(restored, 1000001)).toThrow(/running/);
    finishTimer(restored, 1000000 + 60 * 60000);
    finishTimer(restored, 1000000 + 60 * 60000);
    expect(restored.student!.sessions).toHaveLength(1);
    expect(restored.student!.sessions[0].duration).toBe(25 * 60000);
    expect(restored.student!.timer).toBeNull();
    validateStudent(restored.student!);
  });
  it("plans without collisions, after now and before task deadlines", () => {
    const s = freshStudent();
    s.tasks.push({
      id: "task",
      name: "Review",
      due: "2026-10-23",
      priority: "high",
      effort: 50,
      notes: "",
      done: false,
      courseId: "",
      repeat: "none",
    });
    s.events.push({
      id: "class",
      name: "Class",
      date: "2026-10-23",
      start: "09:00",
      end: "10:00",
      category: "class",
      repeat: "none",
      origin: "manual",
      courseId: "",
    });
    const slots = planStudy(
      s,
      "2026-10-23",
      { start: 9, end: 12 },
      Date.parse("2026-10-23T09:15:00+08:00"),
    );
    expect(slots.map((v) => v.start)).toEqual(["10:00", "10:30"]);
    expect(planStudy(s, "2026-10-24")).toEqual([]);
    s.events.push({
      id: "study:task:2026-10-23:10:00",
      name: "Study",
      date: "2026-10-23",
      start: "10:00",
      end: "10:25",
      category: "study",
      repeat: "none",
      origin: "manual",
      courseId: "",
    });
    expect(planStudy(s, "2026-10-23", { start: 9, end: 12 }, 0)).toHaveLength(
      1,
    );
  });
  it("unifies events with stable IDs and rejects invalid backups", () => {
    const d = freshData(),
      s = editStudent(d);
    s.events.push({
      id: "class",
      name: "Class",
      date: "2026-10-23",
      start: "09:00",
      end: "10:00",
      category: "class",
      repeat: "none",
      origin: "manual",
      courseId: "",
    });
    const events = unifiedEvents(d, "2026-10-23", "2026-10-23");
    expect(events.filter((v) => v.category === "class")).toHaveLength(1);
    expect(events).toEqual(unifiedEvents(d, "2026-10-23", "2026-10-23"));
    s.events[0].end = "08:00";
    expect(() => validateStudent(s)).toThrow(/event/);
  });
});
