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
create table if not exists eligtas.settings (key text primary key, value jsonb not null);
create table if not exists eligtas.audit (
  id uuid primary key,
  actor_id uuid references eligtas.users(id),
  action text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);
revoke all on all tables in schema eligtas from public;
