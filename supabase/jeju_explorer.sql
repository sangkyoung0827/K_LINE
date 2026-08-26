-- K_LINE Jeju Explorer MVP
-- This migration is intentionally isolated from ECC, Hanhwal, club boards, and
-- existing K_LINE profile tables. It can be run more than once safely.

create table if not exists public.jeju_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'user'
    check (role in ('user', 'supporter', 'jeju_admin')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  granted_by text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jeju_places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text not null default '',
  category text not null
    check (category in ('restaurant', 'cafe', 'attraction', 'hidden_spot', 'shopping', 'culture', 'nature', 'other')),
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  address text not null default '',
  description text not null default '',
  description_en text not null default '',
  thumbnail_url text not null default '',
  thumbnail_path text not null default '',
  average_rating numeric(3, 2) not null default 0,
  review_count integer not null default 0,
  recommendation_percentage numeric(5, 2) not null default 0,
  price_range text not null default 'unknown'
    check (price_range in ('budget', 'moderate', 'premium', 'unknown')),
  atmosphere text not null default '',
  food_features text[] not null default '{}',
  recommended_menu text[] not null default '{}',
  allergy_info text not null default '',
  vegetarian_supported boolean not null default false,
  vegan_supported boolean not null default false,
  english_friendly boolean not null default false,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jeju_user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_email text not null unique,
  site_member_id uuid references public.site_members(id) on delete set null,
  display_name text not null default '',
  allergies text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  vegetarian boolean not null default false,
  vegan boolean not null default false,
  spicy_food_preference text not null default 'medium'
    check (spicy_food_preference in ('none', 'mild', 'medium', 'high')),
  seafood_preference text not null default 'neutral'
    check (seafood_preference in ('avoid', 'neutral', 'like')),
  budget_preference text not null default 'moderate'
    check (budget_preference in ('budget', 'moderate', 'premium')),
  preferred_foods text[] not null default '{}',
  preferred_activities text[] not null default '{}',
  places_want_to_visit text[] not null default '{}',
  food_want_to_try text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jeju_visits (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  place_id uuid not null references public.jeju_places(id) on delete cascade,
  visited_at timestamptz not null default now(),
  -- Coordinates are optional and stored only at a privacy-preserving rounded precision.
  checkin_latitude numeric(8, 3),
  checkin_longitude numeric(9, 3),
  checkin_distance_meters integer,
  checkin_method text not null default 'gps'
    check (checkin_method in ('gps', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jeju_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.jeju_places(id) on delete cascade,
  visit_id uuid references public.jeju_visits(id) on delete set null,
  user_email text not null,
  display_name text not null default '',
  overall_rating smallint not null check (overall_rating between 1 and 5),
  food_rating smallint check (food_rating between 1 and 5),
  price_rating smallint not null check (price_rating between 1 and 5),
  atmosphere_rating smallint not null check (atmosphere_rating between 1 and 5),
  what_liked text not null default '',
  could_be_better text not null default '',
  review_text text not null default '',
  would_recommend boolean not null default true,
  is_public boolean not null default true,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_email)
);

create table if not exists public.jeju_review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.jeju_reviews(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.jeju_memories (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  place_id uuid references public.jeju_places(id) on delete set null,
  visit_id uuid references public.jeju_visits(id) on delete set null,
  title text not null default '',
  note text not null default '',
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id)
);

create table if not exists public.jeju_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  title_en text not null default '',
  description text not null default '',
  description_en text not null default '',
  semester text not null,
  capacity_min integer not null default 25 check (capacity_min >= 1),
  capacity_max integer not null default 35 check (capacity_max >= capacity_min),
  starts_at timestamptz,
  ends_at timestamptz,
  meeting_place text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'completed')),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jeju_program_applications (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.jeju_programs(id) on delete cascade,
  user_email text not null,
  display_name text not null default '',
  allergies text[] not null default '{}',
  food_preferences text[] not null default '{}',
  foods_want_to_try text[] not null default '{}',
  restaurants_want_to_visit text[] not null default '{}',
  attractions_want_to_visit text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  spicy_food_tolerance text not null default 'medium',
  seafood_preference text not null default 'neutral',
  budget_preference text not null default 'moderate',
  interested_activities text[] not null default '{}',
  status text not null default 'submitted'
    check (status in ('submitted', 'waitlist', 'approved', 'rejected', 'cancelled')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, user_email)
);

create table if not exists public.jeju_program_candidates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.jeju_programs(id) on delete cascade,
  place_id uuid references public.jeju_places(id) on delete set null,
  name text not null,
  description text not null default '',
  is_selected boolean not null default false,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jeju_program_votes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.jeju_program_candidates(id) on delete cascade,
  user_email text not null,
  created_at timestamptz not null default now(),
  unique (candidate_id, user_email)
);

create table if not exists public.jeju_program_teams (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.jeju_programs(id) on delete cascade,
  team_name text not null,
  restaurant text not null default '',
  supporter_email text not null default '',
  meeting_time timestamptz,
  meeting_place text not null default '',
  nearby_attraction text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, team_name)
);

create table if not exists public.jeju_program_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.jeju_program_teams(id) on delete cascade,
  user_email text not null,
  role text not null default 'participant'
    check (role in ('participant', 'supporter')),
  created_at timestamptz not null default now(),
  unique (team_id, user_email)
);

