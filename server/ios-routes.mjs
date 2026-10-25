import { digest } from './auth.mjs';
import { validAppleToken } from './ios-push.mjs';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function iosRoutes(app, db, push, tokenFrom, rateLimit) {
  app.post('/api/push/ios', async (req,res) => {
    if (!push?.iosReady) fail(503,'iPhone push delivery is awaiting Apple setup. Your inbox is still available.');
    const { token, environment, liveStartToken, liveEnabled, criticalEnabled } = req.body;
    if (!validAppleToken(token) || !['sandbox','production'].includes(environment) ||
      (liveStartToken != null && !validAppleToken(liveStartToken)) || typeof liveEnabled !== 'boolean' || typeof criticalEnabled !== 'boolean') fail(400,'Invalid iPhone device registration.');
    rateLimit(req,'ios-device',120);
    // Clear activity bindings before a device is reassigned to a different account.
    await db.transaction(async tx => {
      await tx.query('delete from eligtas.ios_devices where token=$1 and user_id<>$2',[token,req.user.id]);
      await tx.query(`insert into eligtas.ios_devices(token,user_id,session_hash,environment,live_start_token,live_enabled,critical_enabled)
        values($1,$2,$3,$4,$5,$6,$7) on conflict(token) do update set session_hash=excluded.session_hash,environment=excluded.environment,
        live_start_token=excluded.live_start_token,live_enabled=excluded.live_enabled,critical_enabled=excluded.critical_enabled,updated_at=now()`,
        [token,req.user.id,digest(tokenFrom(req)),environment,liveStartToken || null,liveEnabled,criticalEnabled]);
    });
    res.json({ok:true});
  });
  app.delete('/api/push/ios',async(req,res)=>{
    if(!validAppleToken(req.body.token)) fail(400,'Invalid iPhone device registration.');
    await db.query('delete from eligtas.ios_devices where token=$1 and user_id=$2',[req.body.token,req.user.id]);res.json({ok:true});
  });
  app.post('/api/push/ios/activity',async(req,res)=>{
    const { token,deviceToken,alertId }=req.body;
    if(!validAppleToken(token)||!validAppleToken(deviceToken)||typeof alertId!=='string'||!/^[a-f0-9-]{36}$/i.test(alertId)) fail(400,'Invalid Live Activity registration.');
    rateLimit(req,'ios-activity',120);
    const own=(await db.query(`select d.token,r.read_at from eligtas.ios_devices d join eligtas.receipts r on r.user_id=d.user_id and r.alert_id=$3
      where d.token=$1 and d.user_id=$2 and d.session_hash=$4`,[deviceToken,req.user.id,alertId,digest(tokenFrom(req))])).rows[0];
    if(!own) fail(404,'Alert or device not found.');
    const existing=(await db.query('select device_token,alert_id from eligtas.ios_activities where token=$1',[token])).rows[0];
    if(existing && (existing.device_token!==deviceToken || existing.alert_id!==alertId)) fail(409,'This activity is already registered.');
    await db.query('insert into eligtas.ios_activities(token,device_token,alert_id) values($1,$2,$3) on conflict(token) do nothing',[token,deviceToken,alertId]);
    if(own.read_at) void push?.acknowledge?.(req.user.id,alertId).catch(()=>{});
    res.json({ok:true});
  });
}
