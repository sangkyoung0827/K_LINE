-- Private source snapshots and project-scoped test records; no production tables.
begin;
create table public.co_dev_sources (
  revision_id uuid primary key references public.co_dev_revisions(id),
  files jsonb not null check (jsonb_typeof(files)='object' and octet_length(files::text)<=2097152),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  created_by text not null, created_at timestamptz not null default now()
);
create table public.co_dev_records (
  project_id uuid not null references public.co_dev_projects(id),
  collection text not null check (collection ~ '^[a-z][a-z0-9_-]{0,39}$'),
  id uuid not null, data jsonb not null check (jsonb_typeof(data)='object' and octet_length(data::text)<=32768),
  version integer not null check (version>0), archived boolean not null default false,
  updated_by text not null, updated_at timestamptz not null default now(), primary key(project_id,collection,id)
);
create table public.co_dev_record_history (
  project_id uuid not null, collection text not null, id uuid not null,
  version integer not null, data jsonb not null, archived boolean not null,
  updated_by text not null, updated_at timestamptz not null default now(), primary key(project_id,collection,id,version),
  foreign key(project_id,collection,id) references public.co_dev_records(project_id,collection,id)
);
create index co_dev_record_history_actor_time on public.co_dev_record_history(updated_by,updated_at);
alter table public.co_dev_sources enable row level security;
alter table public.co_dev_records enable row level security;
alter table public.co_dev_record_history enable row level security;
revoke all on public.co_dev_sources,public.co_dev_records,public.co_dev_record_history from public,anon,authenticated,service_role;
grant select,insert on public.co_dev_sources,public.co_dev_record_history to service_role;
grant select,insert,update on public.co_dev_records to service_role;

create function public.co_dev_bundle_save(p_actor text,p_id uuid,p_expected integer,p_title text,p_description text,p_html text,p_fixture jsonb,p_files jsonb,p_hash text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare project jsonb; revision_id uuid;
begin
  perform public.co_dev_assert(p_actor);
  project:=public.co_dev_save(p_actor,p_id,p_expected,p_title,p_description,p_html,p_fixture);
  select id into revision_id from public.co_dev_revisions where project_id=p_id and revision=(project->>'revision')::integer;
  insert into public.co_dev_sources(revision_id,files,source_hash,created_by) values(revision_id,p_files,p_hash,p_actor);
  return jsonb_build_object('project',project,'sourceHash',p_hash,'revisionId',revision_id);
end $$;
create function public.co_dev_source_get(p_actor text,p_revision uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.co_dev_assert(p_actor);
  return (select jsonb_build_object('revisionId',revision_id,'files',files,'sourceHash',source_hash,'createdBy',created_by) from public.co_dev_sources where revision_id=p_revision);
end $$;
create function public.co_dev_records_list(p_actor text,p_project uuid,p_collection text,p_after uuid,p_limit integer,p_archived boolean) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare items jsonb;
begin
  perform public.co_dev_assert(p_actor);
  if not exists(select 1 from public.co_dev_projects where id=p_project) then raise exception 'NOT_FOUND'; end if;
  if p_limit not between 1 and 100 then raise exception 'INVALID_BODY'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into items from (
    select * from public.co_dev_records where project_id=p_project and collection=p_collection and (p_after is null or id>p_after) and (p_archived or not archived) order by id limit p_limit+1
  ) r;
  if jsonb_array_length(items)>p_limit then
    return jsonb_build_object('records',items-p_limit,'nextCursor',items->(p_limit-1)->>'id');
  end if;
  return jsonb_build_object('records',items,'nextCursor',null);
end $$;
create function public.co_dev_record_save(p_actor text,p_project uuid,p_collection text,p_id uuid,p_data jsonb,p_expected integer,p_archived boolean) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item public.co_dev_records;
begin
  perform public.co_dev_assert(p_actor);
  perform pg_advisory_xact_lock(hashtextextended(p_project::text,6120721));
  if not exists(select 1 from public.co_dev_projects where id=p_project) then raise exception 'NOT_FOUND'; end if;
  if (select count(*) from public.co_dev_record_history where updated_by=p_actor and updated_at>now()-interval '1 hour')>=300 then raise exception 'RATE_LIMITED'; end if;
  if p_expected=0 then
    if (select count(*) from public.co_dev_records where project_id=p_project)>=500 then raise exception 'PROJECT_LIMIT'; end if;
    insert into public.co_dev_records(project_id,collection,id,data,version,archived,updated_by) values(p_project,p_collection,p_id,p_data,1,p_archived,p_actor)
      on conflict(project_id,collection,id) do nothing returning * into item;
  else
    update public.co_dev_records set data=p_data,version=version+1,archived=p_archived,updated_by=p_actor,updated_at=now()
      where project_id=p_project and collection=p_collection and id=p_id and version=p_expected returning * into item;
  end if;
  if item.id is null then raise exception 'RECORD_CONFLICT'; end if;
  insert into public.co_dev_record_history(project_id,collection,id,version,data,archived,updated_by)
    values(item.project_id,item.collection,item.id,item.version,item.data,item.archived,p_actor);
  return to_jsonb(item);
end $$;
revoke all on function public.co_dev_bundle_save(text,uuid,integer,text,text,text,jsonb,jsonb,text),public.co_dev_source_get(text,uuid),public.co_dev_records_list(text,uuid,text,uuid,integer,boolean),public.co_dev_record_save(text,uuid,text,uuid,jsonb,integer,boolean) from public,anon,authenticated;
grant execute on function public.co_dev_bundle_save(text,uuid,integer,text,text,text,jsonb,jsonb,text),public.co_dev_source_get(text,uuid),public.co_dev_records_list(text,uuid,text,uuid,integer,boolean),public.co_dev_record_save(text,uuid,text,uuid,jsonb,integer,boolean) to service_role;
commit;
