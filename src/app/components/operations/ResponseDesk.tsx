import { useEffect, useState } from "react";
import {
  Ambulance,
  ArrowRight,
  CheckCircle2,
  Hospital,
  MapPin,
  MessageCircle,
  Plus,
  Radio,
  Tent,
  X,
} from "lucide-react";
import { api, useLive } from "../../lib/live-service";
import {
  activeResponse,
  responseLabels,
  responseTransitions,
  type ResponsePoint,
  type ResponseStatus,
} from "../../lib/response";
import { ResponseMap } from "../public/ResponseMap";
import { ResponseChat } from "../public/ResponseChat";
import "../../../styles/responder.css";
import "../../../styles/response-desk.css";
const emptyPoint = { lat: 14.578, lng: 121.113, label: "" };
function PointPicker({
  point,
  onChange,
}: {
  point: ResponsePoint;
  onChange: (p: ResponsePoint) => void;
}) {
  return (
    <div className="dispatch-point">
      <label>
        Location description
        <input
          required
          maxLength={180}
          value={point.label}
          onChange={(e) => onChange({ ...point, label: e.target.value })}
          placeholder="Road, landmark and barangay"
        />
      </label>
      <div className="dispatch-coordinates">
        <label>
          Latitude
          <input
            required
            type="number"
            step="any"
            min="-85"
            max="85"
            value={point.lat}
            onChange={(e) =>
              onChange({ ...point, lat: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Longitude
          <input
            required
            type="number"
            step="any"
            min="-180"
            max="180"
            value={point.lng}
            onChange={(e) =>
              onChange({ ...point, lng: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <div className="dispatch-map">
        <ResponseMap
          select={point}
          onSelect={(p) => onChange({ ...p, label: point.label || p.label })}
          satellite={false}
        />
      </div>
      <small>
        Click the map to place the pin. Confirm the exact location with the
        caller.
      </small>
    </div>
  );
}
export function ResponseDesk({
  onLocate,
}: {
  onLocate?: (p: ResponsePoint) => void;
}) {
  const live = useLive(),
    state = live.state!,
    incidents = state.responseIncidents || [],
    facilities = state.responseFacilities || [];
  const [id, setId] = useState<string | null>(null),
    [mode, setMode] = useState<"detail" | "new" | "directory">("detail"),
    [filter, setFilter] = useState<"active" | "closed">("active");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [driver, setDriver] = useState(""),
    [base, setBase] = useState(""),
    [unit, setUnit] = useState(""),
    [tab, setTab] = useState<"overview" | "chat">("overview");
  const [point, setPoint] = useState<ResponsePoint>({ ...emptyPoint }),
    [kind, setKind] = useState("base"),
    [requestId, setRequestId] = useState(""),
    [draftId, setDraftId] = useState(() => crypto.randomUUID()),
    [cancel, setCancel] = useState(false);
  const incident =
    incidents.find((r) => r.id === id) ||
    incidents.find(
      (r) => !["completed", "cancelled", "rejected"].includes(r.status),
    ) ||
    incidents[0];
  const visible = incidents.filter(
    (r) =>
      (filter === "closed") ===
      ["completed", "cancelled", "rejected"].includes(r.status),
  );
  const available = state.users.filter(
    (u) =>
      u.onDuty &&
      !incidents.some(
        (r) =>
          r.id !== incident?.id && r.assigned_id === u.id && activeResponse(r),
      ),
  );
  const requests = state.requests.filter(
    (r) =>
      ["new", "acknowledged"].includes(r.status) &&
      !incidents.some((i) => i.request_id === r.id),
  );
  useEffect(() => {
    setNote("");
    setDriver(incident?.assigned_id || "");
    setBase("");
    setUnit(incident?.unit || "");
    setCancel(false);
  }, [incident?.id]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The change could not be saved.",
      );
      await live.refresh();
    } finally {
      setBusy(false);
    }
  }
  if (!state.responderReady)
    return (
      <div className="dispatch-empty">
        <Ambulance />
        <h3>Responder dispatch</h3>
        <p>
          The service needs the responder update before calls can be assigned.
        </p>
      </div>
    );
  return (
    <section className="dispatch-desk" aria-label="Responder dispatch">
      <header className="dispatch-heading">
        <div>
          <span>FIELD OPERATIONS</span>
          <h2>Dispatch desk</h2>
          <p>Validate the call. Assign the unit. Follow the response.</p>
        </div>
        <div>
          <button
            onClick={() => {
              setMode("directory");
              setPoint({ ...emptyPoint });
              setError("");
            }}
          >
            <Tent size={16} />
            Directory
          </button>
          <button
            className="dispatch-accent"
            onClick={() => {
              setMode("new");
              setPoint({ ...emptyPoint });
              setRequestId("");
              setDraftId(crypto.randomUUID());
              setError("");
            }}
          >
            <Plus size={17} />
            Record emergency call
          </button>
        </div>
      </header>
      {error && (
        <p className="dispatch-error" role="alert">
          {error}
        </p>
      )}
      <div className="dispatch-layout">
        <aside className="dispatch-list">
          <nav aria-label="Dispatch list filter">
            <button
              className={filter === "active" ? "is-active" : ""}
              onClick={() => setFilter("active")}
            >
              Active (
              {
                incidents.filter(
                  (r) =>
                    !["completed", "cancelled", "rejected"].includes(r.status),
                ).length
              }
              )
            </button>
            <button
              className={filter === "closed" ? "is-active" : ""}
              onClick={() => setFilter("closed")}
            >
              History
            </button>
          </nav>
          {visible.map((r) => (
            <button
              key={r.id}
              className={
                "dispatch-case " +
                (r.id === incident?.id && mode === "detail"
                  ? "is-selected"
                  : "")
              }
              onClick={() => {
                setId(r.id);
                setMode("detail");
                setTab("overview");
                setError("");
              }}
            >
              <span>
                {responseLabels[r.status]}
                <small>{r.priority}</small>
              </span>
              <strong>{r.title}</strong>
              <p>{r.location.label}</p>
              <small>
                {r.unit || "Awaiting assignment"} ·{" "}
                {r.assigned_name || r.service}
              </small>
            </button>
          ))}
          {!visible.length && (
            <p className="dispatch-caption">
              No {filter === "active" ? "active" : "closed"} dispatches.
            </p>
          )}
          <div className="dispatch-directory-summary">
            <strong>{requests.length} requests awaiting review</strong>
            <small>
              {facilities.filter((f) => f.kind === "base").length} bases ·{" "}
              {facilities.filter((f) => f.kind === "hospital").length} receiving
              hospitals
            </small>
          </div>
        </aside>
        <div className="dispatch-detail">
          {mode === "new" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void run(async () => {
                  const result = await live.mutate("/responses", {
                    id: draftId,
                    title: data.get("title"),
                    notes: data.get("notes"),
                    service: data.get("service"),
                    priority: data.get("priority"),
                    location: point,
                    requestId: requestId || undefined,
                  });
                  setId(result.incident?.id || draftId);
                  setMode("detail");
                });
              }}
            >
              <div className="dispatch-form-heading">
                <h3>Record an emergency</h3>
                <button
                  type="button"
                  aria-label="Close new call"
                  onClick={() => setMode("detail")}
                >
                  <X size={18} />
                </button>
              </div>
              <label>
                Source
                <select
                  value={requestId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRequestId(value);
                    const request = requests.find((r) => r.id === value),
                      person = state.users.find(
                        (u) => u.id === request?.user_id,
                      );
                    if (request?.include_location && person?.location)
                      setPoint({
                        ...person.location,
                        label: "Caller shared location — confirm with caller",
                      });
                  }}
                >
                  <option value="">Phone call / operator report</option>
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.type}
                    </option>
                  ))}
                </select>
              </label>
              {requestId && (
                <p className="dispatch-caption">
                  {requests.find((r) => r.id === requestId)?.note ||
                    "No caller notes."}
                </p>
              )}
              <label>
                Incident title
                <input
                  name="title"
                  required
                  maxLength={120}
                  placeholder="e.g. Injured person — ambulance requested"
                />
              </label>
              <div className="dispatch-row">
                <label>
                  Requested service
                  <select name="service">
                    <option>Ambulance</option>
                    <option>Rescue</option>
                    <option>Fire response</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select name="priority" defaultValue="high">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>
              <label>
                Dispatch notes
                <textarea
                  name="notes"
                  maxLength={1000}
                  rows={3}
                  placeholder="Relevant situation, access instructions and caller observations"
                />
              </label>
              <PointPicker point={point} onChange={setPoint} />
              <button className="dispatch-accent" disabled={busy}>
                Save for validation
                <ArrowRight size={16} />
              </button>
            </form>
          ) : mode === "directory" ? (
            <>
              <div className="dispatch-form-heading">
                <h3>Bases & receiving hospitals</h3>
                <button
                  aria-label="Close directory"
                  onClick={() => setMode("detail")}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="dispatch-caption">
                Keep destinations verified with your local operations team. A
                mapped hospital listing does not confirm capacity or receiving
                capability.
              </p>
              <div className="dispatch-facilities">
                {facilities.map((f) => (
                  <div key={f.id}>
                    {f.kind === "base" ? (
                      <Tent size={18} />
                    ) : (
                      <Hospital size={18} />
                    )}
                    <span>
                      <strong>{f.name}</strong>
                      <small>
                        {f.kind} · {f.location.lat.toFixed(5)},{" "}
                        {f.location.lng.toFixed(5)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await live.mutate("/response-facilities", {
                      kind,
                      name: point.label,
                      location: point,
                    });
                    setPoint({ ...emptyPoint });
                  });
                }}
              >
                <h4>Add a destination</h4>
                <label>
                  Destination type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="base">Response base</option>
                    <option value="hospital">Receiving hospital</option>
                  </select>
                </label>
                <PointPicker point={point} onChange={setPoint} />
                <button className="dispatch-accent" disabled={busy}>
                  <Plus size={16} />
                  Save destination
                </button>
              </form>
            </>
          ) : !incident ? (
            <div className="dispatch-empty">
              <Ambulance size={42} />
              <h3>Ready for the next call</h3>
              <p>
                Record an emergency and verify its location before assigning a
                driver.
              </p>
            </div>
          ) : (
            <>
              <div className="dispatch-case-heading">
                <span>
                  {responseLabels[incident.status]} ·{" "}
                  {incident.id.slice(0, 8).toUpperCase()}
                </span>
                <h3>{incident.title}</h3>
                <p>
                  <MapPin size={14} />
                  {incident.location.label}
                  <button onClick={() => onLocate?.(incident.location)}>
                    Locate
                  </button>
                </p>
              </div>
              <nav className="dispatch-tabs" aria-label="Dispatch detail views">
                <button
                  className={tab === "overview" ? "is-active" : ""}
                  onClick={() => setTab("overview")}
                >
                  <Radio size={15} />
                  Response
                </button>
                <button
                  className={tab === "chat" ? "is-active" : ""}
                  onClick={() => setTab("chat")}
                >
                  <MessageCircle size={15} />
                  Private chat
                </button>
              </nav>
              {tab === "chat" ? (
                <ResponseChat key={incident.id} incident={incident} />
              ) : (
                <>
                  <p className="dispatch-notes">
                    {incident.notes || "No additional notes."}
                  </p>
                  {incident.status === "reported" && (
                    <div className="dispatch-action-box">
                      <h4>Validate before dispatch</h4>
                      <label>
                        Validation findings
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={500}
                          placeholder="Record how the emergency and location were verified"
                          rows={3}
                        />
                      </label>
                      <div className="dispatch-row">
                        <button
                          className="dispatch-accent"
                          disabled={busy || !note.trim()}
                          onClick={() =>
                            void run(() =>
                              live.mutate(
                                "/responses/" + incident.id + "/validate",
                                {
                                  version: incident.version,
                                  decision: "validated",
                                  note,
                                },
                              ),
                            )
                          }
                        >
                          <CheckCircle2 size={16} />
                          Confirm emergency
                        </button>
                        <button
                          disabled={busy || !note.trim()}
                          onClick={() =>
                            void run(() =>
                              live.mutate(
                                "/responses/" + incident.id + "/validate",
                                {
                                  version: incident.version,
                                  decision: "rejected",
                                  note,
                                },
                              ),
                            )
                          }
                        >
                          Reject report
                        </button>
                      </div>
                    </div>
                  )}
                  {["validated", "assigned"].includes(incident.status) && (
                    <div className="dispatch-action-box">
                      <h4>
                        {incident.status === "assigned"
                          ? "Reassign before departure"
                          : "Assign a response unit"}
                      </h4>
                      <label>
                        On-duty personnel
                        <select
                          value={driver}
                          onChange={(e) => setDriver(e.target.value)}
                        >
                          <option value="">Select a driver / responder</option>
                          {available.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!available.length && (
                        <p className="dispatch-caption">
                          Personnel must sign in and start duty in the mobile
                          app before assignment.
                        </p>
                      )}
                      <div className="dispatch-row">
                        <label>
                          Unit call sign
                          <input
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. Ambulance 01"
                          />
                        </label>
                        <label>
                          Return base
                          <select
                            value={base}
                            onChange={(e) => setBase(e.target.value)}
                          >
                            <option value="">Select a base</option>
                            {facilities
                              .filter((f) => f.kind === "base")
                              .map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                      <button
                        className="dispatch-accent"
                        disabled={busy || !driver || !base || !unit.trim()}
                        onClick={() =>
                          void run(() =>
                            live.mutate(
                              "/responses/" + incident.id + "/assign",
                              {
                                version: incident.version,
                                assigneeId: driver,
                                baseId: base,
                                unit,
                              },
                            ),
                          )
                        }
                      >
                        <Ambulance size={17} />
                        Assign & send navigation
                      </button>
                      <p className="dispatch-caption">
                        Sends a priority alert only to the assigned responder.
                        Their active mobile app opens navigation automatically.
                      </p>
                    </div>
                  )}
                  {incident.assigned_id && (
                    <div className="dispatch-assigned">
                      <Ambulance size={26} />
                      <div>
                        <strong>
                          {incident.unit} · {incident.assigned_name}
                        </strong>
                        <span>{responseLabels[incident.status]}</span>
                        <small>
                          Hospital: {incident.hospital?.label || "Not selected"}
                          <br />
                          Base: {incident.base?.label || "Not set"}
                        </small>
                      </div>
                      <button
                        disabled={
                          !state.users.find(
                            (u) => u.id === incident.assigned_id,
                          )?.location
                        }
                        onClick={() => {
                          const p = state.users.find(
                            (u) => u.id === incident.assigned_id,
                          )?.location;
                          if (p) onLocate?.({ ...p, label: incident.unit });
                        }}
                      >
                        Locate unit
                      </button>
                    </div>
                  )}
                  {incident.validation_note && (
                    <p className="dispatch-validation">
                      <CheckCircle2 size={15} />
                      {incident.validation_note}
                    </p>
                  )}
                  {activeResponse(incident) && (
                    <div className="dispatch-action-box">
                      <h4>Operator status override</h4>
                      <p className="dispatch-caption">
                        Use when the driver reports a stage by radio. Otherwise
                        the responder updates these stages in the app.
                      </p>
                      <div className="dispatch-status-buttons">
                        {(responseTransitions[incident.status] || [])
                          .filter(
                            (s) => s !== "to_hospital" || incident.hospital,
                          )
                          .map((status) => (
                            <button
                              disabled={busy}
                              key={status}
                              onClick={() =>
                                void run(() =>
                                  live.mutate(
                                    "/responses/" + incident.id + "/status",
                                    { version: incident.version, status },
                                    "PATCH",
                                  ),
                                )
                              }
                            >
                              {responseLabels[status]}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  {!["completed", "cancelled", "rejected"].includes(
                    incident.status,
                  ) && (
                    <div className="dispatch-cancel">
                      {cancel ? (
                        <>
                          <p>
                            Cancel this dispatch and stop its active navigation?
                          </p>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await live.mutate(
                                  "/responses/" + incident.id + "/status",
                                  {
                                    version: incident.version,
                                    status: "cancelled",
                                  },
                                  "PATCH",
                                );
                                setCancel(false);
                              })
                            }
                          >
                            Confirm cancellation
                          </button>
                          <button onClick={() => setCancel(false)}>
                            Keep dispatch
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setCancel(true)}>
                          Cancel dispatch
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
