-- Local review only. Preserve legacy projects, sources, records, tokens and settings.
begin;
alter table public.co_dev_projects drop constraint if exists co_dev_projects_created_by_check;
alter table public.co_dev_projects drop constraint if exists co_dev_projects_updated_by_check;
alter table public.co_dev_tokens drop constraint if exists co_dev_tokens_email_check;

create or replace function public.co_dev_assert(p_actor text) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if p_actor is null or length(p_actor)>254 or p_actor<>lower(trim(p_actor)) or p_actor !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'LAB_FORBIDDEN'; end if;
end $$;
create or replace function public.co_dev_access(p_actor text,p_project uuid) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.co_dev_assert(p_actor);
  if not exists(select 1 from public.co_dev_projects where id=p_project and (created_by=p_actor or (p_actor in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp') and created_by in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp')))) then raise exception 'NOT_FOUND'; end if;
end $$;
create or replace function public.co_dev_owner(p_actor text) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if p_actor is distinct from 'waterfallingsound0827@gmail.com' then raise exception 'LAB_FORBIDDEN'; end if;
end $$;

-- Retain proven storage operations behind explicit tenant guards. Internal RPCs are
-- server-role only and never present in the application's RPC/tool allowlist.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('co_dev_get','co_dev_revision','co_dev_source_get','co_dev_state_read','co_dev_state_save','co_dev_records_list','co_dev_record_save','co_dev_settings_get','co_dev_settings_save') loop
    if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname=replace(f.proname,'co_dev_','co_dev_internal_')) then
      execute format('alter function %s rename to %I',f.signature,replace(f.proname,'co_dev_','co_dev_internal_'));
    end if;
  end loop;
end $$;
create or replace function public.co_dev_list(p_actor text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.co_dev_assert(p_actor);
  return (select coalesce(jsonb_agg(to_jsonb(p)-'html'-'fixture' order by p.updated_at desc),'[]'::jsonb) from public.co_dev_projects p where p.created_by=p_actor or (p_actor in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp') and p.created_by in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp')));
