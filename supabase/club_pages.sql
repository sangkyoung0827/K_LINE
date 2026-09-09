-- K_LINE Club Website Builder only. Run in Supabase SQL Editor.
begin;
create table if not exists public.club_pages (
  id uuid primary key default gen_random_uuid(),
  club_key text not null unique check (club_key in ('ecc', 'hanhwal')),
  draft_theme_id text not null default 'default' check (draft_theme_id in ('default','warm','nature','mono')),
  draft_sections jsonb not null default '[]'::jsonb check (jsonb_typeof(draft_sections) = 'array' and jsonb_array_length(draft_sections) <= 30),
  published_theme_id text check (published_theme_id in ('default','warm','nature','mono')),
  published_sections jsonb check (jsonb_typeof(published_sections) = 'array' and jsonb_array_length(published_sections) <= 30),
  is_published boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  revision bigint not null default 0,
  check (not is_published or (published_theme_id is not null and published_sections is not null))
);
alter table public.club_pages enable row level security;
revoke all on public.club_pages from public, anon, authenticated;
grant select, insert, update on public.club_pages to service_role;
insert into public.club_pages (club_key) values ('ecc'), ('hanhwal') on conflict (club_key) do nothing;

-- One row lock protects concurrent editors and atomically publishes the preview.
create or replace function public.write_club_page(
  target_club text, expected_revision bigint, action text,
  theme text, sections jsonb, actor text
) returns bigint language plpgsql security invoker set search_path = public as $$
declare current_revision bigint;
begin
  if target_club not in ('ecc','hanhwal') or action not in ('draft','publish','unpublish')
    or theme not in ('default','warm','nature','mono') or actor is null or actor = ''
    or jsonb_typeof(sections) <> 'array' or jsonb_array_length(sections) > 30
    or octet_length(sections::text) > 350000 then
    raise exception 'Invalid club page input';
  end if;
  select revision into current_revision from public.club_pages where club_key = target_club for update;
  if current_revision is null then raise exception 'Club page migration is required'; end if;
  if current_revision <> expected_revision then raise exception 'CLUB_PAGE_CONFLICT'; end if;
  update public.club_pages set
    draft_theme_id = case when action = 'unpublish' then draft_theme_id else theme end,
    draft_sections = case when action = 'unpublish' then draft_sections else sections end,
    published_theme_id = case when action = 'publish' then theme else published_theme_id end,
    published_sections = case when action = 'publish' then sections else published_sections end,
    is_published = case when action = 'publish' then true when action = 'unpublish' then false else is_published end,
    published_by = case when action = 'publish' then actor else published_by end,
    published_at = case when action = 'publish' then now() else published_at end,
    updated_by = actor, updated_at = now(), revision = revision + 1
  where club_key = target_club;
  return current_revision + 1;
end;
$$;
revoke all on function public.write_club_page(text,bigint,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.write_club_page(text,bigint,text,text,jsonb,text) to service_role;

-- Public images are intentional; uploads are service-role only after NextAuth checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-page-media', 'club-page-media', true, 4000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 4000000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
-- No browser write policies. Never delete images referenced by a published page.
notify pgrst, 'reload schema';
commit;
