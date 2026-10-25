import { connect } from 'node:http2';
import { createPrivateKey, sign } from 'node:crypto';

export const validAppleToken = token => typeof token === 'string' && /^[a-f0-9]{64,512}$/i.test(token);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function pushText(text, budget = 2600) {
  let result = '';
  for (const character of text) {
    if (Buffer.byteLength(result + character, 'utf8') > budget) return result + '…';
    result += character;
  }
  return result;
}
export function applePayload(alert, device, criticalApproved = false, now = Date.now()) {
  const urgent = ['high', 'critical'].includes(alert.priority);
  const critical = urgent && criticalApproved && device.critical_enabled;
  return { aps: { alert: { title: `TANOVIQ · ${alert.priority} alert`, body: pushText(alert.content) },
    category: 'TANOVIQ_ALERT', 'thread-id': 'command-center', 'mutable-content': 1,
    'content-available': 1, 'interruption-level': critical ? 'critical' : urgent ? 'time-sensitive' : 'active',
    sound: critical ? { critical: 1, name: 'default', volume: 1 } : 'default' },
    alertId: alert.id, userId: device.user_id, priority: alert.priority,
    createdAt: new Date(alert.created_at || now).toISOString() };
}
export function liveActivityPayload(alert, device, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  return { aps: { timestamp, event: 'start', 'stale-date': timestamp + 300,
    'attributes-type': 'TANOVIQAlertAttributes', attributes: { alertID: alert.id, userID: device.user_id },
    'content-state': { priority: alert.priority, message: pushText(alert.content, 1200), updatedAt: timestamp, acknowledged: false },
    'relevance-score': alert.priority === 'critical' ? 100 : 80,
    alert: { title: 'TANOVIQ · Active alert', body: pushText(alert.content, 300) } } };
}
async function sendHttp2({ environment, token, headers, payload }) {
  const host = environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  return new Promise((resolve, reject) => {
    const client = connect(host); let finished = false;
    const finish = (error, value) => { if (finished) return; finished = true; clearTimeout(timer); client.destroy(); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => finish(new Error('APNs timed out.')), 12000);
    client.on('error', error => finish(error));
    const request = client.request({ ':method': 'POST', ':path': `/3/device/${token}`, ...headers });
    let status = 0, body = '';
    request.on('response', values => { status = Number(values[':status']); });
    request.setEncoding('utf8'); request.on('data', chunk => { body += chunk; });
    request.on('error', error => finish(error));
    request.on('end', () => { let data = {}; try { data = JSON.parse(body); } catch {} finish(null, { status, ...data }); });
    request.end(JSON.stringify(payload));
  });
}
export function setupIosPush(db, env = process.env, transport = sendHttp2) {
  if (!env.APNS_PRIVATE_KEY && !env.APNS_KEY_ID && !env.APNS_TEAM_ID) return null;
  if (!/^[A-Z0-9]{10}$/.test(env.APNS_KEY_ID || '') || !/^[A-Z0-9]{10}$/.test(env.APNS_TEAM_ID || '')) throw new Error('Check APNs team and key IDs.');
  const bundle = env.APNS_BUNDLE_ID || 'ph.tanoviq.app';
  if (!/^[a-zA-Z0-9.-]{3,200}$/.test(bundle)) throw new Error('Check the iOS bundle identifier.');
  const key = createPrivateKey(env.APNS_PRIVATE_KEY.replace(/\\n/g, '\n'));
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('APNs requires a P-256 signing key.');
  let cached;
  const authorization = () => {
    if (cached?.until > Date.now()) return cached.value;
    const unsigned = encode({ alg: 'ES256', kid: env.APNS_KEY_ID }) + '.' + encode({ iss: env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
    const value = unsigned + '.' + sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    cached = { value, until: Date.now() + 45 * 60000 }; return value;
  };
  async function send(device, token, payload, type = 'alert') {
    return transport({ environment: device.environment, token, payload, headers: {
      authorization: `bearer ${authorization()}`, 'apns-topic': bundle + (type === 'liveactivity' ? '.push-type.liveactivity' : ''),
      'apns-push-type': type, 'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 300),
    } });
  }
  return {
    async send(alert) {
      const { rows } = await db.query(`select d.* from eligtas.ios_devices d
        join eligtas.receipts r on r.user_id=d.user_id and r.alert_id=$1
        join eligtas.sessions s on s.token_hash=d.session_hash and s.user_id=d.user_id where s.expires_at>now()`, [alert.id]);
      for (let i = 0; i < rows.length; i += 5) {
        const results = await Promise.allSettled(rows.slice(i,i+5).map(async device => {
          const result = await send(device,device.token,applePayload(alert,device,env.APNS_CRITICAL_ALERTS_APPROVED === 'true'));
          if (result.status === 410) { await db.query('delete from eligtas.ios_devices where token=$1 and user_id=$2', [device.token,device.user_id]); return; }
          if (result.status !== 200) throw new Error(`APNs delivery failed (${result.status}).`);
          if (device.live_enabled && device.live_start_token && ['high','critical'].includes(alert.priority)) {
            const live = await send(device,device.live_start_token,liveActivityPayload(alert,device),'liveactivity');
            if (live.status === 410) await db.query('update eligtas.ios_devices set live_start_token=null where token=$1 and live_start_token=$2',[device.token,device.live_start_token]);
            else if (live.status !== 200) throw new Error(`Live Activity delivery failed (${live.status}).`);
          }
        }));
        if (results.some(result => result.status === 'rejected')) console.error('Some iOS notifications could not be delivered; inbox messages are preserved.');
      }
    },
    async acknowledge(userId, alertId) {
      const { rows } = await db.query(`select a.*,d.environment from eligtas.ios_activities a join eligtas.ios_devices d on d.token=a.device_token
        join eligtas.sessions s on s.token_hash=d.session_hash and s.user_id=d.user_id where d.user_id=$1 and a.alert_id=$2 and s.expires_at>now()`,[userId,alertId]);
      for (const device of rows) {
        const timestamp = Math.floor(Date.now()/1000);
        const result = await send(device,device.token,{ aps: { timestamp,event:'end','dismissal-date':timestamp,
          'content-state':{priority:'normal',message:'Message acknowledged',updatedAt:timestamp,acknowledged:true} } },'liveactivity');
        if ([200,410].includes(result.status)) await db.query('delete from eligtas.ios_activities where token=$1',[device.token]);
      }
    },
  };
}
