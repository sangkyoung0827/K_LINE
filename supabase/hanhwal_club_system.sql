begin;

create extension if not exists pgcrypto;

create table if not exists public.hanhwal_roles (
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
  super_admin_approved_at timestamptz,
  constraint hanhwal_roles_role_check
    check (role in ('user', 'official_member', 'admin', 'super_admin', 'developer')),
  constraint hanhwal_roles_official_status_check
    check (official_member_status in ('none', 'requested', 'approved', 'rejected')),
  constraint hanhwal_roles_admin_status_check
    check (admin_status in ('none', 'requested', 'approved', 'rejected')),
  constraint hanhwal_roles_super_admin_status_check
    check (super_admin_status in ('none', 'requested', 'approved', 'rejected'))
);

create unique index if not exists hanhwal_roles_lower_email_key
  on public.hanhwal_roles (lower(email));
create index if not exists hanhwal_roles_official_status_idx
  on public.hanhwal_roles (official_member_status);
create index if not exists hanhwal_roles_admin_status_idx
  on public.hanhwal_roles (admin_status);
create index if not exists hanhwal_roles_super_admin_status_idx
  on public.hanhwal_roles (super_admin_status);

create table if not exists public.hanhwal_member_registrations (
  id uuid primary key default gen_random_uuid(),
  site_member_id uuid references public.site_members(id) on delete set null,
  google_email text not null,
  google_name text default '',
  google_avatar_url text default '',
  full_name text not null,
  student_id text not null,
  department_or_major text not null,
  nationality text not null,
  gender text not null,
  kakao_display_name text not null,
  kakao_id text not null,
  payment_confirmed boolean not null default false,
  payment_confirmed_by text default '',
  payment_confirmed_at timestamptz,
  official_member boolean not null default false,
  official_member_approved_by text default '',
  official_member_approved_at timestamptz,
  status text not null default 'payment_pending',
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hanhwal_member_registrations_status_check
    check (status in ('submitted', 'payment_pending', 'approved', 'rejected'))
);

create unique index if not exists hanhwal_member_registrations_lower_email_key
  on public.hanhwal_member_registrations (lower(google_email));
create index if not exists hanhwal_member_registrations_created_at_idx
  on public.hanhwal_member_registrations (created_at desc);
create index if not exists hanhwal_member_registrations_status_idx
  on public.hanhwal_member_registrations (status);

create table if not exists public.hanhwal_activity_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  activity_id text not null,
  activity_title text not null,
  name text not null,
  gender text not null,
  nationality text not null,
  preferred_food text not null,
  other_requests text default '',
  status text not null default 'pending',
  constraint hanhwal_activity_applications_activity_check
    check (activity_id in ('gathering', 'mt', 'special', 'opening', 'farewell', 'english-class')),
  constraint hanhwal_activity_applications_status_check
    check (status in ('pending', 'paid'))
);

create index if not exists hanhwal_activity_applications_activity_created_idx
  on public.hanhwal_activity_applications (activity_id, created_at desc);
create index if not exists hanhwal_activity_applications_status_idx
  on public.hanhwal_activity_applications (status);

create table if not exists public.hanhwal_activity_statuses (
  activity_id text primary key,
  is_open boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text default '',
  constraint hanhwal_activity_statuses_activity_check
    check (activity_id in ('gathering', 'mt', 'special', 'opening', 'farewell', 'english-class'))
);

insert into public.hanhwal_activity_statuses (activity_id, is_open)
values
  ('gathering', false),
  ('mt', false),
  ('special', false),
  ('opening', false),
  ('farewell', false),
  ('english-class', false)
on conflict (activity_id) do nothing;

create table if not exists public.hanhwal_fund_settings (
  id text primary key default 'hanhwal',
  bank_name text not null default '',
  account_number text not null default '',
  account_holder text not null default '',
  total_donation_krw bigint not null default 0,
  displayed_balance_krw bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  constraint hanhwal_fund_settings_nonnegative_check
    check (total_donation_krw >= 0 and displayed_balance_krw >= 0)
);

insert into public.hanhwal_fund_settings (id)
values ('hanhwal')
on conflict (id) do nothing;

alter table public.hanhwal_roles enable row level security;
alter table public.hanhwal_member_registrations enable row level security;
alter table public.hanhwal_activity_applications enable row level security;
alter table public.hanhwal_activity_statuses enable row level security;
alter table public.hanhwal_fund_settings enable row level security;

revoke all on table public.hanhwal_roles from anon, authenticated;
revoke all on table public.hanhwal_member_registrations from anon, authenticated;
revoke all on table public.hanhwal_activity_applications from anon, authenticated;
revoke all on table public.hanhwal_activity_statuses from anon, authenticated;
revoke all on table public.hanhwal_fund_settings from anon, authenticated;

grant all on table public.hanhwal_roles to service_role;
grant all on table public.hanhwal_member_registrations to service_role;
grant all on table public.hanhwal_activity_applications to service_role;
grant all on table public.hanhwal_activity_statuses to service_role;
grant all on table public.hanhwal_fund_settings to service_role;

drop policy if exists "Service role manages Hanhwal roles" on public.hanhwal_roles;
create policy "Service role manages Hanhwal roles"
  on public.hanhwal_roles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages Hanhwal member registrations"
  on public.hanhwal_member_registrations;
create policy "Service role manages Hanhwal member registrations"
  on public.hanhwal_member_registrations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages Hanhwal applications"
  on public.hanhwal_activity_applications;
create policy "Service role manages Hanhwal applications"
  on public.hanhwal_activity_applications for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages Hanhwal activity statuses"
  on public.hanhwal_activity_statuses;
create policy "Service role manages Hanhwal activity statuses"
  on public.hanhwal_activity_statuses for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages Hanhwal fund settings"
  on public.hanhwal_fund_settings;
create policy "Service role manages Hanhwal fund settings"
  on public.hanhwal_fund_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

commit;
