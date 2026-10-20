-- Additive, isolated Hanhwal archive. ECC files and membership tables are untouched.
create table if not exists public.hanhwal_resource_files (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 180),
  description text not null default '' check (length(description) <= 2000),
  category text not null default 'other' check (category in ('archery','research','photos','events','other')),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  storage_path text not null unique,
  uploader_email text not null,
  uploader_name text not null default '',
  status text not null default 'uploading' check (status in ('uploading','pending','published','deleted')),
  visibility text not null default 'public' check (visibility in ('public','members','staff')),
  revision integer not null default 1 check (revision > 0),
  reviewed_by text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (status <> 'published' or (published_at is not null and reviewed_by is not null))
);
create index if not exists hanhwal_resource_files_public_idx on public.hanhwal_resource_files (created_at desc) where status = 'published' and visibility = 'public';
create index if not exists hanhwal_resource_files_review_idx on public.hanhwal_resource_files (status, created_at desc);
create index if not exists hanhwal_resource_files_owner_idx on public.hanhwal_resource_files (uploader_email, created_at desc);
alter table public.hanhwal_resource_files enable row level security;
revoke all on public.hanhwal_resource_files from public, anon, authenticated;
grant all on public.hanhwal_resource_files to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('hanhwal-resource-library','hanhwal-resource-library',false,52428800,
array['application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/x-hwp','application/vnd.hancom.hwpx',
'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.presentation','application/vnd.oasis.opendocument.spreadsheet',
'application/rtf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'image/jpeg','image/png','image/webp','image/gif','text/plain','text/csv','application/zip','video/mp4','audio/mpeg'])
on conflict (id) do nothing;
do $$
begin
  if not exists (select 1 from storage.buckets where id='hanhwal-resource-library' and public=false and file_size_limit=52428800)
  then raise exception 'Hanhwal resource bucket exists with incompatible privacy or size settings'; end if;
end $$;
