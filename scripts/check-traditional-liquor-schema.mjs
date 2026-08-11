import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve("supabase/traditional_liquor_market.sql"), "utf8").toLowerCase();

const tables = [
  "traditional_liquor_breweries",
  "traditional_liquor_products",
  "traditional_liquor_platforms",
  "traditional_liquor_sellers",
  "traditional_liquor_offers",
  "traditional_liquor_price_history",
  "traditional_liquor_product_aliases",
  "traditional_liquor_seller_aliases",
  "traditional_liquor_data_sources",
  "traditional_liquor_import_batches",
  "traditional_liquor_import_staging_rows",
  "traditional_liquor_import_errors"
];

const required = [
  ...tables.map((table) => `create table if not exists public.${table}`),
  "create or replace view public.v_traditional_liquor_market",
  "traditional_liquor_offers_external_unique_idx",
  "traditional_liquor_offers_url_unique_idx",
  "traditional_liquor_price_history_offer_observed_idx",
  "price bigint not null",
  "platform_id uuid not null references public.traditional_liquor_platforms",
  "offer_id uuid not null references public.traditional_liquor_offers",
  "enable row level security"
];

const missing = required.filter((needle) => !schema.includes(needle));
if (missing.length) {
  throw new Error(`Traditional liquor schema validation failed. Missing: ${missing.join(", ")}`);
}

if (/\b(price|original_price|shipping_fee)\s+(real|double precision|float)/.test(schema)) {
  throw new Error("Traditional liquor monetary columns must not use floating-point types.");
}

if (schema.includes("references public.knowledge_") || schema.includes("embedding extensions.vector")) {
  throw new Error("Traditional liquor Market DB must remain independent from the Knowledge System.");
}

console.log(`Traditional liquor schema check passed (${tables.length} tables + market view).`);

