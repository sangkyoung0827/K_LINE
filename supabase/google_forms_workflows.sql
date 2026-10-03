-- Apply only to an isolated TEST database after google_forms_application_migration.sql.
-- No native table, member role, or existing activity record is modified.
create table if not exists public.google_form_creation_attempts (
  idempotency_key text primary key,
  draft_hash text not null,
  remote_form_id text,
  status text not null check (status in ('creating', 'configuring', 'ready', 'uncertain')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.google_form_workflows (
  id uuid primary key default gen_random_uuid(),
  club_key text not null check (club_key in ('ecc', 'social_impact_union', 'jeju', 'general')),
  draft jsonb not null,
  notice text not null,
  revision integer not null default 1 check (revision > 0),
  workflow_status text not null default 'draft' check (workflow_status in ('draft', 'running', 'form_created', 'notice_saved', 'notice_published', 'failed')),
  form_registry_id uuid references public.google_forms(id),
  notice_id uuid,
  published_at timestamptz,
  last_error text,
  last_retry_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_form_operation_audit (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.google_form_workflows(id),
  actor_email text not null,
  action text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);

alter table public.google_form_creation_attempts enable row level security;
alter table public.google_form_workflows enable row level security;
alter table public.google_form_operation_audit enable row level security;
revoke all on public.google_form_creation_attempts, public.google_form_workflows, public.google_form_operation_audit from public, anon, authenticated;
grant all on public.google_form_creation_attempts, public.google_form_workflows, public.google_form_operation_audit to service_role;

-- Extra columns are additive if the foundation was already installed in a test DB.
alter table public.google_forms add column if not exists activity_instance_id text;
alter table public.google_form_responses add column if not exists raw_answers_json jsonb not null default '{}'::jsonb;
create index if not exists google_form_workflows_club_created_idx on public.google_form_workflows(club_key, created_at desc);
