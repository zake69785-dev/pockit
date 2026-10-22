import { blankTransport, type Data, type RouteProfile } from "./model";
/** Pure migration. Call validation after this; never alter the supplied backup. */
export function migrate(input: unknown): unknown {
  if (
    !input ||
    typeof input !== "object" ||
    !("version" in input) ||
    input.version !== 1
  )
    return input;
  const old = structuredClone(input) as Omit<Data, "version"> & { version: 1 };
  if (!old.settings || !Array.isArray(old.entries) || !Array.isArray(old.goals))
    throw new Error("Invalid version 1 backup.");
  const route = (id: string, name: string, fare: number): RouteProfile => ({
    id,
    name,
    favorite: true,
    legs: [{ id: `${id}-leg`, mode: "Custom", label: "Original fare", fare }],
  });
  const transport = blankTransport();
  transport.routes = [
    route("legacy-out", "Going to school", old.settings.outbound),
    route("legacy-back", "Going home", old.settings.inbound),
  ];
  transport.outboundId = "legacy-out";
  transport.returnId = "legacy-back";
  transport.weekly = Array.from({ length: 7 }, (_, day) => ({
    mode: old.settings.schoolDays.includes(day) ? "campus" : "off",
    outboundId: "legacy-out",
    returnId: "legacy-back",
  }));
  return {
    ...old,
    version: 2,
    onboardingComplete: true,
    preference: "balanced",
    allowance: {
      amount: 0,
      frequency: "irregular",
      anchor: old.settings.nextAllowance,
    },
    transport,
    plannedSavings: [],
  };
}
