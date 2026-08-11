-- WooHyukmon 4.0 Traditional Liquor Structured Market Database
-- This schema is intentionally independent from the WooHyukmon Knowledge System.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_traditional_liquor_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.traditional_liquor_breweries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text,
  region text,
  province text,
  city text,
  address text,
  description text,
  website_url text,
  official_source_url text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.traditional_liquor_products (
  id uuid primary key default gen_random_uuid(),
  brewery_id uuid references public.traditional_liquor_breweries(id) on delete restrict,
  name text not null,
  canonical_name text,
  normalized_name text,
  category text,
  sub_category text,
  abv numeric(5,2) check (abv is null or (abv >= 0 and abv <= 100)),
  volume_ml integer check (volume_ml is null or volume_ml > 0),
  ingredients text,
  region text,
  description text,
  official_product_url text,
  image_url text,
  traditional_liquor_status text not null default 'UNKNOWN' check (
    traditional_liquor_status in ('OFFICIAL','LIKELY','UNKNOWN','NON_TRADITIONAL')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.traditional_liquor_platforms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  base_url text,
  platform_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.traditional_liquor_sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text,
  company_name text,
  business_number text,
  region text,
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.traditional_liquor_data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (
    source_type in ('MANUAL','CSV','XLSX','PUBLIC_API','OFFICIAL_DATA','COLLECTOR')
  ),
  platform_id uuid references public.traditional_liquor_platforms(id) on delete restrict,
  base_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.traditional_liquor_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.traditional_liquor_data_sources(id) on delete restrict,
  file_name text,
  status text not null default 'PENDING' check (
    status in ('PENDING','PARSING','VALIDATING','READY','IMPORTING','COMPLETED','FAILED','DISCARDED')
  ),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  inserted_rows integer not null default 0 check (inserted_rows >= 0),
  updated_rows integer not null default 0 check (updated_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  discarded_at timestamptz,
  discard_reason text,
  production_committed_at timestamptz,
  created_at timestamptz not null default now(),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);

create table if not exists public.traditional_liquor_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.traditional_liquor_products(id) on delete restrict,
  platform_id uuid not null references public.traditional_liquor_platforms(id) on delete restrict,
  seller_id uuid not null references public.traditional_liquor_sellers(id) on delete restrict,
  external_offer_id text,
  listing_title text,
  listing_url text,
  price bigint not null check (price >= 0),
  original_price bigint check (original_price is null or original_price >= 0),
  shipping_fee bigint check (shipping_fee is null or shipping_fee >= 0),
  quantity integer not null default 1 check (quantity > 0),
  listing_volume_ml integer check (listing_volume_ml is null or listing_volume_ml > 0),
  total_volume_ml integer check (total_volume_ml is null or total_volume_ml > 0),
  stock_status text,
  review_count integer check (review_count is null or review_count >= 0),
  rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5)),
  currency text not null default 'KRW',
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  last_checked_at timestamptz,
  source_id uuid references public.traditional_liquor_data_sources(id) on delete set null,
  import_batch_id uuid references public.traditional_liquor_import_batches(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at is null or first_seen_at is null or last_seen_at >= first_seen_at)
);

create table if not exists public.traditional_liquor_price_history (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.traditional_liquor_offers(id) on delete restrict,
  observed_at timestamptz not null,
  price bigint check (price is null or price >= 0),
  original_price bigint check (original_price is null or original_price >= 0),
  shipping_fee bigint check (shipping_fee is null or shipping_fee >= 0),
  stock_status text,
  review_count integer check (review_count is null or review_count >= 0),
  rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5)),
  created_at timestamptz not null default now(),
  unique (offer_id, observed_at)
);

