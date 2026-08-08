create table if not exists public.woohyukmon_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'General',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_archived boolean not null default false
);

create table if not exists public.woohyukmon_chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.woohyukmon_projects(id) on delete cascade,
  user_id text not null,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  is_archived boolean not null default false
);

create table if not exists public.woohyukmon_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.woohyukmon_chats(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb,
  providers jsonb,
  status text,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.woohyukmon_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.woohyukmon_messages(id) on delete cascade,
  user_id text not null,
  rating text not null check (rating in ('up', 'down')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists woohyukmon_projects_user_updated_idx
  on public.woohyukmon_projects (user_id, updated_at desc);

create index if not exists woohyukmon_chats_project_last_idx
  on public.woohyukmon_chats (project_id, user_id, last_message_at desc);

create index if not exists woohyukmon_messages_chat_created_idx
  on public.woohyukmon_messages (chat_id, user_id, created_at asc);

alter table public.woohyukmon_projects enable row level security;
alter table public.woohyukmon_chats enable row level security;
alter table public.woohyukmon_messages enable row level security;
alter table public.woohyukmon_feedback enable row level security;

-- K_LINE Woohyukmon history is accessed through Next.js server routes using
-- SUPABASE_SERVICE_ROLE_KEY. Those routes enforce auth() email ownership before
-- every read/write. No public anon policies are added here, so conversations are
-- not readable or writable directly from client-side Supabase.
