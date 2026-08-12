-- WooHyukmon 4.0 Traditional Liquor Analytics Views
-- Idempotent migration. Production market entities are never modified or deleted.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.traditional_liquor_market_metrics_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.traditional_liquor_offers(id) on delete restrict,
  product_id uuid not null references public.traditional_liquor_products(id) on delete restrict,
  platform_id uuid not null references public.traditional_liquor_platforms(id) on delete restrict,
  metric_type text not null check (metric_type in (
    'SOURCE_PURCHASE_COUNT', 'KEEP_COUNT', 'REVIEW_COUNT', 'WISH_COUNT',
    'SEARCH_RANK', 'GIFT_RANK', 'CATEGORY_RANK'
  )),
  metric_value bigint not null check (metric_value >= 0),
  observed_at timestamptz not null,
  source_id uuid references public.traditional_liquor_data_sources(id) on delete set null,
  import_batch_id uuid references public.traditional_liquor_import_batches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (offer_id, metric_type, observed_at)
);

alter table public.traditional_liquor_market_metrics_history
  add column if not exists metric_scope text not null default 'OFFER',
  add column if not exists source_entity_id text;

update public.traditional_liquor_market_metrics_history
set source_entity_id = offer_id::text
where source_entity_id is null or trim(source_entity_id) = '';

alter table public.traditional_liquor_market_metrics_history
  alter column source_entity_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'traditional_liquor_metric_scope_check'
  ) then
    alter table public.traditional_liquor_market_metrics_history
      add constraint traditional_liquor_metric_scope_check
      check (metric_scope in ('OFFER', 'PRODUCT', 'CATALOG'));
  end if;
end $$;

create index if not exists traditional_liquor_metrics_offer_observed_idx
  on public.traditional_liquor_market_metrics_history (offer_id, metric_type, observed_at desc);
create index if not exists traditional_liquor_metrics_platform_observed_idx
  on public.traditional_liquor_market_metrics_history (platform_id, metric_type, observed_at desc);
create index if not exists traditional_liquor_metrics_product_observed_idx
  on public.traditional_liquor_market_metrics_history (product_id, metric_type, observed_at desc);
create index if not exists traditional_liquor_metrics_import_batch_idx
  on public.traditional_liquor_market_metrics_history (import_batch_id)
  where import_batch_id is not null;
create unique index if not exists traditional_liquor_metrics_source_snapshot_uidx
  on public.traditional_liquor_market_metrics_history (
    platform_id, metric_scope, source_entity_id, metric_type, observed_at
  );

alter table public.traditional_liquor_market_metrics_history enable row level security;
revoke all on table public.traditional_liquor_market_metrics_history from public, anon, authenticated;
grant select, insert, update, delete on table public.traditional_liquor_market_metrics_history to service_role;

comment on table public.traditional_liquor_market_metrics_history is
  'Time-series market observations. SOURCE_PURCHASE_COUNT is a purchase metric; wish, review, and rank values are popularity metrics.';

