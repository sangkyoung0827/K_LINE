-- K_LINE Explore tracking extension
-- Run this after supabase/jeju_explorer.sql.
-- It is idempotent and adds no sample data.

create table if not exists public.jeju_explore_sessions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists jeju_explore_sessions_one_active_per_user_idx
  on public.jeju_explore_sessions (user_email)
  where ended_at is null;

create index if not exists jeju_explore_sessions_user_started_idx
  on public.jeju_explore_sessions (user_email, started_at desc);

create table if not exists public.jeju_explore_track_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.jeju_explore_sessions(id) on delete cascade,
  user_email text not null,
  latitude numeric(8, 4) not null check (latitude between 32.7 and 34.1),
  longitude numeric(9, 4) not null check (longitude between 125.7 and 127.5),
  accuracy_meters integer check (accuracy_meters is null or accuracy_meters between 0 and 10000),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists jeju_explore_track_points_session_time_idx
  on public.jeju_explore_track_points (session_id, recorded_at asc);

create index if not exists jeju_explore_track_points_user_time_idx
  on public.jeju_explore_track_points (user_email, recorded_at desc);

create table if not exists public.jeju_personal_place_records (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  google_place_id text not null,
  place_name text not null,
  formatted_address text not null default '',
  category text not null default 'other',
  latitude numeric(8, 4) not null check (latitude between 32.7 and 34.1),
  longitude numeric(9, 4) not null check (longitude between 125.7 and 127.5),
  rating smallint not null check (rating between 1 and 5),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jeju_personal_place_records_user_google_place_idx
  on public.jeju_personal_place_records (user_email, google_place_id);

create index if not exists jeju_personal_place_records_user_updated_idx
  on public.jeju_personal_place_records (user_email, updated_at desc);

create table if not exists public.jeju_personal_place_record_photos (
  id uuid primary key default gen_random_uuid(),
  personal_place_record_id uuid not null references public.jeju_personal_place_records(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists jeju_personal_place_record_photos_record_idx
  on public.jeju_personal_place_record_photos (personal_place_record_id, created_at asc);

alter table public.jeju_explore_sessions enable row level security;
alter table public.jeju_explore_track_points enable row level security;
alter table public.jeju_personal_place_records enable row level security;
alter table public.jeju_personal_place_record_photos enable row level security;

-- K_LINE server routes use SUPABASE_SERVICE_ROLE_KEY. Browser clients never
-- receive database credentials and have no direct table policies.
grant usage on schema public to service_role;
grant all privileges on table
  public.jeju_explore_sessions,
  public.jeju_explore_track_points,
  public.jeju_personal_place_records,
  public.jeju_personal_place_record_photos
to service_role;
