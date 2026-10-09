-- Additive, server-only application namespace. No native K_LINE table is altered.
create table public.woo_v1_organizations (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
  owner_id uuid not null, created_at timestamptz not null default now()
);
create table public.woo_v1_organization_members (
  organization_id uuid not null references public.woo_v1_organizations(id), member_id uuid not null,
  role text not null check(role in ('owner','admin','member')), primary key(organization_id,member_id)
);
create table public.woo_v1_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.woo_v1_organizations(id),
  title text not null check(length(title) between 1 and 180), description text not null default '', description_en text not null default '',
  starts_at timestamptz not null, ends_at timestamptz not null, location text not null,
  online boolean not null default false, capacity integer check(capacity between 1 and 10000),
  waitlist boolean not null default true, approval text not null check(approval in ('automatic','manual')),
  applications_open_at timestamptz not null, applications_close_at timestamptz not null,
  visibility text not null default 'public' check(visibility in ('public','members')),
  status text not null default 'draft' check(status in ('draft','scheduled','open','closed','completed','cancelled')),
  questions jsonb not null default '[]' check(jsonb_typeof(questions)='array'),
  memories_enabled boolean not null default false, created_by uuid not null,
  revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at > starts_at), check(applications_close_at > applications_open_at), check(applications_close_at <= ends_at)
);
create index woo_v1_events_discovery on public.woo_v1_events(status,visibility,starts_at,id);
create table public.woo_v1_event_admin_roles (
  event_id uuid not null references public.woo_v1_events(id), member_id uuid not null,
  role text not null check(role in ('manager','staff')), granted_by uuid not null,
  primary key(event_id,member_id)
);
create table public.woo_v1_applications (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.woo_v1_events(id),
  member_id uuid not null, display_name text not null, answers jsonb not null default '{}',
  status text not null check(status in ('submitted','approved','waitlist','rejected','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(event_id,member_id)
);
create index woo_v1_applications_owner on public.woo_v1_applications(member_id,event_id);
create table public.woo_v1_attendance (
  event_id uuid not null references public.woo_v1_events(id), member_id uuid not null,
  confirmed_by uuid not null, confirmed_at timestamptz not null default now(), primary key(event_id,member_id)
);
create table public.woo_v1_memories (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.woo_v1_events(id),
  owner_id uuid not null, title text not null, body text not null default '',
  visibility text not null default 'private' check(visibility in ('private','participants','public')),
  status text not null default 'pending' check(status in ('pending','published','hidden')),
  photo_consent boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index woo_v1_memories_event on public.woo_v1_memories(event_id,created_at);
create table public.woo_v1_memory_assets (
  id uuid primary key default gen_random_uuid(), memory_id uuid not null references public.woo_v1_memories(id) on delete cascade,
  owner_id uuid not null, storage_path text not null unique, mime_type text not null,
  bytes integer not null check(bytes between 1 and 5242880), created_at timestamptz not null default now()
);
create table public.woo_v1_announcements (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.woo_v1_events(id),
  body_ko text not null, body_en text not null, application_url text not null default '',
  status text not null default 'draft' check(status in ('draft','published','archived')), created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.woo_v1_ai_generations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null, draft jsonb not null,
  provider text not null, created_at timestamptz not null default now()
);
create table public.woo_v1_audit (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null, action text not null,
  event_id uuid, target_id uuid, created_at timestamptz not null default now()
);
create table public.woo_v1_mobile_grants (
  code_hash text primary key, member_id uuid not null, challenge text not null,
  expires_at timestamptz not null, consumed_at timestamptz
);
create table public.woo_v1_mobile_sessions (
  token_hash text primary key, member_id uuid not null, expires_at timestamptz not null,
  revoked_at timestamptz, created_at timestamptz not null default now()
);
create index woo_v1_mobile_sessions_member on public.woo_v1_mobile_sessions(member_id);
create table public.woo_v1_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null,
  memory_id uuid not null references public.woo_v1_memories(id), reason text not null,
  status text not null default 'open' check(status in ('open','resolved')), created_at timestamptz not null default now()
);
create table public.woo_v1_blocks (
  member_id uuid not null, blocked_id uuid not null, primary key(member_id,blocked_id), check(member_id<>blocked_id)
);
create table public.woo_v1_deletion_requests (
  id uuid primary key default gen_random_uuid(), member_id uuid not null unique,
  status text not null default 'pending' check(status in ('pending','processing','completed')),
  created_at timestamptz not null default now(), completed_at timestamptz
);

-- Service-only access because K_LINE identities are NextAuth, not Supabase Auth users.
do $$ declare t text; begin
  foreach t in array array['organizations','organization_members','events','event_admin_roles','applications','attendance','memories','memory_assets','announcements','ai_generations','audit','mobile_grants','mobile_sessions','reports','blocks','deletion_requests'] loop
    execute format('alter table public.woo_v1_%I enable row level security',t);
    execute format('revoke all on public.woo_v1_%I from public, anon, authenticated',t);
    execute format('grant all on public.woo_v1_%I to service_role',t);
  end loop;
end $$;

create function public.woo_v1_is_manager(p_actor uuid,p_event uuid,p_owner_only boolean default false)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.woo_v1_events e join public.woo_v1_organization_members m on m.organization_id=e.organization_id
    where e.id=p_event and m.member_id=p_actor and m.role in ('owner','admin'))
    or (not p_owner_only and exists(select 1 from public.woo_v1_event_admin_roles r where r.event_id=p_event and r.member_id=p_actor and r.role='manager'));
$$;
revoke all on function public.woo_v1_is_manager(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.woo_v1_is_manager(uuid,uuid,boolean) to service_role;

create function public.woo_v1_exchange_grant(p_code_hash text,p_challenge text,p_token_hash text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare m uuid;
begin
  update public.woo_v1_mobile_grants set consumed_at=now()
  where code_hash=p_code_hash and challenge=p_challenge and consumed_at is null and expires_at>now() returning member_id into m;
  if m is null then raise exception 'INVALID_LOGIN_CODE'; end if;
  insert into public.woo_v1_mobile_sessions(token_hash,member_id,expires_at) values(p_token_hash,m,now()+interval '30 days');
  return m;
end $$;
revoke all on function public.woo_v1_exchange_grant(text,text,text) from public,anon,authenticated;
grant execute on function public.woo_v1_exchange_grant(text,text,text) to service_role;

create function public.woo_v1_command(p_actor uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
<<command_scope>>
declare
  e public.woo_v1_events; a public.woo_v1_applications; m public.woo_v1_memories;
  event_id uuid; organization_id uuid; target_id uuid; result jsonb; next_status text; used integer;
  q jsonb; answer jsonb; choice jsonb; now_at timestamptz:=now();
begin
  if p_actor is null then raise exception 'LOGIN_REQUIRED'; end if;
  if exists(select 1 from public.woo_v1_deletion_requests where member_id=p_actor and status<>'completed') then raise exception 'DELETION_PENDING'; end if;
  if p_action='create_organization' then
    if length(trim(p_data->>'name')) not between 1 and 120 then raise exception 'INVALID_NAME'; end if;
    insert into public.woo_v1_organizations(name,owner_id) values(trim(p_data->>'name'),p_actor) returning id into organization_id;
    insert into public.woo_v1_organization_members values(organization_id,p_actor,'owner');
    result:=jsonb_build_object('id',organization_id); target_id:=organization_id;
  elsif p_action='create_event' then
    organization_id:=(p_data->>'organizationId')::uuid;
    if not exists(select 1 from public.woo_v1_organization_members where woo_v1_organization_members.organization_id=command_scope.organization_id and member_id=p_actor and role in ('owner','admin')) then raise exception 'FORBIDDEN'; end if;
    insert into public.woo_v1_events(organization_id,title,description,description_en,starts_at,ends_at,location,online,capacity,waitlist,approval,applications_open_at,applications_close_at,visibility,questions,created_by)
    values(organization_id,p_data->>'title',p_data->>'description',p_data->>'descriptionEn',(p_data->>'startsAt')::timestamptz,(p_data->>'endsAt')::timestamptz,p_data->>'location',(p_data->>'online')::boolean,(p_data->>'capacity')::integer,(p_data->>'waitlist')::boolean,p_data->>'approval',(p_data->>'applicationsOpenAt')::timestamptz,(p_data->>'applicationsCloseAt')::timestamptz,p_data->>'visibility',p_data->'questions',p_actor) returning id into event_id;
    result:=jsonb_build_object('id',event_id);
  elsif p_action='block_user' then
    target_id:=(p_data->>'memberId')::uuid;
    if target_id=p_actor then raise exception 'INVALID_TARGET'; end if;
    insert into public.woo_v1_blocks values(p_actor,target_id) on conflict do nothing;
    result:=jsonb_build_object('blocked',true);
  elsif p_action='request_deletion' then
    insert into public.woo_v1_deletion_requests(member_id) values(p_actor) on conflict(member_id) do nothing;
    update public.woo_v1_mobile_sessions set revoked_at=now_at where member_id=p_actor;
    result:=jsonb_build_object('status','pending');
  else
    event_id:=(p_data->>'eventId')::uuid;
    select * into e from public.woo_v1_events where id=event_id for update;
    if e.id is null then raise exception 'NOT_FOUND'; end if;
    if p_action='apply' then
      if e.status<>'open' or now_at<e.applications_open_at or now_at>=e.applications_close_at then raise exception 'APPLICATION_CLOSED'; end if;
      if e.visibility='members' and not exists(select 1 from public.woo_v1_organization_members where woo_v1_organization_members.organization_id=e.organization_id and member_id=p_actor) then raise exception 'FORBIDDEN'; end if;
      if jsonb_typeof(p_data->'answers')<>'object' then raise exception 'INVALID_ANSWERS'; end if;
      for q in select value from jsonb_array_elements(e.questions) loop
        answer:=p_data->'answers'->(q->>'id');
        if q->>'type'='multiple' then
          if answer is not null and jsonb_typeof(answer)<>'array' then raise exception 'INVALID_ANSWER'; end if;
          if (q->>'required')::boolean and (answer is null or jsonb_array_length(answer)=0) then raise exception 'ANSWER_REQUIRED'; end if;
          for choice in select value from jsonb_array_elements(coalesce(answer,'[]')) loop
            if not (q->'options' @> jsonb_build_array(choice)) then raise exception 'INVALID_CHOICE'; end if;
          end loop;
        else
          if answer is not null and jsonb_typeof(answer)<>'string' then raise exception 'INVALID_ANSWER'; end if;
          if (q->>'required')::boolean and coalesce(length(trim(answer#>>'{}')),0)=0 then raise exception 'ANSWER_REQUIRED'; end if;
          if q->>'type'='single' and coalesce(answer#>>'{}','')<>'' and not(q->'options' @> jsonb_build_array(answer)) then raise exception 'INVALID_CHOICE'; end if;
        end if;
      end loop;
      select * into a from public.woo_v1_applications where woo_v1_applications.event_id=e.id and member_id=p_actor;
      if a.id is not null and a.status<>'cancelled' then raise exception 'ALREADY_APPLIED'; end if;
      select count(*) into used from public.woo_v1_applications where woo_v1_applications.event_id=e.id and status in ('submitted','approved');
      next_status:=case when e.capacity is not null and used>=e.capacity then 'waitlist' when e.approval='manual' then 'submitted' else 'approved' end;
      if next_status='waitlist' and not e.waitlist then raise exception 'CAPACITY_FULL'; end if;
      insert into public.woo_v1_applications(event_id,member_id,display_name,answers,status)
      values(e.id,p_actor,p_data->>'displayName',p_data->'answers',next_status)
      on conflict(event_id,member_id) do update set answers=excluded.answers,status=excluded.status,updated_at=now_at returning id into target_id;
      result:=jsonb_build_object('id',target_id,'status',next_status);
    elsif p_action='cancel_application' then
      if e.status in ('completed','cancelled') then raise exception 'APPLICATION_CLOSED'; end if;
      update public.woo_v1_applications set status='cancelled',updated_at=now_at where woo_v1_applications.event_id=e.id and member_id=p_actor returning id into target_id;
      if target_id is null then raise exception 'NOT_FOUND'; end if;
      result:=jsonb_build_object('status','cancelled');
    elsif p_action='save_memory' then
      if e.status<>'completed' or not e.memories_enabled then raise exception 'MEMORIES_NOT_OPEN'; end if;
      if not public.woo_v1_is_manager(p_actor,e.id) and not exists(select 1 from public.woo_v1_attendance where woo_v1_attendance.event_id=e.id and member_id=p_actor) then raise exception 'ATTENDANCE_REQUIRED'; end if;
      if p_data->>'visibility'<>'private' and (p_data->>'photoConsent')::boolean is not true then raise exception 'CONSENT_REQUIRED'; end if;
      if p_data->>'memoryId' is not null then
        target_id:=(p_data->>'memoryId')::uuid;
        update public.woo_v1_memories set title=p_data->>'title',body=p_data->>'body',visibility=p_data->>'visibility',photo_consent=(p_data->>'photoConsent')::boolean,status='pending',updated_at=now_at
        where id=target_id and woo_v1_memories.event_id=e.id and owner_id=p_actor;
        if not found then raise exception 'FORBIDDEN'; end if;
      else
        insert into public.woo_v1_memories(event_id,owner_id,title,body,visibility,photo_consent)
        values(e.id,p_actor,p_data->>'title',p_data->>'body',p_data->>'visibility',(p_data->>'photoConsent')::boolean) returning id into target_id;
      end if;
      result:=jsonb_build_object('id',target_id,'status','pending');
    elsif p_action='report_memory' then
      select * into m from public.woo_v1_memories where id=(p_data->>'memoryId')::uuid and woo_v1_memories.event_id=e.id;
      if m.id is null or m.status<>'published' or (m.visibility='private' and m.owner_id<>p_actor) or (m.visibility='participants' and not exists(select 1 from public.woo_v1_attendance where woo_v1_attendance.event_id=e.id and member_id=p_actor)) then raise exception 'NOT_FOUND'; end if;
      insert into public.woo_v1_reports(reporter_id,memory_id,reason) values(p_actor,m.id,p_data->>'reason') returning id into target_id;
      result:=jsonb_build_object('id',target_id);
    else
      if not public.woo_v1_is_manager(p_actor,e.id) then raise exception 'FORBIDDEN'; end if;
      if p_action='update_event' then
        if e.revision<>(p_data->>'revision')::integer then raise exception 'REVISION_CONFLICT'; end if;
        if e.status in ('completed','cancelled') then raise exception 'EVENT_IMMUTABLE'; end if;
        if exists(select 1 from public.woo_v1_applications where woo_v1_applications.event_id=e.id) and e.questions<>p_data->'questions' then raise exception 'FORM_HAS_RESPONSES'; end if;
        select count(*) into used from public.woo_v1_applications where woo_v1_applications.event_id=e.id and status in ('submitted','approved');
        if (p_data->>'capacity')::integer<used then raise exception 'CAPACITY_BELOW_APPLICATIONS'; end if;
        update public.woo_v1_events set title=p_data->>'title',description=p_data->>'description',description_en=p_data->>'descriptionEn',starts_at=(p_data->>'startsAt')::timestamptz,ends_at=(p_data->>'endsAt')::timestamptz,location=p_data->>'location',online=(p_data->>'online')::boolean,capacity=(p_data->>'capacity')::integer,waitlist=(p_data->>'waitlist')::boolean,approval=p_data->>'approval',applications_open_at=(p_data->>'applicationsOpenAt')::timestamptz,applications_close_at=(p_data->>'applicationsCloseAt')::timestamptz,visibility=p_data->>'visibility',questions=p_data->'questions',revision=revision+1,updated_at=now_at where id=e.id;
        result:=jsonb_build_object('id',e.id,'revision',e.revision+1);
      elsif p_action='set_status' then
        next_status:=p_data->>'status';
        if not ((e.status='draft' and next_status in ('scheduled','open','cancelled')) or (e.status='scheduled' and next_status in ('draft','open','cancelled')) or (e.status='open' and next_status in ('closed','cancelled')) or (e.status='closed' and next_status in ('open','completed','cancelled'))) then raise exception 'INVALID_TRANSITION'; end if;
        if next_status='completed' and e.ends_at>now_at then raise exception 'EVENT_NOT_FINISHED'; end if;
        update public.woo_v1_events set status=next_status,memories_enabled=(next_status='completed'),revision=revision+1,updated_at=now_at where id=e.id;
        result:=jsonb_build_object('id',e.id,'status',next_status);
      elsif p_action='review_application' then
        select * into a from public.woo_v1_applications where id=(p_data->>'applicationId')::uuid and woo_v1_applications.event_id=e.id;
        if a.id is null then raise exception 'NOT_FOUND'; end if;
        if e.status in ('completed','cancelled') or a.status='cancelled' then raise exception 'APPLICATION_IMMUTABLE'; end if;
        next_status:=p_data->>'status';
        if next_status not in ('approved','rejected','waitlist') then raise exception 'INVALID_STATUS'; end if;
        select count(*) into used from public.woo_v1_applications where woo_v1_applications.event_id=e.id and id<>a.id and status in ('submitted','approved');
        if next_status='approved' and e.capacity is not null and used>=e.capacity then raise exception 'CAPACITY_FULL'; end if;
        update public.woo_v1_applications set status=next_status,updated_at=now_at where id=a.id;
        target_id:=a.id; result:=jsonb_build_object('status',next_status);
      elsif p_action='confirm_attendance' then
        if e.status='cancelled' or e.starts_at>now_at then raise exception 'EVENT_NOT_STARTED'; end if;
        target_id:=(p_data->>'memberId')::uuid;
        if not exists(select 1 from public.woo_v1_applications where woo_v1_applications.event_id=e.id and member_id=target_id and status='approved') then raise exception 'APPROVAL_REQUIRED'; end if;
        insert into public.woo_v1_attendance values(e.id,target_id,p_actor,now_at) on conflict(event_id,member_id) do nothing;
        result:=jsonb_build_object('attended',true);
      elsif p_action='set_event_role' then
        if not public.woo_v1_is_manager(p_actor,e.id,true) then raise exception 'FORBIDDEN'; end if;
        target_id:=(p_data->>'memberId')::uuid;
        if p_data->>'role'='remove' then delete from public.woo_v1_event_admin_roles where woo_v1_event_admin_roles.event_id=e.id and member_id=target_id;
        else insert into public.woo_v1_event_admin_roles values(e.id,target_id,p_data->>'role',p_actor) on conflict(event_id,member_id) do update set role=excluded.role,granted_by=p_actor; end if;
        result:=jsonb_build_object('updated',true);
      elsif p_action='save_announcement' then
        insert into public.woo_v1_announcements(event_id,body_ko,body_en,application_url,status,created_by)
        values(e.id,p_data->>'bodyKo',p_data->>'bodyEn',p_data->>'applicationUrl',p_data->>'status',p_actor) returning id into target_id;
        result:=jsonb_build_object('id',target_id);
      elsif p_action='moderate_memory' then
        target_id:=(p_data->>'memoryId')::uuid;
        if p_data->>'status' not in ('published','hidden') then raise exception 'INVALID_STATUS'; end if;
        update public.woo_v1_memories set status=p_data->>'status',updated_at=now_at where id=target_id and woo_v1_memories.event_id=e.id;
        if not found then raise exception 'NOT_FOUND'; end if;
        result:=jsonb_build_object('status',p_data->>'status');
      else raise exception 'UNKNOWN_ACTION'; end if;
    end if;
  end if;
  insert into public.woo_v1_audit(actor_id,action,event_id,target_id) values(p_actor,p_action,event_id,target_id);
  return result;
end $$;
revoke all on function public.woo_v1_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.woo_v1_command(uuid,text,jsonb) to service_role;
