-- Destructive rollback for development environments only.
-- Do not run against production unless every market record has been backed up and deletion is intended.

drop view if exists public.v_traditional_liquor_market;
drop table if exists public.traditional_liquor_import_errors;
drop table if exists public.traditional_liquor_import_staging_rows;
drop table if exists public.traditional_liquor_seller_aliases;
drop table if exists public.traditional_liquor_product_aliases;
drop table if exists public.traditional_liquor_platform_aliases;
drop table if exists public.traditional_liquor_price_history;
drop table if exists public.traditional_liquor_offers;
drop table if exists public.traditional_liquor_import_batches;
drop table if exists public.traditional_liquor_data_sources;
drop table if exists public.traditional_liquor_sellers;
drop table if exists public.traditional_liquor_platforms;
drop table if exists public.traditional_liquor_products;
drop table if exists public.traditional_liquor_breweries;
drop function if exists public.set_traditional_liquor_updated_at();
