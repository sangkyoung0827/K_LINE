-- Traditional Liquor Real Data Import V2
-- Run after traditional_liquor_market.sql and traditional_liquor_collection_engine.sql.

begin;

alter table public.traditional_liquor_import_batches
  add column if not exists import_type text,
  add column if not exists mapping_data jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'traditional_liquor_batches_import_type_check') then
    alter table public.traditional_liquor_import_batches
      add constraint traditional_liquor_batches_import_type_check
      check (import_type is null or import_type in ('PRODUCT_MASTER','MARKET_OFFER'));
  end if;
end $$;

alter table public.traditional_liquor_import_staging_rows
  add column if not exists resolved_brewery_id uuid references public.traditional_liquor_breweries(id) on delete set null,
  add column if not exists resolution_data jsonb not null default '{}'::jsonb,
  add column if not exists review_action text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'traditional_liquor_staging_review_action_check') then
    alter table public.traditional_liquor_import_staging_rows
      add constraint traditional_liquor_staging_review_action_check
      check (review_action is null or review_action in ('LINK_EXISTING','CREATE_NEW','EXCLUDE'));
  end if;
end $$;

create table if not exists public.traditional_liquor_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  import_type text not null check (import_type in ('PRODUCT_MASTER','MARKET_OFFER')),
  mapping_data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists traditional_liquor_mapping_profiles_updated_at on public.traditional_liquor_mapping_profiles;
create trigger traditional_liquor_mapping_profiles_updated_at
before update on public.traditional_liquor_mapping_profiles
for each row execute function public.set_traditional_liquor_updated_at();

create index if not exists traditional_liquor_real_batches_idx
  on public.traditional_liquor_import_batches (import_type, created_at desc)
  where import_type is not null;
create index if not exists traditional_liquor_staging_resolution_idx
  on public.traditional_liquor_import_staging_rows (batch_id, resolution_status, review_action, row_number);
create index if not exists traditional_liquor_staging_brewery_idx
  on public.traditional_liquor_import_staging_rows (resolved_brewery_id)
  where resolved_brewery_id is not null;

alter table public.traditional_liquor_mapping_profiles enable row level security;
revoke all on table public.traditional_liquor_mapping_profiles from anon, authenticated;
grant select, insert, update, delete on table public.traditional_liquor_mapping_profiles to service_role;

create or replace function public.commit_traditional_liquor_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.traditional_liquor_import_batches%rowtype;
  v_row public.traditional_liquor_import_staging_rows%rowtype;
  v_data jsonb;
  v_source_id uuid;
  v_brewery_id uuid;
  v_product_id uuid;
  v_seller_id uuid;
  v_platform_id uuid;
  v_offer_id uuid;
  v_existing_offer public.traditional_liquor_offers%rowtype;
  v_observed_at timestamptz;
  v_is_new_offer boolean;
  v_history_needed boolean;
  v_product_normalized_name text;
  v_seller_normalized_name text;
  v_products_inserted integer := 0;
  v_products_updated integer := 0;
  v_breweries_inserted integer := 0;
  v_sellers_inserted integer := 0;
  v_offers_inserted integer := 0;
  v_offers_updated integer := 0;
  v_history_inserted integer := 0;
  v_skipped integer := 0;
