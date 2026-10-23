create schema if not exists eligtas;
revoke all on schema eligtas from public;

create table if not exists eligtas.users (
  id uuid primary key,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  name text not null check (length(name) between 2 and 80),
  password_hash text not null,
  recovery_hash text not null,
  role text not null default 'resident' check (role in ('resident','operator','admin')),
  operator_requested boolean not null default false,
  groups text[] not null default '{}' check (groups <@ array['pwd','children','seniors','pregnant','responders']::text[]),
  municipality text not null default '' check (length(municipality) <= 80),
  alerts_enabled boolean not null default true,
  location_sharing boolean not null default false,
  lat double precision check (lat between -85 and 85),
  lng double precision check (lng between -180 and 180),
  accuracy double precision check (accuracy between 0 and 100000),
  location_at timestamptz,
  safe_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (location_sharing or (lat is null and lng is null and location_at is null))
);
create table if not exists eligtas.sessions (
  token_hash text primary key,
  user_id uuid not null references eligtas.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user on eligtas.sessions(user_id);
create table if not exists eligtas.location_shares (
  token_hash text primary key,
  user_id uuid not null unique references eligtas.users(id) on delete cascade,
  session_hash text not null references eligtas.sessions(token_hash) on delete cascade
);
create index if not exists location_shares_session on eligtas.location_shares(session_hash);
create table if not exists eligtas.alerts (
  id uuid primary key,
  author_id uuid not null references eligtas.users(id),
  content text not null check (length(content) between 1 and 1000),
  priority text not null check (priority in ('normal','high','critical')),
  area jsonb not null,
  groups text[] not null,
  active_only boolean not null,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists eligtas.receipts (
  alert_id uuid not null references eligtas.alerts(id) on delete cascade,
  user_id uuid not null references eligtas.users(id) on delete cascade,
  received_at timestamptz,
  read_at timestamptz,
  primary key(alert_id,user_id)
);
create index if not exists receipts_user on eligtas.receipts(user_id,alert_id);
create table if not exists eligtas.requests (
  id uuid primary key,
  user_id uuid not null references eligtas.users(id) on delete cascade,
  type text not null check (type in ('Evacuation','Medical assistance','Rescue','Other assistance')),
  note text not null check (length(note) <= 500),
  people integer not null check (people between 1 and 20),
  include_location boolean not null default false,
  status text not null default 'new' check (status in ('new','acknowledged','assigned','resolved','cancelled')),
  assigned_unit text not null default '' check (length(assigned_unit) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_open_request on eligtas.requests(user_id) where status in ('new','acknowledged','assigned');
create index if not exists requests_created on eligtas.requests(created_at desc);
create table if not exists eligtas.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references eligtas.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists push_user on eligtas.push_subscriptions(user_id);
create table if not exists eligtas.android_devices (
  token text primary key,
  user_id uuid not null references eligtas.users(id) on delete cascade,
  session_hash text not null references eligtas.sessions(token_hash) on delete cascade,
  updated_at timestamptz not null default now()
);
create index if not exists android_devices_user on eligtas.android_devices(user_id);
create table if not exists eligtas.settings (key text primary key, value jsonb not null);
create table if not exists eligtas.audit (
  id uuid primary key,
  actor_id uuid references eligtas.users(id),
  action text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);
revoke all on all tables in schema eligtas from public;

-- Additive GSAM migration. Organizational labels never grant application access.
create table if not exists eligtas.projects (
  id uuid primary key,
  name text not null check (length(name) between 1 and 100),
  objective text not null default '' check (length(objective) <= 1000),
  status text not null default 'planned' check (status in ('planned','active','completed')),
  lead_id uuid references eligtas.users(id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
alter table eligtas.users add column if not exists email text not null default '' check (length(email) <= 254);
alter table eligtas.users add column if not exists phone text not null default '' check (length(phone) <= 30);
alter table eligtas.users add column if not exists on_duty boolean not null default false;
alter table eligtas.users add column if not exists duty_at timestamptz;
alter table eligtas.users add column if not exists duty_project_id uuid references eligtas.projects(id);
create table if not exists eligtas.team_groups (
  id uuid primary key,
  name text not null check (length(name) between 1 and 80),
  tag text not null unique check (tag ~ '^[a-z][a-z0-9_-]{0,39}$'),
  description text not null default '' check (length(description) <= 500),
  project_id uuid references eligtas.projects(id),
  parent_id uuid references eligtas.team_groups(id),
  head_id uuid references eligtas.users(id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create table if not exists eligtas.group_members (
  group_id uuid not null references eligtas.team_groups(id),
  user_id uuid not null references eligtas.users(id),
  title text not null default '' check (length(title) <= 80),
  category text not null default '' check (length(category) <= 80),
  primary key (group_id,user_id)
);
create index if not exists group_members_user on eligtas.group_members(user_id);
create table if not exists eligtas.tasks (
  id uuid primary key,
  project_id uuid not null references eligtas.projects(id),
  title text not null check (length(title) between 1 and 160),
  group_id uuid references eligtas.team_groups(id),
  assignee_id uuid references eligtas.users(id),
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists eligtas.contact_requests (
  id uuid primary key,
  user_id uuid not null references eligtas.users(id),
  requester_id uuid not null references eligtas.users(id),
  reason text not null check (length(reason) between 1 and 300),
  fields text[] not null check (cardinality(fields)>0 and fields <@ array['email','phone']::text[]),
  status text not null default 'pending' check (status in ('pending','approved','denied','revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id <> requester_id)
);
create unique index if not exists contact_request_pending on eligtas.contact_requests(user_id,requester_id) where status='pending';
alter table eligtas.alerts alter column area drop not null;
alter table eligtas.alerts add column if not exists target_mode text not null default 'geofence';
alter table eligtas.alerts add column if not exists target_label text not null default '';
alter table eligtas.alerts add column if not exists target_group_ids uuid[] not null default '{}';
alter table eligtas.alerts add column if not exists target_spec jsonb;
-- Old, off-duty pins must not survive the transition to duty-scoped tracking.
delete from eligtas.location_shares where user_id in (select id from eligtas.users where not on_duty);
update eligtas.users set location_sharing=false,lat=null,lng=null,accuracy=null,location_at=null where not on_duty and location_sharing;
-- Apply the new personnel alert policy once without changing Android/OS permissions.
update eligtas.users set alerts_enabled=true where not exists (select 1 from eligtas.settings where key='gsam_personnel_alert_policy_v1');
insert into eligtas.settings(key,value) values ('gsam_personnel_alert_policy_v1','true'::jsonb) on conflict(key) do nothing;
revoke all on all tables in schema eligtas from public;
