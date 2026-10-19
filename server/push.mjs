import webpush from 'web-push';

export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint);
    const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com');
    return allowed && url.protocol === 'https:' && !url.port && !url.username && !url.password && value.endpoint.length < 2048 &&
      /^[A-Za-z0-9_-]{80,100}$/.test(value.keys?.p256dh) && /^[A-Za-z0-9_-]{20,30}$/.test(value.keys?.auth);
  } catch { return false; }
}
export async function setupPush(db) {
  const generated = webpush.generateVAPIDKeys();
  await db.query("insert into eligtas.settings(key,value) values ('vapid',$1) on conflict do nothing", [JSON.stringify(generated)]);
  const { rows } = await db.query("select value from eligtas.settings where key='vapid'");
  const keys = rows[0].value;
  webpush.setVapidDetails(process.env.PUBLIC_APP_URL || 'https://ews-kappa.vercel.app', keys.publicKey, keys.privateKey);
  return {
    publicKey: keys.publicKey,
    async send(alert) {
      const { rows: subscriptions } = await db.query('select s.* from eligtas.push_subscriptions s join eligtas.receipts r on r.user_id=s.user_id where r.alert_id=$1', [alert.id]);
      for (let start = 0; start < subscriptions.length; start += 5) {
        await Promise.allSettled(subscriptions.slice(start, start + 5).map(async sub => {
          try { await webpush.sendNotification(sub.subscription, JSON.stringify({ id: alert.id, title: 'E-Ligtas · ' + alert.priority + ' alert', body: alert.content.slice(0, 180) }), { TTL: 3600, timeout: 5000 }); }
          catch (error) { if ([404, 410].includes(error.statusCode)) await db.query('delete from eligtas.push_subscriptions where endpoint=$1', [sub.endpoint]); }
        }));
      }
    },
  };
}
