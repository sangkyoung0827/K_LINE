create table if not exists public.ecc_roles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null unique,
  name text default '',
  avatar_url text default '',
  role text not null default 'user',
  is_official_member boolean not null default false,
  payment_confirmed boolean not null default false,
  payment_confirmed_by text default '',
  payment_confirmed_at timestamptz,
  official_member_status text not null default 'none',
  admin_status text not null default 'none',
  admin_requested_at timestamptz,
  admin_approved_by text default '',
  admin_approved_at timestamptz,
  super_admin_status text not null default 'none',
  super_admin_requested_at timestamptz,
  super_admin_approved_by text default '',
  super_admin_approved_at timestamptz
);

create index if not exists ecc_roles_email_idx
  on public.ecc_roles (lower(email));

create index if not exists ecc_roles_official_member_status_idx
  on public.ecc_roles (official_member_status);

create index if not exists ecc_roles_admin_status_idx
  on public.ecc_roles (admin_status);

create index if not exists ecc_roles_super_admin_status_idx
  on public.ecc_roles (super_admin_status);

alter table public.ecc_roles enable row level security;
