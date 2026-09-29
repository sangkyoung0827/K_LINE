-- Additive, isolated storage for the public research archive.
create table if not exists public.kline_research_items (
  id uuid primary key default gen_random_uuid(),
  title_ko text not null default '',
  title_en text not null default '',
  subtitle_ko text not null default '',
  subtitle_en text not null default '',
  summary_ko text not null default '',
  summary_en text not null default '',
  body_ko text not null default '',
  body_en text not null default '',
  category text not null default 'Research Note',
  topic text not null default '',
  tags text[] not null default '{}',
  cover_path text not null default '',
  image_paths text[] not null default '{}',
  attachment_paths text[] not null default '{}',
  author_name text not null default '',
  author_organization text not null default '',
  related_organization_id text not null default '',
  related_activity_id text not null default '',
  quotes jsonb not null default '[]'::jsonb,
  reference_entries jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  visibility text not null default 'private' check (visibility in ('public', 'members', 'private')),
  is_sample boolean not null default false,
  created_by text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kline_research_items_public_idx
  on public.kline_research_items (published_at desc)
  where status = 'published' and visibility = 'public' and is_sample = false;
create index if not exists kline_research_items_category_idx
  on public.kline_research_items (category);
create index if not exists kline_research_items_org_idx
  on public.kline_research_items (author_organization);
create index if not exists kline_research_items_tags_idx
  on public.kline_research_items using gin (tags);

create table if not exists public.kline_research_editors (
  email text primary key,
  added_by text not null default '',
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

alter table public.kline_research_items enable row level security;
alter table public.kline_research_editors enable row level security;
revoke all on public.kline_research_items from anon, authenticated;
revoke all on public.kline_research_editors from anon, authenticated;
grant all on public.kline_research_items to service_role;
grant all on public.kline_research_editors to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'open-k-culture-research', 'open-k-culture-research', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;
