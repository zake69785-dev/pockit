import { addDays, format, parseISO } from "date-fns";
import type { Student } from "./student";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const money = (centavos: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    centavos / 100,
  );
export function cents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000_000)
    throw new Error("Amount is too large.");
  return result;
}
export const categories = [
  "Food",
  "Transport",
  "Essentials",
  "Leisure",
  "Other",
] as const;
export type Category = (typeof categories)[number];
export type Entry = {
  accountId?: string;
  id: string;
  date: string;
  name: string;
  amount: number;
  kind: "income" | "expense" | "save" | "withdraw";
  category: Category;
  goalId?: string;
  billId?: string;
  billDate?: string;
  source?: string;
  trip?: { date: string; direction: "outbound" | "return"; routeId: string };
};
export type Goal = {
  id: string;
  name: string;
  target: number;
  deadline: string;
  emergency: boolean;
  priority?: "low" | "normal" | "high";
  icon?: "sparkles" | "laptop" | "plane" | "book" | "home";
};
export type Frequency =
  "daily" | "weekly" | "biweekly" | "monthly" | "irregular";
export type Bill = {
  id: string;
  name: string;
  amount: number;
  date: string;
  frequency?: Frequency;
  until?: string;
};
export type Expected = {
  id: string;
  name: string;
  amount: number;
  date: string;
  frequency?: Frequency;
};
export type Settings = {
  nextAllowance: string;
  cycleStart: string;
  leisure: number;
  schoolDays: number[];
  outbound: number;
  inbound: number;
  theme: "system" | "light" | "dark";
};
export type TransportMode =
  "Bus" | "Mini Bus" | "UV Express" | "Jeepney" | "Walking" | "Custom";
export type RouteProfile = {
  id: string;
  name: string;
  favorite: boolean;
  legs: { id: string; mode: TransportMode; label: string; fare: number }[];
};
export type Attendance = "campus" | "online" | "holiday" | "off";
export type DayPlan = {
  mode: Attendance;
  outboundId: string;
  returnId: string;
};
export type TransportPlan = {
  routes: RouteProfile[];
  outboundId: string;
  returnId: string;
  weekly: DayPlan[];
  exceptions: ({ date: string; note: string } & DayPlan)[];
};
export type Data = {
  version: 3;
  finance?: Finance;
  student?: Student;
  entries: Entry[];
  goals: Goal[];
  bills: Bill[];
  expected: Expected[];
  settings: Settings;
  onboardingComplete: boolean;
  preference: "conservative" | "balanced" | "savings";
  allowance: { amount: number; frequency: Frequency; anchor: string };
  transport: TransportPlan;
  plannedSavings: {
    id: string;
    goalId: string;
    amount: number;
    date: string;
  }[];
};
export type Account = {
  id: string;
  name: string;
  type: "legacy" | "cash" | "gcash" | "maya" | "bank" | "savings" | "custom";
};
export type Finance = {
  version: 1;
  accounts: Account[];
  transfers: {
    id: string;
    from: string;
    to: string;
    amount: number;
    date: string;
  }[];
  lowFunds: boolean;
  adjustments?: {
    id: string;
    accountId: string;
    delta: number;
    date: string;
    reason: string;
  }[];
};
export const freshFinance = (): Finance => ({
  version: 1,
  accounts: [{ id: "legacy", name: "Legacy / unassigned", type: "legacy" }],
  transfers: [],
  lowFunds: false,
  adjustments: [],
});
export const blankTransport = (): TransportPlan => ({
  routes: [],
  outboundId: "",
  returnId: "",
  weekly: [],
  exceptions: [],
});
export const freshData = (): Data => ({
  version: 3,
  finance: freshFinance(),
  onboardingComplete: false,
  preference: "balanced",
  allowance: {
    amount: 0,
    frequency: "irregular",
    anchor: format(addDays(parseISO(today()), 14), "yyyy-MM-dd"),
  },
  transport: blankTransport(),
  plannedSavings: [],
  entries: [],
  goals: [
    {
      id: "emergency",
      name: "Emergency fund",
      target: 500000,
      deadline: "",
      emergency: true,
    },
  ],
  bills: [],
  expected: [],
  settings: {
    nextAllowance: format(addDays(parseISO(today()), 14), "yyyy-MM-dd"),
    cycleStart: today(),
    leisure: 0,
    schoolDays: [],
    outbound: 0,
    inbound: 0,
    theme: "system",
  },
});
export const id = () => crypto.randomUUID();
