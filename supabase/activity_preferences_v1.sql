-- Activity interests only: applications and explicit ratings, never attendance.
-- Additive, rerunnable; no existing source tables, rows, grants or policies change.
begin;

create table if not exists public.activity_preference_activity_map (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  activity_id text not null,
  canonical_title text not null,
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  classification_source text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (source, activity_id),
  check (source <> '' and activity_id <> ''),
  check (categories <@ array['social_networking','party_nightlife','culture_tradition','travel','food','outdoor','sports','wellness','volunteering','education','career','creative','language_exchange','local_exploration']::text[]),
  check (array_position(categories, null) is null and array_position(tags, null) is null)
);

create table if not exists public.activity_preference_events (
  id uuid primary key default gen_random_uuid(),
  user_key text not null check (user_key <> '' and user_key = lower(btrim(user_key))),
  source text not null,
  activity_id text not null,
  activity_instance_id uuid,
  source_event_key text not null unique,
  event_type text not null check (event_type in ('applied', 'rating_submitted')),
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  rating smallint,
  base_weight numeric not null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (metadata = '{}'::jsonb),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source <> '' and activity_id <> '' and source_event_key <> ''),
  check ((event_type = 'applied' and rating is null)
    or (event_type = 'rating_submitted' and rating is not null and rating between 1 and 5)),
  check (categories <@ array['social_networking','party_nightlife','culture_tradition','travel','food','outdoor','sports','wellness','volunteering','education','career','creative','language_exchange','local_exploration']::text[]),
  check (array_position(categories, null) is null and array_position(tags, null) is null)
);
create index if not exists activity_preference_events_user_idx on public.activity_preference_events(user_key);
create index if not exists activity_preference_events_activity_idx on public.activity_preference_events(source, activity_id);
create index if not exists activity_preference_events_type_idx on public.activity_preference_events(event_type);
create index if not exists activity_preference_events_time_idx on public.activity_preference_events(occurred_at);

create table if not exists public.user_activity_preferences (
  user_key text not null,
  dimension_type text not null check (dimension_type in ('category','tag')),
  dimension_key text not null,
  raw_score numeric not null default 0,
  affinity_score numeric not null default 50 check (affinity_score between 0 and 100),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  signal_count integer not null default 0,
  application_count integer not null default 0,
  rating_count integer not null default 0,
  average_rating numeric,
  last_signal_at timestamptz,
  model_version text not null,
  updated_at timestamptz not null default now(),
  primary key (user_key, dimension_type, dimension_key)
);
create index if not exists user_activity_preferences_dimension_idx on public.user_activity_preferences(dimension_type, dimension_key);

-- Per-user lock and coherent counts, including unclassified events. No source-row FK:
-- the original application reset behavior must not erase interest history.
create table if not exists public.activity_preference_profile_state (
  user_key text primary key,
  application_count integer not null default 0,
  rating_count integer not null default 0,
  unmapped_count integer not null default 0,
  model_version text not null default 'v1',
  computed_at timestamptz
);
create table if not exists public.activity_preference_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','completed','failed')),
  model_version text not null,
  summary jsonb not null default '{}'::jsonb
);

create or replace function public.touch_activity_preference_mapping()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists activity_preference_map_updated on public.activity_preference_activity_map;
create trigger activity_preference_map_updated before update on public.activity_preference_activity_map
for each row execute function public.touch_activity_preference_mapping();

-- Preserve administrator classifications on repeated migration runs.
-- Evidence: eccOperations catalog + EccActivityPanel descriptions; no nightlife inferred.
insert into public.activity_preference_activity_map(source, activity_id, canonical_title, categories, tags)
values
 ('ecc','opening','Semester Opening Party',array['social_networking'],array['new_semester','networking']),
 ('ecc','gathering','International Gathering',array['social_networking'],array['international_exchange','networking']),
 ('ecc','farewell','Farewell Party',array['social_networking'],array['semester_closing','networking']),
 ('ecc','english-class','English Class',array['education','language_exchange'],array['english_learning']),
 -- MT and Special Event descriptions do not establish a specific activity format.
 ('ecc','mt','MT','{}','{}'),
 ('ecc','special','Special Event','{}','{}'),
 -- Evidence: HanhwalActivityPanel descriptions explicitly say Korean archery.
 ('hanhwal','gathering','Regular Archery Practice',array['sports','culture_tradition'],array['archery','traditional_culture']),
 ('hanhwal','mt','Hanhwal Training Camp',array['sports','culture_tradition'],array['archery','traditional_culture']),
 ('hanhwal','special','Traditional Archery Event',array['sports','culture_tradition'],array['archery','traditional_culture']),
 ('hanhwal','opening','Semester Opening Practice',array['sports','culture_tradition'],array['archery','new_semester']),
 ('hanhwal','farewell','Semester Closing Practice',array['sports','culture_tradition'],array['archery','semester_closing']),
 ('hanhwal','english-class','Beginner Archery Class',array['sports','culture_tradition','education'],array['archery','beginner'])
