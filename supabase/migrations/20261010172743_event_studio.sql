-- Additive Event Studio storage only. Native applications, roles and membership records are untouched.
-- Explicitly review/apply before enabling EVENT_AI_ENABLED. No automatic recruitment publication.

create table if not exists public.kline_forms_test_event_studio_jobs (
 id uuid primary key default gen_random_uuid(),
 club_key text not null check (club_key in ('ecc','hanhwal','social_impact_union')),
 plan jsonb not null, revision integer not null default 1 check (revision > 0),
 state text not null default 'draft' check (state in ('draft','running','failed','notice_saved')),
 form_registry_id uuid, notice_id uuid, last_error text, ai_metadata jsonb not null default '{}',
 created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists kline_forms_test_studio_club_updated on public.kline_forms_test_event_studio_jobs(club_key,updated_at desc);
create table if not exists public.kline_forms_test_event_ai_limits (
 club_key text primary key check (club_key in ('ecc','hanhwal','social_impact_union')),
 user_daily_limit integer not null default 10 check (user_daily_limit between 1 and 100),
 club_daily_limit integer not null default 50 check (club_daily_limit between 1 and 1000),
 changed_by text not null
);
create table if not exists public.kline_forms_test_event_ai_usage (
 id uuid primary key default gen_random_uuid(), actor_email text not null, club_key text not null,
 requested_model text not null, actual_model text, reason text not null, attempt integer not null,
 input_tokens integer, output_tokens integer, duration_ms integer, estimated_cost_usd numeric,
 error_code text, status text not null default 'reserved' check (status in ('reserved','completed','failed')),
 created_at timestamptz not null default now()
);
create index if not exists kline_forms_test_event_ai_actor_time on public.kline_forms_test_event_ai_usage(actor_email,created_at);
create index if not exists kline_forms_test_event_ai_club_time on public.kline_forms_test_event_ai_usage(club_key,created_at);
alter table public.kline_forms_test_event_studio_jobs enable row level security;
alter table public.kline_forms_test_event_ai_usage enable row level security;
alter table public.kline_forms_test_event_ai_limits enable row level security;
revoke all on public.kline_forms_test_event_studio_jobs, public.kline_forms_test_event_ai_usage, public.kline_forms_test_event_ai_limits from public, anon, authenticated;
grant all on public.kline_forms_test_event_studio_jobs, public.kline_forms_test_event_ai_usage, public.kline_forms_test_event_ai_limits to service_role;
create or replace function public.kline_forms_test_event_ai_reserve(p_actor text,p_club text,p_model text,p_reason text,p_attempt integer)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $body$
declare uid uuid; actor_cap integer := 10; club_cap integer := 50; boundary timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_actor = '' or p_club not in ('ecc','hanhwal','social_impact_union') or p_attempt not between 0 and 2 then raise exception 'INVALID_AI_RESERVATION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kline_forms_test_actor:'||p_actor,0));
 perform pg_advisory_xact_lock(hashtextextended('kline_forms_test_club:'||p_club,0));
 select user_daily_limit,club_daily_limit into actor_cap,club_cap from public.kline_forms_test_event_ai_limits where club_key=p_club;
 actor_cap := coalesce(actor_cap,10); club_cap := coalesce(club_cap,50);
 if (select count(*) from public.kline_forms_test_event_ai_usage where actor_email=p_actor and created_at>=boundary) >= actor_cap
 or (select count(*) from public.kline_forms_test_event_ai_usage where club_key=p_club and created_at>=boundary) >= club_cap then return null; end if;
 insert into public.kline_forms_test_event_ai_usage(actor_email,club_key,requested_model,reason,attempt)
 values(p_actor,p_club,p_model,p_reason,p_attempt) returning id into uid;
 return uid;
end $body$;
revoke all on function public.kline_forms_test_event_ai_reserve(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.kline_forms_test_event_ai_reserve(text,text,text,text,integer) to service_role;

create table if not exists public.kline_forms_live_event_studio_jobs (
 id uuid primary key default gen_random_uuid(),
 club_key text not null check (club_key in ('ecc','hanhwal','social_impact_union')),
 plan jsonb not null, revision integer not null default 1 check (revision > 0),
 state text not null default 'draft' check (state in ('draft','running','failed','notice_saved')),
 form_registry_id uuid, notice_id uuid, last_error text, ai_metadata jsonb not null default '{}',
 created_by text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists kline_forms_live_studio_club_updated on public.kline_forms_live_event_studio_jobs(club_key,updated_at desc);
create table if not exists public.kline_forms_live_event_ai_limits (
 club_key text primary key check (club_key in ('ecc','hanhwal','social_impact_union')),
 user_daily_limit integer not null default 10 check (user_daily_limit between 1 and 100),
 club_daily_limit integer not null default 50 check (club_daily_limit between 1 and 1000),
 changed_by text not null
);
create table if not exists public.kline_forms_live_event_ai_usage (
 id uuid primary key default gen_random_uuid(), actor_email text not null, club_key text not null,
 requested_model text not null, actual_model text, reason text not null, attempt integer not null,
 input_tokens integer, output_tokens integer, duration_ms integer, estimated_cost_usd numeric,
 error_code text, status text not null default 'reserved' check (status in ('reserved','completed','failed')),
 created_at timestamptz not null default now()
);
create index if not exists kline_forms_live_event_ai_actor_time on public.kline_forms_live_event_ai_usage(actor_email,created_at);
create index if not exists kline_forms_live_event_ai_club_time on public.kline_forms_live_event_ai_usage(club_key,created_at);
alter table public.kline_forms_live_event_studio_jobs enable row level security;
alter table public.kline_forms_live_event_ai_usage enable row level security;
alter table public.kline_forms_live_event_ai_limits enable row level security;
revoke all on public.kline_forms_live_event_studio_jobs, public.kline_forms_live_event_ai_usage, public.kline_forms_live_event_ai_limits from public, anon, authenticated;
grant all on public.kline_forms_live_event_studio_jobs, public.kline_forms_live_event_ai_usage, public.kline_forms_live_event_ai_limits to service_role;
create or replace function public.kline_forms_live_event_ai_reserve(p_actor text,p_club text,p_model text,p_reason text,p_attempt integer)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $body$
declare uid uuid; actor_cap integer := 10; club_cap integer := 50; boundary timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if p_actor = '' or p_club not in ('ecc','hanhwal','social_impact_union') or p_attempt not between 0 and 2 then raise exception 'INVALID_AI_RESERVATION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kline_forms_live_actor:'||p_actor,0));
 perform pg_advisory_xact_lock(hashtextextended('kline_forms_live_club:'||p_club,0));
 select user_daily_limit,club_daily_limit into actor_cap,club_cap from public.kline_forms_live_event_ai_limits where club_key=p_club;
 actor_cap := coalesce(actor_cap,10); club_cap := coalesce(club_cap,50);
 if (select count(*) from public.kline_forms_live_event_ai_usage where actor_email=p_actor and created_at>=boundary) >= actor_cap
 or (select count(*) from public.kline_forms_live_event_ai_usage where club_key=p_club and created_at>=boundary) >= club_cap then return null; end if;
 insert into public.kline_forms_live_event_ai_usage(actor_email,club_key,requested_model,reason,attempt)
 values(p_actor,p_club,p_model,p_reason,p_attempt) returning id into uid;
 return uid;
end $body$;
revoke all on function public.kline_forms_live_event_ai_reserve(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.kline_forms_live_event_ai_reserve(text,text,text,text,integer) to service_role;
