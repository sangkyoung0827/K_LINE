# Traditional Liquor Data Collection Engine V1

V1 collects external-shaped data into a standard `RawCollectedOffer`, validates and normalizes each row, and writes only to Import staging tables. It never resolves or commits products, sellers, offers, or price history.

## Flow

`CollectionQuery -> CollectionAdapter -> RawCollectedOffer -> Normalizer -> Validator -> ImportBatch -> StagingRows -> Preview`

The developer-only API is `/api/v4/traditional-liquor/collection`. It requires WooHyukmon V4 developer authentication and calls Supabase only from server modules.

## Database setup

Run these in Supabase SQL Editor in order:

1. `supabase/traditional_liquor_market.sql`
2. `supabase/traditional_liquor_collection_engine.sql`

The collection migration is idempotent. It adds the query dictionary and collection-run log, enables RLS, revokes `anon` and `authenticated`, and grants access only to `service_role`.

## Source policy

- `FIXTURE_BROWSER_V1` is the only executable V1 source in the UI.
- Playwright extraction is tested against `fixtures/traditional-liquor-shop.html`.
- Naver and Kakao adapters are disabled policy stubs. There is no CAPTCHA bypass, stealth, proxy rotation, or rate-limit bypass.
- Query expansion returns human-review candidates only and does not schedule collection.

## Production safety

The collection/import modules may write only to:

- `traditional_liquor_data_sources`
- `traditional_liquor_collection_runs`
- `traditional_liquor_import_batches`
- `traditional_liquor_import_staging_rows`
- `traditional_liquor_import_errors`
- `traditional_liquor_collection_queries`

There is no V1 endpoint or repository method that inserts or updates `traditional_liquor_products`, `traditional_liquor_offers`, or `traditional_liquor_price_history`.

## Verification

```bash
npm run test:traditional-liquor-collection
npm run check:traditional-liquor-collection
npm run check
```
