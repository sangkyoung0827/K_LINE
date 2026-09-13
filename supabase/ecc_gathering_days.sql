-- ECC International Gathering weekday options. Safe to run more than once.
-- Existing applicants are left with NULL (no historical weekday inferred).
begin;

alter table public.ecc_activity_statuses
  add column if not exists gathering_open_days text[] not null
  default array['monday', 'wednesday']::text[];

alter table public.ecc_activity_applications
  add column if not exists gathering_days text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ecc_activity_statuses'::regclass and conname = 'ecc_gathering_open_days_valid') then
    alter table public.ecc_activity_statuses add constraint ecc_gathering_open_days_valid
      check (gathering_open_days <@ array['monday','wednesday']::text[]
        and cardinality(gathering_open_days) <= 2
        and array_position(gathering_open_days, null) is null
        and (cardinality(gathering_open_days) < 2 or gathering_open_days[1] <> gathering_open_days[2]));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ecc_activity_applications'::regclass and conname = 'ecc_gathering_days_valid') then
    alter table public.ecc_activity_applications add constraint ecc_gathering_days_valid
      check (gathering_days is null or (
        activity_id = 'gathering'
        and gathering_days <@ array['monday','wednesday']::text[]
        and cardinality(gathering_days) between 1 and 2
        and array_position(gathering_days, null) is null
        and (cardinality(gathering_days) = 1 or gathering_days[1] <> gathering_days[2])
      ));
  end if;
end $$;

-- Do not alter the existing activity's open/closed state.
insert into public.ecc_activity_statuses (activity_id, is_open)
values ('gathering', false) on conflict (activity_id) do nothing;

create or replace function public.validate_ecc_gathering_days()
returns trigger language plpgsql set search_path = public as $$
declare
  allowed_days text[];
  accepting boolean;
begin
  -- Payment/note updates to historical registrations must remain valid.
  if tg_op = 'UPDATE' then
    if new.activity_id is not distinct from old.activity_id
       and new.gathering_days is not distinct from old.gathering_days then
      return new;
    end if;
  end if;
  if new.activity_id <> 'gathering' then return new; end if;

  -- Permit legacy clients during migration-first rollout. The new application
  -- API requires a nonempty selection; existing versions still submit NULL.
  if new.gathering_days is null then return new; end if;

  -- Serialize inserts with day/activity closure so stale browser forms cannot
  -- insert a closed day between the API's availability check and DB insert.
  select gathering_open_days, is_open into allowed_days, accepting
  from public.ecc_activity_statuses where activity_id = 'gathering' for share;
  if not found or accepting is not true or not (new.gathering_days <@ allowed_days) then
    raise exception 'ECC_GATHERING_DAYS_CLOSED' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.validate_ecc_gathering_days() from public;
drop trigger if exists ecc_gathering_days_guard on public.ecc_activity_applications;
create trigger ecc_gathering_days_guard
before insert or update of activity_id, gathering_days on public.ecc_activity_applications
for each row execute function public.validate_ecc_gathering_days();

-- Existing RLS policies and grants remain unchanged. Browser clients do not
-- gain permission to edit settings or applications directly.
notify pgrst, 'reload schema';
commit;
