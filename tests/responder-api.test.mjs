import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../server/app.mjs";
import { digest } from "../server/auth.mjs";
import { normalizeResponsePhoto } from "../server/responses.mjs";
import { destinationFor, routeProgress } from "../src/app/lib/response.ts";
import { createResponseRouting } from "../server/response-routing.mjs";
const point = {
    lat: 14.577,
    lng: 121.112,
    label: "TEST ONLY emergency landmark",
  },
  basePoint = { lat: 14.583, lng: 121.117, label: "TEST ONLY response base" };
test("response navigation follows road progress and never invents a failed road route", async () => {
  const progress = routeProgress(
    [
      [121, 14],
      [121.01, 14],
      [121.02, 14],
    ],
    { lat: 14, lng: 121.005 },
  );
  assert.ok(progress.distanceAlong > 500 && progress.distanceAlong < 550);
  assert.ok(progress.remaining > 1500);
  assert.ok(progress.offRoute < 1);
  assert.equal(
    destinationFor({
      status: "to_hospital",
      hospital: point,
      location: basePoint,
    }),
    point,
  );
  assert.equal(
    destinationFor({ status: "returning", base: basePoint, location: point }),
    basePoint,
  );
  assert.equal(destinationFor({ status: "cancelled", location: point }), null);
  const routing = createResponseRouting({
    fetcher: async () => new Response(JSON.stringify({ code: "NoRoute" })),
  });
  await assert.rejects(
    () => routing.route(basePoint, point),
    /No drivable route/,
  );
});
test("photo pipeline strips metadata, validates actual format and bounds dimensions", async () => {
  const original = await sharp({
    create: { width: 2200, height: 900, channels: 3, background: "#ccddee" },
  })
    .withExif({ IFD0: { Artist: "TEST METADATA" } })
    .jpeg()
    .toBuffer();
  const photo = await normalizeResponsePhoto(original.toString("base64")),
    meta = await sharp(photo.data).metadata();
  assert.equal(meta.width, 1800);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.format, "jpeg");
  await assert.rejects(
    () =>
      normalizeResponsePhoto(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>',
        ).toString("base64"),
      ),
    /JPEG|decoded/,
  );
  await assert.rejects(
    () => normalizeResponsePhoto("invalid base64"),
    /photo/i,
  );
});
test("operator-to-driver dispatch: validation, scoped alerts, chat photos, hospital and base", async (t) => {
  const db = new PGlite();
  await db.exec(
    await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
  const pushed = [],
    routing = {
      hospitals: async () => [],
      route: async (origin, destination) => ({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        distance: 1400,
        duration: 180,
        steps: [],
        generatedAt: new Date().toISOString(),
      }),
    };
  const app = createApp(db, {
    allowedOrigins: ["https://test.local"],
    push: { send: async (a) => pushed.push(a) },
    routing,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await db.close();
  });
  const url = "http://127.0.0.1:" + server.address().port + "/api",
    users = {};
  for (const [name, role, duty] of [
    ["operator", "admin", false],
    ["driver", "resident", true],
    ["other", "resident", true],
    ["offduty", "resident", false],
  ]) {
    const id = randomUUID(),
      token = randomBytes(32).toString("base64url");
    users[name] = { id, token };
    await db.query(
      "insert into eligtas.users(id,username,name,password_hash,recovery_hash,role,on_duty) values($1,$2,$2,$3,$3,$4,$5)",
      [id, name, "test-only", role, duty],
    );
    await db.query(
      "insert into eligtas.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 day')",
      [digest(token), id],
    );
  }
  async function req(
    user,
    path,
    body,
    method = body === undefined ? "GET" : "POST",
  ) {
    const r = await fetch(url + path, {
      method,
      headers: {
        Origin: "https://test.local",
        Cookie: "eligtas_session=" + users[user]?.token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: r.headers.get("content-type")?.startsWith("image/")
        ? Buffer.from(await r.arrayBuffer())
        : await r.json(),
      headers: r.headers,
    };
  }
  async function ok(user, path, body, method) {
    const r = await req(user, path, body, method);
    assert.ok(r.status < 300, JSON.stringify(r));
    return r.data;
  }
  const create = {
    id: randomUUID(),
    title: "TEST ONLY injured person",
    notes: "Private fictional case note",
    service: "Ambulance",
    priority: "high",
    location: point,
  };
  assert.equal((await req("driver", "/responses", create)).status, 403);
  let incident = await ok("operator", "/responses", create);
  assert.equal(incident.status, "reported");
  const iid = create.id,
    path = "/responses/" + iid;
  assert.equal((await ok("operator", "/responses", create)).id, iid);
  assert.equal(
    (await req("operator", "/responses", { ...create, title: "changed" }))
      .status,
    409,
  );
  const base = await ok("operator", "/response-facilities", {
    kind: "base",
    name: basePoint.label,
    location: basePoint,
  });
  const hospital = await ok("operator", "/response-facilities", {
    kind: "hospital",
    name: "TEST ONLY receiving hospital",
    location: { ...point, lat: 14.59 },
  });
  const assignment = {
    version: incident.version,
    assigneeId: users.driver.id,
    baseId: base.id,
    unit: "TEST AMB-01",
  };
  assert.equal(
    (await req("operator", path + "/assign", assignment)).status,
    409,
  );
  assert.equal(
    (
      await req("driver", path + "/validate", {
        decision: "validated",
        note: "Verified",
        version: 1,
      })
    ).status,
    403,
  );
  incident = await ok("operator", path + "/validate", {
    decision: "validated",
    note: "Location and emergency verified with caller",
    version: incident.version,
  });
  assert.equal(
    (
      await req("operator", path + "/assign", {
        ...assignment,
        version: incident.version,
        assigneeId: users.offduty.id,
      })
    ).status,
    409,
  );
  incident = await ok("operator", path + "/assign", {
    ...assignment,
    version: incident.version,
  });
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0].response_id, iid);
  assert.ok(!JSON.stringify(pushed).includes(create.notes));
  assert.ok(!JSON.stringify(pushed).includes("121.112"));
  const driverState = await ok("driver", "/state?view=public"),
    outsiderState = await ok("other", "/state?view=public");
  assert.equal(driverState.responseIncidents[0].id, iid);
  assert.equal(driverState.alerts[0].response_id, iid);
  assert.equal(outsiderState.responseIncidents.length, 0);
  assert.equal(outsiderState.alerts.length, 0);
  for (const suffix of ["/route", "/messages", "/timeline", "/hospitals"])
    assert.equal((await req("other", path + suffix)).status, 404);
  let route = await ok("driver", path + "/route");
  assert.equal(route.originSource, "last_leg_start");
  assert.deepEqual(route.destination, point);
  await db.query(
    "update eligtas.users set location_sharing=true,lat=$1,lng=$2,accuracy=10,location_at=now() where id=$3",
    [14.581, 121.116, users.driver.id],
  );
  route = await ok("driver", path + "/route");
  assert.equal(route.originSource, "live");
  await db.query(
    "update eligtas.users set location_at=now()-interval '5 minutes' where id=$1",
    [users.driver.id],
  );
  assert.equal(
    (await ok("driver", path + "/route")).originSource,
    "last_leg_start",
  );
  assert.equal(
    (
      await req(
        "driver",
        path + "/status",
        { version: incident.version, status: "completed" },
        "PATCH",
      )
    ).status,
    409,
  );
  const second = await ok("operator", "/responses", {
    ...create,
    id: randomUUID(),
  });
  await ok("operator", "/responses/" + second.id + "/validate", {
    decision: "validated",
    note: "TEST verification",
    version: second.version,
  });
  assert.equal(
    (
      await req("operator", "/responses/" + second.id + "/assign", {
        ...assignment,
        version: 2,
      })
    ).status,
    409,
  );
  const photo = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#abc" },
  })
    .jpeg()
    .toBuffer();
  const message = {
    id: randomUUID(),
    body: "TEST ONLY medical record placeholder",
    photo: photo.toString("base64"),
  };
  await ok("driver", path + "/messages", message);
  await ok("driver", path + "/messages", message);
  assert.equal(
    (await req("driver", path + "/messages", { ...message, body: "different" }))
      .status,
    409,
  );
  let messages = await ok("operator", path + "/messages");
  assert.equal(messages.messages.length, 1);
  assert.equal(messages.messages[0].has_photo, true);
  assert.ok(!JSON.stringify(messages).includes(message.photo));
  const photoPath = path + "/messages/" + message.id + "/photo";
  assert.equal((await req("other", photoPath)).status, 404);
  assert.equal((await req("operator", photoPath)).status, 200);
  assert.equal(
    (await req("driver", photoPath)).headers.get("cache-control"),
    "no-store",
  );
  // Reassignment removes the old driver's access, including existing images.
  incident = await ok("operator", path + "/assign", {
    ...assignment,
    version: incident.version,
    assigneeId: users.other.id,
  });
  assert.equal((await req("driver", photoPath)).status, 404);
  assert.equal((await req("other", photoPath)).status, 200);
  assert.equal(
    (
      await req(
        "driver",
        path + "/status",
        { version: incident.version, status: "en_route" },
        "PATCH",
      )
    ).status,
    404,
  );
  for (const status of ["en_route", "on_scene"])
    incident = await ok(
      "other",
      path + "/status",
      { version: incident.version, status },
      "PATCH",
    );
  assert.equal(
    (
      await req(
        "other",
        path + "/status",
        { version: incident.version, status: "to_hospital" },
        "PATCH",
      )
    ).status,
    400,
  );
  const hospitals = await ok("other", path + "/hospitals");
  assert.equal(hospitals.hospitals[0].id, hospital.id);
  assert.equal(
    (
      await req("other", path + "/hospital", {
        version: incident.version,
        hospitalId: "unknown",
      })
    ).status,
    400,
  );
  incident = await ok("other", path + "/hospital", {
    version: incident.version,
    hospitalId: hospital.id,
  });
  const stale = incident.version - 1;
  assert.equal(
    (
      await req(
        "other",
        path + "/status",
        { version: stale, status: "to_hospital" },
        "PATCH",
      )
    ).status,
    409,
  );
  incident = await ok(
    "other",
    path + "/status",
    { version: incident.version, status: "to_hospital" },
    "PATCH",
  );
  assert.equal(
    (await ok("other", path + "/route")).destination.label,
    "TEST ONLY receiving hospital",
  );
  incident = await ok(
    "other",
    path + "/status",
    { version: incident.version, status: "at_hospital" },
    "PATCH",
  );
  incident = await ok(
    "other",
    path + "/status",
    { version: incident.version, status: "returning" },
    "PATCH",
  );
  assert.deepEqual((await ok("other", path + "/route")).destination, basePoint);
  incident = await ok(
    "other",
    path + "/status",
    { version: incident.version, status: "completed" },
    "PATCH",
  );
  assert.equal((await req("other", path + "/route")).status, 409);
  assert.equal(
    (
      await req("other", path + "/messages", {
        id: randomUUID(),
        body: "closed",
      })
    ).status,
    409,
  );
  await db.query(
    "update eligtas.response_messages set created_at=now()-interval '8 days' where id=$1",
    [message.id],
  );
  assert.equal((await req("operator", photoPath)).status, 404);
  assert.equal(
    (await ok("operator", path + "/messages")).messages[0].photo_expired,
    true,
  );
  assert.ok((await ok("operator", path + "/timeline")).events.length >= 9);
  // Equal timestamps must not skip messages when paging a busy incident.
  for (let n = 0; n < 65; n++)
    await db.query(
      "insert into eligtas.response_messages(id,incident_id,sender_id,body,created_at) values($1,$2,$3,$4,'2026-01-01T00:00:00.123456Z')",
      [randomUUID(), iid, users.operator.id, "TEST page " + n],
    );
  const page1 = await ok("operator", path + "/messages"),
    page2 = await ok(
      "operator",
      path + "/messages?before=" + page1.olderBefore,
    );
  assert.equal(
    new Set([...page1.messages, ...page2.messages].map((m) => m.id)).size,
    66,
  );
  assert.equal(page2.olderBefore, null);
  assert.equal(
    (await req("operator", path + "/messages?before=invalid")).status,
    400,
  );
  assert.equal(
    JSON.stringify(
      (await db.query("select * from eligtas.audit")).rows,
    ).includes(create.notes),
    false,
  );
  await db.exec(
    await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
});
