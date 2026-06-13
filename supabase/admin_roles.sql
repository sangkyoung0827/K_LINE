create table if not exists public.admin_role_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  name text default '',
  reason text default '',
  requested_role text not null default 'super_admin',
  status text not null default 'pending',
  reviewed_by text default '',
  reviewed_at timestamptz
);

create index if not exists admin_role_requests_email_idx
  on public.admin_role_requests (lower(email));

create index if not exists admin_role_requests_status_idx
  on public.admin_role_requests (status);

alter table public.admin_role_requests enable row level security;

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  role text not null default 'super_admin',
  status text not null default 'active',
  granted_by text default '',
  revoked_by text default '',
  revoked_at timestamptz
);

create index if not exists admin_roles_email_idx
  on public.admin_roles (lower(email));

create index if not exists admin_roles_role_status_idx
  on public.admin_roles (role, status);

alter table public.admin_roles enable row level security;
