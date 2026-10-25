import { isOperator } from './auth.mjs';

const actions = {
  dispatch_alert: ['alerts', 'Alert dispatched'],
  create_group: ['groups', 'Group created'], update_group: ['groups', 'Group updated'],
  assign_group_member: ['groups', 'Member assignment changed'], remove_group_member: ['groups', 'Member removed from group'],
  add_group_members: ['groups', 'Members added to group'],
  create_project: ['operations', 'Operation created'], update_project: ['operations', 'Operation updated'],
  create_task: ['operations', 'Task created'], update_task: ['operations', 'Task updated'],
  request_acknowledged: ['requests', 'Assistance request acknowledged'], request_assigned: ['requests', 'Response team assigned'],
  request_resolved: ['requests', 'Assistance request resolved'], request_cancelled: ['requests', 'Assistance request cancelled'],
  bootstrap_admin: ['access', 'Account owner configured'], approve_operator: ['access', 'Operator approved'],
  change_operator_access: ['access', 'Operator access changed'], request_contact_visibility: ['access', 'Contact visibility requested'],
  contact_approved: ['access', 'Contact visibility approved'], contact_denied: ['access', 'Contact visibility denied'],
  contact_revoked: ['access', 'Contact visibility revoked'],
};
const categories = new Set(['all', ...Object.values(actions).map(([category]) => category)]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = () => { throw Object.assign(new Error('Check the log filters.'), { status: 400 }); };
const labelSql = `case a.action ${Object.entries(actions).map(([action, [, label]]) => `when '${action}' then '${label}'`).join(' ')} else replace(a.action, '_', ' ') end`;

export function auditRoutes(app, db) {
  app.get('/api/audit', async (req, res) => {
    if (!isOperator(req.user)) return res.status(403).json({ error: 'Approved command-center access is required to view logs.' });
    const { q = '', category = 'all', since = '', cursor = '' } = req.query;
    if (typeof q !== 'string' || q.length > 100 || !categories.has(category) || typeof since !== 'string' || typeof cursor !== 'string' || cursor.length > 300) invalid();
    if (since && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(since)) invalid();
    if (since && !Number.isFinite(Date.parse(since))) invalid();
    let before = null;
    if (cursor) {
      try { before = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { invalid(); }
      if (!Array.isArray(before) || before.length !== 2 || typeof before[0] !== 'string' || !Number.isFinite(Date.parse(before[0])) || !uuid.test(before[1])) invalid();
    }
    const selected = category === 'all' ? null : Object.keys(actions).filter(key => actions[key][0] === category);
    // Return only preferred names and record labels. Never include contact details,
    // coordinates, authentication data, or the contents of private messages.
    const { rows } = await db.query(`with entries as (
      select a.id,a.action,a.created_at,a.created_at::text as cursor_at,coalesce(actor.name,'Unavailable account') as actor,
        ${labelSql} as label, a.target_id,
        coalesce(g.name,p.name,t.title,r.type,al.target_label,person.name,'') as target
      from eligtas.audit a
      left join eligtas.users actor on actor.id=a.actor_id
      left join eligtas.team_groups g on g.id=a.target_id and a.action in ('create_group','update_group','add_group_members')
      left join eligtas.projects p on p.id=a.target_id and a.action in ('create_project','update_project')
      left join eligtas.tasks t on t.id=a.target_id and a.action in ('create_task','update_task')
      left join eligtas.requests r on r.id=a.target_id and a.action like 'request_%'
      left join eligtas.alerts al on al.id=a.target_id and a.action='dispatch_alert'
      left join eligtas.users person on person.id=a.target_id and a.action in ('bootstrap_admin','approve_operator','change_operator_access','assign_group_member','remove_group_member','request_contact_visibility')
      where ($2::text[] is null or a.action=any($2))
        and ($3::timestamptz is null or a.created_at >= $3)
        and ($4::timestamptz is null or (a.created_at,a.id)<($4::timestamptz,$5::uuid))
    ) select * from entries where ($1='' or concat_ws(' ',label,actor,target) ilike $1)
      order by created_at desc,id desc limit 51`, [q.trim() ? `%${q.trim().replace(/[\\%_]/g, '\\$&')}%` : '', selected, since || null, before?.[0] || null, before?.[1] || null]);
    const entries = rows.slice(0, 50).map(row => ({ id: row.id, action: row.label, category: actions[row.action]?.[0] || 'operations', actor: row.actor, target: row.target, reference: row.target_id, createdAt: row.created_at }));
    const last = rows[49];
    res.json({ entries, nextCursor: rows.length > 50 ? Buffer.from(JSON.stringify([last.cursor_at, last.id])).toString('base64url') : null });
  });
}
