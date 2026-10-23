import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  FolderKanban,
  GitBranch,
  LocateFixed,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLive } from "../../lib/live-service";
import {
  groupBranch,
  memberIds,
  type Project,
  type TeamGroup,
} from "../../lib/organization";
import { liveLocationLabel } from "../../lib/residents";
import type { GeofencePoint } from "../../lib/geofencing";
import "../../../styles/gsam.css";

const data = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
};
const dateInput = (date: string | null) =>
  date
    ? new Date(Date.parse(date) - new Date(date).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const iso = (value: FormDataEntryValue) =>
  value ? new Date(String(value)).toISOString() : null;
const stamp = (value: string) => new Date(value).toLocaleString("en-PH");
function useSave() {
  const live = useLive(),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  return {
    busy,
    note,
    save: async (
      path: string,
      body: unknown,
      method = "POST",
      done?: (result: any) => void,
    ) => {
      setBusy(true);
      setNote("");
      try {
        const result = await live.mutate(path, body, method);
        setNote("Saved.");
        done?.(result);
      } catch (error) {
        setNote(error instanceof Error ? error.message : "Unable to save.");
      } finally {
        setBusy(false);
      }
    },
  };
}
function Feedback({ busy, note }: { busy: boolean; note: string }) {
  return (
    <>
      {busy && (
        <p className="el-connected-caption" role="status">
          Saving…
        </p>
      )}
      {note && (
        <p className="el-connected-notice" role="status">
          {note}
        </p>
      )}
    </>
  );
}

export function StructureWorkspace({
  tab = "projects",
  onBroadcast,
}: {
  tab?: "projects" | "groups";
  onBroadcast?: (id: string) => void;
}) {
  const { state } = useLive();
  if (!state || !["admin", "operator"].includes(state.user.role))
    return (
      <p className="el-connected-notice">
        Sign in with approved command-center access to manage operations.
      </p>
    );
  return (
    <div className="el-connected gsam-workspace">
      {tab === "projects" ? <Projects /> : <Groups onBroadcast={onBroadcast} />}
    </div>
  );
}
function Projects() {
  const { state } = useLive(),
    { busy, note, save } = useSave();
  const projects = state?.projects || [],
    users = state?.users || [],
    groups = state?.teamGroups || [];
  const [selected, setSelected] = useState(projects[0]?.id || ""),
    [creating, setCreating] = useState(!projects.length),
    [edit, setEdit] = useState(false);
  const project = projects.find((p) => p.id === selected);
  const tasks = (state?.tasks || []).filter(
    (task) => task.project_id === selected,
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    const f = data(event);
    void save(
      creating ? "/projects" : `/projects/${project!.id}`,
      {
        name: f.name,
        objective: f.objective,
        status: f.status,
        leadId: f.leadId,
        startsAt: iso(f.startsAt),
        endsAt: iso(f.endsAt),
      },
      creating ? "POST" : "PUT",
      (result) => {
        setSelected(result.id);
        setCreating(false);
        setEdit(false);
      },
    );
  };
  return (
    <>
      <div className="gsam-toolbar">
        <div>
          <h3>Project management</h3>
          <p>Objectives, operational periods, assignments, and progress.</p>
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setEdit(false);
          }}
        >
          <Plus size={15} />
          New project
        </button>
      </div>
      <Feedback busy={busy} note={note} />
      <div className="gsam-project-list">
        {projects.map((p) => (
          <button
            key={p.id}
            className={selected === p.id ? "is-selected" : ""}
            onClick={() => {
              setSelected(p.id);
              setCreating(false);
              setEdit(false);
            }}
          >
            <FolderKanban size={18} />
            <strong>{p.name}</strong>
            <small>{p.status}</small>
          </button>
        ))}
      </div>
      {(creating || edit) && (
        <form
          key={creating ? "new" : project?.id}
          className="gsam-form-panel"
          onSubmit={submit}
        >
          <h3>{creating ? "Create a project" : "Project details"}</h3>
          <label>
            Project name
            <input
              name="name"
              defaultValue={creating ? "" : project?.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Operational objective
            <textarea
              name="objective"
              defaultValue={creating ? "" : project?.objective}
              rows={3}
              maxLength={1000}
            />
          </label>
          <div className="el-connected-fields">
            <label>
              Status
              <select
                name="status"
                defaultValue={creating ? "planned" : project?.status}
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              Project lead
              <select
                name="leadId"
                defaultValue={creating ? "" : project?.lead_id || ""}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Operational period starts
              <input
                type="datetime-local"
                name="startsAt"
                defaultValue={
                  creating ? "" : dateInput(project?.starts_at || null)
                }
              />
            </label>
            <label>
              Operational period ends
              <input
                type="datetime-local"
                name="endsAt"
                defaultValue={
                  creating ? "" : dateInput(project?.ends_at || null)
                }
              />
            </label>
          </div>
          <p className="el-connected-caption">
            Completing a project ends its active duty sessions. The operational
            period is a planning reference.
          </p>
          <button disabled={busy}>Save project</button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setEdit(false);
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {project && !creating && !edit && (
        <>
          <section className="gsam-project-summary">
            <div>
              <span className="gsam-kicker">{project.status} PROJECT</span>
              <h2>{project.name}</h2>
              <p>
                {project.objective ||
                  "Add an operational objective to guide the team."}
              </p>
              <small>
                Lead:{" "}
                {users.find((u) => u.id === project.lead_id)?.name ||
                  "Unassigned"}
                {project.starts_at && ` · ${stamp(project.starts_at)}`}
                {project.ends_at && ` – ${stamp(project.ends_at)}`}
              </small>
            </div>
            <button onClick={() => setEdit(true)}>Edit project</button>
          </section>
          <div className="gsam-metrics">
            <span>
              <strong>
                {
                  groups.filter((g) => g.project_id === selected && !g.archived)
                    .length
                }
              </strong>
              Groups
            </span>
            <span>
              <strong>
                {
                  users.filter((u) => u.onDuty && u.dutyProjectId === selected)
                    .length
                }
              </strong>
              On duty
            </span>
            <span>
              <strong>
                {tasks.filter((t) => t.status === "done").length}/{tasks.length}
              </strong>
              Tasks complete
            </span>
          </div>
          <form
            className="gsam-task-form"
            onSubmit={(event) => {
              const form = event.currentTarget,
                f = data(event);
              void save(
                "/tasks",
                {
                  projectId: selected,
                  title: f.title,
                  groupId: f.groupId,
                  assigneeId: f.assigneeId,
                  dueAt: iso(f.dueAt),
                },
                "POST",
                () => form.reset(),
              );
            }}
          >
            <h3>Assign a task</h3>
            <label>
              Task
              <input
                name="title"
                placeholder="What needs to be done?"
                required
                maxLength={160}
              />
            </label>
            <div className="el-connected-fields">
              <label>
                Responsible group
                <select name="groupId">
                  <option value="">No group</option>
                  {groups
                    .filter((g) => g.project_id === selected && !g.archived)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        #{g.tag}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Assigned person
                <select name="assigneeId">
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input name="dueAt" type="datetime-local" />
              </label>
            </div>
            <button disabled={busy || project.status === "completed"}>
              Add task
            </button>
          </form>
          <div className="gsam-task-board">
            {(["todo", "in_progress", "blocked", "done"] as const).map(
              (status) => (
                <section key={status}>
                  <h3>
                    {status.replace("_", " ")}{" "}
                    <span>
                      {tasks.filter((t) => t.status === status).length}
                    </span>
                  </h3>
                  {tasks
                    .filter((t) => t.status === status)
                    .map((task) => (
                      <article key={task.id}>
                        <strong>{task.title}</strong>
                        <small>
                          {users.find((u) => u.id === task.assignee_id)?.name ||
                            groups.find((g) => g.id === task.group_id)?.name ||
                            "Unassigned"}
                        </small>
                        {task.due_at && <small>Due {stamp(task.due_at)}</small>}
                        <label className="gsam-sr">
                          Task status
                          <select
                            aria-label={`Status of ${task.title}`}
                            value={task.status}
                            disabled={busy}
                            onChange={(e) =>
                              void save(
                                `/tasks/${task.id}`,
                                { status: e.target.value },
                                "PATCH",
                              )
                            }
                          >
                            {["todo", "in_progress", "blocked", "done"].map(
                              (s) => (
                                <option key={s} value={s}>
                                  {s.replace("_", " ")}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </article>
                    ))}
                  {!tasks.some((t) => t.status === status) && <p>No tasks</p>}
                </section>
              ),
            )}
          </div>
        </>
      )}
      {!projects.length && !creating && (
        <p className="el-connected-notice">
          Create your first project to organize objectives and assignments.
        </p>
      )}
    </>
  );
}
function Groups({ onBroadcast }: { onBroadcast?: (id: string) => void }) {
  const { state } = useLive(),
    { busy, note, save } = useSave();
  const admin = state!.user.role === "admin";
  const groups = state?.teamGroups || [],
    members = state?.memberships || [],
    users = state?.users || [],
    projects = state?.projects || [];
  const [selected, setSelected] = useState(""),
    [edit, setEdit] = useState(false),
    [creating, setCreating] = useState(false),
    [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState(""),
    [parentId, setParentId] = useState("");
  const group = groups.find((g) => g.id === selected);
  const editGroup = (g?: TeamGroup) => {
    setSelected(g?.id || "");
    setProjectId(g?.project_id || "");
    setParentId(g?.parent_id || "");
    setCreating(!g);
    setEdit(true);
  };
  const descendants = groupBranch(
    groups.map((g) => ({ ...g, archived: false })),
    [selected],
  );
  return (
    <>
      <div className="gsam-toolbar">
        <div>
          <h3>Your organizational structure</h3>
          <p>
            Define your own groups, reporting lines, heads, position titles, and
            classifications.
          </p>
        </div>
        {admin && (
          <button onClick={() => editGroup()}>
            <Plus size={15} />
            New group
          </button>
        )}
      </div>
      <Feedback busy={busy} note={note} />
      <label>
        Find a group
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a name or #tag"
        />
      </label>
      <div className="gsam-group-directory">
        {groups
          .filter((g) =>
            `${g.name} ${g.tag}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((g) => (
            <article
              key={g.id}
              className={`${selected === g.id ? "is-selected" : ""}${g.archived ? " is-archived" : ""}`}
            >
              <button
                className="gsam-group-select"
                onClick={() => {
                  setSelected(g.id);
                  setEdit(false);
                  setCreating(false);
                }}
              >
                <GitBranch size={18} />
                <span>
                  <strong>{g.name}</strong>
                  <code>#{g.tag}</code>
                  <small>
                    {g.archived
                      ? "Archived"
                      : g.parent_id
                        ? `Reports to ${groups.find((p) => p.id === g.parent_id)?.name || "parent group"}`
                        : "Top-level group"}{" "}
                    ·{" "}
                    {g.project_id
                      ? projects.find((p) => p.id === g.project_id)?.name
                      : "Organization-wide"}
                  </small>
                </span>
                <b>
                  {memberIds(groups, members, [g.id]).size}
                  <small>members*</small>
                </b>
              </button>
              <div className="gsam-group-actions">
                <span>
                  Head:{" "}
                  {users.find((u) => u.id === g.head_id)?.name || "Unassigned"}
                </span>
                <button
                  disabled={g.archived || !onBroadcast}
                  onClick={() => onBroadcast?.(g.id)}
                >
                  Broadcast <ArrowUpRight size={13} />
                </button>
              </div>
            </article>
          ))}
      </div>
      <p className="el-connected-caption">
        * Includes members of active subgroups. #tag alerts reach members
        regardless of location or duty status. Organizational titles do not
        grant admin/operator access.
      </p>
      {!groups.length && (
        <p className="el-connected-notice">
          Your structure starts empty. Add your own groups; no predefined
          hierarchy is imposed.
        </p>
      )}
      {admin && edit && (
        <form
          key={creating ? "new" : selected}
          className="gsam-form-panel"
          onSubmit={(event) => {
            const f = data(event);
            void save(
              creating ? "/groups" : `/groups/${selected}`,
              {
                name: f.name,
                tag: f.tag,
                description: f.description,
                projectId,
                parentId,
                headId: f.headId,
                archived: f.archived === "on",
              },
              creating ? "POST" : "PUT",
              (result) => {
                setSelected(result.id);
                setEdit(false);
                setCreating(false);
              },
            );
          }}
        >
          <h3>{creating ? "New group" : "Edit group"}</h3>
          <div className="el-connected-fields">
            <label>
              Group name
              <input
                name="name"
                defaultValue={creating ? "" : group?.name}
                maxLength={80}
                required
              />
            </label>
            <label>
              Broadcast tag
              <input
                name="tag"
                defaultValue={creating ? "" : group?.tag}
                placeholder="groupA"
                pattern="[a-zA-Z][a-zA-Z0-9_-]{0,39}"
                maxLength={40}
                required
              />
            </label>
            <label>
              Project
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setParentId("");
                }}
              >
                <option value="">Organization-wide</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reports to
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">No parent group</option>
                {groups
                  .filter(
                    (g) =>
                      !g.archived &&
                      (g.project_id || "") === projectId &&
                      !descendants.has(g.id) &&
                      g.id !== selected,
                  )
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Group head
              <select
                name="headId"
                defaultValue={creating ? "" : group?.head_id || ""}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={creating ? "" : group?.description}
              maxLength={500}
            />
          </label>
          {!creating && (
            <label className="el-connected-check">
              <input
                name="archived"
                type="checkbox"
                defaultChecked={group?.archived}
              />
              Archive this group
            </label>
          )}
          <button disabled={busy}>Save structure</button>
          <button type="button" onClick={() => setEdit(false)}>
            Cancel
          </button>
        </form>
      )}
      {group && !edit && (
        <section className="gsam-form-panel">
          <div className="gsam-toolbar">
            <div>
              <h3>{group.name} · direct members</h3>
              <p>{group.description}</p>
            </div>
            {admin && (
              <button onClick={() => editGroup(group)}>Edit structure</button>
            )}
          </div>
          {members
            .filter((m) => m.group_id === group.id)
            .map((m) => (
              <div className="gsam-member" key={m.user_id}>
                <span>
                  <strong>
                    {users.find((u) => u.id === m.user_id)?.name || "Personnel"}
                  </strong>
                  <small>
                    {m.user_id === group.head_id ? "Head · " : ""}
                    {m.title || "Member"}
                    {m.category && ` · ${m.category}`}
                  </small>
                </span>
                {admin && (
                  <button
                    disabled={busy || group.head_id === m.user_id}
                    onClick={() =>
                      void save(
                        `/groups/${group.id}/members/${m.user_id}`,
                        {},
                        "DELETE",
                      )
                    }
                  >
                    Remove member
                  </button>
                )}
              </div>
            ))}
          {admin && !group.archived && (
            <form
              key={group.id}
              onSubmit={(event) => {
                const form = event.currentTarget,
                  f = data(event);
                void save(
                  `/groups/${group.id}/members/${f.userId}`,
                  { title: f.title, category: f.category },
                  "PUT",
                  () => form.reset(),
                );
              }}
            >
              <h3>Add or update a member</h3>
              <label>
                Preferred name
                <select name="userId" required>
                  <option value="">Choose personnel</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="el-connected-fields">
                <label>
                  Position / function
                  <input
                    name="title"
                    maxLength={80}
                    placeholder="Your position title"
                  />
                </label>
                <label>
                  Personnel classification
                  <input
                    name="category"
                    maxLength={80}
                    placeholder="Your category"
                  />
                </label>
              </div>
              <button disabled={busy}>Save member</button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
export function PersonnelDirectory({
  onLocate,
}: {
  onLocate?: (point: GeofencePoint) => void;
}) {
  const live = useLive(),
    { state } = live,
    { busy, note, save } = useSave();
  const [search, setSearch] = useState(""),
    [groupId, setGroup] = useState(""),
    [onlyDuty, setOnlyDuty] = useState(false),
    [requestFor, setRequestFor] = useState("");
  if (!state) return null;
  const admin = state.user.role === "admin",
    groups = state.teamGroups || [],
    members = state.memberships || [];
  const groupUsers = groupId ? memberIds(groups, members, [groupId]) : null;
  const users = state.users.filter(
    (u) =>
      (!onlyDuty || u.onDuty) &&
      (!groupUsers || groupUsers.has(u.id)) &&
      u.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="gsam-toolbar">
        <div>
          <h3>Personnel directory</h3>
          <p>
            Preferred names and masked contacts. Location is visible only during
            duty.
          </p>
        </div>
      </div>
      <Feedback busy={busy} note={note} />
      <div className="el-connected-fields">
        <label>
          Search preferred name
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Group
          <select value={groupId} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {groups
              .filter((g) => !g.archived)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  #{g.tag}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="el-connected-check">
        <input
          type="checkbox"
          checked={onlyDuty}
          onChange={(e) => setOnlyDuty(e.target.checked)}
        />
        On-duty personnel only
      </label>
      <div className="gsam-personnel-list">
        {users.map((user) => (
          <article key={user.id}>
            <div className="gsam-person-heading">
              <span
                className={`el-device-dot ${user.onDuty ? "is-active" : ""}`}
              />
              <strong>{user.name}</strong>
              <span className="gsam-duty-badge">
                {user.onDuty ? "On duty" : "Off duty"}
              </span>
              <button
                disabled={!user.location || !onLocate}
                onClick={() => user.location && onLocate?.(user.location)}
              >
                <LocateFixed size={14} />
                Locate
              </button>
            </div>
            <p>
              {members
                .filter((m) => m.user_id === user.id)
                .map((m) => {
                  const g = groups.find((g) => g.id === m.group_id);
                  return g && !g.archived
                    ? `#${g.tag}${m.title ? ` · ${m.title}` : ""}${m.category ? ` · ${m.category}` : ""}`
                    : null;
                })
                .filter(Boolean)
                .join(" / ") || "No group assigned"}
            </p>
            <p>
              {user.location
                ? `${liveLocationLabel(user.location.updatedAt, live.locationNow)} · ±${Math.round(user.location.accuracy)} m`
                : user.onDuty
                  ? "Waiting for a device location"
                  : "Location not tracked off duty"}
            </p>
            <div className="gsam-contact">
              <span>
                Email:{" "}
                {user.id === state.user.id && user.email
                  ? "Your own contact"
                  : user.email || "Not supplied"}
              </span>
              <span>
                Phone:{" "}
                {user.id === state.user.id && user.phone
                  ? "Your own contact"
                  : user.phone || "Not supplied"}
              </span>
            </div>
            {user.id !== state.user.id && user.contactVisible?.length > 0 && (
              <p className="el-connected-caption">
                Visible to you with this person’s approval. Permission expires
                after 24 hours and can be revoked.
              </p>
            )}
            {admin && (
              <div className="gsam-person-actions">
                {user.role === "admin" ? (
                  <span>
                    <ShieldCheck size={14} />
                    Administrator
                  </span>
                ) : (
                  <label>
                    Access
                    <select
                      aria-label={`Access for ${user.name}`}
                      value={user.role}
                      disabled={busy}
                      onChange={(e) =>
                        void save(
                          `/operator/access/${user.id}`,
                          { role: e.target.value },
                          "PUT",
                        )
                      }
                    >
                      <option value="resident">Personnel</option>
                      <option value="operator">Operator</option>
                    </select>
                  </label>
                )}
                {user.id !== state.user.id && (
                  <button
                    onClick={() =>
                      setRequestFor(requestFor === user.id ? "" : user.id)
                    }
                  >
                    Request contact visibility
                  </button>
                )}
              </div>
            )}
            {requestFor === user.id && (
              <form
                onSubmit={(event) => {
                  const f = data(event);
                  void save(
                    "/contact-requests",
                    {
                      userId: user.id,
                      reason: f.reason,
                      fields: [
                        ...(f.email ? ["email"] : []),
                        ...(f.phone ? ["phone"] : []),
                      ],
                    },
                    "POST",
                    () => setRequestFor(""),
                  );
                }}
              >
                <label>
                  Reason for access
                  <input
                    name="reason"
                    maxLength={300}
                    required
                    placeholder="Explain why these details are needed"
                  />
                </label>
                <div className="gsam-checkbox-row">
                  <label>
                    <input type="checkbox" name="email" defaultChecked />
                    Email
                  </label>
                  <label>
                    <input type="checkbox" name="phone" defaultChecked />
                    Phone
                  </label>
                </div>
                <p className="el-connected-caption">
                  The person must approve in their mobile app. Access is limited
                  to you for 24 hours.
                </p>
                <button disabled={busy}>Send visibility request</button>
              </form>
            )}
          </article>
        ))}
      </div>
      {!users.length && <p>No matching personnel.</p>}
    </>
  );
}
