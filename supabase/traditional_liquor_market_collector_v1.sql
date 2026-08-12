-- WooHyukmon Market Collector V1
-- Run after traditional_liquor_market.sql and traditional_liquor_real_import_v2.sql.
-- Idempotent: existing Production products, offers, prices and metrics are not modified.

begin;

create table if not exists public.traditional_liquor_collector_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null,
  platform_code text not null check (platform_code in ('NAVER', 'KAKAO_GIFT')),
  query text not null check (char_length(trim(query)) between 1 and 120),
  status text not null default 'PENDING' check (
    status in ('PENDING','DISPATCHED','RUNNING','UPLOADING','COMPLETED','FAILED','EXPIRED')
  ),
  token_hash text not null unique check (char_length(token_hash) = 64),
  target_url text not null,
  expires_at timestamptz not null,
  batch_id uuid references public.traditional_liquor_import_batches(id) on delete set null,
  diagnostics jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  check (finished_at is null or started_at is null or finished_at >= started_at)
);

create index if not exists traditional_liquor_collector_jobs_requested_idx
  on public.traditional_liquor_collector_jobs (requested_by, created_at desc);
create index if not exists traditional_liquor_collector_jobs_status_idx
  on public.traditional_liquor_collector_jobs (status, expires_at);
create index if not exists traditional_liquor_collector_jobs_batch_idx
  on public.traditional_liquor_collector_jobs (batch_id)
  where batch_id is not null;

alter table public.traditional_liquor_collector_jobs enable row level security;
revoke all on table public.traditional_liquor_collector_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.traditional_liquor_collector_jobs to service_role;

comment on table public.traditional_liquor_collector_jobs is
  'Short-lived, user-initiated browser collection jobs. Only SHA-256 token hashes are stored; results enter staging and never write Production directly.';

commit;
