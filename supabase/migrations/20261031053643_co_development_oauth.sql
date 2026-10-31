-- Additive, server-only OAuth state. Does not alter projects, legacy keys or club data.
begin;
create table public.co_dev_oauth_clients (
  id text primary key, issuer text not null, metadata jsonb not null,
  secret_hash text, created_at timestamptz not null default now()
);
create table public.co_dev_oauth_grants (
  id uuid primary key, email text not null, client_id text not null references public.co_dev_oauth_clients(id),
  issuer text not null, resource text not null, scope text not null check(scope='lab:develop'),
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '90 days',
  revoked_at timestamptz
);
create index co_dev_oauth_grants_email on public.co_dev_oauth_grants(email,created_at desc);
create table public.co_dev_oauth_requests (
  id uuid primary key, client_id text not null references public.co_dev_oauth_clients(id),
  issuer text not null, resource text not null, scope text not null check(scope='lab:develop'),
  redirect_uri text not null, state text, challenge text not null, nonce_hash text not null,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes',
  decided_at timestamptz, code_hash text unique, consumed_at timestamptz,
  grant_id uuid references public.co_dev_oauth_grants(id)
);
create table public.co_dev_oauth_tokens (
  access_hash text primary key, refresh_hash text unique not null,
  grant_id uuid not null references public.co_dev_oauth_grants(id),
  access_expires_at timestamptz not null default now()+interval '1 hour',
  refresh_expires_at timestamptz not null default now()+interval '30 days',
  refreshed_at timestamptz
);
create index co_dev_oauth_tokens_grant on public.co_dev_oauth_tokens(grant_id);
create table public.co_dev_oauth_limits (
  key text primary key, count integer not null, expires_at timestamptz not null
);

