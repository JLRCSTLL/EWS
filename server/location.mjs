import { digest, randomToken } from './auth.mjs';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function locationFix(body, now = Date.now()) {
  const { lat, lng, accuracy } = body;
  const at = body.capturedAt === undefined ? now : Date.parse(body.capturedAt);
  if (![lat,lng,accuracy].every(Number.isFinite) || Math.abs(lat) > 85 || Math.abs(lng) > 180 || accuracy < 0 || accuracy > 100000)
    fail(400, 'The device returned an invalid location.');
  if (!Number.isFinite(at) || at < now - 120000 || at > now + 30000)
    fail(400, 'A fresh GPS fix is required.');
  return { lat, lng, accuracy, capturedAt: new Date(Math.min(at, now)).toISOString() };
}
async function save(tx, userId, body) {
  if (!(await tx.query('select id from eligtas.users where id=$1 and on_duty',[userId])).rows.length) fail(409,'Start your duty session before sharing location.');
  const fix = locationFix(body);
  const { rows } = await tx.query(`update eligtas.users set location_sharing=true,lat=$1,lng=$2,accuracy=$3,location_at=$4,updated_at=now()
    where id=$5 and (location_at is null or location_at <= $4) returning id`, [fix.lat,fix.lng,fix.accuracy,fix.capturedAt,userId]);
  return { ok: true, accepted: !!rows.length };
}
async function clear(tx, userId) {
  await tx.query('delete from eligtas.location_shares where user_id=$1', [userId]);
  await tx.query('update eligtas.users set on_duty=false,duty_at=null,duty_project_id=null,location_sharing=false,lat=null,lng=null,accuracy=null,location_at=null,updated_at=now() where id=$1', [userId]);
}
export function locations(db, changed) {
  const lock = (tx, id) => tx.query('select id from eligtas.users where id=$1 for update', [id]);
  return {
    start: async (userId, sessionHash) => db.transaction(async tx => {
      await lock(tx,userId);
      if (!(await tx.query('select id from eligtas.users where id=$1 and on_duty',[userId])).rows.length) fail(409,'Start your duty session before sharing location.');
      // One active sharing device per account. Replaced or stopped tokens cannot revive a location.
      await tx.query('delete from eligtas.location_shares where user_id=$1', [userId]);
      const token = randomToken();
      await tx.query('insert into eligtas.location_shares(token_hash,user_id,session_hash) values ($1,$2,$3)', [digest(token),userId,sessionHash]);
      return { token, userId };
    }),
    save: async (userId, body) => {
      const result = await db.transaction(async tx => { await lock(tx,userId); return save(tx,userId,body); });
      if (result.accepted) changed(userId);
      return result;
    },
    stop: async userId => {
      await db.transaction(async tx => { await lock(tx,userId); await clear(tx,userId); });
      changed(userId); return { ok:true };
    },
    native: async (token, method, body) => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) fail(401,'Location sharing has expired. Open the app to share again.');
      let userId;
      const result = await db.transaction(async tx => {
        const query = 'select l.user_id from eligtas.location_shares l join eligtas.sessions s on s.token_hash=l.session_hash and s.user_id=l.user_id where l.token_hash=$1 and s.expires_at>now()';
        userId = (await tx.query(query,[digest(token)])).rows[0]?.user_id;
        if (!userId) fail(401,'Location sharing has expired. Open the app to share again.');
        await lock(tx,userId);
        // Recheck after the lock so a simultaneous Stop always revokes queued uploads.
        if (!(await tx.query(query,[digest(token)])).rows.length) fail(401,'Location sharing stopped.');
        if (method === 'DELETE') { await clear(tx,userId); return { ok:true }; }
        return save(tx,userId,body);
      });
      if (method === 'DELETE' || result.accepted) changed(userId);
      return result;
    },
  };
}
