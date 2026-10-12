-- REVIEW ONLY: additive archive schema. Do not apply to production without approval/backup.
-- NextAuth identities are checked by the server; no browser/JWT role grants are trusted.
create table public.event_archive_import_jobs (
 id uuid primary key default gen_random_uuid(), actor_email text not null,
 club_key text not null check (club_key in ('ecc','hanhwal','social_impact_union','unclassified')),
 idempotency_key text not null, payload_sha256 text not null,
 manifest jsonb not null, results jsonb not null default '[]',
 status text not null default 'pending' check (status in ('pending','running','partial','saved')),
 lease_until timestamptz, lease_token uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(actor_email,idempotency_key)
);
create table public.event_archive_items (
 id uuid primary key default gen_random_uuid(),
 club_key text not null check (club_key in ('ecc','hanhwal','social_impact_union','unclassified')),
 batch_id uuid not null references public.event_archive_import_jobs(id), content_key text not null,
 original_text text, original_text_sha256 text check (original_text_sha256 ~ '^[a-f0-9]{64}$'),
 source_kind text not null, source_identifier text, upstream_formatting text not null default 'unknown',
 title_suggestion text, item_type text not null default 'other' check(item_type in ('notice','poster','plan','application','other')),
 language text, event_type text, event_date date, academic_term text, suggested_tags jsonb not null default '[]', summary text, confidence numeric check(confidence between 0 and 1),
 visibility text not null default 'private' check(visibility in ('private','public')),
 review_status text not null default 'pending' check(review_status in ('pending','approved')),
 classification_status text not null default 'pending' check(classification_status in ('pending','completed','failed','review_required')),
 ai_consent boolean not null default false, ai_search_allowed boolean not null default false,
 reviewed_by text, review_checklist jsonb, created_by text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(club_key,content_key),
 check((original_text is null) = (original_text_sha256 is null)),
 check(visibility <> 'public' or (review_status='approved' and reviewed_by is not null
   and review_checklist is not null and review_checklist @> '{"privacy":true,"copyright":true,"source":true}'::jsonb))
);
create index event_archive_items_scope_date on public.event_archive_items(club_key,created_at desc);
create index event_archive_items_public on public.event_archive_items(created_at desc) where visibility='public' and review_status='approved';
create index event_archive_items_tags on public.event_archive_items using gin(suggested_tags);
create table public.event_archive_assets (
 id uuid primary key default gen_random_uuid(), archive_item_id uuid not null references public.event_archive_items(id),
 original_filename text not null, original_storage_path text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), file_size bigint not null check(file_size between 1 and 26214400),
 mime_type text not null, preview_storage_path text, uploaded_at timestamptz not null default now()
);
create index event_archive_assets_item on public.event_archive_assets(archive_item_id);
create index event_archive_assets_hash on public.event_archive_assets(sha256);
create table public.event_archive_labels (
 id uuid primary key default gen_random_uuid(), archive_item_id uuid not null references public.event_archive_items(id),
 labels jsonb not null, origin text not null check(origin in ('ai','human')), model text, status text not null,
 created_by text not null, created_at timestamptz not null default now()
);
create index event_archive_labels_item on public.event_archive_labels(archive_item_id,created_at desc);
create function public.event_archive_label_reserve(p_id uuid,p_actor text) returns uuid
 language plpgsql security invoker set search_path=public,pg_temp as $$
declare reservation uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('archive-label:'||p_actor,0));
 perform pg_advisory_xact_lock(hashtextextended('archive-label-item:'||p_id::text,0));
 if (select count(*) from public.event_archive_labels where origin='ai' and status in ('reserved','finished') and created_by=p_actor and created_at>now()-interval '1 day') >= 100
 or (select count(*) from public.event_archive_labels where origin='ai' and archive_item_id=p_id and status in ('reserved','finished') and created_at>now()-interval '1 day') >= 3
 then raise exception 'ARCHIVE_RATE_LIMIT'; end if;
 if exists(select 1 from public.event_archive_labels where archive_item_id=p_id and status='reserved' and created_at>now()-interval '3 minutes') then raise exception 'IMPORT_BUSY'; end if;
 insert into public.event_archive_labels(archive_item_id,labels,origin,status,created_by) values(p_id,'{}','ai','reserved',p_actor) returning id into reservation;
 return reservation;
