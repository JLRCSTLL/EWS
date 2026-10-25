import { randomUUID } from "node:crypto";
import { isOperator } from "./auth.mjs";
import { groupBranch } from "../src/app/lib/organization.ts";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const value = (input, max, label, required = false) =>
  typeof input === "string" &&
  input.trim().length <= max &&
  (!required || input.trim())
    ? input.trim()
    : fail(400, `Check ${label}.`);
const idOrNull = (input) =>
  input == null || input === ""
    ? null
    : uuid.test(input)
      ? input
      : fail(400, "Invalid record identifier.");
const date = (input) =>
  !input
    ? null
    : typeof input === "string" && Number.isFinite(Date.parse(input))
      ? new Date(input).toISOString()
      : fail(400, "Check the date.");
const operator = (req) => {
  if (!isOperator(req.user)) fail(403, "Operator access is required.");
};
const admin = (req) => {
  if (req.user.role !== "admin") fail(403, "Administrator access is required.");
};
async function exists(tx, table, id) {
  if (
    id &&
    !(await tx.query(`select id from eligtas.${table} where id=$1`, [id])).rows
      .length
  )
    fail(400, "Choose an existing record.");
}
async function audit(tx, user, action, target) {
  await tx.query(
    "insert into eligtas.audit(id,actor_id,action,target_id) values ($1,$2,$3,$4)",
    [randomUUID(), user, action, target],
  );
}