on conflict(source,activity_id) do nothing;

create or replace function public.record_activity_preference_event(p_event jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  v public.activity_preference_events;
  old_event public.activity_preference_events;
  mapped public.activity_preference_activity_map;
  new_id uuid;
begin
  v := jsonb_populate_record(null::public.activity_preference_events, p_event);
  select * into mapped from public.activity_preference_activity_map
    where source = v.source and activity_id = v.activity_id and is_active;
  v.categories := coalesce(mapped.categories, '{}');
  v.tags := coalesce(mapped.tags, '{}');
  insert into public.activity_preference_events
    (user_key,source,activity_id,activity_instance_id,source_event_key,event_type,categories,tags,rating,base_weight,occurred_at)
  values (v.user_key,v.source,v.activity_id,v.activity_instance_id,v.source_event_key,v.event_type,v.categories,v.tags,v.rating,v.base_weight,v.occurred_at)
  on conflict(source_event_key) do nothing returning id into new_id;
  if new_id is not null then return jsonb_build_object('inserted',true); end if;
  select * into old_event from public.activity_preference_events where source_event_key = v.source_event_key for update;
  if row(old_event.user_key,old_event.source,old_event.activity_id,old_event.activity_instance_id,old_event.event_type,old_event.rating,old_event.occurred_at)
     is distinct from row(v.user_key,v.source,v.activity_id,v.activity_instance_id,v.event_type,v.rating,v.occurred_at) then
    raise exception 'PREFERENCE_EVENT_IDENTITY_CONFLICT';
  end if;
  update public.activity_preference_events set categories=v.categories,tags=v.tags,base_weight=v.base_weight,updated_at=now()
    where source_event_key=v.source_event_key and
      row(categories,tags,base_weight) is distinct from row(v.categories,v.tags,v.base_weight);
  return jsonb_build_object('inserted',false);
end;
$$;

-- Config constants are supplied by the server's versioned config.ts, not an LLM.
-- Transactional per-user aggregation prevents concurrent hooks losing updates.
create or replace function public.recompute_activity_preferences(
  p_user_key text, p_as_of timestamptz, p_model_version text,
  p_half_life_days double precision, p_affinity_scale double precision, p_confidence_scale double precision
)
returns void language plpgsql set search_path = public, pg_temp as $$
declare v_events jsonb;
begin
  if p_user_key = '' or p_user_key <> lower(btrim(p_user_key)) or p_as_of is null
    or p_half_life_days <= 0 or p_affinity_scale <= 0 or p_confidence_scale <= 0 then
    raise exception 'INVALID_PREFERENCE_CONFIG';
  end if;
  insert into public.activity_preference_profile_state(user_key) values(p_user_key) on conflict do nothing;
  perform 1 from public.activity_preference_profile_state where user_key=p_user_key for update;
  -- Do not move the profile clock backwards when older queued hooks finish later.
  select greatest(p_as_of,coalesce(computed_at,p_as_of),clock_timestamp()) into p_as_of
    from public.activity_preference_profile_state where user_key=p_user_key;
  select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into v_events
    from public.activity_preference_events e where user_key=p_user_key;
  delete from public.user_activity_preferences where user_key=p_user_key;
  insert into public.user_activity_preferences
    (user_key,dimension_type,dimension_key,raw_score,affinity_score,confidence,signal_count,application_count,rating_count,average_rating,last_signal_at,model_version,updated_at)
  with dimensions as (
    select e.*, d.kind,d.key,
      e.base_weight::double precision * power(2::double precision,
        -greatest(0,extract(epoch from (p_as_of-e.occurred_at))/86400)::double precision/p_half_life_days) as weight
    from jsonb_populate_recordset(null::public.activity_preference_events,v_events) e
    cross join lateral (
      select distinct 'category'::text kind, unnest(e.categories) key
      union select distinct 'tag'::text kind, unnest(e.tags) key
    ) d where e.user_key=p_user_key
  ), scores as (
    select kind,key,sum(weight) raw,count(*)::integer signals,
      count(*) filter(where event_type='applied')::integer applications,
      count(*) filter(where event_type='rating_submitted')::integer ratings,
      avg(rating) average_rating,max(occurred_at) last_signal
    from dimensions group by kind,key
  )
  select p_user_key,kind,key,raw,
    100 / (1 + exp(-2 * greatest(-350,least(350,raw/p_affinity_scale)))),
    1-exp(-signals::double precision/p_confidence_scale),
    signals,applications,ratings,average_rating,last_signal,p_model_version,p_as_of from scores;
  update public.activity_preference_profile_state set
    application_count=(select count(*) from jsonb_populate_recordset(null::public.activity_preference_events,v_events) where event_type='applied'),
    rating_count=(select count(*) from jsonb_populate_recordset(null::public.activity_preference_events,v_events) where event_type='rating_submitted'),
    unmapped_count=(select count(*) from jsonb_populate_recordset(null::public.activity_preference_events,v_events) where cardinality(categories)=0 and cardinality(tags)=0),
    model_version=p_model_version,computed_at=p_as_of where user_key=p_user_key;
end;
$$;

create or replace function public.read_activity_preference_profile(p_user_key text)
returns jsonb language sql stable set search_path = public, pg_temp as $$
 select jsonb_build_object(
   'state',(select to_jsonb(s)-'user_key' from public.activity_preference_profile_state s where user_key=p_user_key),
   'dimensions',coalesce((select jsonb_agg(to_jsonb(p)-'user_key') from public.user_activity_preferences p where user_key=p_user_key),'[]'::jsonb)
 );
$$;

create or replace function public.activity_preference_diagnostics()
returns jsonb language sql stable set search_path = public, pg_temp as $$
 select jsonb_build_object(
   'events',(select count(*) from public.activity_preference_events),
   'uniqueEventKeys',(select count(distinct source_event_key) from public.activity_preference_events),
   'applicationEvents',(select count(*) from public.activity_preference_events where event_type='applied'),
   'ratingEvents',(select count(*) from public.activity_preference_events where event_type='rating_submitted'),
   'attendanceEvents',(select count(*) from public.activity_preference_events where event_type not in ('applied','rating_submitted')),
   'profiles',(select count(*) from public.activity_preference_profile_state where computed_at is not null),
   'categoryDimensions',(select count(*) from public.user_activity_preferences where dimension_type='category'),
   'tagDimensions',(select count(*) from public.user_activity_preferences where dimension_type='tag'),
   'mappedActivities',(select count(*) from public.activity_preference_activity_map where is_active and cardinality(categories)+cardinality(tags)>0),
   'unmappedActivities',coalesce((select jsonb_agg(t) from (
     select source,activity_id,count(*) events from public.activity_preference_events
     where cardinality(categories)=0 and cardinality(tags)=0 group by source,activity_id
   ) t),'[]'::jsonb),
   'latestReconciliation',(select to_jsonb(r) from public.activity_preference_reconciliation_runs r order by started_at desc limit 1)
 );
$$;

alter table public.activity_preference_activity_map enable row level security;
alter table public.activity_preference_events enable row level security;
alter table public.user_activity_preferences enable row level security;
alter table public.activity_preference_profile_state enable row level security;
alter table public.activity_preference_reconciliation_runs enable row level security;
-- NextAuth authorizes the server. No Supabase-auth identity or public policies.
revoke all on public.activity_preference_activity_map,public.activity_preference_events,
  public.user_activity_preferences,public.activity_preference_profile_state,public.activity_preference_reconciliation_runs from public,anon,authenticated;
grant all on public.activity_preference_activity_map,public.activity_preference_events,
  public.user_activity_preferences,public.activity_preference_profile_state,public.activity_preference_reconciliation_runs to service_role;
revoke all on function public.touch_activity_preference_mapping(),public.record_activity_preference_event(jsonb),
  public.recompute_activity_preferences(text,timestamptz,text,double precision,double precision,double precision),
  public.read_activity_preference_profile(text),public.activity_preference_diagnostics() from public,anon,authenticated;
grant execute on function public.record_activity_preference_event(jsonb),
  public.recompute_activity_preferences(text,timestamptz,text,double precision,double precision,double precision),
  public.read_activity_preference_profile(text),public.activity_preference_diagnostics() to service_role;
notify pgrst, 'reload schema';
commit;
