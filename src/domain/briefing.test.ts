import { describe, expect, it } from "vitest";
import { freshData, today } from "./model";
import { dailyBriefing } from "./briefing";
import { editStudent } from "./student";
describe("daily briefing", () => {
  it("uses actual received money and prioritizes shortfalls without counting expected allowance", () => {
    const d = freshData(), day = today();
    d.entries.push({ id: "income", name: "Received", date: day, amount: 1000, kind: "income", category: "Other" });
    d.bills.push({ id: "bill", name: "Essential", date: day, amount: 1500 });
    d.allowance.amount = 100000;
    const b = dailyBriefing(d, day);
    expect(b.liquid).toBe(1000); expect(b.daily).toBe(0);
    expect(b.notifications.some((n) => n.id === `low-funds:${day}` && n.urgent)).toBe(true);
    expect(dailyBriefing(d, day)).toEqual(b);
  });
  it("preserves classes and honors notification dismissal", () => {
    const d = freshData(), s = editStudent(d), day = today();
    s.events.push({ id: "class", name: "Physics", date: day, start: "09:00", end: "10:00", category: "class", repeat: "weekly", courseId: "", origin: "manual" });
    const b = dailyBriefing(d, day); expect(b.classes).toHaveLength(1);
    s.dismissed = b.notifications.map((n) => n.id);
    expect(dailyBriefing(d, day).notifications).toEqual([]);
    expect(dailyBriefing(d, day).classes).toHaveLength(1);
  });
});
