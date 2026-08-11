-- Development-only seed for the Traditional Liquor Market Database.
-- Every entity is visibly prefixed with TEST and must not be treated as live market data.

insert into public.traditional_liquor_platforms (id, code, name, base_url, platform_type)
values
  ('10000000-0000-4000-8000-000000000001', 'TEST_NAVER', 'TEST NAVER', 'https://example.invalid/test-naver', 'MARKETPLACE'),
  ('10000000-0000-4000-8000-000000000002', 'TEST_KAKAO_GIFT', 'TEST KAKAO GIFT', 'https://example.invalid/test-kakao', 'GIFT')
on conflict (id) do update set name = excluded.name, base_url = excluded.base_url, platform_type = excluded.platform_type;

insert into public.traditional_liquor_breweries (
  id, name, normalized_name, region, province, city, description
)
values (
  '20000000-0000-4000-8000-000000000001',
  'TEST 안동 양조장',
  'test안동양조장',
  '경상북도 안동',
  '경상북도',
  '안동시',
  'Schema validation only. Not a live brewery record.'
)
on conflict (id) do update set name = excluded.name, normalized_name = excluded.normalized_name;

insert into public.traditional_liquor_products (
  id, brewery_id, name, canonical_name, normalized_name, category, sub_category,
  abv, volume_ml, region, description, traditional_liquor_status
)
values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'TEST 안동소주 375ml 45도',
  'TEST 안동소주',
  'test안동소주375ml45도',
  '증류주',
  '증류식 소주',
  45.00,
  375,
  '경상북도 안동',
  'Schema validation only. Not a live product record.',
  'UNKNOWN'
)
on conflict (id) do update set name = excluded.name, canonical_name = excluded.canonical_name;

insert into public.traditional_liquor_sellers (
  id, name, normalized_name, company_name, region
)
values
  ('40000000-0000-4000-8000-000000000001', 'TEST 판매업체 A', 'test판매업체a', 'TEST Company A', '서울'),
  ('40000000-0000-4000-8000-000000000002', 'TEST 판매업체 B', 'test판매업체b', 'TEST Company B', '경기')
on conflict (id) do update set name = excluded.name, normalized_name = excluded.normalized_name;

insert into public.traditional_liquor_data_sources (
  id, name, source_type, platform_id, description
)
values (
  '50000000-0000-4000-8000-000000000001',
  'TEST manual seed',
  'MANUAL',
  '10000000-0000-4000-8000-000000000001',
  'Development schema validation source only.'
)
on conflict (id) do update set name = excluded.name, description = excluded.description;

insert into public.traditional_liquor_import_batches (
  id, source_id, file_name, status, total_rows, valid_rows, inserted_rows, started_at, finished_at
)
values (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'TEST_SEED.sql',
  'COMPLETED',
  1,
  1,
  1,
  '2026-08-11T00:00:00Z',
  '2026-08-11T00:00:01Z'
)
on conflict (id) do update set status = excluded.status;

insert into public.traditional_liquor_offers (
  id, product_id, platform_id, seller_id, external_offer_id, listing_title, listing_url,
  price, original_price, shipping_fee, quantity, listing_volume_ml, total_volume_ml,
  stock_status, currency, first_seen_at, last_seen_at, last_checked_at, source_id, import_batch_id
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'TEST-OFFER-A',
    'TEST 안동소주 375ml 1병',
    'https://example.invalid/test-naver/offer-a',
    19000,
    21000,
    3000,
    1,
    375,
    375,
    'IN_STOCK',
    'KRW',
    '2026-08-01T00:00:00Z',
    '2026-08-11T00:00:00Z',
    '2026-08-11T00:00:00Z',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'TEST-OFFER-B',
    'TEST 안동소주 선물세트',
    'https://example.invalid/test-kakao/offer-b',
    39000,
    null,
    0,
    2,
    375,
    750,
    'IN_STOCK',
    'KRW',
    '2026-08-01T00:00:00Z',
    '2026-08-11T00:00:00Z',
    '2026-08-11T00:00:00Z',
    '50000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001'
  )
on conflict (id) do update set price = excluded.price, last_checked_at = excluded.last_checked_at;

insert into public.traditional_liquor_price_history (
  id, offer_id, observed_at, price, original_price, shipping_fee, stock_status
)
values
  ('80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '2026-08-01T00:00:00Z', 21000, 23000, 3000, 'IN_STOCK'),
  ('80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', '2026-08-05T00:00:00Z', 18000, 21000, 3000, 'IN_STOCK'),
  ('80000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', '2026-08-11T00:00:00Z', 19000, 21000, 3000, 'IN_STOCK')
on conflict (id) do update set price = excluded.price;

insert into public.traditional_liquor_product_aliases (
  id, product_id, alias_name, normalized_alias, platform_id, confidence
)
values (
  '90000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '[TEST 공식] 안동소주 375ML',
  'test안동소주375ml',
  '10000000-0000-4000-8000-000000000001',
  1.0000
)
on conflict (id) do update set alias_name = excluded.alias_name;

insert into public.traditional_liquor_seller_aliases (
  id, seller_id, alias_name, normalized_alias, platform_id, confidence
)
values (
  'a0000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'TEST 판매업체A 공식스토어',
  'test판매업체a공식스토어',
  '10000000-0000-4000-8000-000000000001',
  1.0000
)
on conflict (id) do update set alias_name = excluded.alias_name;

