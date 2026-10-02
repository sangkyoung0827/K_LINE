create table if not exists public.hanhwal_introduction (
  id text primary key,
  content jsonb not null,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.hanhwal_introduction enable row level security;
revoke all on public.hanhwal_introduction from anon, authenticated;
grant all on public.hanhwal_introduction to service_role;