create table if not exists public.traditional_liquor_product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.traditional_liquor_products(id) on delete restrict,
  alias_name text not null,
  normalized_alias text,
  platform_id uuid references public.traditional_liquor_platforms(id) on delete restrict,
  seller_id uuid references public.traditional_liquor_sellers(id) on delete restrict,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create table if not exists public.traditional_liquor_seller_aliases (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.traditional_liquor_sellers(id) on delete restrict,
  alias_name text not null,
  normalized_alias text,
  platform_id uuid references public.traditional_liquor_platforms(id) on delete restrict,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create table if not exists public.traditional_liquor_import_staging_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.traditional_liquor_import_batches(id) on delete restrict,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_status text not null default 'PENDING' check (
    validation_status in ('PENDING','VALID','INVALID')
  ),
  resolution_status text not null default 'UNRESOLVED' check (
    resolution_status in ('UNRESOLVED','MATCHED','NEW_ENTITY','MANUAL_REVIEW')
  ),
  resolved_product_id uuid references public.traditional_liquor_products(id) on delete set null,
  resolved_seller_id uuid references public.traditional_liquor_sellers(id) on delete set null,
  resolved_platform_id uuid references public.traditional_liquor_platforms(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create table if not exists public.traditional_liquor_import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.traditional_liquor_import_batches(id) on delete restrict,
  staging_row_id uuid references public.traditional_liquor_import_staging_rows(id) on delete set null,
  row_number integer check (row_number is null or row_number > 0),
  error_code text,
  field_name text,
  error_message text not null,
  raw_value text,
  raw_record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists traditional_liquor_breweries_normalized_trgm_idx
  on public.traditional_liquor_breweries using gin (normalized_name extensions.gin_trgm_ops);
create index if not exists traditional_liquor_products_name_trgm_idx
  on public.traditional_liquor_products using gin (name extensions.gin_trgm_ops);
create index if not exists traditional_liquor_products_canonical_trgm_idx
  on public.traditional_liquor_products using gin (canonical_name extensions.gin_trgm_ops);
create index if not exists traditional_liquor_products_normalized_trgm_idx
  on public.traditional_liquor_products using gin (normalized_name extensions.gin_trgm_ops);
create index if not exists traditional_liquor_products_brewery_idx
  on public.traditional_liquor_products (brewery_id, is_active);
create index if not exists traditional_liquor_sellers_normalized_trgm_idx
  on public.traditional_liquor_sellers using gin (normalized_name extensions.gin_trgm_ops);
create index if not exists traditional_liquor_product_aliases_trgm_idx
  on public.traditional_liquor_product_aliases using gin (normalized_alias extensions.gin_trgm_ops);
create index if not exists traditional_liquor_product_aliases_product_idx
  on public.traditional_liquor_product_aliases (product_id, platform_id, seller_id);
create index if not exists traditional_liquor_seller_aliases_trgm_idx
  on public.traditional_liquor_seller_aliases using gin (normalized_alias extensions.gin_trgm_ops);
create index if not exists traditional_liquor_seller_aliases_seller_idx
  on public.traditional_liquor_seller_aliases (seller_id, platform_id);

create unique index if not exists traditional_liquor_offers_external_unique_idx
  on public.traditional_liquor_offers (platform_id, external_offer_id)
  where external_offer_id is not null;
create unique index if not exists traditional_liquor_offers_url_unique_idx
  on public.traditional_liquor_offers (platform_id, listing_url)
  where external_offer_id is null and listing_url is not null;
create index if not exists traditional_liquor_offers_product_price_idx
  on public.traditional_liquor_offers (product_id, is_active, price, last_checked_at desc);
create index if not exists traditional_liquor_offers_platform_price_idx
  on public.traditional_liquor_offers (platform_id, is_active, price, last_checked_at desc);
create index if not exists traditional_liquor_offers_seller_price_idx
  on public.traditional_liquor_offers (seller_id, is_active, price, last_checked_at desc);
create index if not exists traditional_liquor_price_history_offer_observed_idx
  on public.traditional_liquor_price_history (offer_id, observed_at desc);
create index if not exists traditional_liquor_batches_source_created_idx
  on public.traditional_liquor_import_batches (source_id, created_at desc);
create index if not exists traditional_liquor_staging_batch_status_idx
  on public.traditional_liquor_import_staging_rows (batch_id, validation_status, resolution_status, row_number);
create index if not exists traditional_liquor_errors_batch_row_idx
  on public.traditional_liquor_import_errors (batch_id, row_number);

drop trigger if exists traditional_liquor_breweries_updated_at on public.traditional_liquor_breweries;
create trigger traditional_liquor_breweries_updated_at before update on public.traditional_liquor_breweries for each row execute function public.set_traditional_liquor_updated_at();
drop trigger if exists traditional_liquor_products_updated_at on public.traditional_liquor_products;
create trigger traditional_liquor_products_updated_at before update on public.traditional_liquor_products for each row execute function public.set_traditional_liquor_updated_at();
drop trigger if exists traditional_liquor_platforms_updated_at on public.traditional_liquor_platforms;
create trigger traditional_liquor_platforms_updated_at before update on public.traditional_liquor_platforms for each row execute function public.set_traditional_liquor_updated_at();
drop trigger if exists traditional_liquor_sellers_updated_at on public.traditional_liquor_sellers;
create trigger traditional_liquor_sellers_updated_at before update on public.traditional_liquor_sellers for each row execute function public.set_traditional_liquor_updated_at();
drop trigger if exists traditional_liquor_sources_updated_at on public.traditional_liquor_data_sources;
create trigger traditional_liquor_sources_updated_at before update on public.traditional_liquor_data_sources for each row execute function public.set_traditional_liquor_updated_at();
drop trigger if exists traditional_liquor_offers_updated_at on public.traditional_liquor_offers;
create trigger traditional_liquor_offers_updated_at before update on public.traditional_liquor_offers for each row execute function public.set_traditional_liquor_updated_at();

create or replace view public.v_traditional_liquor_market
with (security_invoker = true)
as
select
  product.id as product_id,
  product.name as product_name,
  product.canonical_name,
  product.normalized_name as product_normalized_name,
  product.region as product_region,
  product.category,
  product.sub_category,
  product.abv,
  product.volume_ml,
  product.description as product_description,
  brewery.id as brewery_id,
  brewery.name as brewery_name,
  brewery.normalized_name as brewery_normalized_name,
  brewery.region as brewery_region,
  brewery.description as brewery_description,
  platform.id as platform_id,
  platform.code as platform_code,
  platform.name as platform_name,
  seller.id as seller_id,
  seller.name as seller_name,
  seller.normalized_name as seller_normalized_name,
  offer.id as offer_id,
  offer.external_offer_id,
  offer.listing_title,
  offer.listing_url,
  offer.price,
  offer.original_price,
  offer.shipping_fee,
  offer.quantity,
  offer.listing_volume_ml,
  offer.total_volume_ml,
  offer.stock_status,
  offer.review_count,
  offer.rating,
  offer.currency,
  offer.last_checked_at
from public.traditional_liquor_products product
left join public.traditional_liquor_breweries brewery on brewery.id = product.brewery_id
join public.traditional_liquor_offers offer on offer.product_id = product.id and offer.is_active = true
join public.traditional_liquor_platforms platform on platform.id = offer.platform_id and platform.is_active = true
join public.traditional_liquor_sellers seller on seller.id = offer.seller_id and seller.is_active = true
where product.is_active = true
  and (brewery.id is null or brewery.is_active = true);

alter table public.traditional_liquor_breweries enable row level security;
alter table public.traditional_liquor_products enable row level security;
alter table public.traditional_liquor_platforms enable row level security;
alter table public.traditional_liquor_sellers enable row level security;
alter table public.traditional_liquor_offers enable row level security;
alter table public.traditional_liquor_price_history enable row level security;
alter table public.traditional_liquor_product_aliases enable row level security;
alter table public.traditional_liquor_seller_aliases enable row level security;
alter table public.traditional_liquor_data_sources enable row level security;
alter table public.traditional_liquor_import_batches enable row level security;
alter table public.traditional_liquor_import_staging_rows enable row level security;
alter table public.traditional_liquor_import_errors enable row level security;

revoke all on table public.traditional_liquor_breweries from anon, authenticated;
revoke all on table public.traditional_liquor_products from anon, authenticated;
revoke all on table public.traditional_liquor_platforms from anon, authenticated;
revoke all on table public.traditional_liquor_sellers from anon, authenticated;
revoke all on table public.traditional_liquor_offers from anon, authenticated;
revoke all on table public.traditional_liquor_price_history from anon, authenticated;
revoke all on table public.traditional_liquor_product_aliases from anon, authenticated;
revoke all on table public.traditional_liquor_seller_aliases from anon, authenticated;
revoke all on table public.traditional_liquor_data_sources from anon, authenticated;
revoke all on table public.traditional_liquor_import_batches from anon, authenticated;
revoke all on table public.traditional_liquor_import_staging_rows from anon, authenticated;
revoke all on table public.traditional_liquor_import_errors from anon, authenticated;
revoke all on table public.v_traditional_liquor_market from anon, authenticated;

grant select, insert, update, delete on table public.traditional_liquor_breweries to service_role;
grant select, insert, update, delete on table public.traditional_liquor_products to service_role;
grant select, insert, update, delete on table public.traditional_liquor_platforms to service_role;
grant select, insert, update, delete on table public.traditional_liquor_sellers to service_role;
grant select, insert, update, delete on table public.traditional_liquor_offers to service_role;
grant select, insert, update, delete on table public.traditional_liquor_price_history to service_role;
grant select, insert, update, delete on table public.traditional_liquor_product_aliases to service_role;
grant select, insert, update, delete on table public.traditional_liquor_seller_aliases to service_role;
grant select, insert, update, delete on table public.traditional_liquor_data_sources to service_role;
grant select, insert, update, delete on table public.traditional_liquor_import_batches to service_role;
grant select, insert, update, delete on table public.traditional_liquor_import_staging_rows to service_role;
grant select, insert, update, delete on table public.traditional_liquor_import_errors to service_role;
grant select on table public.v_traditional_liquor_market to service_role;
