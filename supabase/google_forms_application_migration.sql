-- K_LINE Google Forms application migration.
-- Additive only: legacy application tables remain untouched as read-only history.

create extension if not exists pgcrypto;

create table if not exists public.google_oauth_connections (
  id text primary key default 'operations' check (id = 'operations'),
  account_email text not null,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  connected_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_forms (
  id uuid primary key default gen_random_uuid(),
  club_key text not null check (club_key in ('ecc', 'social_impact_union', 'jeju', 'general')),
  activity_id text,
  activity_type text,
  google_form_id text not null unique,
  title text not null,
  description text not null default '',
  responder_url text not null,
  edit_url text,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'archived')),
  application_deadline timestamptz,
  response_count integer not null default 0 check (response_count >= 0),
  last_response_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_forms_active_activity_idx
  on public.google_forms (club_key, activity_id)
  where activity_id is not null and status in ('draft', 'open', 'closed');
create index if not exists google_forms_club_status_idx
  on public.google_forms (club_key, status, created_at desc);

create table if not exists public.google_form_responses (
  id uuid primary key default gen_random_uuid(),
  google_form_registry_id uuid not null references public.google_forms(id) on delete cascade,
  google_response_id text not null,
  submitted_at timestamptz not null,
  respondent_email text,
  matched_user_email text,
  answers_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (google_form_registry_id, google_response_id)
);

create index if not exists google_form_responses_form_submitted_idx
  on public.google_form_responses (google_form_registry_id, submitted_at desc);
create index if not exists google_form_responses_matched_user_idx
  on public.google_form_responses (lower(matched_user_email), submitted_at desc)
  where matched_user_email is not null;

alter table public.google_oauth_connections enable row level security;
alter table public.google_forms enable row level security;
alter table public.google_form_responses enable row level security;

revoke all on public.google_oauth_connections, public.google_forms, public.google_form_responses
  from public, anon, authenticated;
grant all on public.google_oauth_connections, public.google_forms, public.google_form_responses
  to service_role;

create or replace function public.touch_google_forms_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_google_forms_updated_at() from public, anon, authenticated;
grant execute on function public.touch_google_forms_updated_at() to service_role;

drop trigger if exists google_oauth_connections_touch_updated_at on public.google_oauth_connections;
create trigger google_oauth_connections_touch_updated_at
before update on public.google_oauth_connections
for each row execute function public.touch_google_forms_updated_at();

drop trigger if exists google_forms_touch_updated_at on public.google_forms;
create trigger google_forms_touch_updated_at
before update on public.google_forms
for each row execute function public.touch_google_forms_updated_at();

comment on table public.google_oauth_connections is
  'Server-only encrypted OAuth connection for the dedicated K_LINE operations Google account.';
comment on table public.google_forms is
  'Registry for Google Forms; Google is authoritative for all new application submissions.';
comment on table public.google_form_responses is
  'Read-only K_LINE mirror of authoritative Google Form responses.';