create or replace function public.capture_traditional_liquor_batch_metrics()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'COMPLETED' or old.status = 'COMPLETED' then
    return new;
  end if;

  insert into public.traditional_liquor_market_metrics_history (
    offer_id, product_id, platform_id, metric_type, metric_value,
    observed_at, source_id, import_batch_id, metric_scope,
    source_entity_id, metadata
  )
  select
    offer.id,
    offer.product_id,
    offer.platform_id,
    metric.metric_type,
    metric.metric_value,
    coalesce(nullif(row.normalized_data->>'collectedAt', '')::timestamptz, offer.last_checked_at, now()),
    offer.source_id,
    new.id,
    case
      when upper(coalesce(row.normalized_data->>'metricScope', 'OFFER')) in ('OFFER', 'PRODUCT', 'CATALOG')
        then upper(coalesce(row.normalized_data->>'metricScope', 'OFFER'))
      else 'OFFER'
    end,
    coalesce(
      nullif(row.normalized_data->>'sourceEntityId', ''),
      nullif(row.normalized_data->>'externalOfferId', ''),
      nullif(row.normalized_data->>'listingUrl', ''),
      offer.id::text
    ),
    jsonb_build_object('stagingRowId', row.id, 'rowNumber', row.row_number)
  from public.traditional_liquor_import_staging_rows row
  join public.traditional_liquor_offers offer
    on offer.product_id = row.resolved_product_id
   and offer.platform_id = row.resolved_platform_id
   and offer.seller_id = row.resolved_seller_id
   and (
     (nullif(row.normalized_data->>'externalOfferId', '') is not null
       and offer.external_offer_id = row.normalized_data->>'externalOfferId')
     or
     (nullif(row.normalized_data->>'externalOfferId', '') is null
       and offer.listing_url = row.normalized_data->>'listingUrl')
   )
  cross join lateral (
    values
      ('SOURCE_PURCHASE_COUNT', nullif(row.normalized_data->>'sourcePurchaseCount', '')::bigint),
      ('KEEP_COUNT', nullif(row.normalized_data->>'keepCount', '')::bigint),
      ('REVIEW_COUNT', nullif(row.normalized_data->>'reviewCount', '')::bigint),
      ('WISH_COUNT', nullif(row.normalized_data->>'wishCount', '')::bigint),
      ('SEARCH_RANK', nullif(row.normalized_data->>'searchRank', '')::bigint),
      ('GIFT_RANK', nullif(row.normalized_data->>'giftRank', '')::bigint),
      ('CATEGORY_RANK', nullif(row.normalized_data->>'categoryRank', '')::bigint)
  ) as metric(metric_type, metric_value)
  where row.batch_id = new.id
    and row.validation_status = 'VALID'
    and row.review_action is distinct from 'EXCLUDE'
    and metric.metric_value is not null
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_capture_traditional_liquor_batch_metrics
  on public.traditional_liquor_import_batches;
create trigger trg_capture_traditional_liquor_batch_metrics
after update of status on public.traditional_liquor_import_batches
for each row execute function public.capture_traditional_liquor_batch_metrics();

-- Backfill metrics from batches completed before this trigger existed.
insert into public.traditional_liquor_market_metrics_history (
  offer_id, product_id, platform_id, metric_type, metric_value,
  observed_at, source_id, import_batch_id, metric_scope,
  source_entity_id, metadata
)
select
  offer.id, offer.product_id, offer.platform_id,
  metric.metric_type, metric.metric_value,
  coalesce(nullif(row.normalized_data->>'collectedAt', '')::timestamptz, offer.last_checked_at, batch.production_committed_at, now()),
  batch.source_id, batch.id,
  case
    when upper(coalesce(row.normalized_data->>'metricScope', 'OFFER')) in ('OFFER', 'PRODUCT', 'CATALOG')
      then upper(coalesce(row.normalized_data->>'metricScope', 'OFFER'))
    else 'OFFER'
  end,
  coalesce(
    nullif(row.normalized_data->>'sourceEntityId', ''),
    nullif(row.normalized_data->>'externalOfferId', ''),
    nullif(row.normalized_data->>'listingUrl', ''),
    offer.id::text
  ),
  jsonb_build_object('stagingRowId', row.id, 'rowNumber', row.row_number, 'backfilled', true)
from public.traditional_liquor_import_batches batch
join public.traditional_liquor_import_staging_rows row on row.batch_id = batch.id
join public.traditional_liquor_offers offer
  on offer.product_id = row.resolved_product_id
 and offer.platform_id = row.resolved_platform_id
 and offer.seller_id = row.resolved_seller_id
 and (
   (nullif(row.normalized_data->>'externalOfferId', '') is not null
     and offer.external_offer_id = row.normalized_data->>'externalOfferId')
   or
   (nullif(row.normalized_data->>'externalOfferId', '') is null
     and offer.listing_url = row.normalized_data->>'listingUrl')
 )
cross join lateral (
  values
    ('SOURCE_PURCHASE_COUNT', nullif(row.normalized_data->>'sourcePurchaseCount', '')::bigint),
    ('KEEP_COUNT', nullif(row.normalized_data->>'keepCount', '')::bigint),
    ('REVIEW_COUNT', nullif(row.normalized_data->>'reviewCount', '')::bigint),
    ('WISH_COUNT', nullif(row.normalized_data->>'wishCount', '')::bigint),
    ('SEARCH_RANK', nullif(row.normalized_data->>'searchRank', '')::bigint),
    ('GIFT_RANK', nullif(row.normalized_data->>'giftRank', '')::bigint),
    ('CATEGORY_RANK', nullif(row.normalized_data->>'categoryRank', '')::bigint)
) as metric(metric_type, metric_value)
where batch.status = 'COMPLETED'
  and batch.production_committed_at is not null
  and row.validation_status = 'VALID'
  and row.review_action is distinct from 'EXCLUDE'
  and metric.metric_value is not null