end $$;
create or replace function public.co_dev_get(p_actor text,p_id uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.co_dev_access(p_actor,p_id); return public.co_dev_internal_get(p_actor,p_id); end $$;
create or replace function public.co_dev_revision(p_actor text,p_revision uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.co_dev_access(p_actor,(select project_id from public.co_dev_revisions where id=p_revision)); return public.co_dev_internal_revision(p_actor,p_revision); end $$;
create or replace function public.co_dev_source_get(p_actor text,p_revision uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.co_dev_access(p_actor,(select project_id from public.co_dev_revisions where id=p_revision)); return public.co_dev_internal_source_get(p_actor,p_revision); end $$;
create or replace function public.co_dev_state_read(p_actor text,p_revision uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.co_dev_access(p_actor,(select project_id from public.co_dev_revisions where id=p_revision)); return public.co_dev_internal_state_read(p_actor,p_revision); end $$;
create or replace function public.co_dev_state_save(p_actor text,p_revision uuid,p_expected integer,p_data jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.co_dev_access(p_actor,(select project_id from public.co_dev_revisions where id=p_revision)); return public.co_dev_internal_state_save(p_actor,p_revision,p_expected,p_data); end $$;
create or replace function public.co_dev_records_list(p_actor text,p_project uuid,p_collection text,p_after uuid,p_limit integer,p_archived boolean) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.co_dev_access(p_actor,p_project); return public.co_dev_internal_records_list(p_actor,p_project,p_collection,p_after,p_limit,p_archived); end $$;
create or replace function public.co_dev_record_save(p_actor text,p_project uuid,p_collection text,p_id uuid,p_data jsonb,p_expected integer,p_archived boolean) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.co_dev_access(p_actor,p_project); return public.co_dev_internal_record_save(p_actor,p_project,p_collection,p_id,p_data,p_expected,p_archived); end $$;

create or replace function public.co_dev_save(p_actor text,p_id uuid,p_expected integer,p_title text,p_description text,p_html text,p_fixture jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_projects;
begin
  perform public.co_dev_assert(p_actor);
  perform pg_advisory_xact_lock(hashtextextended(p_actor,6120722));
  if exists(select 1 from public.co_dev_projects where id=p_id) then perform public.co_dev_access(p_actor,p_id); end if;
  if (select count(*) from public.co_dev_revisions where created_by=p_actor and created_at>now()-interval '1 hour')>=60 then raise exception 'RATE_LIMITED'; end if;
  if (select count(*) from public.co_dev_revisions where project_id=p_id)>=100 then raise exception 'PROJECT_LIMIT'; end if;
  if p_expected=0 then
    if (select count(*) from public.co_dev_projects where created_by=p_actor)>=100 then raise exception 'PROJECT_LIMIT'; end if;
    insert into public.co_dev_projects(id,title,description,html,fixture,revision,created_by,updated_by)
      values(p_id,p_title,p_description,p_html,p_fixture,1,p_actor,p_actor) on conflict(id) do nothing returning * into item;
  else
    update public.co_dev_projects set title=p_title,description=p_description,html=p_html,fixture=p_fixture,revision=revision+1,review_state='draft',updated_by=p_actor,updated_at=now() where id=p_id and revision=p_expected returning * into item;
  end if;
  if item.id is null then raise exception 'REVISION_CONFLICT'; end if;
  insert into public.co_dev_revisions(project_id,revision,title,description,html,fixture,created_by) values(item.id,item.revision,item.title,item.description,item.html,item.fixture,p_actor);
  return to_jsonb(item);
end $$;

create table if not exists public.co_dev_user_settings (
  actor text primary key,appearance jsonb not null check(jsonb_typeof(appearance)='object' and octet_length(appearance::text)<=262144),version integer not null check(version>0)
);
create table if not exists public.co_dev_user_settings_history (
  actor text not null,version integer not null,appearance jsonb not null,created_at timestamptz not null default now(),primary key(actor,version)
);
create or replace function public.co_dev_settings_get(p_actor text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.co_dev_assert(p_actor);
  if p_actor in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp') then return public.co_dev_internal_settings_get(p_actor); end if;
  return (select jsonb_build_object('appearance',appearance,'version',version) from public.co_dev_user_settings where actor=p_actor);
end $$;
create or replace function public.co_dev_settings_save(p_actor text,p_expected integer,p_appearance jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_user_settings; target text;
begin
  perform public.co_dev_assert(p_actor);
  target:=p_appearance->>'landingProjectId';
  if target is not null then perform public.co_dev_access(p_actor,target::uuid); end if;
  if p_actor in ('waterfallingsound0827@gmail.com','noritakeyuki@fuji.waseda.jp') then return public.co_dev_internal_settings_save(p_actor,p_expected,p_appearance); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor,6120723));
  if (select count(*) from public.co_dev_user_settings_history where actor=p_actor and created_at>now()-interval '1 hour')>=60 then raise exception 'RATE_LIMITED'; end if;
  if p_expected=0 then
    insert into public.co_dev_user_settings(actor,appearance,version) values(p_actor,p_appearance,1) on conflict(actor) do nothing returning * into item;
  else
    update public.co_dev_user_settings set appearance=p_appearance,version=version+1 where actor=p_actor and version=p_expected returning * into item;
  end if;
  if item.actor is null then raise exception 'SETTINGS_CONFLICT'; end if;
  insert into public.co_dev_user_settings_history(actor,version,appearance) values(p_actor,item.version,item.appearance);
  return jsonb_build_object('appearance',item.appearance,'version',item.version);
end $$;

create table if not exists public.co_dev_reviews (
  id uuid primary key default gen_random_uuid(),project_id uuid not null references public.co_dev_projects(id),
  revision_id uuid not null references public.co_dev_revisions(id),revision integer not null,
  state text not null default 'pending' check(state in ('pending','approved','rejected')),
  requested_by text not null,requested_at timestamptz not null default now(),
  decided_by text,decided_at timestamptz,note text not null default '' check(length(note)<=2000),unique(project_id,revision)
);
create table if not exists public.co_dev_publications (
  project_id uuid primary key references public.co_dev_projects(id),review_id uuid not null references public.co_dev_reviews(id),
  revision_id uuid not null references public.co_dev_revisions(id),active boolean not null,version integer not null check(version>0),updated_at timestamptz not null default now()
);
create table if not exists public.co_dev_release_history (
  id uuid primary key default gen_random_uuid(),project_id uuid not null,review_id uuid not null,revision_id uuid not null,
  active boolean not null,version integer not null,actor text not null,created_at timestamptz not null default now(),unique(project_id,version)
);
create or replace function public.co_dev_review(p_actor text,p_id uuid,p_expected integer) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_projects; rid uuid;
begin
  perform public.co_dev_access(p_actor,p_id);
  select * into item from public.co_dev_projects where id=p_id and revision=p_expected for update;
  if not found then raise exception 'REVISION_CONFLICT'; end if;
  select id into rid from public.co_dev_revisions where project_id=p_id and revision=p_expected;
  insert into public.co_dev_reviews(project_id,revision_id,revision,requested_by) values(p_id,rid,p_expected,p_actor) on conflict(project_id,revision) do nothing;
  update public.co_dev_projects set review_state='review_requested' where id=p_id returning * into item;
  return to_jsonb(item);
end $$;
create or replace function public.co_dev_review_queue(p_actor text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.co_dev_owner(p_actor);
  return (select coalesce(jsonb_agg(to_jsonb(q) order by q.requested_at desc),'[]'::jsonb) from (
    select r.*,v.title,v.description,p.revision as current_revision,coalesce(s.version,0) as publication_version,s.active,s.revision_id as published_revision_id
    from public.co_dev_reviews r join public.co_dev_revisions v on v.id=r.revision_id join public.co_dev_projects p on p.id=r.project_id left join public.co_dev_publications s on s.project_id=r.project_id order by r.requested_at desc limit 100
  ) q);
end $$;
create or replace function public.co_dev_review_detail(p_actor text,p_id uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_reviews; previous_html text;
begin
  perform public.co_dev_owner(p_actor);
  select * into item from public.co_dev_reviews where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select v.html into previous_html from public.co_dev_publications p join public.co_dev_revisions v on v.id=p.revision_id where p.project_id=item.project_id;
  return jsonb_build_object('review',to_jsonb(item),'revision',(select to_jsonb(v) from public.co_dev_revisions v where id=item.revision_id),'source',(select jsonb_build_object('files',files,'sourceHash',source_hash) from public.co_dev_sources where revision_id=item.revision_id),'previousHtml',previous_html);
end $$;
create or replace function public.co_dev_review_decide(p_actor text,p_id uuid,p_approve boolean,p_note text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_reviews;
begin
  perform public.co_dev_owner(p_actor);
  select * into item from public.co_dev_reviews where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform 1 from public.co_dev_projects where id=item.project_id and revision=item.revision for update;
  if not found or item.state<>'pending' then raise exception 'REVISION_CONFLICT'; end if;
  if p_note is null or length(trim(p_note))<1 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
  update public.co_dev_reviews set state=case when p_approve then 'approved' else 'rejected' end,note=p_note,decided_by=p_actor,decided_at=now() where id=p_id returning * into item;
  return to_jsonb(item);
end $$;
create or replace function public.co_dev_release(p_actor text,p_id uuid,p_expected integer,p_publish boolean) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_reviews; published public.co_dev_publications;
begin
  perform public.co_dev_owner(p_actor);
  select * into item from public.co_dev_reviews where id=p_id and state='approved';
  if not found then raise exception 'REVIEW_REQUIRED'; end if;
  perform 1 from public.co_dev_projects where id=item.project_id for update;
  if p_publish and not exists(select 1 from public.co_dev_projects where id=item.project_id and revision=item.revision) then raise exception 'REVISION_CONFLICT'; end if;
  if p_expected=0 then
    insert into public.co_dev_publications(project_id,review_id,revision_id,active,version) values(item.project_id,item.id,item.revision_id,p_publish,1) on conflict(project_id) do nothing returning * into published;
  else
    update public.co_dev_publications set review_id=item.id,revision_id=item.revision_id,active=p_publish,version=version+1,updated_at=now() where project_id=item.project_id and version=p_expected returning * into published;
  end if;
  if published.project_id is null then raise exception 'REVISION_CONFLICT'; end if;
  insert into public.co_dev_release_history(project_id,review_id,revision_id,active,version,actor) values(published.project_id,published.review_id,published.revision_id,published.active,published.version,p_actor);
  return to_jsonb(published);
end $$;
create or replace function public.co_dev_catalog() returns jsonb language sql security invoker set search_path=pg_catalog,public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',p.project_id,'title',v.title,'description',v.description,'revision',v.revision) order by p.updated_at desc),'[]'::jsonb) from public.co_dev_publications p join public.co_dev_revisions v on v.id=p.revision_id where p.active;
$$;
create or replace function public.co_dev_public_revision(p_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog,public as $$
  select jsonb_build_object('id',p.project_id,'title',v.title,'html',v.html,'revision',v.revision) from public.co_dev_publications p join public.co_dev_revisions v on v.id=p.revision_id where p.project_id=p_id and p.active;
$$;

-- Published applications never reuse author test records. Each signed-in visitor
-- receives a private data partition, including after a new approved UI revision.
create table if not exists public.co_dev_service_records (
  project_id uuid not null references public.co_dev_projects(id),actor text not null,collection text not null,id uuid not null,
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=131072),version integer not null check(version>0),
  archived boolean not null default false,updated_at timestamptz not null default now(),primary key(project_id,actor,collection,id)
);
create table if not exists public.co_dev_service_writes (id uuid primary key default gen_random_uuid(),actor text not null,created_at timestamptz not null default now());
create index if not exists co_dev_service_writes_actor_time on public.co_dev_service_writes(actor,created_at);
create or replace function public.co_dev_service_data(p_actor text,p_project uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_service_records; items jsonb; cid text; rid uuid; expected integer; lim integer; after_id uuid;
begin
  perform public.co_dev_assert(p_actor);
  if public.co_dev_public_revision(p_project) is null then raise exception 'NOT_FOUND'; end if;
  if p_action not in ('state_read','state_save','records_list','record_save') then raise exception 'INVALID_OPERATION'; end if;
  cid:=case when p_action in ('state_read','state_save') then '@state' else p_payload->>'collection' end;
  if cid is null or (cid<>'@state' and cid !~ '^[a-z][a-z0-9_-]{0,39}$') or (cid='@state' and p_action in ('records_list','record_save')) then raise exception 'INVALID_COLLECTION'; end if;
  rid:=case when cid='@state' then '00000000-0000-0000-0000-000000000000'::uuid else (p_payload->>'id')::uuid end;
  if p_action='records_list' then
    lim:=coalesce((p_payload->>'limit')::integer,50); after_id:=(p_payload->>'after')::uuid;
    if lim not between 1 and 100 then raise exception 'INVALID_BODY'; end if;
    select coalesce(jsonb_agg(to_jsonb(r)-'actor' order by r.id),'[]'::jsonb) into items from (
      select * from public.co_dev_service_records where project_id=p_project and actor=p_actor and collection=cid and (after_id is null or id>after_id) and (coalesce((p_payload->>'includeArchived')::boolean,false) or not archived) order by id limit lim+1
    ) r;
    return jsonb_build_object('records',case when jsonb_array_length(items)>lim then items-lim else items end,'nextCursor',case when jsonb_array_length(items)>lim then items->(lim-1)->>'id' else null end);
  end if;
  if p_action='state_read' then
    select * into item from public.co_dev_service_records where project_id=p_project and actor=p_actor and collection=cid and id=rid;
    return jsonb_build_object('data',coalesce(item.data,'{}'::jsonb),'version',coalesce(item.version,0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor,6120724));
  if (select count(*) from public.co_dev_service_writes where actor=p_actor and created_at>now()-interval '1 hour')>=300 then raise exception 'RATE_LIMITED'; end if;
  expected:=(p_payload->>'expectedVersion')::integer;
  if rid is null or expected is null or expected<0 then raise exception 'INVALID_BODY'; end if;
  if expected=0 then
    if (select count(*) from public.co_dev_service_records where project_id=p_project and actor=p_actor)>=500 then raise exception 'PROJECT_LIMIT'; end if;
    insert into public.co_dev_service_records(project_id,actor,collection,id,data,version,archived) values(p_project,p_actor,cid,rid,p_payload->'data',1,coalesce((p_payload->>'archived')::boolean,false)) on conflict(project_id,actor,collection,id) do nothing returning * into item;
  else
    update public.co_dev_service_records set data=p_payload->'data',version=version+1,archived=coalesce((p_payload->>'archived')::boolean,false),updated_at=now() where project_id=p_project and actor=p_actor and collection=cid and id=rid and version=expected returning * into item;
  end if;
  if item.id is null then raise exception 'RECORD_CONFLICT'; end if;
  insert into public.co_dev_service_writes(actor) values(p_actor);
  if cid='@state' then return jsonb_build_object('data',item.data,'version',item.version); end if;
  return to_jsonb(item)-'actor';
end $$;

do $$ declare t text; f record; begin
  foreach t in array array['co_dev_user_settings','co_dev_user_settings_history','co_dev_reviews','co_dev_publications','co_dev_release_history','co_dev_service_records','co_dev_service_writes'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert on public.%I to service_role',t);
  end loop;
  grant update on public.co_dev_user_settings,public.co_dev_reviews,public.co_dev_publications,public.co_dev_service_records to service_role;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and left(proname,7)='co_dev_' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
commit;
