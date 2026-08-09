-- WooHyukmon 4.0 original-algorithm port history.
-- Run after woohyukmon_v4_finance.sql. Browser clients receive no policies.

create table if not exists public.finance_analysis_runs (
  id uuid primary key,
  symbol text not null,
  strategy_version text not null,
  mode text not null check (mode in ('PAPER', 'LIVE')),
  summary text not null,
  normalized_result jsonb not null,
  raw_result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists finance_analysis_runs_created_idx
  on public.finance_analysis_runs(created_at desc);
create index if not exists finance_analysis_runs_symbol_created_idx
  on public.finance_analysis_runs(symbol, created_at desc);

alter table public.finance_analysis_runs enable row level security;
-- No public RLS policy: only the server-side service role may read/write after V4 authorization.