on conflict do nothing;

create or replace function public.get_traditional_liquor_price_analytics(
  p_query text default null,
  p_platform_code text default null,
  p_min_price bigint default null,
  p_max_price bigint default null,
  p_sort text default 'LOWEST',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  offer_id uuid,
  product_name text,
  platform_code text,
  platform_name text,
  seller_name text,
  price bigint,
  total_volume_ml integer,
  price_per_100ml numeric,
  last_checked_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      o.id as offer_id,
      p.name as product_name,
      pl.code as platform_code,
      pl.name as platform_name,
      s.name as seller_name,
      o.price,
      coalesce(o.total_volume_ml, o.listing_volume_ml, p.volume_ml) as total_volume_ml,
      case
        when coalesce(o.total_volume_ml, o.listing_volume_ml, p.volume_ml) > 0
          then round((o.price::numeric * 100) / coalesce(o.total_volume_ml, o.listing_volume_ml, p.volume_ml), 2)
        else null
      end as price_per_100ml,
      o.last_checked_at
    from public.traditional_liquor_offers o
    join public.traditional_liquor_products p on p.id = o.product_id and p.is_active = true
    join public.traditional_liquor_platforms pl on pl.id = o.platform_id and pl.is_active = true
    join public.traditional_liquor_sellers s on s.id = o.seller_id and s.is_active = true
    left join public.traditional_liquor_import_batches ib on ib.id = o.import_batch_id
    where o.is_active = true
      and (o.import_batch_id is null or (ib.status = 'COMPLETED' and ib.production_committed_at is not null))
      and upper(coalesce(p.name, '')) not like 'TEST%'
      and upper(coalesce(s.name, '')) not like 'TEST%'
      and (nullif(trim(p_platform_code), '') is null or upper(pl.code) = upper(trim(p_platform_code)))
      and (p_min_price is null or o.price >= p_min_price)
      and (p_max_price is null or o.price <= p_max_price)
      and (
        nullif(trim(p_query), '') is null
        or p.name ilike '%' || trim(p_query) || '%'
        or coalesce(o.listing_title, '') ilike '%' || trim(p_query) || '%'
        or pl.name ilike '%' || trim(p_query) || '%'
        or pl.code ilike '%' || trim(p_query) || '%'
        or s.name ilike '%' || trim(p_query) || '%'
      )
  )
  select
    e.offer_id, e.product_name, e.platform_code, e.platform_name, e.seller_name,
    e.price, e.total_volume_ml, e.price_per_100ml, e.last_checked_at,
    count(*) over()::bigint as total_count
  from eligible e
  where upper(coalesce(p_sort, 'LOWEST')) <> 'PER_100ML' or e.price_per_100ml is not null
  order by
    case when upper(coalesce(p_sort, 'LOWEST')) = 'LOWEST' then e.price end asc,
    case when upper(coalesce(p_sort, 'LOWEST')) = 'HIGHEST' then e.price end desc,
    case when upper(coalesce(p_sort, 'LOWEST')) = 'PER_100ML' then e.price_per_100ml end asc nulls last,
    e.product_name asc,
    e.offer_id asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
$$;

drop function if exists public.get_traditional_liquor_sales_analytics(text, text, text, text, integer, integer);

