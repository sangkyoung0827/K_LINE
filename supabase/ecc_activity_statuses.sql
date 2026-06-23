create table if not exists public.ecc_activity_statuses (
  activity_id text primary key,
  is_open boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.ecc_activity_statuses enable row level security;

insert into public.ecc_activity_statuses (activity_id, is_open)
values
  ('gathering', true),
  ('mt', true),
  ('special', true),
  ('opening', true),
  ('farewell', true),
  ('english-class', true)
on conflict (activity_id) do nothing;
