-- WooHyukmon 4.0 Finance Engine foundation.
-- This schema stores research and audit data only. It does not connect to a broker
-- or permit real-money execution.

create extension if not exists pgcrypto;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  mode text not null check (mode in ('PAPER', 'LIVE')),
  label text not null default 'WooHyukmon Finance',
  experimental_capital_krw numeric not null default 100000 check (experimental_capital_krw >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_email, mode)
);

create table if not exists public.finance_portfolios (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  name text not null,
  strategy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.finance_portfolios(id) on delete cascade,
  symbol text not null,
  quantity numeric not null,
  average_entry_price numeric,
  mode text not null check (mode in ('PAPER', 'LIVE')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.finance_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL')),
  quantity numeric not null check (quantity > 0),
  mode text not null check (mode in ('PAPER', 'LIVE')),
  status text not null default 'PROPOSED' check (status in ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED')),
  strategy_version text not null,
  proposal_token_hash text,
  expires_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_trades (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.finance_orders(id) on delete set null,
  signal_id uuid,
  symbol text not null,
  strategy_version text not null,
  side text not null check (side in ('BUY', 'SELL')),
  mode text not null check (mode in ('PAPER', 'LIVE')),
  entry_time timestamptz,
  exit_time timestamptz,
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  fees numeric not null default 0,
  slippage numeric not null default 0,
  gross_pnl numeric,
  net_pnl numeric,
  pnl_percent numeric,
  mfe numeric,
  mae numeric,
  holding_seconds integer,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  source text not null,
  captured_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.finance_signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  strategy_version text not null,
  action text not null check (action in ('BUY', 'SELL', 'HOLD')),
  confidence numeric,
  market_snapshot_id uuid references public.finance_market_snapshots(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_agent_decisions (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  symbol text not null,
  agent text not null,
  strategy_version text not null,
  action text not null,
  confidence numeric,
  reasoning_summary text,
  market_snapshot_id uuid references public.finance_market_snapshots(id) on delete set null,
  signal_id uuid references public.finance_signals(id) on delete set null
);

create table if not exists public.finance_strategies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_strategy_versions (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.finance_strategies(id) on delete cascade,
  version text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  change_summary text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (strategy_id, version)
);

create table if not exists public.finance_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  strategy_version text,
  mode text not null check (mode in ('PAPER', 'LIVE')),
  measured_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb
);

create table if not exists public.finance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  event_type text not null check (event_type in ('LOGIN', 'V4_ACCESS', 'FINANCE_ACCESS', 'ANALYSIS_REQUEST', 'SIGNAL_CREATED', 'PAPER_ORDER', 'TRADE_PROPOSAL', 'ORDER_APPROVAL', 'ORDER_REJECTION', 'ORDER_EXECUTION', 'STRATEGY_CHANGE')),
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists finance_orders_account_created_idx on public.finance_orders(account_id, created_at desc);
create index if not exists finance_trades_mode_created_idx on public.finance_trades(mode, created_at desc);
create index if not exists finance_signals_symbol_created_idx on public.finance_signals(symbol, created_at desc);
create index if not exists finance_agent_decisions_symbol_created_idx on public.finance_agent_decisions(symbol, timestamp desc);
create index if not exists finance_audit_logs_actor_created_idx on public.finance_audit_logs(actor_email, created_at desc);

alter table public.finance_accounts enable row level security;
alter table public.finance_portfolios enable row level security;
alter table public.finance_positions enable row level security;
alter table public.finance_orders enable row level security;
alter table public.finance_trades enable row level security;
alter table public.finance_market_snapshots enable row level security;
alter table public.finance_signals enable row level security;
alter table public.finance_agent_decisions enable row level security;
alter table public.finance_strategies enable row level security;
alter table public.finance_strategy_versions enable row level security;
alter table public.finance_performance_metrics enable row level security;
alter table public.finance_audit_logs enable row level security;

-- No public RLS policies are created. Browser clients cannot access finance data.
-- Server-side service-role access is intentionally required after developer authorization.

