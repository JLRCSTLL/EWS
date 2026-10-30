import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Ambulance,
  ArrowUpRight,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Hospital,
  Layers,
  LocateFixed,
  MessageCircle,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, useLive } from "../../lib/live-service";
import {
  activeResponse,
  destinationFor,
  responseDistance,
  responseLabels,
  responseTransitions,
  routeProgress,
  type ResponseIncident,
  type ResponseRoute,
  type ResponseStatus,
  type NearbyHospital,
} from "../../lib/response";
import { ResponseMap } from "./ResponseMap";
import { ResponseChat } from "./ResponseChat";
import { DutyCard } from "./PersonnelPanels";
import "../../../styles/responder.css";
const actionLabels: Partial<Record<ResponseStatus, string>> = {
  en_route: "Depart for emergency",
  on_scene: "Confirm arrival on scene",
  to_hospital: "Navigate to hospital",
  at_hospital: "Confirm hospital arrival",
  returning: "Return to base",
  completed: "Confirm back at base",
};
export function ResponderMobile() {
  const live = useLive(),
    user = live.state!.user,
    incidents = live.state?.responseIncidents || [];
  const active = incidents.find(activeResponse),
    [selected, setSelected] = useState<string | null>(null);
  const incident =
    incidents.find((r) => r.id === (selected || active?.id)) || active;
  const [view, setView] = useState<"navigation" | "chat" | "details">(
      "navigation",
    ),
    [satellite, setSatellite] = useState(true),
    [follow, setFollow] = useState(true);
  const [route, setRoute] = useState<ResponseRoute | null>(null),
    [routing, setRouting] = useState(false),
    [routeError, setRouteError] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [hospitalOpen, setHospitalOpen] = useState(false),
    [startTransport, setStartTransport] = useState(false),
    [hospitals, setHospitals] = useState<NearbyHospital[]>([]),
    [hospitalWarning, setHospitalWarning] = useState(""),
    [timeline, setTimeline] = useState<any[]>([]);
  const request = useRef(0),
    lastRouteAt = useRef(0),
    routeBusy = useRef(false),
    incidentRef = useRef(incident);
  incidentRef.current = incident;
  const destination = incident ? destinationFor(incident) : null,
    position = user.location;
  const fixAge = position
    ? Date.now() - Date.parse(position.updatedAt)
    : Infinity;
  const usable =
    !!position &&
    fixAge < 120000 &&
    fixAge >= -30000 &&
    position.accuracy <= 250;
  const fresh = usable && fixAge < 30000;
  const progress = useMemo(
    () =>
      route && usable && position
        ? routeProgress(route.coordinates, position)
        : null,
    [route, usable, position?.lat, position?.lng],
  );
  const remaining = progress ? progress.remaining : route?.distance || 0;
  const remainingTime = route
    ? Math.max(
        1,
        Math.ceil(
          (route.duration *
            (route.distance ? Math.min(1, remaining / route.distance) : 1)) /
            60,
        ),
      )
    : 0;
  let cumulative = 0;
  const step =
    route?.steps.find((s) => {
      cumulative += s.distance;
      return !progress || cumulative > progress.distanceAlong + 12;
    }) || route?.steps.at(-1);
  async function loadRoute() {
    const current = incidentRef.current;
    if (!current || !destinationFor(current) || routeBusy.current) return;
    const token = ++request.current;
    routeBusy.current = true;
    lastRouteAt.current = Date.now();
    setRouting(true);
    setRouteError("");
    try {
      const next = await api("/responses/" + current.id + "/route");
      if (token === request.current) setRoute(next);
    } catch (e) {
      if (token === request.current) {
        setRoute(null);
        setRouteError(
          e instanceof Error ? e.message : "Directions unavailable.",
        );
      }
    } finally {
      if (token === request.current) {
        routeBusy.current = false;
        setRouting(false);
      }
    }
  }
  useEffect(() => {
    request.current++;
    routeBusy.current = false;
    setRoute(null);
    setRouteError("");
    if (destination) void loadRoute();
    return () => {
      request.current++;
      routeBusy.current = false;
    };
  }, [incident?.id, destination?.lat, destination?.lng, incident?.status]);
  useEffect(() => {
    if (
      fresh &&
      (route?.originSource !== "live" || (progress?.offRoute || 0) > 90) &&
      Date.now() - lastRouteAt.current > 30000
    )
      void loadRoute();
  }, [position?.updatedAt]);
  useEffect(() => {
    setSelected(null);
    setView("navigation");
    setHospitalOpen(false);
  }, [active?.id]);
  useEffect(() => {
    if (!incident || view !== "details") return;
    let disposed = false;
    void api("/responses/" + incident.id + "/timeline")
      .then((r) => {
        if (!disposed) setTimeline(r.events);
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [incident?.id, incident?.version, view]);
  async function changeStatus(status: ResponseStatus) {
    if (!incident) return;
    setBusy(true);
    setError("");
    try {
      await live.mutate(
        "/responses/" + incident.id + "/status",
        { status, version: incident.version },
        "PATCH",
      );
      setView("navigation");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status was not saved.");
      await live.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function chooseHospital(start = false) {
    if (!incident) return;
    setStartTransport(start);
    setHospitalOpen(true);
    setBusy(true);
    setHospitalWarning("");
    try {
      const result = await api("/responses/" + incident.id + "/hospitals");
      setHospitals(result.hospitals);
      setHospitalWarning(result.warning);
    } catch (e) {
      setHospitalWarning(
        e instanceof Error ? e.message : "Hospitals unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!incident)
    return (
      <section className="rsp-standby">
        <span className="rsp-kicker">
          <Radio size={14} /> RESPONDER WORKSPACE
        </span>
        <div className="rsp-standby-icon">
          <Ambulance size={50} strokeWidth={1.2} />
        </div>
        <h1>
          Ready for the
          <br />
          next response.
        </h1>
        <p>
          Validated assignments arrive from dispatch. Your route opens
          automatically when you are assigned.
        </p>
        {!live.state?.responderReady && (
          <p className="rsp-error">
            The responder service is being updated. Reload after deployment.
          </p>
        )}
        <DutyCard />
        {incidents.length > 0 && (
          <div className="rsp-history">
            <h2>Recent dispatches</h2>
            {incidents.map((r) => (
              <button onClick={() => setSelected(r.id)} key={r.id}>
                <span>
                  <strong>{r.title}</strong>
                  <small>{responseLabels[r.status]}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )}
      </section>
    );
  const next = responseTransitions[incident.status] || [];
  const Turn = step?.modifier?.includes("left")
    ? ArrowLeft
    : step?.modifier?.includes("right")
      ? ArrowRight
      : ArrowUp;
  return (
    <div className={"rsp-workspace rsp-view-" + view}>
      <ResponseMap
        position={position}
        destination={destination || incident.location}
        route={route}
        satellite={satellite}
        follow={follow}
      />
      <div className="rsp-map-shade" />
      <header className="rsp-topbar">
        <div className="rsp-glass rsp-brand">
          <Ambulance size={22} />
          <span>
            <small>RESPONDER</small>
            <strong>{incident.unit || "Mobile Phone"}</strong>
          </span>
        </div>
        <span
          className={
            "rsp-live-pill " +
            (live.connection === "connected" ? "is-online" : "")
          }
        >
          <i />
          {live.connection === "connected" ? "Connected" : "Reconnecting"}
        </span>
      </header>
      {view === "navigation" && (
        <>
          <section className="rsp-glass rsp-guidance">
            <div className="rsp-turn">
              <Turn size={31} />
            </div>
            <div>
              <small>
                {routing
                  ? "Calculating road route"
                  : step
                    ? "NEXT DIRECTION"
                    : "DESTINATION"}
              </small>
              <h1>
                {step?.instruction || destination?.label || "Dispatch complete"}
              </h1>
              <p>{destination?.label || responseLabels[incident.status]}</p>
            </div>
          </section>
          <div className="rsp-map-actions">
            <button
              className="rsp-glass rsp-icon-button"
              onClick={() => setSatellite((v) => !v)}
              aria-label={satellite ? "Use street map" : "Use satellite map"}
            >
              <Layers size={20} />
            </button>
            <button
              className={
                "rsp-glass rsp-icon-button " + (follow ? "is-active" : "")
              }
              onClick={() => setFollow((v) => !v)}
              aria-label="Follow my location"
              aria-pressed={follow}
            >
              <LocateFixed size={20} />
            </button>
            <button
              className="rsp-glass rsp-icon-button"
              onClick={() => void loadRoute()}
              disabled={routing}
              aria-label="Refresh road route"
            >
              <RefreshCw size={19} />
            </button>
          </div>
        </>
      )}
      <section
        className={
          "rsp-glass rsp-bottom-sheet " +
          (view === "navigation" ? "" : "is-expanded")
        }
      >
        <div className="rsp-sheet-handle" />
        <nav className="rsp-view-tabs" aria-label="Dispatch views">
          {[
            [Compass, "navigation", "Navigation"],
            [MessageCircle, "chat", "Chat"],
            [ShieldCheck, "details", "Incident"],
          ].map(([Icon, id, label]: any) => (
            <button
              key={id}
              className={view === id ? "is-active" : ""}
              onClick={() => setView(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        {view === "chat" ? (
          <ResponseChat key={incident.id} incident={incident} />
        ) : view === "details" ? (
          <div className="rsp-details">
            <span className="rsp-kicker">
              INCIDENT · {incident.id.slice(0, 8).toUpperCase()}
            </span>
            <h2>{incident.title}</h2>
            <p>{incident.notes || "No additional field notes."}</p>
            <dl>
              <div>
                <dt>Emergency location</dt>
                <dd>{incident.location.label}</dd>
              </div>
              <div>
                <dt>Receiving hospital</dt>
                <dd>{incident.hospital?.label || "Not selected"}</dd>
              </div>
              <div>
                <dt>Return base</dt>
                <dd>{incident.base?.label || "Not assigned"}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{incident.validation_note}</dd>
              </div>
            </dl>
            <h3>Response timeline</h3>
            <ol className="rsp-timeline">
              {timeline.map((event) => (
                <li key={event.id}>
                  <i />
                  <div>
                    <strong>
                      {responseLabels[event.status as ResponseStatus] ||
                        event.status.replaceAll("_", " ")}
                    </strong>
                    <small>
                      {event.actor} ·{" "}
                      {new Date(event.created_at).toLocaleTimeString("en-PH", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {!activeResponse(incident) && (
              <button
                className="rsp-secondary"
                onClick={() => {
                  setSelected(null);
                  setView("navigation");
                  location.hash = "#/public/home";
                }}
              >
                Return to overview
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="rsp-incident-heading">
              <span className="rsp-status">
                <i />
                {responseLabels[incident.status]}
              </span>
              <span className="rsp-priority">{incident.priority}</span>
            </div>
            <h2>{incident.title}</h2>
            <div className="rsp-trip-metrics">
              <div>
                <strong>{route ? responseDistance(remaining) : "—"}</strong>
                <small>
                  <Route size={12} /> remaining
                </small>
              </div>
              <div>
                <strong>{route ? remainingTime + " min" : "—"}</strong>
                <small>
                  <Clock size={12} /> estimated travel
                </small>
              </div>
              <div>
                <strong>{fresh ? "Live GPS" : "Last location"}</strong>
                <small>
                  <LocateFixed size={12} />
                  {position
                    ? "±" + Math.round(position.accuracy) + " m"
                    : "Awaiting duty GPS"}
                </small>
              </div>
            </div>
            {routeError && (
              <p className="rsp-error" role="status">
                {routeError}
              </p>
            )}
            {!usable && activeResponse(incident) && (
              <p className="rsp-caption">
                Route starts from the last known leg start until a fresh duty
                position arrives. <a href="#/public/account">Review location</a>
              </p>
            )}
            {route && (
              <p className="rsp-caption">
                Road directions · no live traffic or road-closure data
              </p>
            )}
            <div className="rsp-status-actions">
              {next.map((status) => (
                <button
                  key={status}
                  className={
                    status === "returning" && next.length > 1
                      ? "rsp-secondary"
                      : "rsp-primary"
                  }
                  disabled={busy || live.connection !== "connected"}
                  onClick={() =>
                    status === "to_hospital" && !incident.hospital
                      ? void chooseHospital(true)
                      : void changeStatus(status)
                  }
                >
                  {status === "completed" ? (
                    <Check size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}{" "}
                  {actionLabels[status]}
                </button>
              ))}
            </div>
            {["assigned", "en_route", "on_scene", "to_hospital"].includes(
              incident.status,
            ) && (
              <button
                className="rsp-hospital-link"
                onClick={() => void chooseHospital()}
              >
                <Hospital size={17} />
                <span>
                  {incident.hospital?.label || "Find nearest hospitals"}
                </span>
                <ChevronRight size={16} />
              </button>
            )}
            {destination && (
              <a
                className="rsp-external-route"
                href={
                  "https://www.google.com/maps/dir/?api=1&destination=" +
                  destination.lat +
                  "," +
                  destination.lng +
                  "&travelmode=driving&dir_action=navigate"
                }
                target="_blank"
                rel="noreferrer"
              >
                Open turn-by-turn in Maps <ArrowUpRight size={13} />
              </a>
            )}
          </>
        )}
        {error && (
          <p className="rsp-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <Dialog.Root open={hospitalOpen} onOpenChange={setHospitalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="rsp-modal-overlay" />
          <Dialog.Content className="rsp-hospital-picker rsp-glass">
            <header>
              <div>
                <span className="rsp-kicker">TRANSPORT DESTINATION</span>
                <Dialog.Title>Nearby hospitals</Dialog.Title>
              </div>
              <button
                className="rsp-icon-button"
                onClick={() => setHospitalOpen(false)}
                aria-label="Close hospitals"
              >
                <X />
              </button>
            </header>
            <Dialog.Description>
              Closest mapped facilities to the emergency, by straight-line
              distance. Confirm receiving capability and availability with
              dispatch.
            </Dialog.Description>
            {busy && <p role="status">Finding hospitals…</p>}
            {hospitalWarning && <p className="rsp-error">{hospitalWarning}</p>}
            <div>
              {hospitals.map((hospital, i) => (
                <button
                  className="rsp-hospital-option"
                  key={hospital.id}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setHospitalWarning("");
                    try {
                      const saved = await live.mutate(
                        "/responses/" + incident.id + "/hospital",
                        { hospitalId: hospital.id, version: incident.version },
                      );
                      if (startTransport && saved.status === "on_scene")
                        await live.mutate(
                          "/responses/" + incident.id + "/status",
                          { status: "to_hospital", version: saved.version },
                          "PATCH",
                        );
                      setHospitalOpen(false);
                      setView("navigation");
                    } catch (e) {
                      setHospitalWarning(
                        e instanceof Error
                          ? e.message
                          : "Hospital was not saved.",
                      );
                      await live.refresh();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <span className="rsp-hospital-icon">
                    <Hospital size={22} />
                  </span>
                  <span>
                    <strong>{hospital.label}</strong>
                    <small>
                      {i === 0 ? "Nearest mapped · " : ""}
                      {responseDistance(hospital.distance)} away
                    </small>
                    <small>
                      {hospital.emergency} · {hospital.source}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
            {!busy && !hospitals.length && (
              <p>
                No mapped hospitals found. Dispatch can add a receiving hospital
                to the directory.
              </p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
