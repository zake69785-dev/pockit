import {
  freshData,
  cents,
  id,
  today,
  type Data,
  type Frequency,
  type Attendance,
  type RouteProfile,
} from "./model";
import { budget } from "./budget";
import { validate } from "./validation";
export type SetupDraft = {
  step: number;
  cash: string;
  wallet: string;
  separate: string;
  allowance: string;
  frequency: Frequency;
  nextDate: string;
  weekly: Attendance[];
  outLegs: RouteProfile["legs"];
  backLegs: RouteProfile["legs"];
  essentials: {
    name: string;
    amount: string;
    date: string;
    frequency: Frequency;
  }[];
  goalName: string;
  goalTarget: string;
  goalExisting: string;
  goalDate: string;
  priority: "low" | "normal" | "high";
  preference: Data["preference"];
  emergencyAdd: string;
  goalAdd: string;
};
export function newDraft(): SetupDraft {
  return {
    step: 0,
    cash: "0",
    wallet: "0",
    separate: "0",
    allowance: "0",
    frequency: "weekly",
    nextDate: freshData().settings.nextAllowance,
    weekly: Array(7).fill("off"),
    outLegs: [],
    backLegs: [],
    essentials: [],
    goalName: "",
    goalTarget: "",
    goalExisting: "0",
    goalDate: "",
    priority: "normal",
    preference: "balanced",
    emergencyAdd: "0",
    goalAdd: "0",
  };
}
export function setupData(draft: SetupDraft, includeAllocations = true): Data {
  const d = freshData(),
    cash = cents(draft.cash || "0"),
    wallet = cents(draft.wallet || "0"),
    separate = cents(draft.separate || "0"),
    goalExisting = cents(draft.goalExisting || "0");
  if (goalExisting > separate)
    throw new Error(
      "Existing goal savings must be part of the separately saved amount, not extra money.",
    );
  if (goalExisting && !draft.goalName.trim())
    throw new Error("Name a goal for its existing savings.");
  for (const [key, name, amount] of [
    ["cash", "Opening cash", cash],
    ["wallet", "Opening digital wallet", wallet],
    ["saved", "Opening separate savings", separate],
  ] as const)
    if (amount)
      d.entries.push({
        id: `opening-${key}`,
        name,
        amount,
        date: today(),
        kind: "income",
        category: "Other",
      });
  d.settings.nextAllowance = draft.nextDate;
  d.settings.cycleStart = today();
  d.preference = draft.preference;
  d.allowance = {
    amount: cents(draft.allowance || "0"),
    frequency: draft.frequency,
    anchor: draft.nextDate,
  };
  const make = (key: string, name: string, legs: RouteProfile["legs"]) => {
    if (legs.length)
      d.transport.routes.push({
        id: key,
        name,
        favorite: true,
        legs: structuredClone(legs),
      });
    return legs.length ? key : "";
  };
  d.transport.outboundId = make("setup-out", "Going to school", draft.outLegs);
  d.transport.returnId = make("setup-back", "Going home", draft.backLegs);
  d.transport.weekly = draft.weekly.map((mode) => ({
    mode,
    outboundId: d.transport.outboundId,
    returnId: d.transport.returnId,
  }));
  d.settings.schoolDays = draft.weekly.flatMap((mode, i) =>
    mode === "campus" ? [i] : [],
  );
  d.bills = draft.essentials
    .filter((b) => b.name.trim() && cents(b.amount || "0") > 0)
    .map((b) => ({ ...b, id: id(), amount: cents(b.amount) }));
  if (draft.goalName.trim())
    d.goals.push({
      id: "setup-goal",
      name: draft.goalName.trim(),
      target: cents(draft.goalTarget),
      deadline: draft.goalDate,
      priority: draft.priority,
      icon: "sparkles",
      emergency: false,
    });
  const save = (key: string, goalId: string, amount: number) => {
    if (amount)
      d.entries.push({
        id: key,
        date: today(),
        name: "Opening savings allocation",
        amount,
        kind: "save",
        category: "Other",
        goalId,
      });
  };
  save("opening-emergency", "emergency", separate - goalExisting);
  save("opening-goal", "setup-goal", goalExisting);
  if (includeAllocations) {
    const emergency = cents(draft.emergencyAdd || "0"),
      goal = cents(draft.goalAdd || "0");
    if (goal && !draft.goalName.trim())
      throw new Error("Create a savings goal before allocating money to it.");
    if (emergency + goal > Math.max(0, budget(d, today()).available))
      throw new Error(
        "These new savings allocations would use money reserved for essentials or travel. Reduce them to continue.",
      );
    save("setup-emergency-add", "emergency", emergency);
    save("setup-goal-add", "setup-goal", goal);
  }
  d.onboardingComplete = true;
  return validate(d);
}
