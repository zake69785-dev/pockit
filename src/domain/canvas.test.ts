import { describe, expect, it } from "vitest";
import { canvasPages, fetchCanvasSnapshot, mergeCanvas } from "./canvas";
import { freshStudent } from "./student";
const response = (value: unknown, headers?: HeadersInit) =>
  new Response(JSON.stringify(value), { headers });
describe("read-only Canvas adapter", () => {
  it("preserves all-day ownership and prevents a Canvas refresh replacing manual records", async () => {
    const snapshot = await fetchCanvasSnapshot(async (path) => path.startsWith("/api/v1/courses?") ? response([{ id: 1, name: "Math" }]) : path.includes("calendar_events") ? response([{ id: 7, title: "Review day", all_day: true, all_day_date: "2026-10-23", start_at: "2026-10-22T16:00:00Z", end_at: "2026-10-23T16:00:00Z" }]) : response([]), []);
    const s = freshStudent(), merged = mergeCanvas(s, snapshot);
    expect(merged.events[0]).toMatchObject({ date: "2026-10-23", endDate: "2026-10-23", start: "", end: "", origin: "canvas" });
    s.courses.push({ id: "canvas:course:1", name: "My own course", origin: "manual", categories: [], target: 75 });
    expect(() => mergeCanvas(s, snapshot)).toThrow(/conflicts/);
    expect(s.courses[0].name).toBe("My own course");
  });
  it("follows pagination and rejects foreign or looping links", async () => {
    const calls: string[] = [];
    const items = await canvasPages(async (path) => {
      calls.push(path);
      return calls.length === 1
        ? response([{ id: 1 }], {
            Link: '<https://feu.instructure.com/api/v1/courses?page=2>; rel="next"',
          })
        : response([{ id: 2 }]);
    }, "/api/v1/courses");
    expect(items).toHaveLength(2);
    expect(calls).toHaveLength(2);
    await expect(
      canvasPages(
        async () =>
          response([], {
            Link: '<https://attacker.example/api/v1/courses>; rel="next"',
          }),
        "/api/v1/courses",
      ),
    ).rejects.toThrow(/unsafe/);
    await expect(
      canvasPages(
        async () =>
          response([], {
            Link: '<https://feu.instructure.com/api/v1/courses>; rel="next"',
          }),
        "/api/v1/courses",
      ),
    ).rejects.toThrow(/pagination/);
  });
  it("handles authorization, permission, rate limiting, server and offline failures", async () => {
    for (const [status, code] of [
      [401, "auth"],
      [403, "permission"],
      [429, "rate"],
      [500, "server"],
    ] as const)
      await expect(
        canvasPages(
          async () =>
            new Response(null, { status, headers: { "Retry-After": "30" } }),
          "/api/v1/courses",
        ),
      ).rejects.toMatchObject({
        code,
        ...(status === 429 ? { retryAfter: 30 } : {}),
      });
    await expect(
      canvasPages(async () => {
        throw new Error("offline");
      }, "/api/v1/courses"),
    ).rejects.toMatchObject({ code: "network" });
  });
  it("deduplicates stable IDs and preserves undated, ungraded assignments and manual data", async () => {
    const s = freshStudent();
    s.courses.push({
      id: "manual",
      name: "Manual course",
      origin: "manual",
      target: 75,
      categories: [],
    });
    const snapshot = await fetchCanvasSnapshot(
      async (path) =>
        path.startsWith("/api/v1/courses?")
          ? response([{ id: 1, name: "Math" }])
          : path.includes("assignments")
            ? response([
                { id: 2, name: "Reading", points_possible: 0, due_at: null },
                { id: 2, name: "Reading", points_possible: 0, due_at: null },
              ])
            : response([]),
      [],
    );
    const result = mergeCanvas(mergeCanvas(s, snapshot), snapshot);
    expect(result.courses).toHaveLength(2);
    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0].earned).toBeNull();
    expect(result.assessments[0].dueAt).toBeNull();
    expect(s.assessments).toHaveLength(0);
    expect(s.canvas.lastSync).toBeNull();
  });
  it("does not advance cache state after a partially failed sync", async () => {
    const s = freshStudent(),
      before = structuredClone(s);
    await expect(
      fetchCanvasSnapshot(
        async (path) =>
          path.startsWith("/api/v1/courses?")
            ? response([{ id: 1, name: "Math" }])
            : new Response(null, { status: 500 }),
        [],
      ),
    ).rejects.toThrow();
    expect(s).toEqual(before);
  });
});
