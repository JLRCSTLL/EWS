import { randomUUID, createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import sharp from "sharp";
import { isOperator } from "./auth.mjs";
import {
  responseTransitions,
  destinationFor,
  distanceMeters,
} from "../src/app/lib/response.ts";
import { createResponseRouting } from "./response-routing.mjs";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const text = (value, max, min = 0) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(400, "Check the required text and length.");
  return value.trim();
};
export function responsePoint(value) {
  if (
    !value ||
    !Number.isFinite(value.lat) ||
    !Number.isFinite(value.lng) ||
    Math.abs(value.lat) > 85 ||
    Math.abs(value.lng) > 180
  )
    fail(400, "Select a valid map location.");
  return { lat: value.lat, lng: value.lng, label: text(value.label, 180, 1) };
}
const operator = (req) => {
  if (!isOperator(req.user)) fail(403, "Approved operator access is required.");
};
async function access(db, id, user, lock = false) {
  if (!uuid.test(id)) fail(404, "Dispatch not found.");
  const row = (
    await db.query(
      "select * from eligtas.response_incidents where id=$1" +
        (lock ? " for update" : ""),
      [id],
    )
  ).rows[0];
  if (!row || (!isOperator(user) && row.assigned_id !== user.id))
    fail(404, "Dispatch not found or no longer assigned to you.");
  return row;
}
function revision(row, value) {
  if (!Number.isSafeInteger(value) || value !== row.version)
    fail(409, "This dispatch changed. Refresh and review its current status.");
}
async function record(tx, row, user, status) {
  await tx.query(
    "insert into eligtas.response_events(id,incident_id,actor_id,status) values ($1,$2,$3,$4)",
    [randomUUID(), row.id, user.id, status],
  );
  await tx.query(
    "insert into eligtas.audit(id,actor_id,action,target_id) values ($1,$2,$3,$4)",
    [randomUUID(), user.id, "response_" + status, row.id],
  );
}
export async function responseState(db, user, operatorView) {
  const responseIncidents = (
    await db.query(
      "select r.*,u.name as assigned_name from eligtas.response_incidents r left join eligtas.users u on u.id=r.assigned_id " +
        (operatorView ? "" : "where r.assigned_id=$1 ") +
        "order by r.updated_at desc limit 150",
      operatorView ? [] : [user.id],
    )
  ).rows;
  const responseFacilities = operatorView
    ? (
        await db.query(
          "select id,kind,name,location from eligtas.response_facilities order by name",
        )
      ).rows
    : [];
  return { responseIncidents, responseFacilities, responderReady: true };
}
export async function normalizeResponsePhoto(photo) {
  if (photo === undefined || photo === null) return null;
  if (
    typeof photo !== "string" ||
    photo.length > 3 * 1024 * 1024 ||
    photo.length % 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(photo)
  )
    fail(400, "Choose one photo smaller than 2 MB.");
  const input = Buffer.from(photo, "base64");
  if (input.length > 2 * 1024 * 1024 || input.toString("base64") !== photo)
    fail(400, "Invalid photo.");
  try {
    const image = sharp(input, {
        limitInputPixels: 20000000,
        animated: false,
        failOn: "error",
      }),
      meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format) || (meta.pages || 1) > 1)
      fail(400, "Use a JPEG, PNG or WebP photo.");
    // Re-encoding strips EXIF, GPS and other metadata. Never serve supplied bytes.
    const { data, info } = await image
      .rotate()
      .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > 2 * 1024 * 1024)
      fail(400, "Photo is too large. Choose a smaller image.");
    return {
      data,
      width: info.width,
      height: info.height,
      hash: createHash("sha256").update(data).digest("hex"),
    };
  } catch (error) {
    if (error.status) throw error;
    fail(400, "This photo could not be decoded. Use JPEG, PNG or WebP.");
  }
}
export function responseRoutes(
  app,
  db,
  { changed, push, rateLimit, routing = createResponseRouting() },
) {
  const signal = (row) => {
    changed(row.assigned_id || undefined);
    if (row.request_user_id) changed(row.request_user_id);
  };
  async function hospitals(row) {
    const manual = (
      await db.query(
        "select * from eligtas.response_facilities where kind='hospital'",
      )
    ).rows.map((f) => ({
      ...f.location,
      id: f.id,
      label: f.name,
      source: "Operator directory",
      emergency: "Confirm receiving availability",
    }));
    let external = [],
      warning = "";
    try {
      external = await routing.hospitals(row.location);
    } catch (error) {
      warning = error.message;
    }
    const merged = [
      ...manual,
      ...external.filter(
        (e) =>
          !manual.some(
            (m) =>
              distanceMeters(m, e) < 100 &&
              m.label.toLowerCase() === e.label.toLowerCase(),
          ),
      ),
    ];
    return {
      hospitals: merged
        .map((h) => ({ ...h, distance: distanceMeters(row.location, h) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 12),
      warning,
    };
  }
  app.post("/api/response-facilities", async (req, res) => {
    operator(req);
    rateLimit(req, "response-facility", 30);
    if (!["base", "hospital"].includes(req.body.kind))
      fail(400, "Choose a base or hospital.");
    const id = randomUUID(),
      name = text(req.body.name, 120, 1),
      location = responsePoint({ ...req.body.location, label: req.body.name });
    await db.query(
      "insert into eligtas.response_facilities(id,kind,name,location,created_by) values ($1,$2,$3,$4,$5)",
      [id, req.body.kind, name, JSON.stringify(location), req.user.id],
    );
    changed();
    res.status(201).json({ id });
  });
  app.post("/api/responses", async (req, res) => {
    operator(req);
    rateLimit(req, "response-create", 60);
    const b = req.body,
      id = b.id;
    if (
      !uuid.test(id) ||
      !["Ambulance", "Rescue", "Fire response"].includes(b.service) ||
      !["normal", "high", "critical"].includes(b.priority)
    )
      fail(400, "Check the dispatch details.");
    const title = text(b.title, 120, 1),
      notes = text(b.notes || "", 1000),
      location = responsePoint(b.location);
    if (b.requestId && !uuid.test(b.requestId))
      fail(400, "Invalid assistance request.");
    const row = await db.transaction(async (tx) => {
      const prior = (
        await tx.query("select * from eligtas.response_incidents where id=$1", [
          id,
        ])
      ).rows[0];
      if (prior) {
        if (
          prior.created_by !== req.user.id ||
          prior.title !== title ||
          prior.notes !== notes ||
          prior.service !== b.service ||
          prior.priority !== b.priority ||
          prior.request_id !== (b.requestId || null) ||
          !isDeepStrictEqual(prior.location, location)
        )
          fail(409, "Dispatch identifier already used.");
        return prior;
      }
      if (
        b.requestId &&
        !(
          await tx.query(
            "select id from eligtas.requests where id=$1 and status in ('new','acknowledged') for update",
            [b.requestId],
          )
        ).rows.length
      )
        fail(409, "This request is no longer available for validation.");
      if (
        b.requestId &&
        (
          await tx.query(
            "select id from eligtas.response_incidents where request_id=$1",
            [b.requestId],
          )
        ).rows.length
      )
        fail(409, "This assistance request already has an incident.");
      const r = (
        await tx.query(
          "insert into eligtas.response_incidents(id,request_id,title,notes,priority,service,location,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *",
          [
            id,
            b.requestId || null,
            title,
            notes,
            b.priority,
            b.service,
            JSON.stringify(location),
            req.user.id,
          ],
        )
      ).rows[0];
      await record(tx, r, req.user, "reported");
      return r;
    });
    changed();
    res.status(201).json(row);
  });
  app.post("/api/responses/:id/validate", async (req, res) => {
    operator(req);
    const decision = req.body.decision,
      note = text(req.body.note, 500, 1);
    if (!["validated", "rejected"].includes(decision))
      fail(400, "Choose a validation result.");
    const row = await db.transaction(async (tx) => {
      const r = await access(tx, req.params.id, req.user, true);
      revision(r, req.body.version);
      if (r.status !== "reported")
        fail(409, "This call has already been validated.");
      const next = (
        await tx.query(
          "update eligtas.response_incidents set status=$1,validation_note=$2,validated_by=$3,version=version+1,updated_at=now() where id=$4 returning *",
          [decision, note, req.user.id, r.id],
        )
      ).rows[0];
      if (r.request_id)
        await tx.query(
          "update eligtas.requests set status=$1,updated_at=now() where id=$2",
          [
            decision === "validated" ? "acknowledged" : "cancelled",
            r.request_id,
          ],
        );
      await record(tx, r, req.user, decision);
      return next;
    });
    changed();
    res.json(row);
  });
  app.post("/api/responses/:id/assign", async (req, res) => {
    operator(req);
    rateLimit(req, "response-assign", 60);
    if (!uuid.test(req.body.assigneeId) || !uuid.test(req.body.baseId))
      fail(400, "Choose an on-duty driver and a base.");
    const unit = text(req.body.unit, 80, 1);
    let dispatched, previousUser;
    const row = await db.transaction(async (tx) => {
      const r = await access(tx, req.params.id, req.user, true);
      revision(r, req.body.version);
      if (!["validated", "assigned"].includes(r.status))
        fail(409, "Validate this call before assigning a driver.");
      const user = (
        await tx.query(
          "select id,on_duty from eligtas.users where id=$1 for update",
          [req.body.assigneeId],
        )
      ).rows[0];
      if (!user?.on_duty)
        fail(409, "The selected driver must start duty before dispatch.");
      if (
        (
          await tx.query(
            "select id from eligtas.response_incidents where assigned_id=$1 and id<>$2 and status in ('assigned','en_route','on_scene','to_hospital','at_hospital','returning')",
            [user.id, r.id],
          )
        ).rows.length
      )
        fail(409, "This driver already has an active dispatch.");
      const base = (
        await tx.query(
          "select location from eligtas.response_facilities where id=$1 and kind='base'",
          [req.body.baseId],
        )
      ).rows[0]?.location;
      if (!base) fail(400, "Select a saved dispatch base.");
      previousUser = r.assigned_id;
      const next = (
        await tx.query(
          "update eligtas.response_incidents set assigned_id=$1,unit=$2,base=$3,route_origin=$3,status='assigned',version=version+1,updated_at=now() where id=$4 returning *",
          [user.id, unit, JSON.stringify(base), r.id],
        )
      ).rows[0];
      if (r.request_id)
        await tx.query(
          "update eligtas.requests set status='assigned',assigned_unit=$1,updated_at=now() where id=$2",
          [unit, r.request_id],
        );
      // Push only a generic notice. Medical notes and locations stay in scoped API data.
      const alertId = randomUUID(),
        content =
          "New " +
          r.service.toLowerCase() +
          " assignment. Open responder navigation to review the emergency and route.";
      await tx.query(
        "insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only,recipient_count,target_mode,target_label,response_id) values ($1,$2,$3,'high','null'::jsonb,'{}',false,1,'groups','Responder dispatch',$4)",
        [alertId, req.user.id, content, r.id],
      );
      await tx.query(
        "insert into eligtas.receipts(alert_id,user_id) values ($1,$2)",
        [alertId, user.id],
      );
      dispatched = {
        id: alertId,
        content,
        priority: "high",
        created_at: new Date().toISOString(),
        response_id: r.id,
      };
      await record(tx, r, req.user, "assigned");
      return next;
    });
    signal(row);
    if (previousUser && previousUser !== row.assigned_id) changed(previousUser);
    if (push)
      void push
        .send(dispatched)
        .catch(() =>
          console.error("Responder push delivery could not be completed."),
        );
    res.json(row);
  });
  app.patch("/api/responses/:id/status", async (req, res) => {
    const status = req.body.status;
    const row = await db.transaction(async (tx) => {
      const r = await access(tx, req.params.id, req.user, true);
      revision(r, req.body.version);
      const cancel =
        status === "cancelled" &&
        isOperator(req.user) &&
        !["completed", "cancelled", "rejected"].includes(r.status);
      if (!cancel && !(responseTransitions[r.status] || []).includes(status))
        fail(
          409,
          "This status change is not available from the current stage.",
        );
      if (status === "to_hospital" && !r.hospital)
        fail(400, "Choose a receiving hospital before starting transport.");
      let origin = r.route_origin;
      if (status === "on_scene" || status === "to_hospital")
        origin = r.location;
      if (status === "at_hospital") origin = r.hospital;
      if (status === "returning")
        origin = r.status === "at_hospital" ? r.hospital : r.location;
      const next = (
        await tx.query(
          "update eligtas.response_incidents set status=$1,route_origin=$2,version=version+1,updated_at=now() where id=$3 returning *",
          [status, JSON.stringify(origin), r.id],
        )
      ).rows[0];
      if (r.request_id && ["completed", "cancelled"].includes(status))
        await tx.query(
          "update eligtas.requests set status=$1,updated_at=now() where id=$2",
          [status === "completed" ? "resolved" : "cancelled", r.request_id],
        );
      await record(tx, r, req.user, status);
      return next;
    });
    changed();
    res.json(row);
  });
  app.get("/api/responses/:id/hospitals", async (req, res) => {
    const row = await access(db, req.params.id, req.user);
    rateLimit(req, "response-hospitals", 20);
    res.json(await hospitals(row));
  });
  app.post("/api/responses/:id/hospital", async (req, res) => {
    const current = await access(db, req.params.id, req.user);
    rateLimit(req, "response-hospital-choice", 20);
    revision(current, req.body.version);
    const list = await hospitals(current),
      hospital = list.hospitals.find((h) => h.id === req.body.hospitalId);
    if (!hospital)
      fail(
        400,
        "Refresh nearby hospitals or ask dispatch to add the receiving facility.",
      );
    const row = await db.transaction(async (tx) => {
      const r = await access(tx, req.params.id, req.user, true);
      revision(r, req.body.version);
      if (
        !["assigned", "en_route", "on_scene", "to_hospital"].includes(r.status)
      )
        fail(409, "The hospital cannot be changed at this stage.");
      const next = (
        await tx.query(
          "update eligtas.response_incidents set hospital=$1,version=version+1,updated_at=now() where id=$2 returning *",
          [JSON.stringify(responsePoint(hospital)), r.id],
        )
      ).rows[0];
      await record(tx, r, req.user, "hospital_selected");
      return next;
    });
    signal(row);
    res.json(row);
  });
  app.get("/api/responses/:id/route", async (req, res) => {
    const row = await access(db, req.params.id, req.user);
    rateLimit(req, "response-route-" + req.user.id, 30, 5 * 60000);
    const destination = destinationFor(row);
    if (!destination) fail(409, "There is no active navigation destination.");
    const driver = row.assigned_id
      ? (
          await db.query("select * from eligtas.users where id=$1", [
            row.assigned_id,
          ])
        ).rows[0]
      : null;
    const fresh =
      driver?.on_duty &&
      driver.location_sharing &&
      Number.isFinite(driver.lat) &&
      Date.now() - Date.parse(driver.location_at) < 120000 &&
      Date.now() - Date.parse(driver.location_at) >= -30000 &&
      driver.accuracy <= 250;
    const origin = fresh
      ? { lat: driver.lat, lng: driver.lng, label: "Live driver location" }
      : row.route_origin || row.base;
    if (!origin)
      fail(409, "A live location or dispatch base is required for directions.");
    res.json({
      ...(await routing.route(origin, destination)),
      origin,
      destination,
      originSource: fresh ? "live" : "last_leg_start",
    });
  });
  app.get("/api/responses/:id/timeline", async (req, res) => {
    await access(db, req.params.id, req.user);
    res.json({
      events: (
        await db.query(
          "select e.id,e.status,e.created_at,coalesce(u.name,'Former user') as actor from eligtas.response_events e left join eligtas.users u on u.id=e.actor_id where incident_id=$1 order by e.created_at desc limit 100",
          [req.params.id],
        )
      ).rows,
    });
  });
  app.get("/api/responses/:id/messages", async (req, res) => {
    await access(db, req.params.id, req.user);
    let cursor = null;
    if (req.query.before) {
      try {
        if (
          typeof req.query.before !== "string" ||
          req.query.before.length > 300
        )
          throw Error();
        cursor = JSON.parse(
          Buffer.from(req.query.before, "base64url").toString(),
        );
        if (
          !uuid.test(cursor.id) ||
          typeof cursor.at !== "string" ||
          !Number.isFinite(Date.parse(cursor.at))
        )
          throw Error();
      } catch {
        fail(400, "Invalid message page.");
      }
    }
    const rows = (
      await db.query(
        "select m.id,m.sender_id,u.name as sender_name,m.body,m.created_at,m.created_at::text as page_at,m.photo_sha256 is not null as has_photo,(m.created_at<now()-interval '7 days') as photo_expired,m.photo_width,m.photo_height from eligtas.response_messages m join eligtas.users u on u.id=m.sender_id where incident_id=$1 and ($2::timestamptz is null or (m.created_at,m.id)<($2::timestamptz,$3::uuid)) order by m.created_at desc,m.id desc limit 60",
        [req.params.id, cursor?.at || null, cursor?.id || null],
      )
    ).rows;
    const last = rows.at(-1),
      olderBefore =
        rows.length === 60
          ? Buffer.from(
              JSON.stringify({ at: last.page_at, id: last.id }),
            ).toString("base64url")
          : null;
    res.json({
      messages: rows.reverse().map(({ page_at, ...message }) => message),
      olderBefore,
    });
  });
  app.post("/api/responses/:id/messages", async (req, res) => {
    rateLimit(req, "response-message", 60);
    const current = await access(db, req.params.id, req.user);
    if (!uuid.test(req.body.id)) fail(400, "Invalid message identifier.");
    const body = text(req.body.body || "", 2000),
      photo = await normalizeResponsePhoto(req.body.photo);
    if (!body && !photo) fail(400, "Write a message or attach a photo.");
    await db.transaction(async (tx) => {
      const row = await access(tx, current.id, req.user, true);
      if (["completed", "cancelled", "rejected"].includes(row.status))
        fail(409, "This dispatch is closed. Its conversation is read-only.");
      const previous = (
        await tx.query(
          "select incident_id,sender_id,body,photo_sha256 from eligtas.response_messages where id=$1",
          [req.body.id],
        )
      ).rows[0];
      if (previous) {
        if (
          previous.incident_id !== row.id ||
          previous.sender_id !== req.user.id ||
          previous.body !== body ||
          previous.photo_sha256 !== (photo?.hash || null)
        )
          fail(409, "This message identifier was already used.");
        return;
      }
      // Bound photo storage and revoke old photo access after seven days.
      await tx.query(
        "update eligtas.response_messages set photo_data=null where photo_data is not null and created_at<now()-interval '7 days'",
      );
      if (
        photo &&
        (
          await tx.query(
            "select count(*)::int as n from eligtas.response_messages where incident_id=$1 and photo_data is not null",
            [row.id],
          )
        ).rows[0].n >= 40
      )
        fail(409, "This incident has reached its 40-photo limit.");
      await tx.query(
        "insert into eligtas.response_messages(id,incident_id,sender_id,body,photo_data,photo_sha256,photo_width,photo_height) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          req.body.id,
          row.id,
          req.user.id,
          body,
          photo?.data || null,
          photo?.hash || null,
          photo?.width || null,
          photo?.height || null,
        ],
      );
    });
    signal(current);
    res.status(201).json({ ok: true });
  });
  app.get("/api/responses/:id/messages/:message/photo", async (req, res) => {
    await access(db, req.params.id, req.user);
    if (!uuid.test(req.params.message)) fail(404, "Photo not found.");
    const row = (
      await db.query(
        "select photo_data from eligtas.response_messages where incident_id=$1 and id=$2 and created_at>now()-interval '7 days'",
        [req.params.id, req.params.message],
      )
    ).rows[0];
    if (!row?.photo_data) fail(404, "Photo unavailable or expired.");
    res
      .set("Content-Type", "image/jpeg")
      .set("Content-Disposition", 'inline; filename="incident-photo.jpg"')
      .set("Cache-Control", "no-store")
      .send(Buffer.from(row.photo_data));
  });
}
