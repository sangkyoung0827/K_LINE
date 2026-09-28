-- Independent ECC resource library. Existing club boards and membership data stay untouched.
create table if not exists public.ecc_resource_files (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  storage_path text not null unique,
  uploader_email text not null,
  uploader_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists ecc_resource_files_public_idx
  on public.ecc_resource_files (published_at desc)
  where status = 'published';
create index if not exists ecc_resource_files_owner_idx
  on public.ecc_resource_files (uploader_email, created_at desc);

alter table public.ecc_resource_files enable row level security;
revoke all on public.ecc_resource_files from anon, authenticated;
grant all on public.ecc_resource_files to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ecc-resource-library', 'ecc-resource-library', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-hwp', 'application/vnd.hancom.hwpx',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet', 'application/rtf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'text/plain', 'text/csv', 'application/zip',
    'video/mp4', 'audio/mpeg'
  ]
)
on conflict (id) do nothing;