export async function organizationState(db, user, operatorView) {
  const projects = (
    await db.query("select * from eligtas.projects order by created_at desc")
  ).rows;
  const allGroups = (
    await db.query("select * from eligtas.team_groups order by name")
  ).rows;
  const allMembers = (await db.query("select * from eligtas.group_members"))
    .rows;
  const allTasks = (
    await db.query("select * from eligtas.tasks order by created_at desc")
  ).rows;
  const mine = new Set(
    allMembers.filter((m) => m.user_id === user.id).map((m) => m.group_id),
  );
  // Include ancestor labels for context, without revealing another person's membership.
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of allGroups)
      if (mine.has(group.id) && group.parent_id && !mine.has(group.parent_id)) {
        mine.add(group.parent_id);
        grew = true;
      }
  }
  const teamGroups = operatorView
    ? allGroups
    : allGroups.filter((g) => mine.has(g.id) && !g.archived);
  const projectIds = new Set([
    ...teamGroups.map((g) => g.project_id),
    ...allTasks
      .filter((t) => t.assignee_id === user.id)
      .map((t) => t.project_id),
  ]);
  const contactRequests = (
    await db.query(
      `select r.*,u.name as requester_name from eligtas.contact_requests r join eligtas.users u on u.id=r.requester_id where r.user_id=$1 or r.requester_id=$1 order by r.created_at desc limit 200`,
      [user.id],
    )
  ).rows;
  return {
    projects: operatorView
      ? projects
      : projects.filter(
          (p) =>
            projectIds.has(p.id) ||
            p.id === user.duty_project_id ||
            p.lead_id === user.id,
        ),
    teamGroups,
    memberships: operatorView
      ? allMembers
      : allMembers.filter((m) => m.user_id === user.id),
    tasks: operatorView
      ? allTasks
      : allTasks.filter(
          (t) =>
            t.assignee_id === user.id ||
            (!t.assignee_id && mine.has(t.group_id)),
        ),
    contactRequests,
  };
}
export function contactVisibility(
  requests,
  viewerId,
  targetId,
  now = Date.now(),
) {
  return [
    ...new Set(
      requests
        .filter(
          (r) =>
            r.requester_id === viewerId &&
            r.user_id === targetId &&
            r.status === "approved" &&
            Date.parse(r.expires_at) > now,
        )
        .flatMap((r) => r.fields),
    ),
  ];
}
export function organizationRoutes(app, db, changed) {
  async function saveProject(req, res, editing) {
    operator(req);
    const b = req.body,
      id = editing ? idOrNull(req.params.id) : randomUUID();
    const name = value(b.name, 100, "project name", true),
      objective = value(b.objective || "", 1000, "objective"),
      lead = idOrNull(b.leadId),
      starts = date(b.startsAt),
      ends = date(b.endsAt);
    if (
      !["planned", "active", "completed"].includes(b.status) ||
      (starts && ends && ends < starts)
    )
      fail(400, "Check project status and operational period.");
    await db.transaction(async (tx) => {
      await exists(tx, "users", lead);
      if (editing) {
        if (
          !(
            await tx.query(
              "select id from eligtas.projects where id=$1 for update",
              [id],
            )
          ).rows.length
        )
          fail(404, "Project not found.");
        await tx.query(
          "update eligtas.projects set name=$1,objective=$2,status=$3,lead_id=$4,starts_at=$5,ends_at=$6 where id=$7",
          [name, objective, b.status, lead, starts, ends, id],
        );
      } else
        await tx.query(
          "insert into eligtas.projects(id,name,objective,status,lead_id,starts_at,ends_at) values ($1,$2,$3,$4,$5,$6,$7)",
          [id, name, objective, b.status, lead, starts, ends],
        );
      if (b.status === "completed") {
        await tx.query(
          "delete from eligtas.location_shares where user_id in (select id from eligtas.users where duty_project_id=$1)",
          [id],
        );
        await tx.query(
          "update eligtas.users set on_duty=false,duty_at=null,duty_project_id=null,location_sharing=false,lat=null,lng=null,accuracy=null,location_at=null where duty_project_id=$1",
          [id],
        );
      }
      await audit(
        tx,
        req.user.id,
        editing ? "update_project" : "create_project",
        id,
      );
    });
    changed();
    res.status(editing ? 200 : 201).json({ id });
  }
  app.post("/api/projects", (req, res) => saveProject(req, res, false));
  app.put("/api/projects/:id", (req, res) => saveProject(req, res, true));
  async function saveGroup(req, res, editing) {
    operator(req);
    const b = req.body,
      id = editing ? idOrNull(req.params.id) : randomUUID();
    const name = value(b.name, 80, "group name", true),
      tag = value(b.tag, 40, "group tag", true).replace(/^#/, "").toLowerCase(),
      description = value(b.description || "", 500, "description");
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(tag))
      fail(
        400,
        "Use a tag starting with a letter, followed by letters, numbers, hyphens or underscores.",
      );
    const project = idOrNull(b.projectId),
      parent = idOrNull(b.parentId),
      head = idOrNull(b.headId);
    await db.transaction(async (tx) => {
      // Serialize hierarchy edits to prevent concurrent changes creating a cycle.
      await tx.query(
        "lock table eligtas.team_groups in share row exclusive mode",
      );
      const groups = (await tx.query("select * from eligtas.team_groups")).rows,
        old = groups.find((g) => g.id === id);
      if (editing && !old) fail(404, "Group not found.");
      if (
        old &&
        old.project_id !== project &&
        groups.some((g) => g.parent_id === id)
      )
        fail(409, "Move child groups before changing this group’s project.");
      const parentGroup = groups.find((g) => g.id === parent);
      if (
        parent &&
        (!parentGroup ||
          parentGroup.archived ||
          parentGroup.project_id !== project ||
          groupBranch(
            groups.map((g) => ({ ...g, archived: false })),
            [id],
          ).has(parent))
      )
        fail(
          400,
          "Choose an active parent in the same project; reporting relationships cannot form a cycle.",
        );
      await exists(tx, "projects", project);
      await exists(tx, "users", head);
      if (b.archived && groups.some((g) => g.parent_id === id && !g.archived))
        fail(409, "Archive or move child groups first.");
      try {
        if (editing)
          await tx.query(
            "update eligtas.team_groups set name=$1,tag=$2,description=$3,project_id=$4,parent_id=$5,head_id=$6,archived=$7 where id=$8",
            [name, tag, description, project, parent, head, !!b.archived, id],
          );
        else
          await tx.query(
            "insert into eligtas.team_groups(id,name,tag,description,project_id,parent_id,head_id) values ($1,$2,$3,$4,$5,$6,$7)",
            [id, name, tag, description, project, parent, head],
          );
      } catch (error) {
        if (error.code === "23505")
          fail(409, "That group tag is already in use.");
        throw error;
      }
      if (head)
        await tx.query(
          "insert into eligtas.group_members(group_id,user_id,title,is_leader) values ($1,$2,$3,true) on conflict(group_id,user_id) do update set is_leader=true",
          [id, head, ""],
        );
      await audit(
        tx,
        req.user.id,
        editing ? "update_group" : "create_group",
        id,
      );
    });
    changed();
    res.status(editing ? 200 : 201).json({ id });
  }
  app.post("/api/groups", (req, res) => saveGroup(req, res, false));
  app.put("/api/groups/:id", (req, res) => saveGroup(req, res, true));
  app.put("/api/groups/:id/members/:userId", async (req, res) => {
    operator(req);
    const id = idOrNull(req.params.id),
      userId = idOrNull(req.params.userId);
    const title = value(req.body.title || "", 80, "position title"),
      category = value(req.body.category || "", 80, "personnel category");
    await db.transaction(async (tx) => {
      const group = (
        await tx.query(
          "select * from eligtas.team_groups where id=$1 for update",
          [id],
        )
      ).rows[0];
      if (!group || group.archived) fail(404, "Active group not found.");
      if (req.body.isLeader !== undefined && typeof req.body.isLeader !== "boolean") fail(400, "Choose a valid member role.");
      if (group.head_id === userId && req.body.isLeader === false) fail(409, "Change the primary leader in group settings first.");
      await exists(tx, "users", userId);
      await tx.query(
        "insert into eligtas.group_members(group_id,user_id,title,category,is_leader) values ($1,$2,$3,$4,$5) on conflict(group_id,user_id) do update set title=excluded.title,category=excluded.category,is_leader=coalesce($6,eligtas.group_members.is_leader)",
        [id, userId, title, category, group.head_id === userId || req.body.isLeader === true, req.body.isLeader ?? null],
      );
      await audit(tx, req.user.id, "assign_group_member", userId);
    });
    changed();
    res.json({ ok: true });
  });
  app.delete("/api/groups/:id/members/:userId", async (req, res) => {
    operator(req);
    const id = idOrNull(req.params.id),
      userId = idOrNull(req.params.userId);
    await db.transaction(async (tx) => {
      const group = (
        await tx.query(
          "select * from eligtas.team_groups where id=$1 for update",
          [id],
        )
      ).rows[0];
      if (!group) fail(404, "Group not found.");
      if (group.head_id === userId)
        fail(409, "Change the primary leader in group settings before removing this member.");
      await tx.query(
        "delete from eligtas.group_members where group_id=$1 and user_id=$2",
        [id, userId],
      );
      await audit(tx, req.user.id, "remove_group_member", userId);
    });
    changed();
    res.json({ ok: true });
  });
  app.put("/api/groups/:id/members", async (req, res) => {
    operator(req);
    const id = idOrNull(req.params.id), ids = req.body.userIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(userId => typeof userId !== 'string' || !uuid.test(userId))) fail(400, "Select between 1 and 100 registered people.");
    const unique = [...new Set(ids)];
    await db.transaction(async tx => {
      const group = (await tx.query("select * from eligtas.team_groups where id=$1 for update", [id])).rows[0];
      if (!group || group.archived) fail(404, "Active group not found.");
      const people = (await tx.query("select id from eligtas.users where id=any($1::uuid[])", [unique])).rows;
      if (people.length !== unique.length) fail(400, "One of the selected people is no longer registered. Refresh the directory.");
      for (const userId of unique) {
        await tx.query("insert into eligtas.group_members(group_id,user_id) values ($1,$2) on conflict(group_id,user_id) do nothing", [id,userId]);
      }
      await audit(tx, req.user.id, "add_group_members", id);
    });
    changed();
    res.json({ ok: true, count: unique.length });
  });
  app.post("/api/tasks", async (req, res) => {
    operator(req);
    const b = req.body,
      id = randomUUID(),
      project = idOrNull(b.projectId),
      group = idOrNull(b.groupId),
      assignee = idOrNull(b.assigneeId),
      title = value(b.title, 160, "task title", true),
      due = date(b.dueAt);
    if (!project) fail(400, "Choose a project.");
    await db.transaction(async (tx) => {
      const row = (
        await tx.query("select * from eligtas.projects where id=$1", [project])
      ).rows[0];
      if (!row || row.status === "completed")
        fail(409, "Choose an open project.");
      if (
        group &&
        !(
          await tx.query(
            "select id from eligtas.team_groups where id=$1 and project_id=$2 and not archived",
            [group, project],
          )
        ).rows.length
      )
        fail(400, "Choose a group within this project.");
      await exists(tx, "users", assignee);
      await tx.query(
        "insert into eligtas.tasks(id,project_id,title,group_id,assignee_id,due_at) values ($1,$2,$3,$4,$5,$6)",
        [id, project, title, group, assignee, due],
      );
      await audit(tx, req.user.id, "create_task", id);
    });
    changed();
    res.status(201).json({ id });
  });
  app.patch("/api/tasks/:id", async (req, res) => {
    const id = idOrNull(req.params.id),
      status = req.body.status;
    if (!["todo", "in_progress", "blocked", "done"].includes(status))
      fail(400, "Choose a task status.");
    await db.transaction(async (tx) => {
      const task = (
        await tx.query("select * from eligtas.tasks where id=$1 for update", [
          id,
        ])
      ).rows[0];
      if (!task || (!isOperator(req.user) && task.assignee_id !== req.user.id))
        fail(
          403,
          "Only an operator or the assigned person can update this task.",
        );
      await tx.query("update eligtas.tasks set status=$1 where id=$2", [
        status,
        id,
      ]);
      await audit(tx, req.user.id, "update_task", id);
    });
    changed();
    res.json({ ok: true });
  });
  app.post("/api/contact-requests", async (req, res) => {
    admin(req);
    const userId = idOrNull(req.body.userId),
      reason = value(req.body.reason, 300, "reason", true),
      fields = req.body.fields;
    if (
      !userId ||
      userId === req.user.id ||
      !Array.isArray(fields) ||
      !fields.length ||
      fields.length > 2 ||
      fields.some((f) => !["email", "phone"].includes(f))
    )
      fail(400, "Choose a person and the contact fields needed.");
    await exists(db, "users", userId);
    const id = randomUUID();
    try {
      await db.query(
        "insert into eligtas.contact_requests(id,user_id,requester_id,reason,fields) values ($1,$2,$3,$4,$5)",
        [id, userId, req.user.id, reason, [...new Set(fields)]],
      );
    } catch (error) {
      if (error.code === "23505")
        fail(
          409,
          "A contact visibility request is already pending for this person.",
        );
      throw error;
    }
    await audit(db, req.user.id, "request_contact_visibility", userId);
    changed();
    res.status(201).json({ id });
  });
  app.patch("/api/contact-requests/:id", async (req, res) => {
    const id = idOrNull(req.params.id),
      status = req.body.status;
    if (!["approved", "denied", "revoked"].includes(status))
      fail(400, "Choose approve, decline, or revoke.");
    await db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "select * from eligtas.contact_requests where id=$1 and user_id=$2 for update",
          [id, req.user.id],
        )
      ).rows[0];
      if (!row) fail(404, "Request not found.");
      if (
        status === "revoked"
          ? row.status !== "approved"
          : row.status !== "pending"
      )
        fail(409, "This request has already changed.");
      await tx.query(
        "update eligtas.contact_requests set status=$1,expires_at=case when $1='approved' then now()+interval '24 hours' else null end where id=$2",
        [status, id],
      );
      await audit(tx, req.user.id, `contact_${status}`, id);
    });
    changed();
    res.json({ ok: true });
  });
  app.put("/api/operator/access/:id", async (req, res) => {
    admin(req);
    const id = idOrNull(req.params.id),
      role = req.body.role;
    if (!["resident", "operator"].includes(role))
      fail(400, "Choose personnel or operator access.");
    const result = await db.query(
      "update eligtas.users set role=$1,operator_requested=false where id=$2 and role<>'admin' returning id",
      [role, id],
    );
    if (!result.rows.length)
      fail(409, "Administrator access cannot be changed here.");
    await audit(db, req.user.id, "change_operator_access", id);
    changed();
    res.json({ ok: true });
  });
}
