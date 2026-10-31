import type { ReactNode } from "react";
import { Ambulance, ArrowUpRight, Bell, CheckCheck, ChevronRight, HeartHandshake, MapPin, Radio } from "lucide-react";
import { useLive } from "../../lib/live-service";
import { activeResponse, responseLabels } from "../../lib/response";
import { ResponseMap } from "./ResponseMap";
import { DutyCard } from "./PersonnelPanels";

export function MobileHome({ unread, busy, onSafe, children }: {
  unread: number;
  busy: boolean;
  onSafe: () => void;
  children: ReactNode;
}) {
  const live = useLive();
  const user = live.state!.user;
  const assigned = live.state?.responseIncidents?.find(activeResponse);
  return <div className="mobile-home">
    <header className="mobile-welcome">
      <div><span className="el-eyebrow">YOUR FIELD OVERVIEW</span><h1>Hello, {user.name.split(" ")[0]}<span>.</span></h1></div>
      <span className={"mobile-duty-pill" + (user.onDuty ? " is-on-duty" : "")}><i />{user.onDuty ? "On duty" : "Off duty"}</span>
    </header>
    {live.state?.responderReady && <section className="mobile-response-hero" aria-label="Response overview">
      <ResponseMap position={user.location} destination={assigned?.location} interactive={false} follow={false} />
      <div className="mobile-map-vignette" />
      <span className="mobile-map-label"><Radio size={13} />{assigned ? responseLabels[assigned.status] : "RESPONSE WORKSPACE"}</span>
      <div className="mobile-response-content"><span className="mobile-hero-icon"><Ambulance size={26} /></span>
        <h2>{assigned ? assigned.title : user.onDuty ? "Ready for dispatch" : "Your next response starts here"}</h2>
        <p>{assigned ? assigned.location.label : "Assignments, navigation and your dispatch team in one place."}</p>
        <a href="#/public/responder">{assigned ? "Continue response" : "Open responder map"}<ArrowUpRight size={19} /></a>
      </div>
    </section>}
    <div className="mobile-summary-grid">
      <a href="#/public/alerts" className="mobile-summary-card"><Bell size={19} /><strong>{unread ? unread + " unread" : "All caught up"}</strong><span>Command center alerts</span><ChevronRight size={16} /></a>
      <a href="#/public/map" className="mobile-summary-card"><MapPin size={19} /><strong>{user.location ? "My shared location" : "My area"}</strong><span>{user.location ? "View on the map" : "Location & alert zones"}</span><ChevronRight size={16} /></a>
    </div>
    <DutyCard key={user.id} compact />
    <div className="mobile-quick-actions" aria-label="Quick actions">
      <button disabled={busy || live.connection !== "connected"} onClick={onSafe}><CheckCheck size={21} /><span>I’m safe<small>Send a check-in</small></span></button>
      <a href="#/public/help"><HeartHandshake size={21} /><span>Request help<small>Contact your center</small></span></a>
    </div>
    {children}
  </div>;
}
