-- Separate private storage; no policies or buckets used by existing clubs are changed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('woohyukmon-event-media','woohyukmon-event-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

do $$
begin
  if exists(select 1 from storage.buckets where id='woohyukmon-event-media' and public) then
    raise exception 'WOOHYUKMON_MEDIA_BUCKET_MUST_BE_PRIVATE';
  end if;
end $$;