end $$;
create table public.event_archive_links (
 id uuid primary key default gen_random_uuid(), archive_item_id uuid not null references public.event_archive_items(id),
 target_kind text not null check(target_kind in ('import','studio_job','event','google_form','post')),
 target_id text not null, input_index integer, created_by text not null, created_at timestamptz not null default now(),
 unique(archive_item_id,target_kind,target_id,input_index)
);
create index event_archive_links_target on public.event_archive_links(target_kind,target_id);
create table public.event_archive_versions (
 id uuid primary key default gen_random_uuid(), original_item_id uuid not null references public.event_archive_items(id),
 version_item_id uuid not null references public.event_archive_items(id), created_by text not null,
 created_at timestamptz not null default now(), unique(original_item_id,version_item_id), check(original_item_id <> version_item_id)
);
create index event_archive_versions_child on public.event_archive_versions(version_item_id);

create function public.event_archive_immutable() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if tg_table_name = 'event_archive_items' then
  if row(new.original_text,new.original_text_sha256,new.club_key,new.content_key,new.batch_id,new.source_kind,new.source_identifier,new.upstream_formatting,new.created_by,new.created_at)
     is distinct from row(old.original_text,old.original_text_sha256,old.club_key,old.content_key,old.batch_id,old.source_kind,old.source_identifier,old.upstream_formatting,old.created_by,old.created_at)
  then raise exception 'ARCHIVE_ORIGINAL_IMMUTABLE'; end if;
 elsif tg_table_name = 'event_archive_assets' then
  if row(new.archive_item_id,new.original_filename,new.original_storage_path,new.sha256,new.file_size,new.mime_type)
     is distinct from row(old.archive_item_id,old.original_filename,old.original_storage_path,old.sha256,old.file_size,old.mime_type)
  then raise exception 'ARCHIVE_ASSET_IMMUTABLE'; end if;
 else
  if row(new.actor_email,new.club_key,new.idempotency_key,new.payload_sha256,new.manifest)
     is distinct from row(old.actor_email,old.club_key,old.idempotency_key,old.payload_sha256,old.manifest)
  then raise exception 'ARCHIVE_IMPORT_IMMUTABLE'; end if;
 end if;
 return new;
end $$;
create trigger event_archive_original_guard before update on public.event_archive_items for each row execute function public.event_archive_immutable();
create trigger event_archive_asset_guard before update on public.event_archive_assets for each row execute function public.event_archive_immutable();
create trigger event_archive_import_guard before update on public.event_archive_import_jobs for each row execute function public.event_archive_immutable();

-- Persistent rate limit + exact idempotency contract, not process-local memory.
create function public.event_archive_reserve(p_actor text,p_manifest jsonb,p_hash text) returns jsonb
 language plpgsql security invoker set search_path=public,pg_temp as $$
declare j public.event_archive_import_jobs;
begin
 perform pg_advisory_xact_lock(hashtextextended('archive:'||p_actor,0));
 select * into j from public.event_archive_import_jobs where actor_email=p_actor and idempotency_key=p_manifest->>'idempotencyKey';
 if found then
  if j.payload_sha256 <> p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return to_jsonb(j);
 end if;
 if (select count(*) from public.event_archive_import_jobs where actor_email=p_actor and created_at > now()-interval '1 hour') >= 30 then raise exception 'ARCHIVE_RATE_LIMIT'; end if;
 insert into public.event_archive_import_jobs(actor_email,club_key,idempotency_key,payload_sha256,manifest)
 values(p_actor,p_manifest->>'clubKey',p_manifest->>'idempotencyKey',p_hash,p_manifest) returning * into j;
 return to_jsonb(j);
end $$;
create function public.event_archive_claim(p_id uuid,p_actor text,p_token uuid) returns jsonb
 language plpgsql security invoker set search_path=public,pg_temp as $$
declare j public.event_archive_import_jobs;
begin
 update public.event_archive_import_jobs set status='running',lease_token=p_token,lease_until=now()+interval '3 minutes',updated_at=now()
 where id=p_id and actor_email=p_actor and (lease_until is null or lease_until < now()) returning * into j;
 if not found then raise exception 'IMPORT_BUSY'; end if;
 return to_jsonb(j);
