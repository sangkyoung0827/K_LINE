create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_files (
  id uuid primary key default gen_random_uuid(),
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  extension text not null default '',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text not null,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  processing_status text not null default 'UPLOADED' check (
    processing_status in ('UPLOADED','QUEUED','EXTRACTING','ANALYZING','CHUNKING','EMBEDDING','INDEXING','READY','UNSUPPORTED','FAILED')
  ),
  processing_error text,
  parser_type text,
  extracted_text text,
  ai_summary text,
  ai_description text,
  document_type text,
  organization text,
  event text,
  location text,
  document_date date,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists knowledge_files_sha256_unique_idx
  on public.knowledge_files (sha256);
create index if not exists knowledge_files_status_uploaded_idx
  on public.knowledge_files (processing_status, uploaded_at desc);
create index if not exists knowledge_files_org_event_idx
  on public.knowledge_files (organization, event, document_date desc);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.knowledge_files(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  page_number integer,
  section text,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  embedding_provider text,
  embedding_model text,
  created_at timestamptz not null default now(),
  unique (file_id, chunk_index)
);

create index if not exists knowledge_chunks_file_idx
  on public.knowledge_chunks (file_id, chunk_index);
create index if not exists knowledge_chunks_text_idx
  on public.knowledge_chunks using gin (to_tsvector('simple', content));
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create table if not exists public.knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in ('PERSON','ORGANIZATION','EVENT','LOCATION','DATE','PROJECT','ROLE','TOPIC')
  ),
  canonical_name text not null,
  aliases text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  unique (entity_type, canonical_name)
);

create table if not exists public.knowledge_file_entities (
  file_id uuid not null references public.knowledge_files(id) on delete cascade,
  entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  relation_type text not null default 'MENTIONS',
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_text text,
  primary key (file_id, entity_id, relation_type)
);

create table if not exists public.knowledge_relations (
  id uuid primary key default gen_random_uuid(),
  source_entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  target_entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  relation_type text not null,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_file_id uuid references public.knowledge_files(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_file_relations (
  source_file_id uuid not null references public.knowledge_files(id) on delete cascade,
  target_file_id uuid not null references public.knowledge_files(id) on delete cascade,
  relation_type text not null default 'RELATED',
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (source_file_id, target_file_id, relation_type),
  check (source_file_id <> target_file_id)
);

create table if not exists public.knowledge_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.knowledge_files(id) on delete cascade,
  stage text not null,
  status text not null check (status in ('STARTED','COMPLETED','FAILED')),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  error text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists knowledge_jobs_file_started_idx
  on public.knowledge_processing_jobs (file_id, started_at desc);

alter table public.knowledge_files enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_entities enable row level security;
alter table public.knowledge_file_entities enable row level security;
alter table public.knowledge_relations enable row level security;
alter table public.knowledge_file_relations enable row level security;
alter table public.knowledge_processing_jobs enable row level security;

insert into storage.buckets (id, name, public, file_size_limit)
values ('woohyukmon-knowledge', 'woohyukmon-knowledge', false, null)
on conflict (id) do update set public = false, file_size_limit = null;

create or replace function public.match_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 30,
  organization_filter text default null,
  status_filter text default 'READY'
)
returns table (
  chunk_id uuid,
  file_id uuid,
  chunk_index integer,
  content text,
  page_number integer,
  section text,
  chunk_metadata jsonb,
  similarity double precision,
  original_name text,
  mime_type text,
  organization text,
  event text,
  location text,
  document_date date,
  ai_summary text,
  uploaded_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id,
    c.file_id,
    c.chunk_index,
    c.content,
    c.page_number,
    c.section,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity,
    f.original_name,
    f.mime_type,
    f.organization,
    f.event,
    f.location,
    f.document_date,
    f.ai_summary,
    f.uploaded_at
  from public.knowledge_chunks c
  join public.knowledge_files f on f.id = c.file_id
  where c.embedding is not null
    and (status_filter is null or f.processing_status = status_filter)
    and (organization_filter is null or f.organization = organization_filter)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
$$;

revoke all on function public.match_knowledge_chunks(extensions.vector, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks(extensions.vector, integer, text, text)
  to service_role;

revoke all on table public.knowledge_files from anon, authenticated;
revoke all on table public.knowledge_chunks from anon, authenticated;
revoke all on table public.knowledge_entities from anon, authenticated;
revoke all on table public.knowledge_file_entities from anon, authenticated;
revoke all on table public.knowledge_relations from anon, authenticated;
revoke all on table public.knowledge_file_relations from anon, authenticated;
revoke all on table public.knowledge_processing_jobs from anon, authenticated;
