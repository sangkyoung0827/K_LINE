create table if not exists public.ecc_alumni_notices (
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

create table if not exists public.ecc_alumni_activity_inquiries (
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

create table if not exists public.ecc_rejoin_requests (
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

create table if not exists public.ecc_membership_history (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  previous_role text,
  new_status text not null default 'previous_member'
    check (new_status in ('previous_member', 'alumni')),
  changed_by text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.ecc_alumni_notices enable row level security;
alter table public.ecc_alumni_activity_inquiries enable row level security;
alter table public.ecc_rejoin_requests enable row level security;
alter table public.ecc_membership_history enable row level security;

drop policy if exists "Public can read public alumni notices" on public.ecc_alumni_notices;
create policy "Public can read public alumni notices"
  on public.ecc_alumni_notices
  for select
  using (visibility = 'public');

-- K_LINE server routes use SUPABASE_SERVICE_ROLE_KEY for authenticated writes and admin reads.
-- Do not add public write policies for inquiries or rejoin requests unless a separate
-- spam-protected public submission flow is intentionally introduced.
