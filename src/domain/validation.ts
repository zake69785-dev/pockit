import { isValid, parseISO, format } from "date-fns";
import { categories, type Data, today } from "./model";
import { goalBalance } from "./budget";
import { validateStudent } from "./student-validation";
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const date = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  isValid(parseISO(value)) &&
  format(parseISO(value), "yyyy-MM-dd") === value &&
  value >= "2000-01-01" &&
  value <= "2100-12-31";
const amount = (value: unknown) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 100_000_000_000;
const name = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 120;
export function validate(input: unknown): Data {
  assert(
    input && typeof input === "object",
    "Invalid backup: expected a Pockit data object.",
  );
  const d = input as Data;
  assert(d.version === 3, "Unsupported backup version.");
  if (d.student !== undefined) validateStudent(d.student);
  if (d.finance !== undefined) {
    const f = d.finance;
    if (f?.adjustments !== undefined) {
      assert(
        Array.isArray(f.adjustments) && f.adjustments.length <= 100000,
        "Invalid balance adjustments.",
      );
      assert(
        new Set(f.adjustments.map((a) => a?.id)).size === f.adjustments.length,
        "Duplicate balance adjustments.",
      );
      for (const a of f.adjustments)
        assert(
          a &&
            name(a.id) &&
            name(a.reason) &&
            amount(Math.abs(a.delta)) &&
            a.delta !== 0 &&
            date(a.date) &&
            a.date <= today() &&
            Array.isArray(f.accounts) &&
            f.accounts.some((account) => account.id === a.accountId),
          "Invalid balance adjustment.",
        );
    }
    assert(
      f && f.version === 1 && typeof f.lowFunds === "boolean",
      "Invalid financial account version.",
    );
    assert(
      Array.isArray(f.accounts) &&
        f.accounts.length > 0 &&
        f.accounts.length <= 100,
      "Invalid accounts.",
    );
    assert(
      new Set(f.accounts.map((a) => a?.id)).size === f.accounts.length,
      "Duplicate account IDs.",
    );
    assert(
      f.accounts.filter((a) => a?.id === "legacy" && a.type === "legacy")
        .length === 1,
      "Legacy account is required.",
    );
    for (const a of f.accounts)
      assert(
        a &&
          name(a.id) &&
          name(a.name) &&
          [
            "legacy",
            "cash",
            "gcash",
            "maya",
            "bank",
            "savings",
            "custom",
          ].includes(a.type) &&
          (a.type !== "legacy" || a.id === "legacy"),
        "Invalid account.",
      );
    assert(
      Array.isArray(f.transfers) && f.transfers.length <= 100000,
      "Invalid account transfers.",
    );
    assert(
      new Set(f.transfers.map((t) => t?.id)).size === f.transfers.length,
      "Duplicate account transfers.",
    );
    for (const t of f.transfers)
      assert(
        t &&
          name(t.id) &&
          amount(t.amount) &&
          t.amount > 0 &&
          date(t.date) &&
          t.date <= today() &&
          t.from !== t.to &&
          [t.from, t.to].every((key) => f.accounts.some((a) => a.id === key)),
        "Invalid account transfer.",
      );
    assert(
      Number.isSafeInteger(f.transfers.reduce((sum, t) => sum + t.amount, 0)),
      "Account transfers exceed the safe integer range.",
    );
  }
  for (const collection of [d.entries, d.goals, d.bills, d.expected]) {
    assert(
      Array.isArray(collection) && collection.length <= 100000,
      "Invalid or oversized collection.",
    );
    assert(
      new Set(collection.map((x) => x?.id)).size === collection.length,
      "Duplicate record IDs.",
    );
    for (const item of collection)
      assert(
        item && name(item.id) && name(item.name),
        "Every record needs a valid ID and name.",
      );
  }
  const s = d.settings;
  assert(
    typeof d.onboardingComplete === "boolean" &&
      ["conservative", "balanced", "savings"].includes(d.preference),
    "Invalid setup preferences.",
  );
  const frequencies = ["daily", "weekly", "biweekly", "monthly", "irregular"];
  assert(
    d.allowance &&
      amount(d.allowance.amount) &&
      date(d.allowance.anchor) &&
      frequencies.includes(d.allowance.frequency),
    "Invalid allowance schedule.",
  );
  const t = d.transport;
  assert(
    t &&
      Array.isArray(t.routes) &&
      t.routes.length <= 100 &&
      Array.isArray(t.weekly) &&
      (t.weekly.length === 0 || t.weekly.length === 7) &&
      Array.isArray(t.exceptions) &&
      t.exceptions.length <= 2000,
    "Invalid transportation plan.",
  );
  assert(
    new Set(t.routes.map((r) => r.id)).size === t.routes.length,
    "Duplicate route IDs.",
  );
  for (const r of t.routes) {
    assert(
      name(r.id) &&
        name(r.name) &&
        typeof r.favorite === "boolean" &&
        Array.isArray(r.legs) &&
        r.legs.length > 0 &&
        r.legs.length <= 12,
      "Invalid transportation route.",
    );
    assert(
      new Set(r.legs.map((l) => l.id)).size === r.legs.length,
      "Duplicate route legs.",
    );
    for (const l of r.legs)
      assert(
        name(l.id) &&
          [
            "Bus",
            "Mini Bus",
            "UV Express",
            "Jeepney",
            "Walking",
            "Custom",
          ].includes(l.mode) &&
          typeof l.label === "string" &&
          l.label.length <= 120 &&
          amount(l.fare) &&
          (l.mode !== "Walking" || l.fare === 0),
        "Invalid route leg or fare.",
      );
  }
  const routeRef = (value: unknown) =>
    typeof value === "string" &&
    (value === "" || t.routes.some((r) => r.id === value));
  assert(
    routeRef(t.outboundId) && routeRef(t.returnId),
    "Default route is missing.",
  );
  for (const p of [...t.weekly, ...t.exceptions])
    assert(
      ["campus", "online", "holiday", "off"].includes(p.mode) &&
        routeRef(p.outboundId) &&
        routeRef(p.returnId),
      "Invalid attendance or route selection.",
    );
  assert(
    new Set(t.exceptions.map((e) => e.date)).size === t.exceptions.length,
    "Duplicate school date overrides.",
  );
  for (const e of t.exceptions)
    assert(
      date(e.date) && typeof e.note === "string" && e.note.length <= 120,
      "Invalid school exception.",
    );
  assert(
    Array.isArray(d.plannedSavings) &&
      d.plannedSavings.length <= 10000 &&
      new Set(d.plannedSavings.map((p) => p.id)).size ===
        d.plannedSavings.length,
    "Invalid planned contributions.",
  );
  for (const p of d.plannedSavings)
    assert(
      name(p.id) &&
        date(p.date) &&
        amount(p.amount) &&
        p.amount > 0 &&
        d.goals.some((g) => g.id === p.goalId),
      "Invalid planned contribution.",
    );
  assert(
    s && date(s.nextAllowance) && date(s.cycleStart) && s.cycleStart <= today(),
    "Check your allowance and cycle dates.",
  );
  assert(
    difference(s.nextAllowance, today()) <= 730,
    "Next allowance must be within two years.",
  );
  assert(
    amount(s.leisure) && amount(s.outbound) && amount(s.inbound),
    "Invalid budget amount.",
  );
  assert(["system", "light", "dark"].includes(s.theme), "Invalid theme.");
  assert(
    Array.isArray(s.schoolDays) &&
      s.schoolDays.length <= 7 &&
      new Set(s.schoolDays).size === s.schoolDays.length &&
      s.schoolDays.every((x) => Number.isInteger(x) && x >= 0 && x <= 6),
    "Invalid school schedule.",
  );
  for (const g of d.goals)
    assert(
      amount(g.target) &&
        g.target > 0 &&
        (g.deadline === "" || date(g.deadline)) &&
        typeof g.emergency === "boolean",
      "Invalid savings goal.",
    );
  for (const g of d.goals) {
    assert(
      g.priority === undefined ||
        ["low", "normal", "high"].includes(g.priority),
      "Invalid goal priority.",
    );
    assert(
      g.icon === undefined ||
        ["sparkles", "laptop", "plane", "book", "home"].includes(g.icon),
      "Invalid goal icon.",
    );
  }
  for (const b of [...d.bills, ...d.expected])
    assert(
      amount(b.amount) &&
        b.amount > 0 &&
        date(b.date) &&
        (b.frequency === undefined || frequencies.includes(b.frequency)),
      "Invalid planned amount or date.",
    );
  for (const bill of d.bills)
    assert(
      bill.until === undefined || date(bill.until),
      "Invalid essential end date.",
    );
  for (const e of d.entries) {
    assert(
      e.accountId === undefined ||
        (d.finance && d.finance.accounts.some((a) => a.id === e.accountId)),
      "Transaction account is missing.",
    );
    assert(
      amount(e.amount) &&
        (e.amount > 0 || !!e.trip) &&
        date(e.date) &&
        e.date <= today(),
      "Transactions require a positive amount and a date no later than today.",
    );
    assert(
      ["income", "expense", "save", "withdraw"].includes(e.kind) &&
        categories.includes(e.category),
      "Invalid transaction type.",
    );
    assert(
      e.goalId === undefined || typeof e.goalId === "string",
      "Invalid goal reference.",
    );
    assert(
      e.billId === undefined || typeof e.billId === "string",
      "Invalid essential reference.",
    );
    if (e.kind === "save" || e.kind === "withdraw")
      assert(
        d.goals.some((g) => g.id === e.goalId) && !e.billId,
        "Transfer needs an existing savings pocket.",
      );
    else assert(!e.goalId, "Only transfers can reference savings.");
    if (e.billId)
      assert(
        e.kind === "expense" &&
          e.category === "Essentials" &&
          d.bills.some((b) => b.id === e.billId),
        "Payment needs an existing essential.",
      );
    if (e.billDate !== undefined)
      assert(date(e.billDate) && !!e.billId, "Invalid bill occurrence.");
    if (e.source?.startsWith("saving:"))
      assert(
        e.kind === "save",
        "A planned contribution must remain a savings transfer.",
      );
    if (e.source?.startsWith("allowance:") || e.source?.startsWith("expected:"))
      assert(
        e.kind === "income",
        "Received scheduled money must remain income.",
      );
    if (e.source !== undefined)
      assert(name(e.source), "Invalid transaction source.");
    if (e.trip)
      assert(
        e.kind === "expense" &&
          e.category === "Transport" &&
          e.trip.date === e.date &&
          ["outbound", "return"].includes(e.trip.direction) &&
          typeof e.trip.routeId === "string",
        "Invalid recorded journey.",
      );
  }
  const trips = d.entries
      .filter((e) => e.trip)
      .map((e) => `${e.trip!.date}:${e.trip!.direction}`),
    sources = d.entries.filter((e) => e.source).map((e) => e.source);
  assert(
    new Set(trips).size === trips.length,
    "A journey cannot be recorded twice.",
  );
  assert(
    new Set(sources).size === sources.length,
    "An expected payment cannot be received twice.",
  );
  for (const g of d.goals) {
    let balance = 0;
    for (const e of [...d.entries]
      .filter((e) => e.goalId === g.id)
      .sort((a, b) => a.date.localeCompare(b.date))) {
      balance += e.kind === "save" ? e.amount : -e.amount;
      assert(
        balance >= 0,
        "A savings withdrawal cannot exceed its balance on that date.",
      );
    }
  }
  const total =
    (d.finance?.adjustments?.reduce((sum, a) => sum + Math.abs(a.delta), 0) ??
      0) +
    (d.finance?.transfers.reduce((sum, t) => sum + t.amount, 0) ?? 0) +
    [...d.entries, ...d.plannedSavings].reduce((sum, e) => sum + e.amount, 0) +
    d.goals.reduce((sum, g) => sum + g.target, 0) +
    s.leisure +
    (s.outbound + s.inbound) * 730 +
    [...d.bills, ...d.expected].reduce(
      (sum, item) =>
        sum +
        item.amount *
          (item.frequency && item.frequency !== "irregular" ? 37000 : 1),
      0,
    ) +
    t.routes.reduce(
      (sum, r) => sum + r.legs.reduce((fare, l) => fare + l.fare, 0),
      0,
    ) *
      1462 +
    d.allowance.amount * 37000;
  assert(
    Number.isSafeInteger(total),
    "Ledger exceeds the supported safe integer range.",
  );
  const saved = d.goals.reduce((sum, g) => sum + goalBalance(d, g.id), 0);
  assert(Number.isSafeInteger(saved), "Savings total is too large.");
  return d;
}
function difference(a: string, b: string) {
  return (parseISO(a).getTime() - parseISO(b).getTime()) / 86400000;
}
