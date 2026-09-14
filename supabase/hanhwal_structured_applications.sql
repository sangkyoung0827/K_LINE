-- Hanhwal structured applications: competition, equipment order, uniform order.
-- Additive and rerunnable. Existing Hanhwal tables and rows are not modified.
begin;

create table if not exists public.hanhwal_structured_activities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('competition', 'equipment_order', 'uniform_order')),
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  event_date timestamptz,
  location text not null default '',
  deadline timestamptz not null,
  fee_krw bigint check (fee_krw is null or fee_krw >= 0),
  unit_price_krw bigint check (unit_price_krw is null or unit_price_krw >= 0),
  pricing_note text not null default '',
  item_name text not null default '',
  pickup_information text not null default '',
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hanhwal_structured_activities_kind_status_idx
  on public.hanhwal_structured_activities(kind, status, deadline desc);
create index if not exists hanhwal_structured_activities_updated_idx
  on public.hanhwal_structured_activities(updated_at desc);

create table if not exists public.hanhwal_structured_submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.hanhwal_structured_activities(id) on delete restrict,
  kind text not null check (kind in ('competition', 'equipment_order', 'uniform_order')),
  user_email text not null check (user_email = lower(btrim(user_email)) and user_email <> ''),
  user_name text not null default '',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'submitted' check (status in ('submitted', 'cancelled')),
  payment_status text not null default 'unconfirmed' check (payment_status in ('unconfirmed', 'confirmed')),
  fulfillment_status text check (fulfillment_status is null or fulfillment_status in ('ordered', 'ready', 'received')),
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create unique index if not exists hanhwal_structured_submissions_active_user_idx
  on public.hanhwal_structured_submissions(activity_id, lower(user_email))
  where status = 'submitted';
create index if not exists hanhwal_structured_submissions_activity_idx
  on public.hanhwal_structured_submissions(activity_id, status, applied_at);
create index if not exists hanhwal_structured_submissions_user_idx
  on public.hanhwal_structured_submissions(lower(user_email), applied_at desc);

create or replace function public.touch_hanhwal_structured_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_hanhwal_structured_submission()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_activity public.hanhwal_structured_activities;
  v_division jsonb;
  v_capacity integer;
  v_count integer;
begin
  select * into v_activity
  from public.hanhwal_structured_activities
  where id = new.activity_id
  for update;

  if not found then raise exception 'HANHWAL_ACTIVITY_NOT_FOUND'; end if;
  if new.kind <> v_activity.kind then raise exception 'HANHWAL_KIND_MISMATCH'; end if;

  if tg_op = 'INSERT' then
    if v_activity.status <> 'open' or v_activity.deadline <= now() then
      raise exception 'HANHWAL_APPLICATION_CLOSED';
    end if;
    if new.kind = 'competition' then
      select value into v_division
      from jsonb_array_elements(coalesce(v_activity.configuration->'divisions', '[]'::jsonb))
      where value->>'id' = new.payload->>'divisionId'
      limit 1;
      if v_division is null then raise exception 'HANHWAL_INVALID_DIVISION'; end if;
      v_capacity := nullif(v_division->>'capacity', '')::integer;
      if v_capacity is not null then
        select count(*) into v_count
        from public.hanhwal_structured_submissions
        where activity_id = new.activity_id
          and status = 'submitted'
          and id <> new.id
          and payload->>'divisionId' = new.payload->>'divisionId';
        if v_count >= v_capacity then raise exception 'HANHWAL_DIVISION_FULL'; end if;
      end if;
    end if;
  elsif new.kind = 'competition' and new.status = 'submitted' then
    select value into v_division
    from jsonb_array_elements(coalesce(v_activity.configuration->'divisions', '[]'::jsonb))
    where value->>'id' = new.payload->>'divisionId'
    limit 1;
    if v_division is null then raise exception 'HANHWAL_INVALID_DIVISION'; end if;
    v_capacity := nullif(v_division->>'capacity', '')::integer;
    if v_capacity is not null then
      select count(*) into v_count
      from public.hanhwal_structured_submissions
      where activity_id = new.activity_id
        and status = 'submitted'
        and id <> new.id
        and payload->>'divisionId' = new.payload->>'divisionId';
      if v_count >= v_capacity then raise exception 'HANHWAL_DIVISION_FULL'; end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists hanhwal_structured_activities_updated on public.hanhwal_structured_activities;
create trigger hanhwal_structured_activities_updated
before update on public.hanhwal_structured_activities
for each row execute function public.touch_hanhwal_structured_updated_at();

drop trigger if exists hanhwal_structured_submissions_updated on public.hanhwal_structured_submissions;
create trigger hanhwal_structured_submissions_updated
before update on public.hanhwal_structured_submissions
for each row execute function public.touch_hanhwal_structured_updated_at();

drop trigger if exists hanhwal_structured_submissions_validate on public.hanhwal_structured_submissions;
create trigger hanhwal_structured_submissions_validate
before insert or update on public.hanhwal_structured_submissions
for each row execute function public.validate_hanhwal_structured_submission();

alter table public.hanhwal_structured_activities enable row level security;
alter table public.hanhwal_structured_submissions enable row level security;

revoke all on public.hanhwal_structured_activities, public.hanhwal_structured_submissions
  from public, anon, authenticated;
grant all on public.hanhwal_structured_activities, public.hanhwal_structured_submissions
  to service_role;
revoke all on function public.touch_hanhwal_structured_updated_at()
  from public, anon, authenticated;
revoke all on function public.validate_hanhwal_structured_submission()
  from public, anon, authenticated;

-- Competition applications are preference signals. Orders are intentionally excluded.
do $$
begin
  if to_regclass('public.activity_preference_activity_map') is not null then
    insert into public.activity_preference_activity_map
      (source, activity_id, canonical_title, categories, tags)
    values
      ('hanhwal', 'competition', 'Hanhwal Archery Competition',
       array['sports', 'culture_tradition'], array['archery', 'competition'])
    on conflict (source, activity_id) do nothing;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
