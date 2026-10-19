import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { digest, hashPassword, isOperator, publicUser, randomToken, verifyPassword } from './auth.mjs';
import { validSubscription } from './push.mjs';
import { getGeofenceError } from '../src/app/lib/geofencing.ts';
import { getAudience } from '../src/app/lib/residents.ts';
import { asResident } from '../src/app/lib/live-model.ts';

const groupsAllowed = ['pwd', 'children', 'seniors', 'pregnant', 'responders'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (value, min, max, label) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max ? value.trim() : fail(400, `Check ${label}.`);
const requireOperator = user => { if (!isOperator(user)) fail(403, 'Approved command-center access is required.'); };
const passwordInput = value => typeof value === 'string' && value.length >= 12 && value.length <= 128 ? value : fail(400, 'Use a password of 12–128 characters.');

export function createApp(db, { push, production = process.env.NODE_ENV === 'production', allowedOrigins = [], bootstrapToken = process.env.BOOTSTRAP_TOKEN } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff');
    if (!['GET','HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      const ownOrigin = `${req.protocol}://${req.get('host')}`;
      if (!origin || (!allowedOrigins.includes(origin) && origin !== ownOrigin)) return res.status(403).json({ error: 'Open E-Ligtas from its official app address and try again.' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'JSON is required.' });
    }
    next();
  });
  app.use(express.json({ limit: '24kb' }));
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
  app.get('/api/health', async (_req, res) => { await db.query('select 1'); res.json({ ok: true, service: 'E-Ligtas', version: 1 }); });
  app.get('/api/config', (_req, res) => res.json({ pushPublicKey: push?.publicKey || null, registration: true }));
  app.post('/api/auth/register', async (req, res) => {
    rateLimit(req, 'register', 5, 3600000);
    const username = text(req.body.username, 3, 30, 'username').toLowerCase();
    if (!/^[a-z0-9_]+$/.test(username)) fail(400, 'Username can contain letters, numbers, and underscores.');
    const name = text(req.body.name, 2, 80, 'full name');
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
    await db.query('delete from eligtas.sessions where user_id=$1', [rows[0].id]);
    await session(res, rows[0].id); res.json({ recoveryCode: nextCode });
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = tokenFrom(req);
    if (token) await db.query('delete from eligtas.sessions where token_hash=$1', [digest(token)]);
    res.clearCookie('eligtas_session', { httpOnly: true, secure: production, sameSite: 'lax', path: '/api' }); res.json({ ok: true });
  });
  app.use('/api', async (req, _res, next) => {
    const token = tokenFrom(req);
    if (!token) return next(Object.assign(new Error('Sign in to continue.'), { status: 401 }));
    const { rows } = await db.query('select u.* from eligtas.sessions s join eligtas.users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()', [digest(token)]);
    if (!rows.length) return next(Object.assign(new Error('Your session expired. Please sign in again.'), { status: 401 }));
    req.user = rows[0]; next();
  });
  app.get('/api/state', async (req, res) => {
    const operator = isOperator(req.user) && req.query.view !== 'public';
    const users = operator ? (await db.query('select * from eligtas.users order by created_at desc')).rows : [req.user];
    const alerts = operator
      ? await db.query('select a.*,count(r.received_at)::int as received_count,count(r.read_at)::int as read_count from eligtas.alerts a left join eligtas.receipts r on r.alert_id=a.id group by a.id order by a.created_at desc limit 100')
      : await db.query('select a.*,r.received_at,r.read_at from eligtas.alerts a join eligtas.receipts r on r.alert_id=a.id where r.user_id=$1 order by a.created_at desc limit 100', [req.user.id]);
    const requests = await db.query(`select r.*,u.name from eligtas.requests r join eligtas.users u on u.id=r.user_id ${operator ? '' : 'where r.user_id=$1'} order by r.created_at desc limit 200`, operator ? [] : [req.user.id]);
    res.json({ user: publicUser(req.user), users: users.map(publicUser), alerts: alerts.rows, requests: requests.rows, serverTime: new Date().toISOString() });
  });
  app.put('/api/profile', async (req, res) => {
    const name = text(req.body.name, 2, 80, 'full name'), municipality = text(req.body.municipality, 0, 80, 'municipality');
    const groups = req.body.groups;
    if (!Array.isArray(groups) || groups.length > 5 || groups.some(g => !groupsAllowed.includes(g)) || (groups.includes('children') && groups.includes('seniors'))) fail(400, 'Select valid profile groups.');
    if (typeof req.body.alertsEnabled !== 'boolean') fail(400, 'Check alert preference.');
    await db.query('update eligtas.users set name=$1,municipality=$2,groups=$3,alerts_enabled=$4,updated_at=now() where id=$5', [name, municipality, [...new Set(groups)], req.body.alertsEnabled, req.user.id]);
    res.json({ ok: true });
  });
  app.put('/api/location', async (req, res) => {
    const { lat, lng, accuracy } = req.body;
    if (![lat,lng,accuracy].every(Number.isFinite) || Math.abs(lat) > 85 || Math.abs(lng) > 180 || accuracy < 0 || accuracy > 100000) fail(400, 'The device returned an invalid location.');
    await db.query('update eligtas.users set location_sharing=true,lat=$1,lng=$2,accuracy=$3,location_at=now(),updated_at=now() where id=$4', [lat,lng,accuracy,req.user.id]);
    res.json({ ok: true });
  });
  app.delete('/api/location', async (req, res) => {
    await db.query('update eligtas.users set location_sharing=false,lat=null,lng=null,accuracy=null,location_at=null,updated_at=now() where id=$1', [req.user.id]);
    res.json({ ok: true });
  });
  app.post('/api/safe', async (req, res) => {
    await db.query('update eligtas.users set safe_at=now(),updated_at=now() where id=$1', [req.user.id]); res.json({ ok: true });
  });
  app.post('/api/alerts/:id/receipt', async (req, res) => {
    if (!uuid.test(req.params.id)) fail(400, 'Invalid alert.');
    const { rows } = await db.query('update eligtas.receipts set received_at=coalesce(received_at,now()),read_at=case when $3 then coalesce(read_at,now()) else read_at end where alert_id=$1 and user_id=$2 returning alert_id', [req.params.id, req.user.id, req.body.read === true]);
    if (!rows.length) fail(404, 'Alert not found.'); res.json({ ok: true });
  });
  app.post('/api/alerts', async (req, res) => {
    requireOperator(req.user); rateLimit(req, 'dispatch', 30);
    const { area, groups, activeOnly, priority, id } = req.body;
    const content = text(req.body.content, 1, 1000, 'message');
    if (!uuid.test(id)) fail(400, 'Invalid message identifier.');
    if (!area || !['polygon','rectangle','circle'].includes(area.shape) || !Array.isArray(area.points) || area.points.some(p => !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng))) fail(400, 'Draw a valid geofence.');
    const geometryError = getGeofenceError(area);
    if (geometryError) fail(400, geometryError);
    text(area.name, 1, 80, 'area name');
    text(area.id, 1, 100, 'area identifier');
    if (!Array.isArray(groups) || !groups.length || groups.length > 6 || groups.some(g => g !== 'all' && !groupsAllowed.includes(g)) || typeof activeOnly !== 'boolean') fail(400, 'Choose valid recipient groups.');
    if (!['normal','high','critical'].includes(priority)) fail(400, 'Choose a priority.');
    const result = await db.transaction(async tx => {
      const previous = (await tx.query('select * from eligtas.alerts where id=$1', [id])).rows[0];
      if (previous) {
        if (previous.author_id !== req.user.id) fail(409, 'Message identifier is already in use.');
        if (previous.content !== content || previous.priority !== priority || previous.active_only !== activeOnly || !isDeepStrictEqual(previous.area,area) || !isDeepStrictEqual(previous.groups,groups)) fail(409, 'This message was already sent. Check delivery history before creating another alert.');
        return { ...previous, existing: true };
      }
      const users = (await tx.query('select * from eligtas.users where location_sharing and alerts_enabled')).rows.map(row => asResident(publicUser(row)));
      const audience = getAudience(users, area, { groups, activeOnly }, new Date().toISOString());
      if (!audience.recipients.length) fail(409, 'No eligible residents currently share a recent location inside this area. Refresh the preview.');
      await tx.query('insert into eligtas.alerts(id,author_id,content,priority,area,groups,active_only,recipient_count) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id,req.user.id,content,priority,JSON.stringify(area),groups,activeOnly,audience.recipients.length]);
      for (const user of audience.recipients) await tx.query('insert into eligtas.receipts(alert_id,user_id) values ($1,$2)', [id,user.id]);
      await tx.query('insert into eligtas.audit(id,actor_id,action,target_id) values ($1,$2,$3,$4)', [randomUUID(),req.user.id,'dispatch_alert',id]);
      return { id, content, priority, recipient_count: audience.recipients.length };
    });
    res.status(result.existing ? 200 : 201).json(result);
    if (!result.existing && push) void push.send(result).catch(() => console.error('Push delivery task failed; the alert remains in the inbox.'));
  });
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
