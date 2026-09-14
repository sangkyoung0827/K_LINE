create table if not exists public.hanhwal_operational_settings (
  id text primary key,
  period_label text not null default '',
  official_team_chat_url text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.hanhwal_operational_settings enable row level security;

drop policy if exists "Service role manages Hanhwal operational settings"
  on public.hanhwal_operational_settings;

create policy "Service role manages Hanhwal operational settings"
  on public.hanhwal_operational_settings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.hanhwal_operational_settings (
  id,
  period_label,
  official_team_chat_url
)
values (
  'current',
  '',
  'https://invite.kakao.com/tc/zKMZzHW8wo'
)
on conflict (id) do nothing;
