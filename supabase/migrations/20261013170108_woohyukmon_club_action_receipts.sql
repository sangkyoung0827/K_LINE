-- Minimal server-only receipts prevent approval replay without storing member data.
create table if not exists public.woohyukmon_club_action_receipts (
  id text primary key,
  actor_email text not null,
  scope text not null check (scope in ('ecc','hanhwal','social_impact_union','jeju','research','event_archive')),
  capability text not null,
  status text not null check (status in ('running','completed','failed')),
  created_at timestamptz not null default now()
);
alter table public.woohyukmon_club_action_receipts enable row level security;
revoke all on public.woohyukmon_club_action_receipts from public, anon, authenticated;
grant select, insert, update on public.woohyukmon_club_action_receipts to service_role;
