-- Canonical production platform metadata required by MARKET_OFFER entity resolution.
-- Safe to run repeatedly. This inserts no product, seller, offer, or price data.

insert into public.traditional_liquor_platforms (
  code,
  name,
  base_url,
  platform_type,
  is_active
)
values (
  'NAVER',
  '네이버',
  'https://shopping.naver.com',
  'MARKETPLACE',
  true
)
on conflict (code) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  platform_type = excluded.platform_type,
  is_active = true,
  updated_at = now();
