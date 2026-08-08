create table if not exists public.club_board_posts (
  id uuid primary key default gen_random_uuid(),
  board_id text not null check (board_id in ('ecc', 'hanhwal')),
  title text not null,
  author_name text not null default '',
  author_email text not null default '',
  content text not null,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_board_posts_board_created_idx
  on public.club_board_posts (board_id, status, created_at desc);

alter table public.club_board_posts enable row level security;

create table if not exists public.ecc_fund_settings (
  id text primary key default 'ecc',
  bank_name text not null default '',
  account_number text not null default '',
  account_holder text not null default '',
  total_donation_krw bigint not null default 0,
  displayed_balance_krw bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

insert into public.ecc_fund_settings (id)
values ('ecc')
on conflict (id) do nothing;

alter table public.ecc_fund_settings enable row level security;

create table if not exists public.woohyukmon_action_audit (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  action_type text not null,
  target text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists woohyukmon_action_audit_user_created_idx
  on public.woohyukmon_action_audit (user_email, created_at desc);

alter table public.woohyukmon_action_audit enable row level security;

insert into storage.buckets (id, name, public)
values ('woohyukmon-media', 'woohyukmon-media', true)
on conflict (id) do update set public = true;

-- No anon policies are added. K_LINE creates signed upload URLs only after
-- server-side Google login and ECC role checks.
