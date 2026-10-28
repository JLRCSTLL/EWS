import { useState } from "react";
import { LocateFixed, ShieldCheck } from "lucide-react";
import { useLive } from "../../lib/live-service";
import { contactFieldLabel } from "../../lib/emergency-profile";
import { android, isAndroidApp } from "../../lib/android";
import "../../../styles/gsam.css";

export function DutyCard() {
  const live = useLive(),
    user = live.state!.user,
    [project, setProject] = useState(user.dutyProjectId || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function duty() {
    setBusy(true);
    setError("");
    try {
      if (user.onDuty) await live.endDuty();
      else await live.startDuty(project);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to change duty status.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="el-card el-location-card"
      aria-label="Duty and live location"
    >
      <div className="el-section-heading">
        <span className="el-icon-soft">
          <LocateFixed size={21} />
        </span>
        <div>
          <h2>{user.onDuty ? "On duty" : "Off duty"}</h2>
          <p>
            {user.onDuty
              ? user.location
                ? "Duty location shared with approved operators"
                : "Awaiting a live GPS update"
              : "Your location is not tracked"}
          </p>
        </div>
      </div>
      {!user.onDuty && (
        <label>
          Duty assignment
          <select
            className="gsam-duty-select"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">General onsite duty</option>
            {(live.state?.projects || [])
              .filter((p) => p.status !== "completed")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {user.onDuty && (
        <p className="el-location-status" role="status">
          {live.sharingOnDevice ? live.locationStatus : 'This device is not transmitting. Resume duty location if this is your active device.'}
        </p>
      )}
      {user.location && (
        <p className="el-caption">
          Last GPS update{" "}
          {new Date(user.location.updatedAt).toLocaleTimeString("en-PH")} · ±
          {Math.round(user.location.accuracy)} m
        </p>
      )}
      <div className="gsam-duty-actions">
        <button
          className={user.onDuty ? "el-secondary" : "el-primary"}
          disabled={busy}
          onClick={() => void duty()}
        >
          {busy ? "Updating…" : user.onDuty ? "End duty" : "Start duty"}
          <LocateFixed size={17} />
        </button>
        {user.onDuty && !live.sharingOnDevice && (
          <button
            className="el-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await live.startLocation();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Unable to resume location.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Resume duty location
          </button>
        )}
      </div>
      <p className="el-caption">
        Starting duty shares fresh GPS updates with approved operators. Ending
        duty stops tracking and removes your point.{" "}
        {isAndroidApp()
          ? "Android continues while the screen is locked and shows an ongoing duty notification."
          : "Keep this page open; use the Android app for tracking while the screen is locked."}
      </p>
      {error && (
        <p className="el-notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function ContactPrivacy() {
  const live = useLive(),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const requests = (live.state?.contactRequests || []).filter(
    (r) => r.user_id === live.state?.user.id,
  );
  async function respond(id: string, status: string) {
    setBusy(true);
    setNote("");
    try {
      await live.mutate(`/contact-requests/${id}`, { status }, "PATCH");
      setNote(
        status === "approved"
          ? "Approved for 24 hours. You can revoke access here."
          : status === "revoked"
            ? "Access revoked. Your contacts are masked again."
            : "Request declined.",
      );
    } catch (error) {
      setNote(
        error instanceof Error ? error.message : "Unable to save your choice.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="el-card">
      <div className="el-section-heading">
        <ShieldCheck size={20} />
        <h2>Contact privacy</h2>
      </div>
      <p className="el-caption">
        Your email, phone, and emergency contact are optional and masked in the command center. An admin
        must request your approval to see specific fields. Approval lasts 24
        hours and applies only to that admin.
      </p>
      {requests.map((r) => {
        const active =
          r.status === "approved" &&
          !!r.expires_at &&
          Date.parse(r.expires_at) > Date.now();
        return (
          <article className="gsam-privacy-request" key={r.id}>
            <strong>
              {r.requester_name} requests {r.fields.map(contactFieldLabel).join(" and ")}
            </strong>
            <p>{r.reason}</p>
            <small>
              {r.status === "approved" && !active ? "Expired" : r.status}
              {active &&
                ` · until ${new Date(r.expires_at!).toLocaleString("en-PH")}`}
            </small>
            <div>
              {r.status === "pending" && (
                <>
                  <button
                    className="el-primary"
                    disabled={busy}
                    onClick={() => void respond(r.id, "approved")}
                  >
                    Allow for 24 hours
                  </button>
                  <button
                    className="el-secondary"
                    disabled={busy}
                    onClick={() => void respond(r.id, "denied")}
                  >
                    Decline
                  </button>
                </>
              )}
              {active && (
                <button
                  className="el-secondary"
                  disabled={busy}
                  onClick={() => void respond(r.id, "revoked")}
                >
                  Revoke access
                </button>
              )}
            </div>
          </article>
        );
      })}
      {!requests.length && (
        <p className="el-caption">No contact visibility requests.</p>
      )}
      {note && (
        <p className="el-notice" role="status">
          {note}
        </p>
      )}
    </section>
  );
}
export function PersonnelAssignments() {
  const live = useLive(),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    state = live.state!;
  return (
    <section className="el-card">
      <h2>My assignments</h2>
      <p className="el-caption">
        Your groups and leaders are assigned by a command-center operator.
      </p>
      <div className="gsam-mobile-assignments">
        {(state.memberships || []).map((m) => {
          const group = state.teamGroups?.find((g) => g.id === m.group_id);
          return group && !group.archived ? (
            <article key={m.group_id}>
              <strong>
                #{group.tag} · {group.name}
              </strong>
              <small>
                {m.is_leader || group.head_id === m.user_id ? "Leader" : m.title || "Member"}
                {m.category && ` · ${m.category}`}
                {group.head_id === state.user.id ? " · Primary leader" : ""}
              </small>
            </article>
          ) : null;
        })}
        {!(state.memberships || []).length && (
          <p className="el-caption">No group assigned yet.</p>
        )}
        {(state.tasks || []).map((task) => (
          <article key={task.id}>
            <strong>{task.title}</strong>
            <small>
              {state.projects?.find((p) => p.id === task.project_id)?.name} ·{" "}
              {task.due_at
                ? `Due ${new Date(task.due_at).toLocaleString("en-PH")}`
                : "No due date"}
            </small>
            {task.assignee_id === state.user.id ? (
              <select
                aria-label={`Status of ${task.title}`}
                disabled={busy}
                value={task.status}
                onChange={async (e) => {
                  setBusy(true);
                  setNote("");
                  try {
                    await live.mutate(
                      `/tasks/${task.id}`,
                      { status: e.target.value },
                      "PATCH",
                    );
                  } catch (error) {
                    setNote(
                      error instanceof Error
                        ? error.message
                        : "Unable to update task.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {["todo", "in_progress", "blocked", "done"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            ) : (
              <small>{task.status.replace("_", " ")}</small>
            )}
          </article>
        ))}
      </div>
      {note && <p className="el-notice">{note}</p>}
    </section>
  );
}