create table if not exists public.jeju_program_activity_logs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.jeju_programs(id) on delete cascade,
  team_id uuid references public.jeju_program_teams(id) on delete set null,
  place_id uuid references public.jeju_places(id) on delete set null,
  user_email text not null,
  activity_type text not null check (activity_type in ('restaurant', 'attraction')),
  overall_rating smallint check (overall_rating between 1 and 5),
  food_rating smallint check (food_rating between 1 and 5),
  price_rating smallint check (price_rating between 1 and 5),
  atmosphere_rating smallint check (atmosphere_rating between 1 and 5),
  strengths text not null default '',
  weaknesses text not null default '',
  review_text text not null default '',
  would_recommend boolean,
  favorite_menu text not null default '',
  additional_comments text not null default '',
  photo_urls text[] not null default '{}',
  consent_to_publish boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jeju_roles_email_idx on public.jeju_roles (lower(email));
create index if not exists jeju_places_category_idx on public.jeju_places (category, is_active);
create index if not exists jeju_places_location_idx on public.jeju_places (latitude, longitude);
create index if not exists jeju_visits_user_created_idx on public.jeju_visits (user_email, created_at desc);
create index if not exists jeju_visits_place_idx on public.jeju_visits (place_id, visited_at desc);
create index if not exists jeju_reviews_place_idx on public.jeju_reviews (place_id, created_at desc);
create index if not exists jeju_reviews_user_idx on public.jeju_reviews (user_email, created_at desc);
create index if not exists jeju_memories_user_idx on public.jeju_memories (user_email, created_at desc);
create index if not exists jeju_programs_status_idx on public.jeju_programs (status, starts_at);
create index if not exists jeju_program_applications_program_idx on public.jeju_program_applications (program_id, created_at desc);
create index if not exists jeju_program_applications_user_idx on public.jeju_program_applications (user_email, created_at desc);
create index if not exists jeju_program_votes_candidate_idx on public.jeju_program_votes (candidate_id);

create or replace function public.refresh_jeju_place_review_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_place_id uuid;
begin
  target_place_id := coalesce(new.place_id, old.place_id);

  update public.jeju_places
  set
    average_rating = coalesce((
      select round(avg(overall_rating)::numeric, 2)
      from public.jeju_reviews
      where place_id = target_place_id
        and status = 'published'
        and is_public = true
    ), 0),
    review_count = (
      select count(*)::integer
      from public.jeju_reviews
      where place_id = target_place_id
        and status = 'published'
        and is_public = true
    ),
    recommendation_percentage = coalesce((
      select round(avg(case when would_recommend then 100 else 0 end)::numeric, 2)
      from public.jeju_reviews
      where place_id = target_place_id
        and status = 'published'
        and is_public = true
    ), 0),
    updated_at = now()
  where id = target_place_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists jeju_reviews_refresh_place_stats on public.jeju_reviews;
create trigger jeju_reviews_refresh_place_stats
after insert or update or delete on public.jeju_reviews
for each row execute function public.refresh_jeju_place_review_stats();

alter table public.jeju_roles enable row level security;
alter table public.jeju_places enable row level security;
alter table public.jeju_user_profiles enable row level security;
alter table public.jeju_visits enable row level security;
alter table public.jeju_reviews enable row level security;
alter table public.jeju_review_photos enable row level security;
alter table public.jeju_memories enable row level security;
alter table public.jeju_programs enable row level security;
alter table public.jeju_program_applications enable row level security;
alter table public.jeju_program_candidates enable row level security;
alter table public.jeju_program_votes enable row level security;
alter table public.jeju_program_teams enable row level security;
alter table public.jeju_program_team_members enable row level security;
alter table public.jeju_program_activity_logs enable row level security;

-- K_LINE server routes use SUPABASE_SERVICE_ROLE_KEY. No browser client receives
-- direct database credentials, and no public table policy is needed for this module.
-- Keep this grant intentionally limited to the new Jeju Explorer tables.
grant usage on schema public to service_role;
grant all privileges on table
  public.jeju_roles,
  public.jeju_places,
  public.jeju_user_profiles,
  public.jeju_visits,
  public.jeju_reviews,
  public.jeju_review_photos,
  public.jeju_memories,
  public.jeju_programs,
  public.jeju_program_applications,
  public.jeju_program_candidates,
  public.jeju_program_votes,
  public.jeju_program_teams,
  public.jeju_program_team_members,
  public.jeju_program_activity_logs
to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jeju-media',
  'jeju-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read Jeju Explorer media" on storage.objects;
create policy "Public can read Jeju Explorer media"
on storage.objects
for select
to public
using (bucket_id = 'jeju-media');

-- Keep existing stored review statistics correct if this migration is run later.
update public.jeju_places place
set
  average_rating = coalesce((
    select round(avg(review.overall_rating)::numeric, 2)
    from public.jeju_reviews review
    where review.place_id = place.id
      and review.status = 'published'
      and review.is_public = true
  ), 0),
  review_count = (
    select count(*)::integer
    from public.jeju_reviews review
    where review.place_id = place.id
      and review.status = 'published'
      and review.is_public = true
  ),
  recommendation_percentage = coalesce((
    select round(avg(case when review.would_recommend then 100 else 0 end)::numeric, 2)
    from public.jeju_reviews review
    where review.place_id = place.id
      and review.status = 'published'
      and review.is_public = true
  ), 0),
  updated_at = now();
