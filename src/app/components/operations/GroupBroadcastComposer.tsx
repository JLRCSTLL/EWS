import { useEffect, useState, type FormEvent } from "react";
import { LocateFixed, Radio, RefreshCw } from "lucide-react";
import { api, useLive } from "../../lib/live-service";
import { groupTags, memberIds } from "../../lib/organization";
import type { AlertGeofence, GeofencePoint } from "../../lib/geofencing";
import type { AudienceGroup } from "../../lib/residents";
import "../../../styles/gsam.css";

interface Preview {
  mode: "groups" | "geofence";
  label: string;
  previewHash: string;
  recipients: {
    id: string;
    name: string;
    onDuty: boolean;
    location: GeofencePoint | null;
  }[];
}
export function GroupBroadcastComposer({
  areas,
  selectedId,
  onSelectArea,
  initialTeamGroupId,
  initialGroup = "all",
  initialActiveOnly = true,
  onLocate,
}: {
  areas: AlertGeofence[];
  selectedId?: string | null;
  onSelectArea?: (id: string) => void;
  initialTeamGroupId?: string;
  initialGroup?: AudienceGroup;
  initialActiveOnly?: boolean;
  onLocate?: (point: GeofencePoint) => void;
}) {
  const live = useLive(),
    groups = (live.state?.teamGroups || []).filter((g) => !g.archived);
  const [mode, setMode] = useState<"groups" | "geofence">(
      initialTeamGroupId ? "groups" : "geofence",
    ),
    [selectedGroups, setGroups] = useState<string[]>(
      initialTeamGroupId ? [initialTeamGroupId] : [],
    );
  const [content, setContent] = useState(""),
    [priority, setPriority] = useState("high"),
    [activeOnly, setActiveOnly] = useState(initialActiveOnly),
    [groupSearch, setGroupSearch] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null),
    [previewing, setPreviewing] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [messageId, setMessageId] = useState(() => crypto.randomUUID());
  const tags = groupTags(content),
    effectiveMode = tags.length ? "groups" : mode;
  const draft = {
    targetMode: effectiveMode,
    teamGroupIds: effectiveMode === "groups" ? selectedGroups : [],
    content,
    priority,
    area:
      effectiveMode === "geofence"
        ? areas.find((area) => area.id === selectedId)
        : null,
    groups: [initialGroup],
    activeOnly,
  };
  const key = JSON.stringify(draft);
  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setReviewed(false);
    setError("");
    setMessageId(crypto.randomUUID());
    const valid =
      !!content.trim() &&
      (effectiveMode === "groups"
        ? !!(tags.length || selectedGroups.length)
        : !!draft.area);
    if (!valid) {
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    const timer = setTimeout(() => {
      void api("/alerts/preview", JSON.parse(key))
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch((error) => {
          if (!cancelled)
            setError(
              error instanceof Error
                ? error.message
                : "Unable to preview recipients.",
            );
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, revision]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!reviewed || !preview || previewing) return;
    setBusy(true);
    setError("");
    try {
      const result = await live.mutate("/alerts", {
        ...draft,
        id: messageId,
        previewHash: preview.previewHash,
      });
      setNotice(
        `Alert saved for ${result.recipient_count} people. Received/read counts update as their apps respond.`,
      );
      setContent("");
      setReviewed(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send.");
      setReviewed(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="el-live-composer gsam-composer" onSubmit={send}>
      <fieldset disabled={busy} className="gsam-compose-fields">
        <div
          className="gsam-mode-switch"
          role="group"
          aria-label="Broadcast audience"
        >
          <button
            type="button"
            aria-pressed={effectiveMode === "geofence"}
            disabled={!!tags.length}
            onClick={() => setMode("geofence")}
          >
            Geofence audience
          </button>
          <button
            type="button"
            aria-pressed={effectiveMode === "groups"}
            onClick={() => setMode("groups")}
          >
            Named groups · anywhere
          </button>
        </div>
        {effectiveMode === "geofence" ? (
          <>
            <label>
              Geofence
              <select
                value={selectedId || ""}
                required
                onChange={(e) => onSelectArea?.(e.target.value)}
              >
                <option value="">Choose an area</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="el-connected-check">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              Only locations updated within 5 minutes
            </label>
            <p className="el-connected-caption">
              On-duty personnel inside this boundary
              {initialGroup !== "all" ? ` · ${initialGroup}` : ""}.{" "}
              {activeOnly
                ? "Fresh locations only."
                : "Includes recent locations up to 60 minutes old."}
            </p>
          </>
        ) : (
          <>
            <p className="el-connected-notice">
              Group members receive this message anywhere, including off duty
              and without a shared location. Active subgroups are included.
            </p>
            <label>
              Group reference
              <input
                type="search"
                placeholder="Find a group name or #tag"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </label>
            <div className="gsam-group-picker">
              {groups
                .filter((g) =>
                  `${g.name} ${g.tag}`
                    .toLowerCase()
                    .includes(groupSearch.toLowerCase()),
                )
                .map((g) => (
                  <label key={g.id}>
                    <input
                      type="checkbox"
                      checked={
                        selectedGroups.includes(g.id) || tags.includes(g.tag)
                      }
                      disabled={tags.includes(g.tag)}
                      onChange={(e) =>
                        setGroups((current) =>
                          e.target.checked
                            ? [...current, g.id]
                            : current.filter((id) => id !== g.id),
                        )
                      }
                    />
                    <span>
                      <strong>#{g.tag}</strong>
                      <small>{g.name}</small>
                    </span>
                    <b>
                      {
                        memberIds(groups, live.state?.memberships || [], [g.id])
                          .size
                      }
                    </b>
                  </label>
                ))}
              {!groups.length && (
                <p>Add groups and members in Structure first.</p>
              )}
            </div>
          </>
        )}
        <label>
          Alert message
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
            rows={4}
            required
            placeholder="Write your instructions. Use #groupA to address that group anywhere."
          />
        </label>
        {tags.length > 0 && (
          <p className="el-connected-caption">
            Detected: {tags.map((tag) => "#" + tag).join(", ")}. Group targeting
            overrides the geofence. Remove the tags to use a geofence audience.
          </p>
        )}
        <label>
          Alert priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="high">High · full-volume emergency alarm</option>
            <option value="critical">
              Critical · full-volume emergency alarm
            </option>
            <option value="normal">Normal · announcement</option>
          </select>
        </label>
        <p className="el-connected-caption">
          {priority === "normal"
            ? "Announcements use ordinary notification settings."
            : "Emergency alarms are always enabled in the updated Android app. Android permissions and DND alarm exceptions still apply."}
        </p>
        <div className="gsam-toolbar">
          <div className="el-audience-metric">
            <strong>
              {previewing ? "…" : (preview?.recipients.length ?? "—")}
            </strong>
            <span>
              recipients
              <small>
                {preview?.label || "Write a message and choose its audience"}
              </small>
            </span>
          </div>
          <button
            type="button"
            disabled={previewing || busy || !content.trim()}
            onClick={() => setRevision((r) => r + 1)}
          >
            <RefreshCw size={14} />
            Refresh preview
          </button>
        </div>
        {error && (
          <p className="el-connected-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="el-connected-notice" role="status">
            {notice}
          </p>
        )}
        {preview && (
          <div className="el-recipient-list">
            {preview.recipients.map((user) => (
              <div className="gsam-recipient" key={user.id}>
                <span>
                  <strong>{user.name}</strong>
                  <small>
                    {user.onDuty ? "On duty" : "Off duty"}
                    {user.location
                      ? " · location available"
                      : " · no location required for group alerts"}
                  </small>
                </span>
                {user.location && (
                  <button
                    type="button"
                    onClick={() => onLocate?.(user.location!)}
                    aria-label={`Locate ${user.name}`}
                  >
                    <LocateFixed size={14} />
                  </button>
                )}
              </div>
            ))}
            {!preview.recipients.length && (
              <p>
                No eligible recipients. Check group memberships or the geofence.
              </p>
            )}
          </div>
        )}
        <label className="el-connected-check">
          <input
            type="checkbox"
            checked={reviewed}
            disabled={!preview?.recipients.length || previewing}
            onChange={(e) => setReviewed(e.target.checked)}
            required
          />
          I reviewed the message and these recipients.
        </label>
        <button
          className="el-send-live"
          disabled={
            busy ||
            previewing ||
            !preview?.recipients.length ||
            !reviewed ||
            live.connection !== "connected"
          }
        >
          {busy
            ? "Sending…"
            : priority === "normal"
              ? "Send announcement"
              : "Send emergency alert"}
          <Radio size={16} />
        </button>
        <p className="el-connected-caption">
          The server checks the recipient list again. If it changes, you must
          review it again before sending.
        </p>
      </fieldset>
    </form>
  );
}
