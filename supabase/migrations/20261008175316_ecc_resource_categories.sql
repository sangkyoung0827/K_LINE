-- Existing files default to Other; file paths, dates, ownership and access stay unchanged.
alter table public.ecc_resource_files
  add column if not exists category text not null default 'other'
  check (category in ('class-research', 'notice', 'mt', 'special-event', 'other'));
