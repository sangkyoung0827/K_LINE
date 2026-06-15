create table if not exists public.site_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  email text not null unique,
  name text not null default '',
  image_url text not null default '',
  provider text not null default 'google',
  provider_account_id text not null default '',
  role text not null default 'member',
  status text not null default 'active' check (status in ('active', 'paused', 'blocked')),
  first_login_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  login_count integer not null default 1
);

create index if not exists site_members_last_login_idx
  on public.site_members (last_login_at desc);

create index if not exists site_members_status_idx
  on public.site_members (status);

create table if not exists public.site_visitors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  visitor_id text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_path text not null default '',
  last_referrer text not null default '',
  user_email text not null default '',
  visit_count integer not null default 1
);

create index if not exists site_visitors_last_seen_idx
  on public.site_visitors (last_seen_at desc);

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id text not null,
  path text not null default '',
  referrer text not null default '',
  user_email text not null default '',
  user_agent text not null default ''
);

create index if not exists site_visits_created_at_idx
  on public.site_visits (created_at desc);

create index if not exists site_visits_visitor_idx
  on public.site_visits (visitor_id);

alter table public.site_members enable row level security;
alter table public.site_visitors enable row level security;
alter table public.site_visits enable row level security;

drop policy if exists "Service role manages site members"
  on public.site_members;

drop policy if exists "Service role manages site visitors"
  on public.site_visitors;

drop policy if exists "Service role manages site visits"
  on public.site_visits;

create policy "Service role manages site members"
  on public.site_members
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages site visitors"
  on public.site_visitors
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages site visits"
  on public.site_visits
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
