-- Hanhwal-only additive migration. Run before deploying the matching application.
begin;

create table if not exists public.hanhwal_registration_content (
  id text primary key,
  title text not null default '',
  body text not null default '',
  updated_by text default '',
  updated_at timestamptz not null default now()
);

-- Preserve legacy IDs and records, allowing administrator-created activities.
alter table public.hanhwal_activity_applications
  drop constraint if exists hanhwal_activity_applications_activity_check;
alter table public.hanhwal_activity_statuses
  drop constraint if exists hanhwal_activity_statuses_activity_check;
alter table public.hanhwal_activity_statuses
  add column if not exists activity_instance_id uuid,
  add column if not exists registration_closed_at timestamptz,
  add column if not exists requires_payment boolean not null default true;
alter table public.hanhwal_activity_applications
  add column if not exists user_id text,
  add column if not exists activity_instance_id uuid,
  add column if not exists requires_payment boolean not null default true,
  add column if not exists registration_closed_at timestamptz;
update public.hanhwal_activity_statuses
set activity_instance_id = gen_random_uuid()
where activity_instance_id is null;
create index if not exists hanhwal_activity_applications_history_lookup_idx
  on public.hanhwal_activity_applications (user_id, activity_instance_id)
  where user_id is not null and activity_instance_id is not null;

create table if not exists public.hanhwal_alumni_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by text,
  is_pinned boolean not null default false,
  visibility text not null default 'public'
    check (visibility in ('public', 'logged_in_only', 'alumni_only', 'official_member_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hanhwal_alumni_activity_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  name text not null,
  email text not null,
  kakao_display_name text not null,
  current_status text not null,
  requested_activity text not null,
  message text not null,
  availability text,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'approved', 'rejected', 'replied')),
  admin_note text,
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hanhwal_rejoin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  google_email text not null,
  google_name text,
  google_avatar_url text,
  full_name text not null,
  student_id text,
  department_or_major text not null,
  nationality text not null,
  kakao_display_name text not null,
  kakao_id text not null,
  current_status text not null,
  message text,
  status text not null default 'submitted'
    check (status in ('submitted', 'payment_pending', 'payment_confirmed', 'approved', 'rejected')),
  payment_confirmed boolean not null default false,
  payment_confirmed_by text,
  payment_confirmed_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hanhwal_alumni_notices_created_idx
  on public.hanhwal_alumni_notices (is_pinned desc, created_at desc);
create index if not exists hanhwal_alumni_inquiries_email_idx
  on public.hanhwal_alumni_activity_inquiries (email, created_at desc);
create index if not exists hanhwal_rejoin_requests_email_idx
  on public.hanhwal_rejoin_requests (google_email, created_at desc);

-- All requests pass through the organization's server-side access checks.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hanhwal_registration_content', 'hanhwal_alumni_notices',
    'hanhwal_alumni_activity_inquiries', 'hanhwal_rejoin_requests'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('drop policy if exists "Service role only" on public.%I', table_name);
    execute format('create policy "Service role only" on public.%I for all to service_role using (true) with check (true)', table_name);
  end loop;
end $$;

-- Registration and club permissions reset atomically; no other data is deleted.
create or replace function public.reset_hanhwal_member_registration(target_email text)
returns void language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(target_email), '') is null then
    raise exception 'A member email is required';
  end if;
  delete from public.hanhwal_member_registrations
    where lower(google_email) = lower(trim(target_email));
  delete from public.hanhwal_roles
    where lower(email) = lower(trim(target_email));
end $$;
revoke all on function public.reset_hanhwal_member_registration(text) from public, anon, authenticated;
grant execute on function public.reset_hanhwal_member_registration(text) to service_role;

notify pgrst, 'reload schema';
commit;
