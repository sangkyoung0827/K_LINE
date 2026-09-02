create table if not exists public.ecc_registration_content (
  id text primary key,
  title text not null default '',
  body text not null default '',
  updated_by text default '',
  updated_at timestamptz not null default now()
);

alter table public.ecc_registration_content enable row level security;

drop policy if exists "Service role manages ECC registration content"
  on public.ecc_registration_content;

create policy "Service role manages ECC registration content"
  on public.ecc_registration_content
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.ecc_registration_content (id, title, body)
values (
  'ecc-new-member-registration',
  'ECC New Member Registration',
  $$👋 Welcome to ECC!

ECC is the English Conversation Club at Jeonbuk National University.
Please fill out this form after checking the membership fee information.

Membership Fee:
Amount: 15,000 KRW
Bank Account: 3333-30-3496426 / ECC OFICIAL / 카카오뱅크 예금주 이상경

Cash Payment:
If you do not have a Korean bank account, you can pay in cash at the ECC office.
Cash payment is available until September 4th (Fri), from 17:00 to 18:00.
Location: ECC room, 2nd floor of 동아리 전용관.

Notice:
Please write your information correctly.
ECC officers will check your form and payment.

Instagram:
@ecc_jbnu

Thank you! 💚$$
)
on conflict (id) do nothing;
