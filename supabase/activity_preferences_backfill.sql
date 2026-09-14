-- SQL Editor alternative to the server CLI, using the same V1 adapters/RPCs.
-- First run as false (dry run). Set true only after release gates pass.
-- Only derived preference tables are written; source tables are read-only.
begin;
set local statement_timeout = '120s';
set local kline.preference_apply = 'false';

create temporary table preference_source_candidates on commit drop as
with applications as (
  select 'ecc'::text source,id,user_id,activity_id,activity_instance_id,created_at
    from public.ecc_activity_applications
  union all
  select 'hanhwal',id,user_id,activity_id,activity_instance_id,created_at
    from public.hanhwal_activity_applications
), signals as (
  select source bucket, source,id,user_id,activity_id,activity_instance_id,
    source || '_application:' || id::text source_event_key,
    'applied'::text event_type,null::smallint rating,2 base_weight,created_at occurred_at
    from applications
  union all
  select 'ratings',source,id,user_id,activity_id,activity_instance_id,
    'activity_rating:' || id::text || ':' ||
      to_char(rated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'rating_submitted',rating,
    case rating when 1 then -3 when 2 then -1 when 3 then 0 when 4 then 2 when 5 then 4 end,
    rated_at from public.user_activity_records where rating is not null and rated_at is not null
), normalized as (
  select *, lower(btrim(user_id, E' \t\n\r\f\v' || chr(160) || chr(65279))) user_key from signals
)
select bucket,
  coalesce(user_key <> '' and id is not null and source <> '' and activity_id <> ''
    and occurred_at is not null and isfinite(occurred_at) and base_weight is not null,false) valid,
  jsonb_build_object('user_key',user_key,'source',source,'activity_id',activity_id,
    'activity_instance_id',activity_instance_id,'source_event_key',source_event_key,
    'event_type',event_type,'rating',rating,'base_weight',base_weight,'occurred_at',occurred_at) payload
from normalized;

create temporary table preference_run_report on commit drop as
select jsonb_build_object(
  'mode',case when current_setting('kline.preference_apply')::boolean then 'apply' else 'dry-run' end,
  'modelVersion','v1',
  'scanned',jsonb_build_object('ecc',count(*) filter(where bucket='ecc'),
    'hanhwal',count(*) filter(where bucket='hanhwal'),'ratings',count(*) filter(where bucket='ratings')),
  'validSourceEvents',count(*) filter(where valid),
  'skippedMissingIdentityOrInvalid',count(*) filter(where not valid),
  'newEvents',0,'alreadyPresent',0,'profilesRecomputed',0,'errors',0
) summary from preference_source_candidates;

do $$
declare event jsonb; result jsonb; owner_key text; run_id uuid;
  inserted_count integer := 0; existing_count integer := 0; profile_count integer := 0;
begin
  if not current_setting('kline.preference_apply')::boolean then return; end if;
  insert into public.activity_preference_reconciliation_runs(model_version)
    values('v1') returning id into run_id;
  for event in select payload from preference_source_candidates where valid order by payload->>'source_event_key' loop
    result := public.record_activity_preference_event(event);
    if (result->>'inserted')::boolean then inserted_count := inserted_count+1;
    else existing_count := existing_count+1; end if;
  end loop;
  -- Refresh classifications even when an original application was reset later.
  for event in select to_jsonb(e) || jsonb_build_object('base_weight',
      case when event_type='applied' then 2 else
        case rating when 1 then -3 when 2 then -1 when 3 then 0 when 4 then 2 when 5 then 4 end end)
    from public.activity_preference_events e order by source_event_key loop
    perform public.record_activity_preference_event(event);
  end loop;
  for owner_key in select distinct user_key from public.activity_preference_events order by user_key loop
    perform public.recompute_activity_preferences(owner_key,clock_timestamp(),'v1',180,10,4);
    profile_count := profile_count+1;
  end loop;
  update preference_run_report set summary = summary || jsonb_build_object(
    'newEvents',inserted_count,'alreadyPresent',existing_count,'profilesRecomputed',profile_count);
  update public.activity_preference_reconciliation_runs set status='completed',finished_at=clock_timestamp(),
    summary=(select summary from preference_run_report) where id=run_id;
end;
$$;

select summary as backfill_report, public.activity_preference_diagnostics() as diagnostics
from preference_run_report;
commit;
