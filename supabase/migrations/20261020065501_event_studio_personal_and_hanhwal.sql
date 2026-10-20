-- Existing operational rows stay intact. Personal records remain server-only;
-- application handlers additionally require their authenticated creator.
do $migration$
declare prefix text; table_name text; suffix text;
begin
  foreach prefix in array array['kline_forms_test_', 'kline_forms_live_'] loop
    foreach suffix in array array['google_forms', 'google_form_workflows'] loop
      table_name := prefix || suffix;
      execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_club_key_check');
      execute format('alter table public.%I add constraint %I check (club_key in (''ecc'',''hanhwal'',''social_impact_union'',''jeju'',''general'',''personal''))', table_name, table_name || '_club_key_check');
    end loop;
    table_name := prefix || 'club_board_posts';
    execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_board_id_check');
    execute format('alter table public.%I add constraint %I check (board_id in (''ecc'',''hanhwal'',''personal''))', table_name, table_name || '_board_id_check');
    table_name := prefix || 'google_oauth_connections';
    execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_id_check');
    execute format('alter table public.%I add constraint %I check (id = ''operations'' or id ~ ''^actor_[0-9a-f]{64}$'')', table_name, table_name || '_id_check');
    foreach suffix in array array['event_studio_jobs', 'event_ai_limits'] loop
      table_name := prefix || suffix;
      execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_club_key_check');
      execute format('alter table public.%I add constraint %I check (club_key in (''ecc'',''hanhwal'',''social_impact_union'',''personal''))', table_name, table_name || '_club_key_check');
    end loop;
    execute format('create index if not exists %I on public.%I (created_by, updated_at desc) where club_key = ''personal''', prefix || 'studio_personal_owner', prefix || 'event_studio_jobs');
    execute format($function$
      create or replace function public.%1$I(p_actor text,p_club text,p_model text,p_reason text,p_attempt integer)
      returns uuid language plpgsql security invoker set search_path = public, pg_temp as $body$
      declare uid uuid; actor_cap integer := 10; club_cap integer := 50;
        boundary timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
      begin
        if p_actor is null or p_actor = '' or p_club is null or p_club not in ('ecc','hanhwal','social_impact_union','personal') or p_attempt is null or p_attempt not between 0 and 2 then raise exception 'INVALID_AI_RESERVATION'; end if;
        perform pg_advisory_xact_lock(hashtextextended('%2$sactor:'||p_actor,0));
        perform pg_advisory_xact_lock(hashtextextended('%2$sclub:'||p_club,0));
        select user_daily_limit,club_daily_limit into actor_cap,club_cap from public.%3$I where club_key=p_club;
        actor_cap := coalesce(actor_cap,10); club_cap := coalesce(club_cap,50);
        if (select count(*) from public.%4$I where actor_email=p_actor and created_at>=boundary) >= actor_cap
          or (select count(*) from public.%4$I where club_key=p_club and created_at>=boundary) >= club_cap then return null; end if;
        insert into public.%4$I(actor_email,club_key,requested_model,reason,attempt)
          values(p_actor,p_club,p_model,p_reason,p_attempt) returning id into uid;
        return uid;
      end $body$;
    $function$, prefix || 'event_ai_reserve', prefix, prefix || 'event_ai_limits', prefix || 'event_ai_usage');
    execute format('revoke all on function public.%I(text,text,text,text,integer) from public,anon,authenticated', prefix || 'event_ai_reserve');
    execute format('grant execute on function public.%I(text,text,text,text,integer) to service_role', prefix || 'event_ai_reserve');
  end loop;
end $migration$;
