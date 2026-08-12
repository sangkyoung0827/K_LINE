begin;

create table if not exists public.traditional_liquor_platform_aliases (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.traditional_liquor_platforms(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_alias)
);

create index if not exists idx_traditional_liquor_platform_aliases_platform
  on public.traditional_liquor_platform_aliases (platform_id);
create index if not exists idx_traditional_liquor_platform_aliases_active_normalized
  on public.traditional_liquor_platform_aliases (is_active, normalized_alias);

insert into public.traditional_liquor_platforms (code, name, base_url, platform_type, is_active)
values
  ('NAVER', '네이버', 'https://shopping.naver.com', 'MARKETPLACE', true),
  ('KAKAO_GIFT', '카카오톡 선물하기', 'https://gift.kakao.com', 'MARKETPLACE', true)
on conflict (code) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  platform_type = excluded.platform_type,
  is_active = true,
  updated_at = now();

with kakao as (
  select id from public.traditional_liquor_platforms where code = 'KAKAO_GIFT'
), aliases(alias_name, normalized_alias) as (
  values
    ('KAKAO_GIFT', 'kakao gift'),
    ('KAKAO', 'kakao'),
    ('카카오', '카카오'),
    ('카카오 선물하기', '카카오 선물하기'),
    ('카카오톡 선물하기', '카카오톡 선물하기'),
    ('gift.kakao.com', 'gift kakao com')
)
insert into public.traditional_liquor_platform_aliases (
  platform_id, alias_name, normalized_alias, is_active
)
select kakao.id, aliases.alias_name, aliases.normalized_alias, true
from kakao cross join aliases
on conflict (normalized_alias) do update set
  platform_id = excluded.platform_id,
  alias_name = excluded.alias_name,
  is_active = true,
  updated_at = now();

alter table public.traditional_liquor_platform_aliases enable row level security;
revoke all on table public.traditional_liquor_platform_aliases from public, anon, authenticated;
grant select, insert, update, delete on table public.traditional_liquor_platform_aliases to service_role;

create or replace function public.assign_traditional_liquor_batch_platform(
  p_batch_id uuid,
  p_platform_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.traditional_liquor_import_batches%rowtype;
  v_platform public.traditional_liquor_platforms%rowtype;
  v_applied integer := 0;
begin
  select * into v_batch
  from public.traditional_liquor_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'IMPORT_BATCH_NOT_FOUND';
  end if;
  if v_batch.status <> 'READY' or v_batch.import_type <> 'MARKET_OFFER' then
    raise exception 'BATCH_NOT_READY';
  end if;

  select * into v_platform
  from public.traditional_liquor_platforms
  where id = p_platform_id and is_active = true;

  if not found then
    raise exception 'PLATFORM_NOT_FOUND';
  end if;

  update public.traditional_liquor_import_staging_rows as row
  set normalized_data = jsonb_set(
        coalesce(row.normalized_data, '{}'::jsonb),
        '{platformCode}',
        to_jsonb(v_platform.code),
        true
      ),
      resolved_platform_id = v_platform.id,
      resolution_status = case
        when row.resolution_status = 'MANUAL_REVIEW'
          and coalesce(row.resolution_data->'reasons', '[]'::jsonb) <@ '["UNKNOWN_PLATFORM"]'::jsonb
        then 'UNRESOLVED'
        else row.resolution_status
      end,
      resolution_data = jsonb_set(
        jsonb_set(
          coalesce(row.resolution_data, '{}'::jsonb),
          '{reasons}',
          coalesce((
            select jsonb_agg(reason.value)
            from jsonb_array_elements_text(coalesce(row.resolution_data->'reasons', '[]'::jsonb)) as reason(value)
            where reason.value <> 'UNKNOWN_PLATFORM'
          ), '[]'::jsonb),
          true
        ),
        '{platform}',
        jsonb_build_object(
          'id', v_platform.id,
          'code', v_platform.code,
          'name', v_platform.name,
          'match', 'BATCH_ASSIGNED'
        ),
        true
      ),
      review_action = null
  where row.batch_id = p_batch_id
    and row.validation_status = 'VALID';
  get diagnostics v_applied = row_count;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'platformId', v_platform.id,
    'platformCode', v_platform.code,
    'appliedRows', v_applied
  );
end;
$$;

revoke all on function public.assign_traditional_liquor_batch_platform(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_traditional_liquor_batch_platform(uuid, uuid)
  to service_role;

comment on table public.traditional_liquor_platform_aliases is
  'Exact aliases used after canonical platform_code matching during MARKET_OFFER resolution.';
comment on function public.assign_traditional_liquor_batch_platform(uuid, uuid) is
  'Assigns one canonical platform to every valid staging row in an uncommitted MARKET_OFFER batch.';

commit;
