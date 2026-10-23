import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  Wallet,
  LayoutGrid,
  GraduationCap,
  ListChecks,
  Settings as SettingsIcon,
  WifiOff,
  CalendarDays,
} from "lucide-react";
import { read, change } from "./data/db";
import { today, type Entry } from "./domain/model";
import { Sheet } from "./components/Sheet";
import { EntryForm, type FormKind } from "./components/EntryForm";
import { Today } from "./pages/Today";
const Plan = lazy(() =>
  import("./pages/Plan").then((m) => ({ default: m.Plan })),
);
const Money = lazy(() =>
  import("./pages/Money").then((m) => ({ default: m.Money })),
);
const School = lazy(() =>
  import("./pages/School").then((m) => ({ default: m.School })),
);
const Tasks = lazy(() =>
  import("./pages/Tasks").then((m) => ({ default: m.Tasks })),
);
const Pockets = lazy(() =>
  import("./pages/Pockets").then((m) => ({ default: m.Pockets })),
);
const Calendar = lazy(() =>
  import("./pages/Calendar").then((m) => ({ default: m.Calendar })),
);
const Transport = lazy(() =>
  import("./pages/Transport").then((m) => ({ default: m.Transport })),
);
const Onboarding = lazy(() =>
  import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })),
);
const Activity = lazy(() =>
  import("./pages/Activity").then((module) => ({ default: module.Activity })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);
const nav = [
  ["/", "Home", Wallet],
  ["/school", "School", GraduationCap],
  ["/money", "Money", LayoutGrid],
  ["/calendar", "Calendar", CalendarDays],
  ["/tasks", "Tasks", ListChecks],
] as const;
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Pockit couldn’t open your data.</h1>
        <p>
          Try reloading. If storage is blocked, allow site storage or use a
          regular browser window. Do not clear browser data unless you have a
          backup.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload Pockit
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Application() {
  const data = useLiveQuery(() => read(), []),
    [day, setDay] = useState(today),
    [sheet, setSheet] = useState<{
      kind: FormKind;
      entry?: Entry;
      goalId?: string;
      initialKind?: Entry["kind"];
      initialDate?: string;
    } | null>(null),
    [message, setMessage] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    location = useLocation();
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const update = () => {
      setDay(today());
      setOnline(navigator.onLine);
    };
    const timer = setInterval(update, 30000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    const name =
      nav.find(([url]) => url === location.pathname)?.[1] ??
      (location.pathname === "/settings" ? "Settings" : "Transportation");
    document.title = `${name} · Pockit`;
  }, [location.pathname]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(timer);
  }, [message]);
  const theme = data?.settings.theme;
  useEffect(() => {
    if (!theme) return;
    try {
      localStorage.setItem("pockit-theme", theme);
    } catch {
      /* IndexedDB remains the source of truth. */
    }
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#111c32" : "#fffdf6");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const run = async (
    fn: () => Promise<unknown>,
    notice = "Saved. Your budget is up to date.",
  ) => {
    try {
      await fn();
      setMessage(notice);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    }
  };
  const open = (kind: FormKind) => setSheet({ kind }),
    edit = (entry: Entry) => setSheet({ kind: "transaction", entry });
  if (!data)
    return (
      <main className="loading">
        <div className="brand">
          <Wallet />
          pockit<span>Loading your pockets…</span>
        </div>
        <div className="skeleton" />
      </main>
    );
  if (!data.onboardingComplete && location.pathname !== "/settings")
    return (
      <Suspense
        fallback={
          <main className="loading" role="status">
            Opening your little money plan…
          </main>
        }
      >
        <Onboarding />
      </Suspense>
    );
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="app-shell">
        <header className="app-header">
          <NavLink to="/" className="brand" aria-label="Pockit home">
            <img src={`${import.meta.env.BASE_URL}illustrations/pockit-mascot.png`} width="44" height="44" alt="" />
            pockit<span>A little plan. A lot of possibility.</span>
          </NavLink>
          <span className="connection">
            {!online ? (
              <>
                <WifiOff size={14} />
                Offline
              </>
            ) : offlineReady ? (
              "Ready offline"
            ) : (
              "On this device"
            )}
          </span>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className="icon-button settings-link"
          >
            <SettingsIcon size={21} />
          </NavLink>
        </header>
        <main id="main" tabIndex={-1}>
          {needRefresh && (
            <div className="notice">
              A new version is ready. Save any open form first.
              <button
                className="text-button"
                onClick={() => {
                  if (!sheet && !document.querySelector("dialog[open]"))
                    void updateServiceWorker(true);
                  else setMessage("Finish or close your form before updating.");
                }}
              >
                Update Pockit
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <div className="empty" role="status">
                Opening your pocket…
              </div>
            }
          >
            <div className="route-view" key={location.pathname}>
              <Routes>
                <Route path="/school" element={<School data={data} />} />
                <Route
                  path="/tasks"
                  element={<Tasks data={data} day={day} />}
                />
                <Route
                  path="/money"
                  element={<Money data={data} day={day} />}
                />
                <Route
                  path="/"
                  element={
                    <Today
                      data={data}
                      day={day}
                      add={(initialKind) =>
                        setSheet({ kind: "transaction", initialKind })
                      }
                      plan={() => open("plan")}
                      edit={edit}
                    />
                  }
                />
                <Route
                  path="/plan"
                  element={<Plan data={data} day={day} open={open} run={run} />}
                />
                <Route
                  path="/transport"
                  element={<Transport data={data} run={run} />}
                />
                <Route
                  path="/calendar"
                  element={
                    <Calendar
                      data={data}
                      day={day}
                      edit={edit}
                      add={(initialDate) =>
                        setSheet({ kind: "transaction", initialDate })
                      }
                      run={run}
                    />
                  }
                />
                <Route
                  path="/pockets"
                  element={
                    <Pockets
                      data={data}
                      day={day}
                      add={() => open("goal")}
                      transfer={(goalId) =>
                        setSheet({ kind: "transaction", goalId })
                      }
                      editGoal={(goalId) => setSheet({ kind: "goal", goalId })}
                      run={run}
                    />
                  }
                />
                <Route
                  path="/activity"
                  element={<Activity data={data} day={day} edit={edit} />}
                />
                <Route
                  path="/settings"
                  element={<Settings data={data} run={run} />}
                />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>This pocket is empty.</h1>
                      <NavLink to="/">Back to Home</NavLink>
                    </div>
                  }
                />
              </Routes>
            </div>
          </Suspense>
        </main>
        <nav className="bottom-nav" aria-label="Main navigation">
          {nav.map(([url, label, Icon]) => (
            <NavLink
              key={url}
              to={url}
              end={url === "/"}
              className={({ isActive }) =>
                isActive ||
                (url === "/money" &&
                  ["/plan", "/transport", "/pockets", "/activity"].includes(
                    location.pathname,
                  ))
                  ? "active"
                  : ""
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div
          role="status"
          aria-live="polite"
          className={message ? "toast" : "sr-only"}
        >
          {message}
        </div>
      </div>
      {sheet && (
        <Sheet
          title={
            sheet.entry
              ? "Edit transaction"
              : {
                  transaction: "A little money update",
                  goal: "Something to save for",
                  bill: "Protect an essential",
                  expected: "Plan incoming money",
                  plan: "Your budget rhythm",
                }[sheet.kind]
          }
          onClose={() => setSheet(null)}
        >
          <EntryForm
            key={sheet.entry?.id ?? sheet.goalId ?? sheet.kind}
            kind={sheet.kind}
            data={data}
            entry={sheet.entry}
            goalId={sheet.goalId}
            initialKind={sheet.initialKind}
            initialDate={sheet.initialDate}
            onDone={() => {
              setSheet(null);
              setMessage("Saved. Your budget is up to date.");
            }}
          />
          {sheet.entry && (
            <button
              className="danger full"
              onClick={() => {
                if (
                  confirm(
                    "Delete this transaction? Your balances will be recalculated.",
                  )
                )
                  void run(async () => {
                    await change((d) => {
                      d.entries = d.entries.filter(
                        (e) => e.id !== sheet.entry!.id,
                      );
                    });
                    setSheet(null);
                  }, "Transaction deleted.");
              }}
            >
              Delete transaction
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}
export default function App() {
  return (
    <Boundary>
      <Application />
    </Boundary>
  );
}
