-- K_LINE user activity history and post-activity rating layer
-- Additive and idempotent. Existing ECC/Hanhwal application flows remain intact.

alter table public.ecc_activity_statuses
  add column if not exists activity_instance_id uuid,
  add column if not exists registration_closed_at timestamptz,
  add column if not exists requires_payment boolean not null default true;

alter table public.hanhwal_activity_statuses
  add column if not exists activity_instance_id uuid,
  add column if not exists registration_closed_at timestamptz,
  add column if not exists requires_payment boolean not null default true;

update public.ecc_activity_statuses
set activity_instance_id = gen_random_uuid()
where activity_instance_id is null;

update public.hanhwal_activity_statuses
set activity_instance_id = gen_random_uuid()
where activity_instance_id is null;

alter table public.ecc_activity_applications
  add column if not exists user_id text,
  add column if not exists activity_instance_id uuid,
  add column if not exists requires_payment boolean not null default true,
  add column if not exists registration_closed_at timestamptz;

alter table public.hanhwal_activity_applications
  add column if not exists user_id text,
  add column if not exists activity_instance_id uuid,
  add column if not exists requires_payment boolean not null default true,
  add column if not exists registration_closed_at timestamptz;

create index if not exists ecc_activity_applications_history_lookup_idx
  on public.ecc_activity_applications (user_id, activity_instance_id)
  where user_id is not null and activity_instance_id is not null;

create index if not exists hanhwal_activity_applications_history_lookup_idx
  on public.hanhwal_activity_applications (user_id, activity_instance_id)
  where user_id is not null and activity_instance_id is not null;

create table if not exists public.user_activity_records (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source text not null check (source in ('ecc', 'hanhwal')),
  activity_id text not null,
  activity_instance_id uuid not null,
  activity_title_snapshot text not null,
  activity_date_snapshot timestamptz,
  eligible_at timestamptz not null,
  rating smallint check (rating is null or rating between 1 and 5),
  rated_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_activity_records_rating_timestamp_check
    check ((rating is null and rated_at is null) or (rating is not null and rated_at is not null))
);

create unique index if not exists user_activity_records_user_source_instance_key
  on public.user_activity_records (user_id, source, activity_instance_id);

create index if not exists user_activity_records_pending_rating_idx
  on public.user_activity_records (user_id, eligible_at asc)
  where rating is null and dismissed_at is null;

create or replace function public.set_user_activity_record_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_activity_records_set_updated_at on public.user_activity_records;

create trigger user_activity_records_set_updated_at
before update on public.user_activity_records
for each row
execute function public.set_user_activity_record_updated_at();

alter table public.user_activity_records enable row level security;

revoke all on table public.user_activity_records from anon, authenticated;
grant usage on schema public to service_role;
grant all privileges on table public.user_activity_records to service_role;

drop policy if exists "Service role manages user activity records"
  on public.user_activity_records;

create policy "Service role manages user activity records"
  on public.user_activity_records
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