create function public.co_dev_oauth(p_op text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare c public.co_dev_oauth_clients; r public.co_dev_oauth_requests;
  g public.co_dev_oauth_grants; t public.co_dev_oauth_tokens; n integer;
begin
  case p_op
  when 'limit' then
    insert into public.co_dev_oauth_limits(key,count,expires_at)
      values(p_data->>'key',1,now()+interval '1 hour')
      on conflict(key) do update set count=case when co_dev_oauth_limits.expires_at<=now() then 1 else co_dev_oauth_limits.count+1 end,
        expires_at=case when co_dev_oauth_limits.expires_at<=now() then now()+interval '1 hour' else co_dev_oauth_limits.expires_at end
      returning count into n;
    delete from public.co_dev_oauth_limits where expires_at<now()-interval '1 day';
    return to_jsonb(n<=(p_data->>'max')::integer);
  when 'client_get' then
    select * into c from public.co_dev_oauth_clients where id=p_data->>'id' and issuer=p_data->>'issuer';
    return case when found then to_jsonb(c) else null end;
  when 'client_save' then
    insert into public.co_dev_oauth_clients(id,issuer,metadata,secret_hash)
      values(p_data->>'id',p_data->>'issuer',p_data->'metadata',p_data->>'secret_hash')
      on conflict(id) do update set metadata=excluded.metadata where co_dev_oauth_clients.issuer=excluded.issuer and co_dev_oauth_clients.secret_hash is null;
    return 'true'::jsonb;
  when 'request_save' then
    delete from public.co_dev_oauth_requests where expires_at<now()-interval '1 day';
    insert into public.co_dev_oauth_requests(id,client_id,issuer,resource,scope,redirect_uri,state,challenge,nonce_hash)
      values((p_data->>'id')::uuid,p_data->>'client_id',p_data->>'issuer',p_data->>'resource','lab:develop',p_data->>'redirect_uri',p_data->>'state',p_data->>'challenge',p_data->>'nonce_hash');
    return 'true'::jsonb;
  when 'request_get' then
    select * into r from public.co_dev_oauth_requests where id=(p_data->>'id')::uuid and nonce_hash=p_data->>'nonce_hash'
      and issuer=p_data->>'issuer' and expires_at>now() and decided_at is null;
    if not found then return null; end if;
    select * into c from public.co_dev_oauth_clients where id=r.client_id;
    return jsonb_build_object('clientName',c.metadata->>'client_name','redirectUri',r.redirect_uri,'scope',r.scope);
  when 'decide' then
    perform public.co_dev_assert(p_data->>'email');
    select * into r from public.co_dev_oauth_requests where id=(p_data->>'id')::uuid and nonce_hash=p_data->>'nonce_hash'
      and issuer=p_data->>'issuer' and expires_at>now() and decided_at is null for update;
    if not found then return null; end if;
    if (p_data->>'approve')::boolean then
      -- Consent belongs to the authenticated K_LINE user, never a client-provided email.
      insert into public.co_dev_oauth_grants(id,email,client_id,issuer,resource,scope)
        values((p_data->>'grant_id')::uuid,p_data->>'email',r.client_id,r.issuer,r.resource,r.scope);
      update public.co_dev_oauth_requests set decided_at=now(),code_hash=p_data->>'code_hash',grant_id=(p_data->>'grant_id')::uuid,
        expires_at=now()+interval '2 minutes' where id=r.id;
    else
      update public.co_dev_oauth_requests set decided_at=now() where id=r.id;
    end if;
    return jsonb_build_object('redirect_uri',r.redirect_uri,'state',r.state);
  when 'exchange' then
    select * into r from public.co_dev_oauth_requests where code_hash=p_data->>'code_hash' and client_id=p_data->>'client_id'
      and issuer=p_data->>'issuer' and resource=p_data->>'resource' and redirect_uri=p_data->>'redirect_uri' for update;
    if not found then return null; end if;
    if r.consumed_at is not null then
      update public.co_dev_oauth_grants set revoked_at=now() where id=r.grant_id;
      return null;
    end if;
    if r.expires_at<=now() or r.challenge<>p_data->>'challenge' or r.grant_id is null then return null; end if;
    select * into g from public.co_dev_oauth_grants where id=r.grant_id for update;
    if g.revoked_at is not null or g.expires_at<=now() then return null; end if;
    update public.co_dev_oauth_requests set consumed_at=now() where id=r.id;
    insert into public.co_dev_oauth_tokens(access_hash,refresh_hash,grant_id) values(p_data->>'access_hash',p_data->>'refresh_hash',g.id);
    return 'true'::jsonb;
  when 'refresh' then
    -- Lock the grant first: refresh, revocation and code replay serialize consistently.
    select g1.* into g from public.co_dev_oauth_grants g1 join public.co_dev_oauth_tokens t1 on t1.grant_id=g1.id
      where t1.refresh_hash=p_data->>'old_refresh_hash' and g1.client_id=p_data->>'client_id'
      and g1.issuer=p_data->>'issuer' and g1.resource=p_data->>'resource' for update of g1;
    if not found or g.revoked_at is not null or g.expires_at<=now() then return null; end if;
    select * into t from public.co_dev_oauth_tokens where refresh_hash=p_data->>'old_refresh_hash' for update;
    if t.refreshed_at is not null then
      update public.co_dev_oauth_grants set revoked_at=now() where id=g.id;
      return null;
    end if;
    if t.refresh_expires_at<=now() then return null; end if;
    update public.co_dev_oauth_tokens set refreshed_at=now() where access_hash=t.access_hash;
    insert into public.co_dev_oauth_tokens(access_hash,refresh_hash,grant_id) values(p_data->>'access_hash',p_data->>'refresh_hash',g.id);
    return 'true'::jsonb;
  when 'verify' then
    return (select jsonb_build_object('email',g1.email) from public.co_dev_oauth_tokens t1 join public.co_dev_oauth_grants g1 on g1.id=t1.grant_id
      where t1.access_hash=p_data->>'hash' and t1.access_expires_at>now() and g1.expires_at>now() and g1.revoked_at is null
      and g1.issuer=p_data->>'issuer' and g1.resource=p_data->>'resource' and g1.scope='lab:develop');
  when 'revoke_token' then
    update public.co_dev_oauth_grants set revoked_at=now() where client_id=p_data->>'client_id' and issuer=p_data->>'issuer'
      and id in(select grant_id from public.co_dev_oauth_tokens where access_hash=p_data->>'hash' or refresh_hash=p_data->>'hash');
    return 'true'::jsonb;
  when 'connections' then
    perform public.co_dev_assert(p_data->>'email');
    return (select coalesce(jsonb_agg(jsonb_build_object('id',g1.id,'clientName',c1.metadata->>'client_name','createdAt',g1.created_at,'expiresAt',g1.expires_at) order by g1.created_at desc),'[]'::jsonb)
      from public.co_dev_oauth_grants g1 join public.co_dev_oauth_clients c1 on c1.id=g1.client_id
      where g1.email=p_data->>'email' and g1.issuer=p_data->>'issuer' and g1.revoked_at is null and g1.expires_at>now());
  when 'disconnect' then
    perform public.co_dev_assert(p_data->>'email');
    update public.co_dev_oauth_grants set revoked_at=now() where id=(p_data->>'id')::uuid and email=p_data->>'email' and issuer=p_data->>'issuer';
    return 'true'::jsonb;
  else raise exception 'INVALID_OPERATION';
  end case;
end $$;

do $$ declare tab text; begin
  foreach tab in array array['co_dev_oauth_clients','co_dev_oauth_grants','co_dev_oauth_requests','co_dev_oauth_tokens','co_dev_oauth_limits'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated',tab);
    execute format('grant select,insert,update,delete on public.%I to service_role',tab);
  end loop;
end $$;
revoke all on function public.co_dev_oauth(text,jsonb) from public,anon,authenticated;
grant execute on function public.co_dev_oauth(text,jsonb) to service_role;
commit;
