import { verifyPassword } from './auth.mjs';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function accountRoutes(app, db, { rateLimit, changed, production }) {
  app.delete('/api/account', async (req, res) => {
    rateLimit(req, 'account-delete', 5);
    if (req.body.confirm !== true) fail(400, 'Confirm that you want to permanently delete your account.');
    const password = typeof req.body.password === 'string' && req.body.password.length <= 128 ? req.body.password : '';
    if (!await verifyPassword(password, req.user.password_hash)) fail(403, 'Check your password. Your account has not been deleted.');

    await db.transaction(async tx => {
      const current = (await tx.query('select password_hash from eligtas.users where id=$1 for update', [req.user.id])).rows[0];
      if (!current || current.password_hash !== req.user.password_hash) fail(409, 'Your account changed. Sign in again before deleting it.');
      const id = req.user.id;
      // Remove user-associated records, not just the sign-in or a disabled flag.
      // Other people's accounts and shared project/group definitions are preserved.
      await tx.query(`delete from eligtas.audit where actor_id=$1 or target_id=$1
        or target_id in (select id from eligtas.alerts where author_id=$1)
        or target_id in (select id from eligtas.requests where user_id=$1)
        or target_id in (select id from eligtas.contact_requests where user_id=$1 or requester_id=$1)`, [id]);
      await tx.query('delete from eligtas.contact_requests where user_id=$1 or requester_id=$1', [id]);
      await tx.query('delete from eligtas.group_members where user_id=$1', [id]);
      await tx.query('update eligtas.projects set lead_id=null where lead_id=$1', [id]);
      await tx.query('update eligtas.team_groups set head_id=null where head_id=$1', [id]);
      await tx.query('update eligtas.tasks set assignee_id=null where assignee_id=$1', [id]);
      await tx.query('delete from eligtas.alerts where author_id=$1', [id]);
      // Foreign keys cascade receipts, requests, device registrations, sessions,
      // Live Activity tokens and native location credentials in this transaction.
      await tx.query('delete from eligtas.users where id=$1', [id]);
    });
    changed(req.user.id);
    res.clearCookie('eligtas_session', { httpOnly: true, secure: production, sameSite: 'lax', path: '/api' });
    res.json({ ok: true, deleted: true });
  });
}
