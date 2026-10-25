import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { publicUser, isOperator } from "./auth.mjs";
import { getGeofenceError } from "../src/app/lib/geofencing.ts";
import { getAudience } from "../src/app/lib/residents.ts";
import { asResident } from "../src/app/lib/live-model.ts";
import { groupTags, memberIds } from "../src/app/lib/organization.ts";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function dispatchSpec(body) {
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 1000)
    fail(400, "Write a message of 1–1000 characters.");
  if (!["normal", "high", "critical"].includes(body.priority))
    fail(400, "Choose a priority.");
  if (body.targetMode && !["geofence", "groups"].includes(body.targetMode))
    fail(400, "Choose a broadcast audience.");
  const tags = groupTags(content).sort(),
    mode = tags.length ? "groups" : body.targetMode || "geofence";
  const teamGroupIds = body.teamGroupIds || [];
  if (
    !Array.isArray(teamGroupIds) ||
    teamGroupIds.length > 30 ||
    teamGroupIds.some((id) => !uuid.test(id))
  )
    fail(400, "Choose valid organization groups.");
  if (mode === "groups") {
    if (!tags.length && !teamGroupIds.length)
      fail(400, "Select a group or enter its #tag.");
    return {
      content,
      priority: body.priority,
      mode,
      tags,
      teamGroupIds: [...new Set(teamGroupIds)].sort(),
      area: null,
      groups: ["all"],
      activeOnly: false,
    };
  }
  const { area } = body;
  if (
    !area ||
    !["polygon", "rectangle", "circle", "boundary"].includes(area.shape) ||
    !Array.isArray(area.points) ||
    area.points.length > 100 ||
    area.points.some(
      (p) => !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng),
    )
  )
    fail(400, "Draw a valid geofence.");
  const error = getGeofenceError(area);
  if (error) fail(400, error);
  if (
    typeof area.name !== "string" ||
    !area.name.trim() ||
    area.name.length > 80 ||
    typeof area.id !== "string" ||
    !area.id ||
    area.id.length > 100
  )
    fail(400, "Name the geofence.");
  const groups = body.groups || ["all"];
  if (
    !Array.isArray(groups) ||
    !groups.length ||
    groups.length > 6 ||
    groups.some(
      (g) =>
        ![
          "all",
          "pwd",
          "children",
          "seniors",
          "pregnant",
          "responders",
        ].includes(g),
    ) ||
    typeof body.activeOnly !== "boolean"
  )
    fail(400, "Choose valid geofence filters.");
  return {
    content,
    priority: body.priority,
    mode,
    tags: [],
    teamGroupIds: [],
    area,
    groups: [...new Set(groups)].sort(),
    activeOnly: body.activeOnly,
  };
}
export async function resolveDispatch(db, spec) {
  const users = (
    await db.query("select * from eligtas.users where alerts_enabled")
  ).rows;
  let recipients,
    label,
    groupIds = [];
  if (spec.mode === "groups") {
    const groups = (
      await db.query("select * from eligtas.team_groups where not archived")
    ).rows;
    if (
      spec.tags.some((tag) => !groups.some((group) => group.tag === tag)) ||
      spec.teamGroupIds.some((id) => !groups.some((group) => group.id === id))
    )
      fail(
        400,
        "An unknown or archived #group was selected. Check the group directory.",
      );
    groupIds = [
      ...new Set([
        ...spec.teamGroupIds,
        ...groups
          .filter((group) => spec.tags.includes(group.tag))
          .map((group) => group.id),
      ]),
    ].sort();
    const members = (await db.query("select * from eligtas.group_members"))
      .rows;
    const ids = memberIds(groups, members, groupIds);
    recipients = users.filter((user) => ids.has(user.id));
    label = groups
      .filter((group) => groupIds.includes(group.id))
      .map((group) => "#" + group.tag)
      .join(", ");
  } else {
    const eligible = getAudience(
      users.map((row) => asResident(publicUser(row, { self: true }))),
      spec.area,
      { groups: spec.groups, activeOnly: spec.activeOnly },
      new Date().toISOString(),
    );
    const ids = new Set(eligible.recipients.map((user) => user.id));
    recipients = users.filter((user) => ids.has(user.id));
    label = spec.area.name;
  }
  const previewHash = createHash("sha256")
    .update(
      JSON.stringify({ spec, ids: recipients.map((user) => user.id).sort() }),
    )
    .digest("hex");
  return {
    mode: spec.mode,
    label,
    groupIds,
    previewHash,
    recipients: recipients.map((user) => ({
      id: user.id,
      name: user.name,
      onDuty: user.on_duty,
      location: publicUser(user).location,
    })),
  };
}
export function dispatchRoutes(app, db, push, rateLimit, changed) {
  const guard = (req) => {
    if (!isOperator(req.user))
      fail(403, "Approved command-center access is required.");
  };
  app.post("/api/alerts/preview", async (req, res) => {
    guard(req);
    rateLimit(req, "preview", 180);
    res.json(await resolveDispatch(db, dispatchSpec(req.body)));
  });
  app.post("/api/alerts", async (req, res) => {
    guard(req);
    rateLimit(req, "dispatch", 30);
    const { id, previewHash } = req.body;
    if (!uuid.test(id)) fail(400, "Invalid message identifier.");
    const spec = dispatchSpec(req.body);
    const result = await db.transaction(async (tx) => {
      // One transaction freezes the recipient list and prevents competing replays.
      await tx.query("lock table eligtas.alerts in share row exclusive mode");
      const previous = (
        await tx.query("select * from eligtas.alerts where id=$1", [id])
      ).rows[0];
      if (previous) {
        if (previous.author_id !== req.user.id)
          fail(409, "Message identifier is already in use.");
        const matches = previous.target_spec
          ? isDeepStrictEqual(previous.target_spec, spec)
          : previous.content === spec.content &&
            previous.priority === spec.priority &&
            isDeepStrictEqual(previous.area, spec.area) &&
            isDeepStrictEqual(previous.groups, spec.groups) &&
            previous.active_only === spec.activeOnly;
        if (!matches)
          fail(
            409,
            "This message was already sent. Check delivery history before creating another alert.",
          );
        return { ...previous, existing: true };
      }
      await tx.query(
        "lock table eligtas.team_groups,eligtas.group_members in share mode",
      );
      const audience = await resolveDispatch(tx, spec);
      if (
        (spec.mode === "groups" || previewHash) &&
        previewHash !== audience.previewHash
      )
        fail(
          409,
          "The audience changed or was not previewed. Review the recipients again before sending.",
        );
      if (!audience.recipients.length)
        fail(
          409,
          spec.mode === "groups"
            ? "No eligible members in the selected groups."
            : "No eligible on-duty personnel share a recent location in this geofence.",
        );
      await tx.query(
        "insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only,recipient_count,target_mode,target_label,target_group_ids,target_spec) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          id,
          req.user.id,
          spec.content,
          spec.priority,
          spec.area ? JSON.stringify(spec.area) : null,
          spec.groups,
          spec.activeOnly,
          audience.recipients.length,
          spec.mode,
          audience.label,
          audience.groupIds,
          JSON.stringify(spec),
        ],
      );
      for (const user of audience.recipients)
        await tx.query(
          "insert into eligtas.receipts(alert_id,user_id) values ($1,$2)",
          [id, user.id],
        );
      await tx.query(
        "insert into eligtas.audit(id,actor_id,action,target_id) values ($1,$2,$3,$4)",
        [randomUUID(), req.user.id, "dispatch_alert", id],
      );
      return {
        id,
        content: spec.content,
        priority: spec.priority,
        created_at: new Date().toISOString(),
        recipient_count: audience.recipients.length,
      };
    });
    res.status(result.existing ? 200 : 201).json(result);
    changed();
    if (!result.existing && push)
      void push
        .send(result)
        .catch(() =>
          console.error(
            "Push delivery task failed; the alert remains in the inbox.",
          ),
        );
  });
}