create function public.get_traditional_liquor_sales_analytics(
  p_query text default null,
  p_platform_code text default null,
  p_metric_type text default 'SOURCE_PURCHASE_COUNT',
  p_period text default 'LATEST',
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  product_id uuid,
  offer_id uuid,
  product_name text,
  platform_code text,
  platform_name text,
  seller_name text,
  metric_type text,
  metric_scope text,
  source_entity_id text,
  period text,
  data_status text,
  latest_value bigint,
  latest_observed_at timestamptz,
  baseline_value bigint,
  baseline_observed_at timestamptz,
  delta_value bigint,
  delta_percent numeric,
  history_count bigint,
  history_points jsonb,
  total_count bigint,
  seven_day_available_count bigint,
  thirty_day_available_count bigint,
  trend_available_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with observations as (
    select
      h.product_id,
      h.offer_id,
      h.platform_id,
      p.name as product_name,
      pl.code as platform_code,
      pl.name as platform_name,
      s.name as seller_name,
      h.metric_type,
      h.metric_scope,
      h.source_entity_id,
      h.metric_value,
      h.observed_at,
      count(*) over (
        partition by h.platform_id, h.metric_scope, h.source_entity_id, h.metric_type
      )::bigint as history_count,
      row_number() over (
        partition by h.platform_id, h.metric_scope, h.source_entity_id, h.metric_type
        order by h.observed_at desc, h.id desc
      ) as recency
    from public.traditional_liquor_market_metrics_history h
    join public.traditional_liquor_offers o on o.id = h.offer_id and o.is_active = true
    join public.traditional_liquor_products p on p.id = o.product_id and p.id = h.product_id and p.is_active = true
    join public.traditional_liquor_platforms pl on pl.id = o.platform_id and pl.id = h.platform_id and pl.is_active = true
    join public.traditional_liquor_sellers s on s.id = o.seller_id and s.is_active = true
    left join public.traditional_liquor_import_batches offer_batch on offer_batch.id = o.import_batch_id
    left join public.traditional_liquor_import_batches metric_batch on metric_batch.id = h.import_batch_id
    where (o.import_batch_id is null or (offer_batch.status = 'COMPLETED' and offer_batch.production_committed_at is not null))
      and (h.import_batch_id is null or (metric_batch.status = 'COMPLETED' and metric_batch.production_committed_at is not null))
      and upper(coalesce(p.name, '')) not like 'TEST%'
      and upper(coalesce(s.name, '')) not like 'TEST%'
      and h.metric_type = upper(coalesce(nullif(trim(p_metric_type), ''), 'SOURCE_PURCHASE_COUNT'))
      and (nullif(trim(p_platform_code), '') is null or upper(pl.code) = upper(trim(p_platform_code)))
      and (
        nullif(trim(p_query), '') is null
        or p.name ilike '%' || trim(p_query) || '%'
        or coalesce(o.listing_title, '') ilike '%' || trim(p_query) || '%'
        or pl.name ilike '%' || trim(p_query) || '%'
        or s.name ilike '%' || trim(p_query) || '%'
      )
  ), latest as (
    select * from observations where recency = 1
  ), compared as (
    select
      l.*,
      b7.metric_value as baseline_7d_value,
      b7.observed_at as baseline_7d_observed_at,
      b30.metric_value as baseline_30d_value,
      b30.observed_at as baseline_30d_observed_at,
      history.first_value,
      history.first_observed_at,
      history.history_points
    from latest l
    left join lateral (
      select h.metric_value, h.observed_at
      from public.traditional_liquor_market_metrics_history h
      left join public.traditional_liquor_import_batches baseline_batch on baseline_batch.id = h.import_batch_id
      where h.platform_id = l.platform_id
        and h.metric_scope = l.metric_scope
        and h.source_entity_id = l.source_entity_id
        and h.metric_type = l.metric_type
        and (h.import_batch_id is null or (baseline_batch.status = 'COMPLETED' and baseline_batch.production_committed_at is not null))
        and h.observed_at <= l.observed_at - interval '7 days'
      order by h.observed_at desc, h.id desc
      limit 1
    ) b7 on true
    left join lateral (
      select h.metric_value, h.observed_at
      from public.traditional_liquor_market_metrics_history h
      left join public.traditional_liquor_import_batches baseline_batch on baseline_batch.id = h.import_batch_id
      where h.platform_id = l.platform_id
        and h.metric_scope = l.metric_scope
        and h.source_entity_id = l.source_entity_id
        and h.metric_type = l.metric_type
        and (h.import_batch_id is null or (baseline_batch.status = 'COMPLETED' and baseline_batch.production_committed_at is not null))
        and h.observed_at <= l.observed_at - interval '30 days'
      order by h.observed_at desc, h.id desc
      limit 1
    ) b30 on true
    left join lateral (
      select
        (array_agg(h.metric_value order by h.observed_at asc, h.id asc))[1] as first_value,
        (array_agg(h.observed_at order by h.observed_at asc, h.id asc))[1] as first_observed_at,
        jsonb_agg(
          jsonb_build_object('observed_at', h.observed_at, 'metric_value', h.metric_value)
          order by h.observed_at asc, h.id asc
        ) as history_points
      from public.traditional_liquor_market_metrics_history h
      left join public.traditional_liquor_import_batches history_batch on history_batch.id = h.import_batch_id
      where h.platform_id = l.platform_id
        and h.metric_scope = l.metric_scope
        and h.source_entity_id = l.source_entity_id
        and h.metric_type = l.metric_type
        and (h.import_batch_id is null or (history_batch.status = 'COMPLETED' and history_batch.production_committed_at is not null))
    ) history on true
  ), scored as (
    select
      c.*,
      case upper(coalesce(p_period, 'LATEST'))
        when '7D' then c.baseline_7d_value
        when '30D' then c.baseline_30d_value
        when 'HISTORY' then case when c.history_count >= 2 then c.first_value else null end
        else null
      end as baseline_value,
      case upper(coalesce(p_period, 'LATEST'))
        when '7D' then c.baseline_7d_observed_at
        when '30D' then c.baseline_30d_observed_at
        when 'HISTORY' then case when c.history_count >= 2 then c.first_observed_at else null end
        else null
      end as baseline_observed_at
    from compared c
  ), finalized as (
    select
      s.*,
      case when upper(coalesce(p_period, 'LATEST')) = 'LATEST' then 'AVAILABLE'
        when s.baseline_value is not null then 'AVAILABLE'
        else 'INSUFFICIENT_DATA'
      end as data_status,
      case when s.baseline_value is not null then s.metric_value - s.baseline_value else null end as delta_value,
      case when s.baseline_value is not null and s.baseline_value <> 0
        then round(((s.metric_value - s.baseline_value)::numeric / s.baseline_value::numeric) * 100, 2)
        else null
      end as delta_percent
    from scored s
  )
  select
    s.product_id, s.offer_id, s.product_name, s.platform_code, s.platform_name, s.seller_name,
    s.metric_type, s.metric_scope, s.source_entity_id,
    upper(coalesce(p_period, 'LATEST')) as period, s.data_status,
    s.metric_value as latest_value, s.observed_at as latest_observed_at,
    s.baseline_value, s.baseline_observed_at, s.delta_value, s.delta_percent,
    s.history_count, coalesce(s.history_points, '[]'::jsonb),
    count(*) over()::bigint as total_count,
    count(*) filter (where s.baseline_7d_value is not null) over()::bigint as seven_day_available_count,
    count(*) filter (where s.baseline_30d_value is not null) over()::bigint as thirty_day_available_count,
    count(*) filter (where s.history_count >= 2) over()::bigint as trend_available_count
  from finalized s
  order by
    case when upper(coalesce(p_period, 'LATEST')) in ('7D', '30D') then (s.data_status = 'AVAILABLE')::integer end desc,
    case when upper(coalesce(p_period, 'LATEST')) in ('7D', '30D') then s.delta_value end desc nulls last,
    case when upper(coalesce(p_period, 'LATEST')) in ('LATEST', 'HISTORY')
      and s.metric_type in ('SEARCH_RANK', 'GIFT_RANK', 'CATEGORY_RANK') then s.metric_value end asc,
    case when upper(coalesce(p_period, 'LATEST')) in ('LATEST', 'HISTORY')
      and s.metric_type not in ('SEARCH_RANK', 'GIFT_RANK', 'CATEGORY_RANK') then s.metric_value end desc,
    s.product_name asc,
    s.offer_id asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
$$;

revoke all on function public.get_traditional_liquor_price_analytics(text, text, bigint, bigint, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_traditional_liquor_sales_analytics(text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_traditional_liquor_price_analytics(text, text, bigint, bigint, text, integer, integer) to service_role;
grant execute on function public.get_traditional_liquor_sales_analytics(text, text, text, text, integer, integer) to service_role;

comment on function public.get_traditional_liquor_price_analytics(text, text, bigint, bigint, text, integer, integer) is
  'Server-side, paginated price analytics over committed Production offers only.';
comment on function public.get_traditional_liquor_sales_analytics(text, text, text, text, integer, integer) is
  'Latest and period-delta market metrics over committed Production observations only.';
