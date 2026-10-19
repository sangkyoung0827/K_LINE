-- Appearance is shared by the two private lab accounts, never by public visitors.
begin;
create table public.co_dev_settings (
  id boolean primary key default true check (id),
  appearance jsonb not null check (jsonb_typeof(appearance) = 'object' and octet_length(appearance::text) <= 262144),
  version integer not null check (version > 0),
  updated_by text not null check (updated_by in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp')),
  updated_at timestamptz not null default now()
);
create table public.co_dev_settings_history (
  version integer primary key, appearance jsonb not null,
  updated_by text not null, updated_at timestamptz not null default now()
);
alter table public.co_dev_settings enable row level security;
alter table public.co_dev_settings_history enable row level security;
revoke all on public.co_dev_settings, public.co_dev_settings_history from public, anon, authenticated, service_role;
grant select, insert, update on public.co_dev_settings to service_role;
grant select, insert on public.co_dev_settings_history to service_role;

create function public.co_dev_settings_get(p_actor text) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  perform public.co_dev_assert(p_actor);
  return (select jsonb_build_object('appearance',appearance,'version',version) from public.co_dev_settings where id);
end $$;

create function public.co_dev_settings_save(p_actor text, p_expected integer, p_appearance jsonb) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare item public.co_dev_settings; target text;
begin
  perform public.co_dev_assert(p_actor);
  perform pg_advisory_xact_lock(6120720);
  if (select count(*) from public.co_dev_settings_history where updated_by=p_actor and updated_at>now()-interval '1 hour') >= 60 then raise exception 'RATE_LIMITED'; end if;
  target := p_appearance->>'landingProjectId';
  if target is not null and not exists(select 1 from public.co_dev_projects where id=target::uuid) then raise exception 'NOT_FOUND'; end if;
  if p_expected=0 then
    insert into public.co_dev_settings(appearance,version,updated_by) values(p_appearance,1,p_actor)
      on conflict(id) do nothing returning * into item;
  else
    update public.co_dev_settings set appearance=p_appearance,version=version+1,updated_by=p_actor,updated_at=now()
      where id and version=p_expected returning * into item;
  end if;
  if item.id is null then raise exception 'SETTINGS_CONFLICT'; end if;
  insert into public.co_dev_settings_history(version,appearance,updated_by) values(item.version,item.appearance,p_actor);
  return jsonb_build_object('appearance',item.appearance,'version',item.version);
end $$;
revoke all on function public.co_dev_settings_get(text), public.co_dev_settings_save(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.co_dev_settings_get(text), public.co_dev_settings_save(text,integer,jsonb) to service_role;
commit;
