import { isOperator } from './auth.mjs';

// Events contain no coordinates. Clients fetch an authenticated, scoped state after each hint.
// The existing five-second refresh also covers other instances and buffering proxies.
export function locationEvents(db) {
  const listeners = new Set();
  async function signal(client, userId) {
    if (client.closed) return;
    try {
      const user = (await db.query('select u.id,u.role from eligtas.sessions s join eligtas.users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()', [client.session])).rows[0];
      if (!user) { client.res.end(); return; }
      if (!userId || user.id === userId || (isOperator(user) && !client.publicView)) {
        if (!client.closed && !client.res.write(`event: ${userId ? 'location' : 'ready'}\ndata: {}\n\n`)) client.res.end();
      }
    } catch { client.res.end(); }
  }
  return {
    changed: userId => { for (const client of listeners) void signal(client,userId); },
    connect: (req, res, session) => {
      res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-store, no-transform', 'X-Accel-Buffering':'no' });
      res.flushHeaders(); res.write('retry: 1500\n\n');
      const client = { res, session, publicView:req.query.view === 'public', closed:false };
      listeners.add(client);
      void signal(client);
      const heartbeat = setInterval(() => void signal(client),15000);
      const expiry = setTimeout(() => res.end(),55000);
      res.on('close', () => { client.closed = true; clearInterval(heartbeat); clearTimeout(expiry); listeners.delete(client); });
    },
  };
}
