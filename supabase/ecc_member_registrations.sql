create table if not exists public.ecc_member_registrations (
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
  status text not null default 'payment_pending'
    check (status in ('submitted', 'payment_pending', 'approved', 'rejected')),
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ecc_member_registrations_google_email_key
  on public.ecc_member_registrations (lower(google_email));

create index if not exists ecc_member_registrations_created_at_idx
  on public.ecc_member_registrations (created_at desc);

create index if not exists ecc_member_registrations_status_idx
  on public.ecc_member_registrations (status);

alter table public.ecc_member_registrations enable row level security;

drop policy if exists "Service role manages ECC member registrations"
  on public.ecc_member_registrations;

create policy "Service role manages ECC member registrations"
  on public.ecc_member_registrations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