begin
  select * into v_batch
  from public.traditional_liquor_import_batches
  where id = p_batch_id
  for update;

  if not found then raise exception 'IMPORT_BATCH_NOT_FOUND'; end if;
  if v_batch.import_type is null then raise exception 'NOT_A_REAL_IMPORT_BATCH'; end if;
  if v_batch.status <> 'READY' then raise exception 'BATCH_NOT_READY: %', v_batch.status; end if;

  if not exists (
    select 1 from public.traditional_liquor_import_staging_rows
    where batch_id = p_batch_id and validation_status = 'VALID' and review_action is distinct from 'EXCLUDE'
  ) then raise exception 'NO_COMMITTABLE_ROWS'; end if;

  if exists (
    select 1 from public.traditional_liquor_import_staging_rows
    where batch_id = p_batch_id
      and validation_status = 'VALID'
      and review_action is distinct from 'EXCLUDE'
      and resolution_status in ('UNRESOLVED','MANUAL_REVIEW')
  ) then raise exception 'MANUAL_REVIEW_REQUIRED'; end if;

  update public.traditional_liquor_import_batches set status = 'IMPORTING' where id = p_batch_id;
  v_source_id := v_batch.source_id;

  for v_row in
    select * from public.traditional_liquor_import_staging_rows
    where batch_id = p_batch_id
    order by row_number
  loop
    if v_row.validation_status <> 'VALID' or v_row.review_action = 'EXCLUDE' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_data := v_row.normalized_data;

    if v_batch.import_type = 'PRODUCT_MASTER' then
      v_brewery_id := v_row.resolved_brewery_id;
      if v_brewery_id is null and v_row.review_action is distinct from 'CREATE_NEW' and nullif(v_data->>'normalizedBreweryName','') is not null then
        select id into v_brewery_id
        from public.traditional_liquor_breweries
        where normalized_name = v_data->>'normalizedBreweryName'
          and (
            nullif(v_data->>'region','') is null
            or region = v_data->>'region'
            or province = v_data->>'region'
            or city = v_data->>'region'
          )
        order by created_at
        limit 1;
      end if;
      if v_brewery_id is null and nullif(v_data->>'breweryName','') is not null then
        insert into public.traditional_liquor_breweries (name, normalized_name, region, province, city, website_url, official_source_url)
        values (v_data->>'breweryName', v_data->>'normalizedBreweryName', nullif(v_data->>'region',''), nullif(v_data->>'province',''), nullif(v_data->>'city',''), nullif(v_data->>'breweryUrl',''), nullif(v_data->>'sourceUrl',''))
        returning id into v_brewery_id;
        v_breweries_inserted := v_breweries_inserted + 1;
      elsif v_brewery_id is not null then
        update public.traditional_liquor_breweries set
          region = coalesce(nullif(v_data->>'region',''), region),
          province = coalesce(nullif(v_data->>'province',''), province),
          city = coalesce(nullif(v_data->>'city',''), city),
          website_url = coalesce(nullif(v_data->>'breweryUrl',''), website_url),
          official_source_url = coalesce(nullif(v_data->>'sourceUrl',''), official_source_url)
        where id = v_brewery_id;
      end if;

      v_product_id := v_row.resolved_product_id;
      if v_product_id is null and v_row.review_action is distinct from 'CREATE_NEW' then
        select id into v_product_id from public.traditional_liquor_products
        where normalized_name = v_data->>'normalizedProductName'
          and brewery_id is not distinct from v_brewery_id
          and (nullif(v_data->>'abv','') is null or abv = (v_data->>'abv')::numeric)
          and (nullif(v_data->>'volumeMl','') is null or volume_ml = (v_data->>'volumeMl')::integer)
        order by created_at limit 1;
      end if;
      if v_product_id is null then
        insert into public.traditional_liquor_products (brewery_id, name, canonical_name, normalized_name, category, sub_category, abv, volume_ml, ingredients, region, description, official_product_url, traditional_liquor_status)
        values (v_brewery_id, v_data->>'productName', coalesce(nullif(v_data->>'canonicalName',''), v_data->>'productName'), v_data->>'normalizedProductName', nullif(v_data->>'category',''), nullif(v_data->>'subCategory',''), nullif(v_data->>'abv','')::numeric, nullif(v_data->>'volumeMl','')::integer, nullif(v_data->>'ingredients',''), nullif(v_data->>'region',''), nullif(v_data->>'description',''), nullif(v_data->>'officialProductUrl',''), coalesce(nullif(v_data->>'traditionalLiquorStatus',''),'UNKNOWN'))
        returning id into v_product_id;
        v_products_inserted := v_products_inserted + 1;
      else
        update public.traditional_liquor_products set
          brewery_id = coalesce(v_brewery_id, brewery_id),
          canonical_name = coalesce(nullif(v_data->>'canonicalName',''), canonical_name),
          category = coalesce(nullif(v_data->>'category',''), category),
          sub_category = coalesce(nullif(v_data->>'subCategory',''), sub_category),
          abv = coalesce(nullif(v_data->>'abv','')::numeric, abv),
          volume_ml = coalesce(nullif(v_data->>'volumeMl','')::integer, volume_ml),
          ingredients = coalesce(nullif(v_data->>'ingredients',''), ingredients),
          region = coalesce(nullif(v_data->>'region',''), region),
          description = coalesce(nullif(v_data->>'description',''), description),
          official_product_url = coalesce(nullif(v_data->>'officialProductUrl',''), official_product_url),
          traditional_liquor_status = coalesce(nullif(v_data->>'traditionalLiquorStatus',''), traditional_liquor_status)
        where id = v_product_id;
        v_products_updated := v_products_updated + 1;
      end if;

      update public.traditional_liquor_import_staging_rows
      set resolved_brewery_id = v_brewery_id, resolved_product_id = v_product_id, resolution_status = 'MATCHED'
      where id = v_row.id;
      continue;
    end if;

    v_platform_id := v_row.resolved_platform_id;
    if v_platform_id is null then raise exception 'PLATFORM_NOT_RESOLVED_AT_ROW_%', v_row.row_number; end if;

    v_seller_id := v_row.resolved_seller_id;
    if v_seller_id is null and v_row.review_action is distinct from 'CREATE_NEW' then
      select id into v_seller_id from public.traditional_liquor_sellers
      where normalized_name = v_data->>'normalizedSellerName' order by created_at limit 1;
    end if;
    if v_seller_id is null then
      insert into public.traditional_liquor_sellers (name, normalized_name)
      values (v_data->>'sellerName', v_data->>'normalizedSellerName') returning id into v_seller_id;
      v_sellers_inserted := v_sellers_inserted + 1;
    end if;

    v_product_id := v_row.resolved_product_id;
    if v_product_id is null and v_row.review_action is distinct from 'CREATE_NEW' then
      select id into v_product_id from public.traditional_liquor_products
      where normalized_name = v_data->>'normalizedProductName'
        and (nullif(v_data->>'listingVolumeMl','') is null or volume_ml = (v_data->>'listingVolumeMl')::integer)
      order by created_at limit 1;
    end if;
    if v_product_id is null then
      insert into public.traditional_liquor_products (name, canonical_name, normalized_name, volume_ml, traditional_liquor_status)
      values (v_data->>'productName', v_data->>'productName', v_data->>'normalizedProductName', nullif(v_data->>'listingVolumeMl','')::integer, 'UNKNOWN')
      returning id into v_product_id;
      v_products_inserted := v_products_inserted + 1;
    end if;

    v_offer_id := null;
    if nullif(v_data->>'externalOfferId','') is not null then
      select id into v_offer_id from public.traditional_liquor_offers
      where platform_id = v_platform_id and external_offer_id = v_data->>'externalOfferId' limit 1;
    elsif nullif(v_data->>'listingUrl','') is not null then
      select id into v_offer_id from public.traditional_liquor_offers
      where platform_id = v_platform_id and external_offer_id is null and listing_url = v_data->>'listingUrl' limit 1;
    end if;

    v_is_new_offer := v_offer_id is null;
    if not v_is_new_offer then select * into v_existing_offer from public.traditional_liquor_offers where id = v_offer_id; end if;
    begin
      v_observed_at := coalesce(nullif(v_data->>'collectedAt','')::timestamptz, now());
    exception when others then v_observed_at := now();
    end;

    if v_is_new_offer then
      insert into public.traditional_liquor_offers (product_id, platform_id, seller_id, external_offer_id, listing_title, listing_url, price, original_price, shipping_fee, quantity, listing_volume_ml, total_volume_ml, stock_status, review_count, rating, first_seen_at, last_seen_at, last_checked_at, source_id, import_batch_id)
      values (v_product_id, v_platform_id, v_seller_id, nullif(v_data->>'externalOfferId',''), v_data->>'listingTitle', nullif(v_data->>'listingUrl',''), (v_data->>'price')::bigint, nullif(v_data->>'originalPrice','')::bigint, nullif(v_data->>'shippingFee','')::bigint, coalesce(nullif(v_data->>'quantity','')::integer,1), nullif(v_data->>'listingVolumeMl','')::integer, nullif(v_data->>'totalVolumeMl','')::integer, nullif(v_data->>'stockStatus',''), nullif(v_data->>'reviewCount','')::integer, nullif(v_data->>'rating','')::numeric, v_observed_at, v_observed_at, v_observed_at, v_source_id, p_batch_id)
      returning id into v_offer_id;
      v_offers_inserted := v_offers_inserted + 1;
      v_history_needed := true;
    else
      v_history_needed := v_existing_offer.price is distinct from (v_data->>'price')::bigint
        or v_existing_offer.original_price is distinct from nullif(v_data->>'originalPrice','')::bigint
        or v_existing_offer.shipping_fee is distinct from nullif(v_data->>'shippingFee','')::bigint
        or v_existing_offer.stock_status is distinct from nullif(v_data->>'stockStatus','')
        or v_existing_offer.review_count is distinct from nullif(v_data->>'reviewCount','')::integer
        or v_existing_offer.rating is distinct from nullif(v_data->>'rating','')::numeric
        or not exists (select 1 from public.traditional_liquor_price_history where offer_id = v_offer_id and observed_at::date = v_observed_at::date);
      update public.traditional_liquor_offers set
        product_id = v_product_id, seller_id = v_seller_id, listing_title = coalesce(nullif(v_data->>'listingTitle',''), listing_title), listing_url = coalesce(nullif(v_data->>'listingUrl',''), listing_url),
        price = (v_data->>'price')::bigint, original_price = nullif(v_data->>'originalPrice','')::bigint, shipping_fee = nullif(v_data->>'shippingFee','')::bigint,
        quantity = coalesce(nullif(v_data->>'quantity','')::integer, quantity), listing_volume_ml = coalesce(nullif(v_data->>'listingVolumeMl','')::integer, listing_volume_ml), total_volume_ml = coalesce(nullif(v_data->>'totalVolumeMl','')::integer, total_volume_ml),
        stock_status = nullif(v_data->>'stockStatus',''), review_count = nullif(v_data->>'reviewCount','')::integer, rating = nullif(v_data->>'rating','')::numeric,
        last_seen_at = v_observed_at, last_checked_at = v_observed_at, source_id = v_source_id, import_batch_id = p_batch_id
      where id = v_offer_id;
      v_offers_updated := v_offers_updated + 1;
    end if;

    if v_history_needed then
      insert into public.traditional_liquor_price_history (offer_id, observed_at, price, original_price, shipping_fee, stock_status, review_count, rating)
      values (v_offer_id, v_observed_at, (v_data->>'price')::bigint, nullif(v_data->>'originalPrice','')::bigint, nullif(v_data->>'shippingFee','')::bigint, nullif(v_data->>'stockStatus',''), nullif(v_data->>'reviewCount','')::integer, nullif(v_data->>'rating','')::numeric)
      on conflict (offer_id, observed_at) do nothing;
      if found then v_history_inserted := v_history_inserted + 1; end if;
    end if;

    select normalized_name into v_product_normalized_name
    from public.traditional_liquor_products where id = v_product_id;
    if nullif(v_data->>'normalizedListingTitle','') is not null
       and v_data->>'normalizedListingTitle' is distinct from v_product_normalized_name then
      insert into public.traditional_liquor_product_aliases (product_id, alias_name, normalized_alias, platform_id, seller_id, confidence)
      select v_product_id, v_data->>'listingTitle', v_data->>'normalizedListingTitle', v_platform_id, v_seller_id, 1
      where not exists (select 1 from public.traditional_liquor_product_aliases where product_id = v_product_id and normalized_alias = v_data->>'normalizedListingTitle' and platform_id is not distinct from v_platform_id and seller_id is not distinct from v_seller_id);
    end if;
    select normalized_name into v_seller_normalized_name
    from public.traditional_liquor_sellers where id = v_seller_id;
    if nullif(v_data->>'normalizedSellerName','') is not null
       and v_data->>'normalizedSellerName' is distinct from v_seller_normalized_name then
      insert into public.traditional_liquor_seller_aliases (seller_id, alias_name, normalized_alias, platform_id, confidence)
      select v_seller_id, v_data->>'sellerName', v_data->>'normalizedSellerName', v_platform_id, 1
      where not exists (select 1 from public.traditional_liquor_seller_aliases where seller_id = v_seller_id and normalized_alias = v_data->>'normalizedSellerName' and platform_id is not distinct from v_platform_id);
    end if;

    update public.traditional_liquor_import_staging_rows
    set resolved_product_id = v_product_id, resolved_seller_id = v_seller_id, resolved_platform_id = v_platform_id, resolution_status = 'MATCHED'
    where id = v_row.id;
  end loop;

  update public.traditional_liquor_import_batches set
    status = 'COMPLETED', inserted_rows = v_products_inserted + v_offers_inserted,
    updated_rows = v_products_updated + v_offers_updated, skipped_rows = v_skipped, finished_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'batchId', p_batch_id, 'productsInserted', v_products_inserted, 'productsUpdated', v_products_updated,
    'breweriesInserted', v_breweries_inserted, 'sellersInserted', v_sellers_inserted,
    'offersInserted', v_offers_inserted, 'offersUpdated', v_offers_updated,
    'priceHistoryInserted', v_history_inserted, 'skipped', v_skipped
  );
end;
$$;

revoke all on function public.commit_traditional_liquor_import_batch(uuid) from public, anon, authenticated;
grant execute on function public.commit_traditional_liquor_import_batch(uuid) to service_role;

commit;
