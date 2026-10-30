import { createPrivateKey, sign } from 'node:crypto';

export const validAndroidToken = token => typeof token === 'string' && /^[A-Za-z0-9_:\-]{80,4096}$/.test(token);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

// A service-account key stays on Render. Never send it to the web app or APK.
export function setupAndroidPush(db, raw = process.env.FCM_SERVICE_ACCOUNT_JSON, request = fetch) {
  if (!raw) return null;
  const credentials = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(credentials.project_id || '') || !credentials.client_email?.endsWith('.iam.gserviceaccount.com')) throw new Error('Check the Firebase service-account configuration.');
  const privateKey = createPrivateKey(credentials.private_key);
  let cached, pending;
  async function accessToken() {
    if (cached?.until > Date.now()) return cached.value;
    if (pending) return pending;
    pending = (async () => {
      const now = Math.floor(Date.now() / 1000);
      const claims = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
      const assertion = claims + '.' + sign('RSA-SHA256', Buffer.from(claims), privateKey).toString('base64url');
      const response = await request('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error('Firebase push authorization failed.');
      cached = { value: data.access_token, until: Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000 };
      return cached.value;
    })();
    try { return await pending; } finally { pending = null; }
  }
  return {
    async send(alert) {
      // Only devices belonging to actual recipients with an unexpired sign-in.
      const { rows } = await db.query(`select d.token,d.user_id from eligtas.android_devices d
        join eligtas.receipts r on r.user_id=d.user_id and r.alert_id=$1
        join eligtas.sessions s on s.token_hash=d.session_hash and s.user_id=d.user_id
        where s.expires_at>now()`, [alert.id]);
      for (let i = 0; i < rows.length; i += 5) {
        const results = await Promise.allSettled(rows.slice(i, i + 5).map(async device => {
          const urgent = ['high','critical'].includes(alert.priority);
          const payload = { message: { token: device.token, android: { priority: urgent ? 'HIGH' : 'NORMAL', ttl: '300s' }, data: {
            kind: 'eligtas-alert', id: alert.id, userId: device.user_id, priority: alert.priority,
            body: [...alert.content].slice(0,500).join(''), createdAt: new Date(alert.created_at || Date.now()).toISOString(),
            ...(alert.audio ? { audioId: alert.audio.id, audioKind: alert.audio.kind } : {}),
            ...(alert.response_id ? { responseId: alert.response_id } : {}),
          } } };
          for (let attempt = 0; attempt < 2; attempt++) {
            const response = await request(`https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`, {
              method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
            });
            if (response.status === 401 && attempt === 0) { cached = null; continue; }
            const data = await response.json();
            if (data.error?.details?.some(detail => detail['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError' && detail.errorCode === 'UNREGISTERED')) {
              await db.query('delete from eligtas.android_devices where token=$1 and user_id=$2', [device.token, device.user_id]); return;
            }
            if (!response.ok) throw new Error(`Android push failed (${response.status}).`);
            return;
          }
        }));
        if (results.some(result => result.status === 'rejected')) console.error('Some Android notifications could not be delivered; inbox messages are preserved.');
      }
    },
  };
}
