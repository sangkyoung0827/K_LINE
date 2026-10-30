alter table public.hanhwal_operational_settings
  add column if not exists team_chat_description_ko text not null default '등록한 이름 또는 카카오톡 표시 이름으로 입장해 주세요.',
  add column if not exists team_chat_description_en text not null default 'Please join using your registered name or KakaoTalk display name.';
