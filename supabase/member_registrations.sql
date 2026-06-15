create table if not exists public.member_registration_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  title text not null,
  description text not null default '',
  target_group text not null default '',
  google_form_url text not null,
  google_sheet_url text not null default '',
  google_sheet_id text not null default '',
  sheet_tab_name text not null default '',
  start_date date,
  deadline date,
  is_active boolean not null default true,
  public_note text not null default '',
  created_by text not null default ''
);

create index if not exists member_registration_campaigns_created_at_idx
  on public.member_registration_campaigns (created_at desc);

create index if not exists member_registration_campaigns_active_idx
  on public.member_registration_campaigns (is_active);

create table if not exists public.member_registration_applicant_statuses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  campaign_id uuid not null references public.member_registration_campaigns(id) on delete cascade,
  external_row_id text not null,
  applicant_name text not null default '',
  applicant_email text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'invited', 'rejected', 'waitlist')),
  kakao_joined boolean not null default false,
  memo text not null default '',
  updated_by text not null default '',
  unique (campaign_id, external_row_id)
);

create index if not exists member_registration_applicant_statuses_campaign_idx
  on public.member_registration_applicant_statuses (campaign_id, created_at desc);

alter table public.member_registration_campaigns enable row level security;
alter table public.member_registration_applicant_statuses enable row level security;

drop policy if exists "Service role manages member registration campaigns"
  on public.member_registration_campaigns;

drop policy if exists "Service role manages member registration applicant statuses"
  on public.member_registration_applicant_statuses;

create policy "Service role manages member registration campaigns"
  on public.member_registration_campaigns
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages member registration applicant statuses"
  on public.member_registration_applicant_statuses
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
