import { describe, it, expect } from "vitest";
import { freshData } from "./model";
import { freshStudent } from "./student";
import { defaultPushPreferences, pushSchedule, vapidBytes } from "./push";
describe("push reminder projection", () => {
  const now = Date.parse("2026-10-23T08:00:00+08:00");
  it("is opt-in and never mutates financial records", () => {
    const data = freshData(),
      before = JSON.stringify(data);
    expect(pushSchedule(data, defaultPushPreferences(), now)).toEqual([]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("excludes completed and missed tasks, uses Manila time and cancels removed items", () => {
    const data = freshData();
    data.student = freshStudent();
    data.student.tasks = [false, true].map((done, i) => ({
      id: String(i),
      name: "Real task",
      due: "2026-10-23",
      done,
      priority: "normal",
      notes: "",
      effort: 15,
      courseId: "",
      repeat: "none",
    }));
    const prefs = defaultPushPreferences();
    prefs.task = { enabled: true, minutes: 15 };
    const result = pushSchedule(data, prefs, now);
    expect(result).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Real task");
    expect(result[0].sendAt).toBe("2026-10-23T00:45:00.000Z");
    expect(pushSchedule(data, prefs, now + 3600000)).toEqual([]);
    data.student.tasks = [];
    expect(pushSchedule(data, prefs, now)).toEqual([]);
  });
  it("does not schedule unsynchronized Canvas deadlines", () => {
    const data = freshData();
    data.student = freshStudent();
    data.student.assessments = [
      {
        id: "c",
        courseId: "course",
        categoryId: "work",
        name: "Canvas work",
        max: 100,
        earned: null,
        dueAt: "2026-10-24T09:00:00+08:00",
        submitted: false,
        origin: "canvas",
      },
    ];
    const prefs = defaultPushPreferences();
    prefs.assignment.enabled = true;
    expect(pushSchedule(data, prefs, now)).toEqual([]);
    data.student.canvas.lastSync = new Date(now).toISOString();
    expect(pushSchedule(data, prefs, now)).toHaveLength(1);
    data.student.assessments[0].submitted = true;
    expect(pushSchedule(data, prefs, now)).toEqual([]);
  });
  it("gives each daily financial snapshot a stable deduplication ID", () => {
    const prefs = defaultPushPreferences();
    prefs.briefing.enabled = true;
    const a = pushSchedule(freshData(), prefs, now),
      b = pushSchedule(freshData(), prefs, now + 60000);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].expiresAt).toBe("2026-10-23T15:59:59.000Z");
  });
  it("rejects invalid public application keys", () => {
    expect(() => vapidBytes("bad")).toThrow();
  });
  it("retains saved start times for recurring classes", () => {
    const data = freshData();
    data.student = freshStudent();
    data.student.events = [
      {
        id: "weekly",
        name: "Class",
        date: "2026-10-16",
        start: "13:00",
        end: "14:00",
        category: "class",
        repeat: "weekly",
        courseId: "",
        origin: "manual",
      },
    ];
    const prefs = defaultPushPreferences();
    prefs.class.enabled = true;
    const result = pushSchedule(data, prefs, now);
    expect(result[0].sendAt).toBe("2026-10-23T04:45:00.000Z");
  });
});