end $$;
-- Asset and item metadata commit in one transaction; retry must not leave a half-item.
create function public.event_archive_commit(p_item jsonb,p_asset jsonb,p_token uuid) returns jsonb
 language plpgsql security invoker set search_path=public,pg_temp as $$
declare i public.event_archive_items; reused_path text;
begin
 perform 1 from public.event_archive_import_jobs
 where id=(p_item->>'batch_id')::uuid and actor_email=p_item->>'created_by'
   and lease_token=p_token and lease_until>now() for update;
 if not found then raise exception 'IMPORT_BUSY'; end if;
 if p_asset is not null then
  perform pg_advisory_xact_lock(hashtextextended('archive-blob:'||(p_item->>'club_key')||':'||(p_asset->>'sha256'),0));
  select a.original_storage_path into reused_path from public.event_archive_assets a
  join public.event_archive_items existing on existing.id=a.archive_item_id
  where existing.club_key=p_item->>'club_key' and a.sha256=p_asset->>'sha256'
    and a.file_size=(p_asset->>'file_size')::bigint and a.mime_type=p_asset->>'mime_type'
  order by a.uploaded_at limit 1;
  if reused_path is not null then p_asset=jsonb_set(p_asset,'{original_storage_path}',to_jsonb(reused_path)); end if;
 end if;
 insert into public.event_archive_items(club_key,batch_id,content_key,original_text,original_text_sha256,source_kind,source_identifier,upstream_formatting,ai_consent,created_by)
 values(p_item->>'club_key',(p_item->>'batch_id')::uuid,p_item->>'content_key',p_item->>'original_text',p_item->>'original_text_sha256',p_item->>'source_kind',p_item->>'source_identifier',p_item->>'upstream_formatting',(p_item->>'ai_consent')::boolean,p_item->>'created_by')
 on conflict(club_key,content_key) do nothing returning * into i;
 if found then
  if p_asset is not null then
   insert into public.event_archive_assets(archive_item_id,original_filename,original_storage_path,sha256,file_size,mime_type)
   values(i.id,p_asset->>'original_filename',p_asset->>'original_storage_path',p_asset->>'sha256',(p_asset->>'file_size')::bigint,p_asset->>'mime_type');
  end if;
 else
  select * into i from public.event_archive_items where club_key=p_item->>'club_key' and content_key=p_item->>'content_key';
 end if;
 return to_jsonb(i);
end $$;

-- Deny all direct Data API access. NextAuth is NOT a Supabase JWT; never authorize by a user-editable email claim.
-- Scoped server APIs authorize before service-role use. Signed downloads expire in 60 seconds.
alter table public.event_archive_items enable row level security;
alter table public.event_archive_assets enable row level security;
alter table public.event_archive_labels enable row level security;
alter table public.event_archive_import_jobs enable row level security;
alter table public.event_archive_links enable row level security;
alter table public.event_archive_versions enable row level security;
revoke all on public.event_archive_items,public.event_archive_assets,public.event_archive_labels,public.event_archive_import_jobs,public.event_archive_links,public.event_archive_versions from public,anon,authenticated;
grant select,insert,update on public.event_archive_items,public.event_archive_assets,public.event_archive_import_jobs to service_role;
grant select,insert,update on public.event_archive_labels to service_role;
grant select,insert on public.event_archive_links,public.event_archive_versions to service_role;
revoke all on function public.event_archive_immutable(),public.event_archive_reserve(text,jsonb,text),public.event_archive_claim(uuid,text,uuid),public.event_archive_commit(jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.event_archive_reserve(text,jsonb,text),public.event_archive_claim(uuid,text,uuid),public.event_archive_commit(jsonb,jsonb,uuid) to service_role;
revoke all on function public.event_archive_label_reserve(uuid,text) from public,anon,authenticated;
grant execute on function public.event_archive_label_reserve(uuid,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-assets','event-assets',false,26214400,
 array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
-- Restrictive policies also defeat any pre-existing permissive policies on shared storage.objects.
create policy event_archive_no_direct_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id <> 'event-assets');
create policy event_archive_no_direct_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id <> 'event-assets');
create policy event_archive_no_direct_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id <> 'event-assets') with check(bucket_id <> 'event-assets');
create policy event_archive_no_direct_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id <> 'event-assets');
