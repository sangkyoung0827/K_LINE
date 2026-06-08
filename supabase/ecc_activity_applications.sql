create table if not exists public.ecc_activity_applications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('gathering', 'mt', 'special')),
  kakao_name text not null,
  gender text not null,
  nationality text not null,
  preferred_food text not null,
  request text default '',
  created_at timestamptz not null default now()
);

alter table public.ecc_activity_applications enable row level security;
