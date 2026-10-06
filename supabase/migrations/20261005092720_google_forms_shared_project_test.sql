-- Separate test namespace within the existing project. No native tables are read or modified.

create extension if not exists pgcrypto;

create table if not exists public.kline_forms_test_google_oauth_connections (
  id text primary key default 'operations' check (id = 'operations'),
  account_email text not null,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  connected_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kline_forms_test_google_forms (
  id uuid primary key default gen_random_uuid(),
  club_key text not null check (club_key in ('ecc', 'social_impact_union', 'jeju', 'general')),
  activity_id text,
  activity_instance_id text,
  activity_type text,
  application_source text not null default 'google_forms' check (application_source = 'google_forms'),
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

create unique index if not exists kline_forms_test_google_forms_instance_idx
  on public.kline_forms_test_google_forms (club_key, activity_instance_id)
  where activity_instance_id is not null;
create index if not exists kline_forms_test_google_forms_club_status_idx
  on public.kline_forms_test_google_forms (club_key, status, created_at desc);

create table if not exists public.kline_forms_test_google_form_responses (
  id uuid primary key default gen_random_uuid(),
  google_form_registry_id uuid not null references public.kline_forms_test_google_forms(id) on delete cascade,
  google_response_id text not null,
  application_source text not null default 'google_forms' check (application_source = 'google_forms'),
  submitted_at timestamptz not null,
  respondent_email text,
  matched_user_email text,
  answers_json jsonb not null default '{}'::jsonb,
  raw_answers_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (google_form_registry_id, google_response_id)
);

create index if not exists kline_forms_test_google_form_responses_form_submitted_idx
  on public.kline_forms_test_google_form_responses (google_form_registry_id, submitted_at desc);
create index if not exists kline_forms_test_google_form_responses_matched_user_idx
  on public.kline_forms_test_google_form_responses (lower(matched_user_email), submitted_at desc)
  where matched_user_email is not null;

alter table public.kline_forms_test_google_oauth_connections enable row level security;
alter table public.kline_forms_test_google_forms enable row level security;
alter table public.kline_forms_test_google_form_responses enable row level security;

revoke all on public.kline_forms_test_google_oauth_connections, public.kline_forms_test_google_forms, public.kline_forms_test_google_form_responses
  from public, anon, authenticated;
grant all on public.kline_forms_test_google_oauth_connections, public.kline_forms_test_google_forms, public.kline_forms_test_google_form_responses
  to service_role;

create or replace function public.kline_forms_test_touch_google_forms_updated_at()
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

revoke all on function public.kline_forms_test_touch_google_forms_updated_at() from public, anon, authenticated;
grant execute on function public.kline_forms_test_touch_google_forms_updated_at() to service_role;

drop trigger if exists kline_forms_test_google_oauth_connections_touch_updated_at on public.kline_forms_test_google_oauth_connections;
create trigger kline_forms_test_google_oauth_connections_touch_updated_at
before update on public.kline_forms_test_google_oauth_connections
for each row execute function public.kline_forms_test_touch_google_forms_updated_at();

drop trigger if exists kline_forms_test_google_forms_touch_updated_at on public.kline_forms_test_google_forms;
create trigger kline_forms_test_google_forms_touch_updated_at
before update on public.kline_forms_test_google_forms
for each row execute function public.kline_forms_test_touch_google_forms_updated_at();

comment on table public.kline_forms_test_google_oauth_connections is
  'Server-only encrypted OAuth connection for the dedicated K_LINE operations Google account.';
comment on table public.kline_forms_test_google_forms is
  'Parallel test registry; native applications remain the default production source.';
comment on table public.kline_forms_test_google_form_responses is
  'Read-only K_LINE mirror of authoritative Google Form responses.';

-- Workflow tables in the same dedicated test namespace.
-- No native table, member role, or existing activity record is modified.
create table if not exists public.kline_forms_test_google_form_creation_attempts (
  idempotency_key text primary key,
  draft_hash text not null,
  remote_form_id text,
  status text not null check (status in ('creating', 'configuring', 'ready', 'uncertain')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kline_forms_test_google_form_workflows (
  id uuid primary key default gen_random_uuid(),
  club_key text not null check (club_key in ('ecc', 'social_impact_union', 'jeju', 'general')),
  draft jsonb not null,
  notice text not null,
  revision integer not null default 1 check (revision > 0),
  workflow_status text not null default 'draft' check (workflow_status in ('draft', 'running', 'form_created', 'notice_saved', 'notice_published', 'failed')),
  form_registry_id uuid references public.kline_forms_test_google_forms(id),
  notice_id uuid,
  published_at timestamptz,
  last_error text,
  last_retry_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kline_forms_test_google_form_operation_audit (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.kline_forms_test_google_form_workflows(id),
  actor_email text not null,
  action text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);

alter table public.kline_forms_test_google_form_creation_attempts enable row level security;
alter table public.kline_forms_test_google_form_workflows enable row level security;
alter table public.kline_forms_test_google_form_operation_audit enable row level security;
revoke all on public.kline_forms_test_google_form_creation_attempts, public.kline_forms_test_google_form_workflows, public.kline_forms_test_google_form_operation_audit from public, anon, authenticated;
grant all on public.kline_forms_test_google_form_creation_attempts, public.kline_forms_test_google_form_workflows, public.kline_forms_test_google_form_operation_audit to service_role;

-- Extra columns are additive if the foundation was already installed in a test DB.
alter table public.kline_forms_test_google_forms add column if not exists activity_instance_id text;
alter table public.kline_forms_test_google_form_responses add column if not exists raw_answers_json jsonb not null default '{}'::jsonb;
create index if not exists kline_forms_test_google_form_workflows_club_created_idx on public.kline_forms_test_google_form_workflows(club_key, created_at desc);

create table if not exists public.kline_forms_test_club_board_posts (
  id uuid primary key,
  board_id text not null check (board_id = 'ecc'),
  title text not null,
  content text not null,
  author_name text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  media jsonb not null default '[]'::jsonb
);

create table if not exists public.kline_forms_test_site_members (
  email text primary key
);

alter table public.kline_forms_test_club_board_posts enable row level security;
alter table public.kline_forms_test_site_members enable row level security;
revoke all on public.kline_forms_test_club_board_posts, public.kline_forms_test_site_members from public, anon, authenticated;
grant all on public.kline_forms_test_club_board_posts, public.kline_forms_test_site_members to service_role;
