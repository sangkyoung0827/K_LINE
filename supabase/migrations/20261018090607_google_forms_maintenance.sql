begin;
create table if not exists public.kline_forms_live_google_form_maintenance (
  form_id uuid primary key references public.kline_forms_live_google_forms(id),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  last_success_at timestamptz,
  last_error text
);
alter table public.kline_forms_live_google_form_maintenance enable row level security;
revoke all on public.kline_forms_live_google_form_maintenance from public, anon, authenticated;
grant all on public.kline_forms_live_google_form_maintenance to service_role;
create index if not exists kline_forms_live_google_form_maintenance_due_idx
  on public.kline_forms_live_google_form_maintenance(next_attempt_at);

create or replace function public.kline_forms_live_google_forms_claim_maintenance(p_lease uuid)
returns setof public.kline_forms_live_google_forms
language plpgsql security invoker set search_path = '' as $$
begin
  if p_lease is null then raise exception 'LEASE_REQUIRED'; end if;
  insert into public.kline_forms_live_google_form_maintenance(form_id)
    select id from public.kline_forms_live_google_forms
    where metadata @> '{"automation":{"version":1}}'::jsonb and status in ('open','closed')
    on conflict (form_id) do nothing;
  return query
    with due as (
      select m.form_id from public.kline_forms_live_google_form_maintenance m
      join public.kline_forms_live_google_forms f on f.id = m.form_id
      where m.next_attempt_at <= now() and (m.lease_expires_at is null or m.lease_expires_at < now())
        and f.metadata @> '{"automation":{"version":1}}'::jsonb and f.status in ('open','closed')
        and (f.status = 'open' or coalesce(f.application_deadline, f.created_at) > now() - interval '7 days')
      order by m.next_attempt_at, m.form_id limit 3 for update of m skip locked
    ), claimed as (
      update public.kline_forms_live_google_form_maintenance m
        set lease_id = p_lease, lease_expires_at = now() + interval '10 minutes'
        from due where m.form_id = due.form_id returning m.form_id
    ) select f.* from public.kline_forms_live_google_forms f join claimed c on c.form_id = f.id;
end;
$$;
create or replace function public.kline_forms_live_google_forms_finish_maintenance(p_form uuid, p_lease uuid, p_success boolean, p_error text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.kline_forms_live_google_form_maintenance
    set next_attempt_at = now() + interval '5 minutes', lease_id = null, lease_expires_at = null,
      last_success_at = case when p_success then now() else last_success_at end,
      last_error = case when p_success then null else left(coalesce(p_error, 'MAINTENANCE_FAILED'), 100) end
    where form_id = p_form and lease_id = p_lease and lease_expires_at > now();
  return found;
end;
$$;
revoke all on function public.kline_forms_live_google_forms_claim_maintenance(uuid) from public, anon, authenticated;
revoke all on function public.kline_forms_live_google_forms_finish_maintenance(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.kline_forms_live_google_forms_claim_maintenance(uuid) to service_role;
grant execute on function public.kline_forms_live_google_forms_finish_maintenance(uuid,uuid,boolean,text) to service_role;
comment on table public.kline_forms_live_google_form_maintenance is 'Server-only opt-in Google Forms maintenance leases and health. No native membership changes.';

create or replace function public.kline_forms_live_google_forms_commit_snapshot(p_form uuid, p_started_at timestamptz, p_responses jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare existing public.kline_forms_live_google_forms; total integer;
begin
  if p_started_at is null or p_started_at > now() + interval '1 minute' or jsonb_typeof(p_responses) is distinct from 'array' then raise exception 'INVALID_SNAPSHOT'; end if;
  select * into strict existing from public.kline_forms_live_google_forms where id = p_form for update;
  if not (existing.metadata @> '{"automation":{"version":1}}') then raise exception 'AUTOMATION_NOT_ENABLED'; end if;
  if existing.last_response_sync_at >= p_started_at then return existing.response_count; end if;
  total := jsonb_array_length(p_responses);
  if total > 100000 or exists (select 1 from jsonb_array_elements(p_responses) r where r->>'google_response_id' is null or r->>'submitted_at' is null) then raise exception 'INVALID_SNAPSHOT'; end if;
  insert into public.kline_forms_live_google_form_responses(google_form_registry_id,google_response_id,submitted_at,respondent_email,matched_user_email,answers_json,raw_answers_json,synced_at)
    select p_form,r->>'google_response_id',(r->>'submitted_at')::timestamptz,r->>'respondent_email',r->>'matched_user_email',r->'answers_json',r->'raw_answers_json',p_started_at
    from jsonb_array_elements(p_responses) r
    on conflict (google_form_registry_id,google_response_id) do update set
      submitted_at=excluded.submitted_at,respondent_email=excluded.respondent_email,matched_user_email=excluded.matched_user_email,
      answers_json=excluded.answers_json,raw_answers_json=excluded.raw_answers_json,synced_at=excluded.synced_at;
  -- Retain older mirrored rows for recovery; only this complete snapshot is active.
  update public.kline_forms_live_google_forms set response_count=total,last_response_sync_at=p_started_at where id=p_form;
  return total;
end;
$$;
revoke all on function public.kline_forms_live_google_forms_commit_snapshot(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.kline_forms_live_google_forms_commit_snapshot(uuid,timestamptz,jsonb) to service_role;
commit;
