import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../server/app.mjs";
import { groupTags } from "../src/app/lib/organization.ts";

test("group tags normalize and do not partially match long tags or email fragments", () => {
  assert.deepEqual(groupTags("Report #GroupA (#group_b) #GROUPA"), [
    "groupa",
    "group_b",
  ]);
  assert.deepEqual(groupTags("user#private #" + "a".repeat(41)), []);
});

test("GSAM custom operations, group targeting, contact approval and duty controls", async (t) => {
  const db = new PGlite(),
    schema = await readFile(
      new URL("../server/schema.sql", import.meta.url),
      "utf8",
    );
  await db.exec(schema);
  const pushed = [];
  const app = createApp(db, {
    allowedOrigins: ["https://test.local"],
    bootstrapToken: "gsam-test-owner",
    push: { send: async (a) => pushed.push(a.id) },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => {
    let cookie = "";
    return async (path, body, method = body === undefined ? "GET" : "POST") => {
      const response = await fetch(base + path, {
        method,
        headers: {
          Cookie: cookie,
          Origin: "https://test.local",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      return { status: response.status, data: await response.json() };
    };
  };
  const owner = client(),
    operator = client(),
    alpha = client(),
    beta = client(),
    outsider = client();
  const ids = {};
  for (const [name, api] of Object.entries({
    owner,
    operator,
    alpha,
    beta,
    outsider,
  })) {
    assert.equal(
      (
        await api("/auth/register", {
          username: `gsam_${name}`,
          name: `Preferred ${name}`,
          password: "isolated-gsam-password",
        })
      ).status,
      201,
    );
    ids[name] = (await api("/state")).data.user.id;
  }
  await owner("/operator/bootstrap", { token: "gsam-test-owner" });
  await owner(`/operator/access/${ids.operator}`, { role: "operator" }, "PUT");
  let project, root, child, second, task, requestId;
  const group = (name, tag, extra = {}) => ({
    name,
    tag,
    description: "Custom structure",
    projectId: project,
    ...extra,
  });
  const broadcast = (extra) => ({
    id: randomUUID(),
    targetMode: "groups",
    teamGroupIds: [root],
    content: "TEST ONLY #GroupA. Report to your assigned lead.",
    priority: "high",
    ...extra,
  });
  const profile = {
    name: "Field Alias",
    municipality: "",
    groups: [],
    email: "private.person@example.test",
    phone: "+639171234567",
  };
  await t.test(
    "structure is empty by default; technical access cannot be self-granted",
    async () => {
      const state = (await owner("/state")).data;
      assert.deepEqual(state.teamGroups, []);
      assert.deepEqual(state.projects, []);
      assert.equal(
        (await alpha(`/operator/access/${ids.alpha}`, { role: "admin" }, "PUT"))
          .status,
        403,
      );
      assert.equal(
        (
          await owner(
            `/operator/access/${ids.owner}`,
            { role: "resident" },
            "PUT",
          )
        ).status,
        409,
      );
      assert.equal(
        (await owner(`/operator/access/${ids.alpha}`, { role: "admin" }, "PUT"))
          .status,
        400,
      );
    },
  );
  await t.test(
    "operators manage groups; personnel cannot create groups or grant access",
    async () => {
      let result = await operator("/projects", {
        name: "Site operation",
        objective: "Inspect and report",
        status: "active",
      });
      assert.equal(result.status, 201);
      project = result.data.id;
      assert.equal(
        (await alpha("/projects", { name: "Unauthorized", status: "active" }))
          .status,
        403,
      );
      assert.equal(
        (await alpha("/groups", group("My team", "groupA"))).status,
        403,
      );
      result = await operator("/groups", group("My own top level", "groupA"));
      assert.equal(result.status, 201);
      root = result.data.id;
      result = await owner(
        "/groups",
        group("My own branch", "branch1", {
          parentId: root,
          headId: ids.alpha,
        }),
      );
      assert.equal(result.status, 201);
      child = result.data.id;
      result = await owner("/groups", group("Another team", "other"));
      assert.equal(result.status, 201);
      second = result.data.id;
      assert.equal((await operator(`/groups/${second}/members`, {userIds:[ids.alpha,ids.beta]}, 'PUT')).status,200);
      assert.equal((await operator(`/groups/${second}/members/${ids.beta}`, {isLeader:true}, 'PUT')).status,200);
      assert.equal((await alpha(`/groups/${second}/members`, {userIds:[ids.outsider]}, 'PUT')).status,403);
      assert.equal((await operator(`/groups/${second}/members`, {userIds:[ids.outsider,randomUUID()]}, 'PUT')).status,400);
      assert.equal((await operator('/state')).data.memberships.some(m => m.group_id === second && m.user_id === ids.outsider),false);
      assert.equal((await operator('/state')).data.memberships.find(m => m.group_id === second && m.user_id === ids.beta).is_leader,true);
      assert.equal((await beta('/state')).data.user.role,'resident');
      await operator(`/groups/${second}/members/${ids.alpha}`,{},'DELETE');
      await operator(`/groups/${second}/members/${ids.beta}`,{},'DELETE');
      assert.equal(
        (
          await owner(
            `/groups/${child}/members/${ids.alpha}`,
            { title: "My custom function", category: "My category" },
            "PUT",
          )
        ).status,
        200,
      );
      await owner(`/groups/${root}/members/${ids.alpha}`, {}, "PUT");
      await owner(`/groups/${child}/members/${ids.beta}`, {}, "PUT");
      const state = (await owner("/state")).data;
      assert.equal(
        state.teamGroups.find((g) => g.id === child).parent_id,
        root,
      );
      assert.equal(
        state.memberships.find(
          (m) => m.group_id === child && m.user_id === ids.alpha,
        ).category,
        "My category",
      );
      assert.equal((await alpha("/state")).data.user.role, "resident");
      assert.equal(
        (await alpha("/state")).data.memberships.some(
          (m) => m.user_id === ids.beta,
        ),
        false,
      );
      assert.deepEqual((await outsider("/state")).data.teamGroups, []);
    },
  );
  await t.test(
    "hierarchy rejects cycles, cross-project parents, duplicate tags, and removal of the current head",
    async () => {
      assert.equal(
        (
          await owner(
            `/groups/${root}`,
            group("My own top level", "groupA", { parentId: child }),
            "PUT",
          )
        ).status,
        400,
      );
      assert.equal(
        (await owner("/groups", group("Duplicate", "GROUPA"))).status,
        409,
      );
      assert.equal(
        (
          await owner(
            "/groups",
            group("Wrong project", "cross", {
              projectId: null,
              parentId: root,
            }),
          )
        ).status,
        400,
      );
      assert.equal(
        (await owner(`/groups/${child}/members/${ids.alpha}`, {}, "DELETE"))
          .status,
        409,
      );
      assert.equal(
        (
          await owner(
            `/groups/${root}`,
            group("My own top level", "groupA", { archived: true }),
            "PUT",
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "group previews include off-duty members without GPS and deduplicate parent/subgroup memberships",
    async () => {
      const draft = broadcast({ teamGroupIds: [root, child] });
      const result = await operator("/alerts/preview", draft);
      assert.equal(result.status, 200);
      assert.deepEqual(
        result.data.recipients.map((u) => u.id).sort(),
        [ids.alpha, ids.beta].sort(),
      );
      assert.ok(
        result.data.recipients.every((u) => !u.onDuty && u.location === null),
      );
      assert.ok(
        result.data.recipients.every(
          (u) => !("email" in u) && !("username" in u),
        ),
      );
      assert.equal((await alpha("/alerts/preview", draft)).status, 403);
      assert.equal(
        (
          await owner(
            "/alerts/preview",
            broadcast({ content: "#not_registered test" }),
          )
        ).status,
        400,
      );
    },
  );
  await t.test(
    "group sends require reviewed audiences; changed membership forces review again",
    async () => {
      const draft = broadcast();
      assert.equal((await operator("/alerts", draft)).status, 409);
      const preview = (await operator("/alerts/preview", draft)).data;
      await owner(`/groups/${child}/members/${ids.beta}`, {}, "DELETE");
      assert.equal(
        (
          await operator("/alerts", {
            ...draft,
            previewHash: preview.previewHash,
          })
        ).status,
        409,
      );
      await owner(`/groups/${child}/members/${ids.beta}`, {}, "PUT");
    },
  );
  await t.test(
    "hashtag targeting overrides geofence and receipt snapshots remain idempotent",
    async () => {
      const draft = broadcast({
        targetMode: "geofence",
        teamGroupIds: [],
        area: null,
      });
      const preview = (await operator("/alerts/preview", draft)).data;
      assert.equal(preview.mode, "groups");
      const sent = await operator("/alerts", {
        ...draft,
        previewHash: preview.previewHash,
      });
      assert.equal(sent.status, 201);
      assert.equal(sent.data.recipient_count, 2);
      assert.equal((await alpha("/state")).data.alerts[0].id, draft.id);
      assert.equal((await beta("/state")).data.alerts[0].area, null);
      assert.deepEqual((await outsider("/state")).data.alerts, []);
      await owner(`/groups/${child}/members/${ids.beta}`, {}, "DELETE");
      assert.equal(
        (
          await operator("/alerts", {
            ...draft,
            previewHash: preview.previewHash,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await operator("/alerts", {
            ...draft,
            content: "Changed #groupA",
            previewHash: preview.previewHash,
          })
        ).status,
        409,
      );
      assert.equal(pushed.filter((id) => id === draft.id).length, 1);
      await owner(`/groups/${child}/members/${ids.beta}`, {}, "PUT");
    },
  );
  await t.test(
    "contacts and usernames remain masked until the person approves the requesting admin",
    async () => {
      assert.equal((await alpha("/profile", profile, "PUT")).status, 200);
      const own = (await alpha("/state")).data.user;
      assert.equal(own.email, profile.email);
      const view = async (api) =>
        (await api("/state")).data.users.find((u) => u.id === ids.alpha);
      assert.equal((await view(owner)).name, "Field Alias");
      assert.notEqual((await view(owner)).email, profile.email);
      assert.notEqual((await view(owner)).phone, profile.phone);
      assert.equal((await view(owner)).username, undefined);
      assert.equal(
        (
          await operator("/contact-requests", {
            userId: ids.alpha,
            fields: ["email"],
            reason: "Contact for task",
          })
        ).status,
        403,
      );
      const result = await owner("/contact-requests", {
        userId: ids.alpha,
        fields: ["email"],
        reason: "Coordinate the inspection",
      });
      assert.equal(result.status, 201);
      requestId = result.data.id;
      assert.notEqual((await view(owner)).email, profile.email);
      assert.equal(
        (
          await owner(
            `/contact-requests/${requestId}`,
            { status: "approved" },
            "PATCH",
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await beta(
            `/contact-requests/${requestId}`,
            { status: "approved" },
            "PATCH",
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await alpha(
            `/contact-requests/${requestId}`,
            { status: "approved" },
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal((await view(owner)).email, profile.email);
      assert.notEqual((await view(owner)).phone, profile.phone);
      assert.notEqual((await view(operator)).email, profile.email);
      assert.deepEqual((await outsider("/state")).data.contactRequests, []);
      await alpha(
        `/contact-requests/${requestId}`,
        { status: "revoked" },
        "PATCH",
      );
      assert.notEqual((await view(owner)).email, profile.email);
      assert.equal(
        (
          await alpha(
            `/contact-requests/${requestId}`,
            { status: "approved" },
            "PATCH",
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "approved contact access expires and changing contacts revokes earlier approvals",
    async () => {
      const view = async () =>
        (await owner("/state")).data.users.find((u) => u.id === ids.alpha);
      let r = await owner("/contact-requests", {
        userId: ids.alpha,
        fields: ["email", "phone"],
        reason: "Operational contact",
      });
      await alpha(
        `/contact-requests/${r.data.id}`,
        { status: "approved" },
        "PATCH",
      );
      await db.query(
        "update eligtas.contact_requests set expires_at=now()-interval '1 second' where id=$1",
        [r.data.id],
      );
      assert.notEqual((await view()).phone, profile.phone);
      r = await owner("/contact-requests", {
        userId: ids.alpha,
        fields: ["email", "phone"],
        reason: "Renew contact access",
      });
      await alpha(
        `/contact-requests/${r.data.id}`,
        { status: "approved" },
        "PATCH",
      );
      await alpha(
        "/profile",
        { ...profile, email: "new.private@example.test" },
        "PUT",
      );
      assert.deepEqual((await view()).contactVisible, []);
    },
  );
  await t.test(
    "off-duty GPS uploads are rejected; only assigned project personnel can start project duty",
    async () => {
      assert.equal(
        (
          await alpha(
            "/location",
            { lat: 14.65, lng: 121.1, accuracy: 10 },
            "PUT",
          )
        ).status,
        409,
      );
      assert.equal((await alpha("/location/share", {})).status, 409);
      assert.equal(
        (await outsider("/duty", { onDuty: true, projectId: project }, "PUT"))
          .status,
        403,
      );
      assert.equal(
        (await alpha("/duty", { onDuty: true, projectId: project }, "PUT"))
          .status,
        200,
      );
      assert.equal(
        (
          await alpha(
            "/location",
            { lat: 14.65, lng: 121.1, accuracy: 10 },
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal(
        (await owner("/state")).data.users.find((u) => u.id === ids.alpha)
          .location.lat,
        14.65,
      );
    },
  );
  await t.test(
    "assigned people update their tasks without obtaining command-center access",
    async () => {
      const r = await operator("/tasks", {
        projectId: project,
        groupId: child,
        assigneeId: ids.alpha,
        title: "Check sector entrance",
      });
      assert.equal(r.status, 201);
      task = r.data.id;
      assert.equal(
        (await alpha(`/tasks/${task}`, { status: "in_progress" }, "PATCH"))
          .status,
        200,
      );
      assert.equal(
        (await beta(`/tasks/${task}`, { status: "done" }, "PATCH")).status,
        403,
      );
      assert.equal(
        (
          await alpha("/tasks", {
            projectId: project,
            title: "Unauthorized task",
          })
        ).status,
        403,
      );
      assert.equal((await alpha("/state")).data.tasks[0].status, "in_progress");
      assert.equal(
        (
          await operator("/tasks", {
            projectId: project,
            assigneeId: ids.outsider,
            title: "Independent assignment",
          })
        ).status,
        201,
      );
      assert.equal(
        (await outsider("/state")).data.projects.some((p) => p.id === project),
        true,
      );
      assert.equal(
        (await outsider("/duty", { onDuty: true, projectId: project }, "PUT"))
          .status,
        200,
      );
    },
  );
  await t.test(
    "ending a project revokes native tokens, clears GPS and prevents further duty in that project",
    async () => {
      const token = (await alpha("/location/share", {})).data.token;
      assert.equal(
        (
          await operator(
            `/projects/${project}`,
            {
              name: "Site operation",
              objective: "Completed",
              status: "completed",
            },
            "PUT",
          )
        ).status,
        200,
      );
      const user = (await owner("/state")).data.users.find(
        (u) => u.id === ids.alpha,
      );
      assert.equal(user.onDuty, false);
      assert.equal(user.location, null);
      const response = await fetch(base + "/location/native", {
        method: "PUT",
        headers: {
          Origin: "https://test.local",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat: 14.65, lng: 121.1, accuracy: 5 }),
      });
      assert.equal(response.status, 401);
      assert.equal(
        (await alpha("/duty", { onDuty: true, projectId: project }, "PUT"))
          .status,
        409,
      );
    },
  );
  await t.test(
    "logout clears duty/location and schema reapplication preserves custom structure and messages",
    async () => {
      await alpha("/duty", { onDuty: true }, "PUT");
      await alpha("/location", { lat: 14.65, lng: 121.1, accuracy: 8 }, "PUT");
      await alpha("/auth/logout", {});
      let user = (await owner("/state")).data.users.find(
        (u) => u.id === ids.alpha,
      );
      assert.equal(user.onDuty, false);
      assert.equal(user.location, null);
      await db.exec(schema);
      const state = (await owner("/state")).data;
      assert.equal(state.teamGroups.length, 3);
      assert.equal(state.tasks.length, 2);
      assert.equal(state.alerts.length, 1);
    },
  );
});

test("GSAM migration preserves legacy accounts and alert history while clearing off-duty pins", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const schema = await readFile(
    new URL("../server/schema.sql", import.meta.url),
    "utf8",
  );
  await db.exec(schema.split("-- Additive GSAM migration.")[0]);
  const id = randomUUID(),
    alertId = randomUUID();
  await db.query(
    "insert into eligtas.users(id,username,name,password_hash,recovery_hash,location_sharing,lat,lng,accuracy,location_at,alerts_enabled) values ($1,'legacy_user','Preferred Legacy','preserved-hash','preserved-recovery',true,14.6,121.1,10,now(),false)",
    [id],
  );
  await db.query(
    "insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only,recipient_count) values ($1,$2,'Historical message','normal','{}'::jsonb,array['all'],true,1)",
    [alertId, id],
  );
  await db.exec(schema);
  const user = (await db.query("select * from eligtas.users where id=$1", [id]))
    .rows[0];
  assert.equal(user.password_hash, "preserved-hash");
  assert.equal(user.name, "Preferred Legacy");
  assert.equal(user.on_duty, false);
  assert.equal(user.lat, null);
  assert.equal(user.location_sharing, false);
  assert.equal(user.alerts_enabled, true);
  assert.equal(
    (
      await db.query("select content from eligtas.alerts where id=$1", [
        alertId,
      ])
    ).rows[0].content,
    "Historical message",
  );
  assert.equal(
    (await db.query("select * from eligtas.team_groups")).rows.length,
    0,
  );
});
