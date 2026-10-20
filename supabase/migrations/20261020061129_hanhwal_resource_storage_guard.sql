-- Defense in depth: only the trusted server may access Hanhwal objects.
-- Restrictive guards also survive future broad policies on unrelated buckets.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='hanhwal_resources_no_direct_read') then
    create policy hanhwal_resources_no_direct_read on storage.objects as restrictive for select to anon, authenticated using (bucket_id <> 'hanhwal-resource-library');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='hanhwal_resources_no_direct_insert') then
    create policy hanhwal_resources_no_direct_insert on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'hanhwal-resource-library');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='hanhwal_resources_no_direct_update') then
    create policy hanhwal_resources_no_direct_update on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'hanhwal-resource-library') with check (bucket_id <> 'hanhwal-resource-library');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='hanhwal_resources_no_direct_delete') then
    create policy hanhwal_resources_no_direct_delete on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'hanhwal-resource-library');
  end if;
end $$;
