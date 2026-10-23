import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { db } from "../data/db";
import { money, type Data } from "../domain/model";
import { dailyBriefing } from "../domain/briefing";
import { editStudent } from "../domain/student";
import { Section } from "./Common";
import { FormFeedback, useLocalMutation } from "./LocalForms";
export function Briefing({ data, day }: { data: Data; day: string }) {
  const brief = useMemo(() => dailyBriefing(data, day), [data, day]),
    mutation = useLocalMutation();
  useEffect(() => {
    void db.drafts
      .put({
        id: "morning-briefing",
        value: { ...brief, generatedAt: new Date().toISOString() },
      })
      .catch(() => {
        /* The briefing still renders from authoritative local state. */
      });
  }, [brief]);
  return (
    <Section title="Your daily briefing" className="wide briefing">
      <p>
        {brief.classes.length
          ? `${brief.classes.length} class${brief.classes.length === 1 ? "" : "es"} today.`
          : "No classes on your calendar today."}{" "}
        {brief.tasks.length
          ? `${brief.tasks.length} personal task${brief.tasks.length === 1 ? "" : "s"} due.`
          : "No personal tasks due today."}
      </p>
      <div className="briefing-cards">
        <Link to="/calendar">
          <strong>{brief.classes.length}</strong>
          <span>Classes today</span>
        </Link>
        <Link to="/tasks">
          <strong>{brief.tasks.length}</strong>
          <span>Tasks due today</span>
        </Link>
        <Link to="/school">
          <strong>
            {
              brief.notifications.filter((n) =>
                n.id.startsWith("notice:assignment:"),
              ).length
            }
          </strong>
          <span>Upcoming assignments</span>
        </Link>
      </div>
      <details>
        <summary>Money, commute & allowance details</summary>
        <dl className="breakdown">
          <div>
            <dt>Money outside savings</dt>
            <dd>{money(brief.liquid)}</dd>
          </div>
          <div>
            <dt>Safe daily spending</dt>
            <dd>{money(brief.daily)}</dd>
          </div>
          <div>
            <dt>Today’s remaining commute</dt>
            <dd>{money(brief.commute)}</dd>
          </div>
        </dl>
        <p className="hint">
          Based on records on this device for {day}. Next allowance expected{" "}
          {brief.nextAllowance}; it is not spendable until received.
        </p>
        {brief.lastCanvasSync && (
          <p className="hint">
            Canvas last synced{" "}
            {new Date(brief.lastCanvasSync).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
            })}
            . Cached deadlines may have changed.
          </p>
        )}
      </details>
      <div className="money-links">
        <Link to="/school">Courses & assignments</Link>
        <Link to="/tasks">Tasks & study</Link>
        <Link to="/transport">Record Commute</Link>
        <Link to="/money">Can I afford this?</Link>
      </div>
      {brief.classes.map((c) => (
        <p key={c.id}>
          <Link to="/calendar">
            {c.time || "All day"} · {c.name}
          </Link>
        </p>
      ))}
      <details>
        <summary>Notifications ({brief.notifications.length})</summary>
        <FormFeedback {...mutation} />
        {brief.notifications.length ? (
          brief.notifications.map((n) => (
            <div key={n.id} className="student-item">
              <Link to={n.link}>{n.name}</Link>
              <p className="hint">
                {n.urgent ? "Needs attention" : "Coming up"} · {n.date}
              </p>
              <button
                className="text-button"
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.save((d) => {
                    const s = editStudent(d);
                    s.dismissed = [...new Set([...s.dismissed, n.id])].slice(
                      -1000,
                    );
                  }, "Notification dismissed.")
                }
              >
                Dismiss notification
              </button>
            </div>
          ))
        ) : (
          <p>You’re up to date with the items currently recorded.</p>
        )}
      </details>
    </Section>
  );
}
