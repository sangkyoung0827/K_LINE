begin;

alter table public.traditional_liquor_import_batches
  add column if not exists discarded_at timestamptz,
  add column if not exists discard_reason text,
  add column if not exists production_committed_at timestamptz;

update public.traditional_liquor_import_batches
set production_committed_at = coalesce(production_committed_at, finished_at, created_at)
where status = 'COMPLETED'
  and production_committed_at is null;

alter table public.traditional_liquor_import_batches
  drop constraint if exists traditional_liquor_import_batches_status_check;

alter table public.traditional_liquor_import_batches
  add constraint traditional_liquor_import_batches_status_check
  check (status in ('PENDING','PARSING','VALIDATING','READY','IMPORTING','COMPLETED','FAILED','DISCARDED'));

create index if not exists idx_traditional_liquor_import_batches_status_created
  on public.traditional_liquor_import_batches (status, created_at desc);

create or replace function public.track_traditional_liquor_import_batch_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    new.production_committed_at := coalesce(new.production_committed_at, now());
  end if;

  if new.status = 'DISCARDED' then
    new.discarded_at := coalesce(new.discarded_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_traditional_liquor_import_batch_status
  on public.traditional_liquor_import_batches;
create trigger trg_traditional_liquor_import_batch_status
before update on public.traditional_liquor_import_batches
for each row execute function public.track_traditional_liquor_import_batch_status();

create or replace function public.discard_traditional_liquor_import_batch(
  p_batch_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.traditional_liquor_import_batches%rowtype;
begin
  select * into v_batch
  from public.traditional_liquor_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status = 'IMPORTING' then
    raise exception 'IMPORTING_BATCH_CANNOT_BE_DISCARDED';
  end if;

  update public.traditional_liquor_import_batches
  set status = 'DISCARDED',
      discarded_at = coalesce(discarded_at, now()),
      discard_reason = nullif(left(trim(coalesce(p_reason, '')), 500), ''),
      finished_at = coalesce(finished_at, now())
  where id = p_batch_id;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'discarded', true,
    'productionCommitted', v_batch.production_committed_at is not null or v_batch.status = 'COMPLETED'
  );
end;
$$;

create or replace function public.delete_uncommitted_traditional_liquor_import_batch(
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.traditional_liquor_import_batches%rowtype;
  v_staging_deleted integer := 0;
  v_errors_deleted integer := 0;
begin
  select * into v_batch
  from public.traditional_liquor_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status <> 'DISCARDED' then
    raise exception 'BATCH_MUST_BE_DISCARDED_FIRST';
  end if;

  if v_batch.production_committed_at is not null
     or exists (
       select 1 from public.traditional_liquor_offers
       where import_batch_id = p_batch_id
     ) then
    raise exception 'COMMITTED_BATCH_CANNOT_BE_DELETED';
  end if;

  delete from public.traditional_liquor_import_errors
  where batch_id = p_batch_id;
  get diagnostics v_errors_deleted = row_count;

  delete from public.traditional_liquor_import_staging_rows
  where batch_id = p_batch_id;
  get diagnostics v_staging_deleted = row_count;

  delete from public.traditional_liquor_import_batches
  where id = p_batch_id;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'deleted', true,
    'stagingRowsDeleted', v_staging_deleted,
    'errorsDeleted', v_errors_deleted
  );
end;
$$;

revoke all on function public.discard_traditional_liquor_import_batch(uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_uncommitted_traditional_liquor_import_batch(uuid)
  from public, anon, authenticated;

grant execute on function public.discard_traditional_liquor_import_batch(uuid, text)
  to service_role;
grant execute on function public.delete_uncommitted_traditional_liquor_import_batch(uuid)
  to service_role;

comment on column public.traditional_liquor_import_batches.discarded_at is
  'Audit timestamp for a batch excluded from future resolution and Production commit.';
comment on column public.traditional_liquor_import_batches.discard_reason is
  'Administrator-provided reason for discarding the batch.';
comment on column public.traditional_liquor_import_batches.production_committed_at is
  'Permanent audit marker proving that a Production commit ran for this batch.';

commit;
