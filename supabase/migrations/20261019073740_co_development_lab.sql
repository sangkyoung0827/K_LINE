-- Private prototypes only. No existing club, member, event or asset table is used.
begin;
create table public.co_dev_projects (
  id uuid primary key, title text not null check (length(title) between 1 and 120),
  description text not null check (length(description) <= 2000),
  html text not null check (octet_length(html) between 1 and 262144),
  fixture jsonb not null check (jsonb_typeof(fixture) = 'object' and octet_length(fixture::text) <= 65536),
  revision integer not null check (revision > 0),
  review_state text not null default 'draft' check (review_state in ('draft','review_requested')),
  created_by text not null check (created_by in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp')),
  updated_by text not null check (updated_by in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.co_dev_revisions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.co_dev_projects(id),
  revision integer not null, title text not null, description text not null, html text not null, fixture jsonb not null,
  created_by text not null, created_at timestamptz not null default now(), unique(project_id, revision)
);
create index co_dev_revisions_actor_time on public.co_dev_revisions(created_by, created_at);
create table public.co_dev_states (
  revision_id uuid primary key references public.co_dev_revisions(id),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536),
  version integer not null check (version > 0), updated_by text not null, updated_at timestamptz not null default now()
);
create table public.co_dev_tokens (
  email text primary key check (email in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null, revoked boolean not null default false
);

alter table public.co_dev_projects enable row level security;
alter table public.co_dev_revisions enable row level security;
alter table public.co_dev_states enable row level security;
alter table public.co_dev_tokens enable row level security;
revoke all on public.co_dev_projects, public.co_dev_revisions, public.co_dev_states, public.co_dev_tokens from public, anon, authenticated, service_role;
grant select, insert, update on public.co_dev_projects, public.co_dev_states, public.co_dev_tokens to service_role;
grant select, insert on public.co_dev_revisions to service_role;

create function public.co_dev_assert(p_actor text) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_actor is null or p_actor not in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp') then raise exception 'LAB_FORBIDDEN'; end if;
end $$;

create function public.co_dev_list(p_actor text) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare result jsonb;
begin
  perform public.co_dev_assert(p_actor);
  select coalesce(jsonb_agg(to_jsonb(p) - 'html' - 'fixture' order by p.updated_at desc), '[]'::jsonb) into result from public.co_dev_projects p;
  return result;
end $$;

create function public.co_dev_get(p_actor text, p_id uuid) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare item public.co_dev_projects; history jsonb;
begin
  perform public.co_dev_assert(p_actor);
  select * into item from public.co_dev_projects where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) - 'html' - 'fixture' order by r.revision desc), '[]'::jsonb) into history from public.co_dev_revisions r where r.project_id = p_id;
  return jsonb_build_object('project', to_jsonb(item), 'revisions', history);
end $$;

create function public.co_dev_revision(p_actor text, p_revision uuid) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare item public.co_dev_revisions;
begin
  perform public.co_dev_assert(p_actor);
  select * into item from public.co_dev_revisions where id = p_revision;
  if not found then raise exception 'NOT_FOUND'; end if;
  return to_jsonb(item);
end $$;

create function public.co_dev_save(p_actor text, p_id uuid, p_expected integer, p_title text, p_description text, p_html text, p_fixture jsonb) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare item public.co_dev_projects;
begin
  perform public.co_dev_assert(p_actor);
  -- Serializes revision writes and bounds the private workspace size.
  perform pg_advisory_xact_lock(6120719);
  if (select count(*) from public.co_dev_revisions where created_by = p_actor and created_at > now() - interval '1 hour') >= 60 then raise exception 'RATE_LIMITED'; end if;
  if (select count(*) from public.co_dev_revisions where project_id=p_id) >= 100 then raise exception 'PROJECT_LIMIT'; end if;
  if p_expected = 0 then
    if (select count(*) from public.co_dev_projects) >= 100 then raise exception 'PROJECT_LIMIT'; end if;
    insert into public.co_dev_projects(id,title,description,html,fixture,revision,created_by,updated_by)
      values(p_id,p_title,p_description,p_html,p_fixture,1,p_actor,p_actor)
      on conflict (id) do nothing returning * into item;
  else
    update public.co_dev_projects set title=p_title, description=p_description, html=p_html, fixture=p_fixture,
      revision=revision+1, review_state='draft', updated_by=p_actor, updated_at=now()
      where id=p_id and revision=p_expected returning * into item;
  end if;
  if item.id is null then raise exception 'REVISION_CONFLICT'; end if;
  insert into public.co_dev_revisions(project_id,revision,title,description,html,fixture,created_by)
    values(item.id,item.revision,item.title,item.description,item.html,item.fixture,p_actor);
  return to_jsonb(item);
end $$;

create function public.co_dev_state_read(p_actor text, p_revision uuid) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare item public.co_dev_revisions; state public.co_dev_states;
begin
  perform public.co_dev_assert(p_actor);
  select * into item from public.co_dev_revisions where id=p_revision;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into state from public.co_dev_states where revision_id=p_revision;
  return jsonb_build_object('data',case when state.revision_id is null then item.fixture else state.data end,'version',coalesce(state.version,0));
end $$;

create function public.co_dev_state_save(p_actor text, p_revision uuid, p_expected integer, p_data jsonb) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare state public.co_dev_states;
begin
  perform public.co_dev_assert(p_actor);
  if not exists(select 1 from public.co_dev_revisions where id=p_revision) then raise exception 'NOT_FOUND'; end if;
  if p_expected=0 then
    insert into public.co_dev_states(revision_id,data,version,updated_by) values(p_revision,p_data,1,p_actor)
      on conflict(revision_id) do nothing returning * into state;
  else
    update public.co_dev_states set data=p_data, version=version+1, updated_by=p_actor, updated_at=now()
      where revision_id=p_revision and version=p_expected returning * into state;
  end if;
  if state.revision_id is null then raise exception 'STATE_CONFLICT'; end if;
  return jsonb_build_object('data',state.data,'version',state.version);
end $$;

create function public.co_dev_review(p_actor text, p_id uuid, p_expected integer) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare item public.co_dev_projects;
begin
  perform public.co_dev_assert(p_actor);
  update public.co_dev_projects set review_state='review_requested',updated_at=now()
    where id=p_id and revision=p_expected returning * into item;
  if not found then raise exception 'REVISION_CONFLICT'; end if;
  return to_jsonb(item);
end $$;

create function public.co_dev_token_lookup(p_hash text) returns jsonb language sql security invoker set search_path = pg_catalog, public as $$
  select jsonb_build_object('email',email) from public.co_dev_tokens where token_hash=p_hash and not revoked and expires_at>now();
$$;
create function public.co_dev_token_rotate(p_actor text, p_hash text) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare expiry timestamptz := now()+interval '30 days';
begin
  perform public.co_dev_assert(p_actor);
  insert into public.co_dev_tokens(email,token_hash,expires_at) values(p_actor,p_hash,expiry)
    on conflict(email) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,revoked=false;
  return jsonb_build_object('expires_at',expiry);
end $$;
create function public.co_dev_token_revoke(p_actor text) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  perform public.co_dev_assert(p_actor);
  update public.co_dev_tokens set revoked=true where email=p_actor;
  return jsonb_build_object('revoked',true);
end $$;

do $$ declare item record; begin
  for item in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and left(proname,7)='co_dev_' loop
    execute format('revoke all on function %s from public, anon, authenticated',item.signature);
    execute format('grant execute on function %s to service_role',item.signature);
  end loop;
end $$;
commit;
