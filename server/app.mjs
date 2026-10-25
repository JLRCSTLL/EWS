import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { digest, hashPassword, isOperator, publicUser, randomToken, verifyPassword } from './auth.mjs';
import { validSubscription } from './push.mjs';
import { validAndroidToken } from './android-push.mjs';
import { locations } from './location.mjs';
import { locationEvents } from './location-events.mjs';
import { organizationRoutes, organizationState, contactVisibility } from './organization.mjs';
import { dispatchRoutes } from './dispatch.mjs';
import { iosRoutes } from './ios-routes.mjs';
import { accountRoutes } from './account.mjs';
import { auditRoutes } from './audit.mjs';

const groupsAllowed = ['pwd', 'children', 'seniors', 'pregnant', 'responders'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (value, min, max, label) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max ? value.trim() : fail(400, `Check ${label}.`);
const requireOperator = user => { if (!isOperator(user)) fail(403, 'Approved command-center access is required.'); };
const passwordInput = value => typeof value === 'string' && value.length >= 12 && value.length <= 128 ? value : fail(400, 'Use a password of 12–128 characters.');

export function createApp(db, { push, production = process.env.NODE_ENV === 'production', allowedOrigins = [], bootstrapToken = process.env.BOOTSTRAP_TOKEN } = {}) {
  const app = express();
  const events = locationEvents(db);
  const location = locations(db, events.changed);
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff');
    if (!['GET','HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      const ownOrigin = `${req.protocol}://${req.get('host')}`;
      if (!origin || (!allowedOrigins.includes(origin) && origin !== ownOrigin)) return res.status(403).json({ error: 'Open TANOVIQ from its official app address and try again.' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'JSON is required.' });
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  const limits = new Map();
  function rateLimit(req, key, max, windowMs = 15 * 60000) {
    const id = `${key}:${req.ip}`;
    const now = Date.now();
    if (limits.size > 10000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    const entry = limits.get(id);
    if (!entry || entry.until < now) limits.set(id, { count: 1, until: now + windowMs });
    else if (++entry.count > max) fail(429, 'Too many attempts. Please wait a few minutes and try again.');
  }
  const tokenFrom = req => /(?:^|;\s*)eligtas_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.get('cookie') || '')?.[1];
  async function session(res, userId) {
    const token = randomToken();
    await db.query("insert into eligtas.sessions(token_hash,user_id,expires_at) values ($1,$2,now()+interval '30 days')", [digest(token), userId]);
    res.cookie('eligtas_session', token, { httpOnly: true, secure: production, sameSite: 'lax', path: '/api', maxAge: 30 * 86400000 });
  }
  app.get('/api/health', async (_req, res) => { await db.query('select 1'); res.json({ ok: true, service: 'TANOVIQ', version: 2 }); });
  app.get('/api/config', (_req, res) => res.json({ pushPublicKey: push?.publicKey || null, androidPushReady: !!push?.androidReady, iosPushReady: !!push?.iosReady, accountDeletionReady: true, nativeLocationReady: true, registration: true, gsamReady: true, dutyTracking: true, groupManagementReady: true, boundaryGeofencesReady: true, auditLogsReady: true, commandCenterVersion: '1.1.0' }));
  for (const method of ['put','delete']) app[method]('/api/location/native', async (req,res) => {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get('authorization') || '')?.[1];
    res.json(await location.native(token,req.method,req.body));
  });
  app.post('/api/auth/register', async (req, res) => {
    rateLimit(req, 'register', 5, 3600000);
    const username = text(req.body.username, 3, 30, 'username').toLowerCase();
    if (!/^[a-z0-9_]+$/.test(username)) fail(400, 'Username can contain letters, numbers, and underscores.');
    const name = text(req.body.name, 2, 80, 'preferred name');
    const password = passwordInput(req.body.password);
    const id = randomUUID(), recoveryCode = randomToken();
    const passwordHash = await hashPassword(password);
    try { await db.query('insert into eligtas.users(id,username,name,password_hash,recovery_hash) values ($1,$2,$3,$4,$5)', [id, username, name, passwordHash, digest(recoveryCode)]); }
    catch (error) { if (error.code === '23505') fail(409, 'That username is already taken. Choose another or sign in.'); throw error; }
    await session(res, id);
    res.status(201).json({ recoveryCode });
  });
  app.post('/api/auth/login', async (req, res) => {
    rateLimit(req, 'login', 20);
    const username = text(req.body.username, 3, 30, 'username').toLowerCase();
    const password = typeof req.body.password === 'string' && req.body.password.length <= 128 ? req.body.password : '';
    const { rows } = await db.query('select * from eligtas.users where username=$1', [username]);
    if (!await verifyPassword(password, rows[0]?.password_hash)) fail(401, 'Username or password is incorrect.');
    await session(res, rows[0].id); res.json({ ok: true });
  });
  app.post('/api/auth/recover', async (req, res) => {
    rateLimit(req, 'recover', 5);
    const username = text(req.body.username, 3, 30, 'username').toLowerCase();
    const code = text(req.body.code, 43, 43, 'recovery code');
    const password = passwordInput(req.body.password);
    const nextCode = randomToken(), nextHash = await hashPassword(password);
    const { rows } = await db.query('update eligtas.users set password_hash=$1,recovery_hash=$2 where username=$3 and recovery_hash=$4 returning id', [nextHash, digest(nextCode), username, digest(code)]);
    if (!rows.length) fail(401, 'Username or recovery code is incorrect.');
    await location.stop(rows[0].id);
    await db.query('delete from eligtas.sessions where user_id=$1', [rows[0].id]);
    await session(res, rows[0].id); res.json({ recoveryCode: nextCode });
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = tokenFrom(req);
    if (token) {
      const sessionRow=(await db.query('select user_id from eligtas.sessions where token_hash=$1 and expires_at>now()',[digest(token)])).rows[0];
      if(sessionRow) await location.stop(sessionRow.user_id);
      await db.query('delete from eligtas.sessions where token_hash=$1', [digest(token)]);
    }
    res.clearCookie('eligtas_session', { httpOnly: true, secure: production, sameSite: 'lax', path: '/api' }); res.json({ ok: true });
  });
  app.use('/api', async (req, _res, next) => {
    const token = tokenFrom(req);
    if (!token) return next(Object.assign(new Error('Sign in to continue.'), { status: 401 }));
    const { rows } = await db.query('select u.* from eligtas.sessions s join eligtas.users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()', [digest(token)]);
    if (!rows.length) return next(Object.assign(new Error('Your session expired. Please sign in again.'), { status: 401 }));
    req.user = rows[0]; next();
  });
  accountRoutes(app, db, { rateLimit, changed: events.changed, production });
  auditRoutes(app, db);
  app.get('/api/state', async (req, res) => {
    const operator = isOperator(req.user) && req.query.view !== 'public';
    const users = operator ? (await db.query('select * from eligtas.users order by created_at desc')).rows : [req.user];
    const alerts = operator
      ? await db.query('select a.*,count(r.received_at)::int as received_count,count(r.read_at)::int as read_count from eligtas.alerts a left join eligtas.receipts r on r.alert_id=a.id group by a.id order by a.created_at desc limit 100')
      : await db.query('select a.*,r.received_at,r.read_at from eligtas.alerts a join eligtas.receipts r on r.alert_id=a.id where r.user_id=$1 order by a.created_at desc limit 100', [req.user.id]);
    const requests = await db.query(`select r.*,u.name from eligtas.requests r join eligtas.users u on u.id=r.user_id ${operator ? '' : 'where r.user_id=$1'} order by r.created_at desc limit 200`, operator ? [] : [req.user.id]);
    const organization = await organizationState(db,req.user,operator);
    res.json({ user: publicUser(req.user,{self:true}), users: users.map(row => publicUser(row,{self:row.id===req.user.id,visible:req.user.role==='admin'?contactVisibility(organization.contactRequests,req.user.id,row.id):[]})), alerts: alerts.rows, requests: requests.rows, ...organization, serverTime: new Date().toISOString() });
  });
  organizationRoutes(app,db,events.changed);
  app.get('/api/location/events', (req,res) => events.connect(req,res,digest(tokenFrom(req))));
  app.post('/api/location/share', async (req,res) => {
    rateLimit(req,'location-share',120);
    res.json(await location.start(req.user.id,digest(tokenFrom(req))));
  });
  app.put('/api/profile', async (req, res) => {
    const name = text(req.body.name, 2, 80, 'preferred name'), municipality = text(req.body.municipality, 0, 80, 'municipality');
    const groups = req.body.groups;
    if (!Array.isArray(groups) || groups.length > 5 || groups.some(g => !groupsAllowed.includes(g)) || (groups.includes('children') && groups.includes('seniors'))) fail(400, 'Select valid profile groups.');
    const email = req.body.email === undefined ? req.user.email : text(req.body.email,0,254,'email');
    const phone = req.body.phone === undefined ? req.user.phone : text(req.body.phone,0,30,'phone');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Enter a valid email or leave it empty.');
    if (phone && !/^\+?[0-9 ()-]{7,30}$/.test(phone)) fail(400,'Enter a valid phone number or leave it empty.');
    await db.transaction(async tx => {
      await tx.query('update eligtas.users set name=$1,municipality=$2,groups=$3,alerts_enabled=true,email=$4,phone=$5,updated_at=now() where id=$6',[name,municipality,[...new Set(groups)],email,phone,req.user.id]);
      if (email !== req.user.email || phone !== req.user.phone) await tx.query("update eligtas.contact_requests set status='revoked',expires_at=null where user_id=$1 and status='approved'",[req.user.id]);
    }); events.changed();
    res.json({ ok: true });
  });
  app.put('/api/duty',async(req,res)=>{
    if(typeof req.body.onDuty!=='boolean')fail(400,'Choose an on-duty or off-duty status.');
    if(!req.body.onDuty){res.json(await location.stop(req.user.id));return;}
    const project=req.body.projectId||null;
    if(project && !uuid.test(project))fail(400,'Choose a project.');
    await db.transaction(async tx=>{
      if(project){
        const row=(await tx.query('select * from eligtas.projects where id=$1 for share',[project])).rows[0];
        if(!row || row.status==='completed')fail(409,'Choose an open project.');
        if(!isOperator(req.user) && row.lead_id!==req.user.id && !(await tx.query('select m.user_id from eligtas.group_members m join eligtas.team_groups g on g.id=m.group_id where m.user_id=$1 and g.project_id=$2 and not g.archived union select assignee_id from eligtas.tasks where assignee_id=$1 and project_id=$2',[req.user.id,project])).rows.length)fail(403,'You are not assigned to this project.');
      }
      await tx.query('update eligtas.users set on_duty=true,duty_at=coalesce(duty_at,now()),duty_project_id=$1,updated_at=now() where id=$2',[project,req.user.id]);
    });events.changed(req.user.id);res.json({ok:true});
  });
  app.put('/api/location', async (req, res) => {
    res.json(await location.save(req.user.id,req.body));
  });
  app.delete('/api/location', async (req, res) => {
    res.json(await location.stop(req.user.id));
  });
  app.post('/api/safe', async (req, res) => {
    await db.query('update eligtas.users set safe_at=now(),updated_at=now() where id=$1', [req.user.id]); res.json({ ok: true });
  });
  app.post('/api/alerts/:id/receipt', async (req, res) => {
    if (!uuid.test(req.params.id)) fail(400, 'Invalid alert.');
    const { rows } = await db.query('update eligtas.receipts set received_at=coalesce(received_at,now()),read_at=case when $3 then coalesce(read_at,now()) else read_at end where alert_id=$1 and user_id=$2 returning alert_id', [req.params.id, req.user.id, req.body.read === true]);
    if (!rows.length) fail(404, 'Alert not found.');
    if (req.body.read === true) void push?.acknowledge?.(req.user.id,req.params.id).catch(()=>console.error('iOS Live Activity acknowledgment could not be delivered.'));
    res.json({ ok: true });
  });
  dispatchRoutes(app,db,push,rateLimit,events.changed);
  iosRoutes(app,db,push,tokenFrom,rateLimit);
  app.post('/api/requests', async (req, res) => {
    const { id, type, people, includeLocation } = req.body;
    if (!uuid.test(id) || !['Evacuation','Medical assistance','Rescue','Other assistance'].includes(type) || !Number.isInteger(people) || people < 1 || people > 20 || typeof includeLocation !== 'boolean') fail(400, 'Check the assistance request.');
    const note = text(req.body.note, 0, 500, 'request details');
    if (includeLocation && (!req.user.location_sharing || !req.user.location_at || Date.now() - new Date(req.user.location_at).getTime() > 5 * 60000)) fail(409, 'Share a fresh location before attaching it to your request.');
    try { await db.query('insert into eligtas.requests(id,user_id,type,note,people,include_location) values ($1,$2,$3,$4,$5,$6)', [id,req.user.id,type,note,people,includeLocation]); }
    catch (error) { if (error.code === '23505') fail(409, 'You already have an open request. Check its status.'); throw error; }
    res.status(201).json({ id });
  });
  app.patch('/api/requests/:id', async (req, res) => {
    if (!uuid.test(req.params.id)) fail(400, 'Invalid request.');
    const { status } = req.body;
    if (status !== 'cancelled') requireOperator(req.user);
    const unit = status === 'assigned' ? text(req.body.unit, 1, 80, 'assigned team') : '';
    await db.transaction(async tx => {
      const row = (await tx.query('select * from eligtas.requests where id=$1 for update', [req.params.id])).rows[0];
      if (!row || (status === 'cancelled' && row.user_id !== req.user.id)) fail(404, 'Request not found.');
      const transitions = { new: ['acknowledged','assigned','cancelled'], acknowledged: ['assigned','resolved','cancelled'], assigned: ['assigned','resolved','cancelled'] };
      if (!transitions[row.status]?.includes(status)) fail(409, 'This request has changed. Refresh its status.');
      await tx.query('update eligtas.requests set status=$1,assigned_unit=case when $1=\'assigned\' then $2 else assigned_unit end,updated_at=now() where id=$3', [status,unit,row.id]);
      await tx.query('insert into eligtas.audit(id,actor_id,action,target_id) values ($1,$2,$3,$4)', [randomUUID(),req.user.id,`request_${status}`,row.id]);
    }); res.json({ ok: true });
  });
  app.post('/api/operator/request', async (req, res) => {
    await db.query('update eligtas.users set operator_requested=true where id=$1', [req.user.id]); res.json({ ok: true });
  });
  app.post('/api/operator/bootstrap', async (req, res) => {
    rateLimit(req, 'bootstrap', 5);
    const supplied = digest(typeof req.body.token === 'string' ? req.body.token : '');
    if (!bootstrapToken || !timingSafeEqual(Buffer.from(supplied),Buffer.from(digest(bootstrapToken)))) fail(403, 'The owner setup key is incorrect.');
    await db.transaction(async tx => {
      await tx.query('lock table eligtas.users in exclusive mode');
      if ((await tx.query("select id from eligtas.users where role='admin'")).rows.length) fail(409, 'Owner setup is already complete. Ask an administrator for access.');
      await tx.query("update eligtas.users set role='admin',operator_requested=false where id=$1", [req.user.id]);
      await tx.query('insert into eligtas.audit(id,actor_id,action,target_id) values ($1,$2,$3,$2)', [randomUUID(),req.user.id,'bootstrap_admin']);
    }); res.json({ ok: true });
  });
  app.post('/api/operator/approve', async (req, res) => {
    if (req.user.role !== 'admin') fail(403, 'Only the account owner can approve operators.');
    if (!uuid.test(req.body.userId)) fail(400, 'Choose a registered account.');
    const { rows } = await db.query("update eligtas.users set role='operator',operator_requested=false where id=$1 and role='resident' and operator_requested returning id", [req.body.userId]);
    if (!rows.length) fail(409, 'No pending access request for that account.');
    await db.query('insert into eligtas.audit(id,actor_id,action,target_id) values ($1,$2,$3,$4)', [randomUUID(),req.user.id,'approve_operator',req.body.userId]);
    res.json({ ok: true });
  });
  app.post('/api/push', async (req, res) => {
    if (!push || !validSubscription(req.body)) fail(400, 'This browser returned an unsupported push subscription.');
    await db.query('insert into eligtas.push_subscriptions(endpoint,user_id,subscription) values ($1,$2,$3) on conflict(endpoint) do update set user_id=excluded.user_id,subscription=excluded.subscription', [req.body.endpoint,req.user.id,JSON.stringify(req.body)]);
    res.json({ ok: true });
  });
  app.post('/api/push/android', async (req, res) => {
    if (!push?.androidReady) fail(503, 'Android background notifications are not configured yet.');
    if (!validAndroidToken(req.body.token)) fail(400, 'Invalid Android device registration.');
    rateLimit(req, 'android-device', 60);
    await db.query(`insert into eligtas.android_devices(token,user_id,session_hash) values ($1,$2,$3)
      on conflict(token) do update set user_id=excluded.user_id,session_hash=excluded.session_hash,updated_at=now()`, [req.body.token,req.user.id,digest(tokenFrom(req))]);
    res.json({ ok: true });
  });
  app.delete('/api/push/android', async (req, res) => {
    if (!validAndroidToken(req.body.token)) fail(400, 'Invalid Android device registration.');
    await db.query('delete from eligtas.android_devices where token=$1 and user_id=$2', [req.body.token,req.user.id]);
    res.json({ ok: true });
  });
  app.delete('/api/push', async (req, res) => {
    await db.query('delete from eligtas.push_subscriptions where endpoint=$1 and user_id=$2', [req.body.endpoint,req.user.id]); res.json({ ok: true });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error, _req, res, _next) => {
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error('API error', error.code || error.name);
    res.status(status).json({ error: status >= 500 ? 'The service could not save this change. Please try again.' : error.message });
  });
  return app;
}
