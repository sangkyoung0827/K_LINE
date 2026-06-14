create table if not exists public.ecc_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  kakao_id text not null,
  email text default '',
  phone text default '',
  nationality text default '',
  note text default '',
  membership_fee_paid boolean not null default false,
  team_chat_sent boolean not null default false,
  team_chat_url text default '',
  qr_code_url text default '',
  payment_note text default '',
  status text not null default 'pending'
);

alter table public.ecc_members enable row level security;
