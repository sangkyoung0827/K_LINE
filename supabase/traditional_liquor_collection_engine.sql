-- Traditional Liquor Data Collection Engine V1
-- Run after supabase/traditional_liquor_market.sql.

begin;

create table if not exists public.traditional_liquor_collection_queries (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  normalized_query text not null,
  query_type text not null check (query_type in ('GENERAL','CATEGORY','PRODUCT','BRAND','BREWERY','DISCOVERY')),
  priority integer not null default 50 check (priority between 0 and 1000),
  is_active boolean not null default true,
  last_collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_query, query_type)
);

create index if not exists traditional_liquor_collection_queries_queue_idx
  on public.traditional_liquor_collection_queries (is_active, priority desc, normalized_query);

drop trigger if exists traditional_liquor_collection_queries_updated_at on public.traditional_liquor_collection_queries;
create trigger traditional_liquor_collection_queries_updated_at
before update on public.traditional_liquor_collection_queries
for each row execute function public.set_traditional_liquor_updated_at();

alter table public.traditional_liquor_collection_queries enable row level security;
revoke all on table public.traditional_liquor_collection_queries from anon, authenticated;
grant select, insert, update, delete on table public.traditional_liquor_collection_queries to service_role;

create table if not exists public.traditional_liquor_collection_runs (
  id uuid primary key default gen_random_uuid(),
  query_id uuid references public.traditional_liquor_collection_queries(id) on delete set null,
  batch_id uuid not null unique references public.traditional_liquor_import_batches(id) on delete restrict,
  query_text text not null,
  source_code text not null,
  status text not null default 'RUNNING' check (status in ('RUNNING','READY','FAILED')),
  pages_scanned integer not null default 1 check (pages_scanned >= 0),
  offers_found integer not null default 0 check (offers_found >= 0),
  valid_offers integer not null default 0 check (valid_offers >= 0),
  invalid_offers integer not null default 0 check (invalid_offers >= 0),
  started_at timestamptz not null,
  finished_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at)
);

create index if not exists traditional_liquor_collection_runs_recent_idx
  on public.traditional_liquor_collection_runs (created_at desc, status);
alter table public.traditional_liquor_collection_runs enable row level security;
revoke all on table public.traditional_liquor_collection_runs from anon, authenticated;
grant select, insert, update, delete on table public.traditional_liquor_collection_runs to service_role;

insert into public.traditional_liquor_collection_queries (query, normalized_query, query_type, priority)
values
  ('전통주', '전통주', 'GENERAL', 100),
  ('막걸리', '막걸리', 'CATEGORY', 90),
  ('탁주', '탁주', 'CATEGORY', 90),
  ('약주', '약주', 'CATEGORY', 90),
  ('청주', '청주', 'CATEGORY', 90),
  ('과실주', '과실주', 'CATEGORY', 90),
  ('증류주', '증류주', 'CATEGORY', 90),
  ('증류식 소주', '증류식 소주', 'CATEGORY', 90),
  ('리큐르', '리큐르', 'CATEGORY', 80),
  ('안동소주', '안동소주', 'PRODUCT', 80),
  ('문배주', '문배주', 'PRODUCT', 80),
  ('이강주', '이강주', 'PRODUCT', 80),
  ('감홍로', '감홍로', 'PRODUCT', 80),
  ('복순도가', '복순도가', 'BRAND', 80)
on conflict (normalized_query, query_type) do update
set query = excluded.query,
    priority = excluded.priority;

commit;
