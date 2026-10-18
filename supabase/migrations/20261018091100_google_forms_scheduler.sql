begin;
-- Uses the existing project; no new hosted project or paid scheduler is required.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function public.kline_forms_live_dispatch_maintenance()
returns bigint language plpgsql security definer set search_path = '' as $$
declare token text;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name = 'kline_forms_maintenance_token' limit 1;
  if token is null or length(token) < 32 then raise exception 'MAINTENANCE_TOKEN_NOT_CONFIGURED'; end if;
  return net.http_get(
    url := 'https://kline-nine-wheat.vercel.app/api/google-forms/maintenance',
    headers := jsonb_build_object('Authorization', 'Bearer ' || token),
    timeout_milliseconds := 300000
  );
end;
$$;
revoke all on function public.kline_forms_live_dispatch_maintenance() from public, anon, authenticated;
-- Activation is an explicit release step, after endpoint/secret verification:
-- select cron.schedule('kline-forms-maintenance', '* * * * *', 'select public.kline_forms_live_dispatch_maintenance()');
-- Reusing the same job name replaces its schedule instead of creating duplicates.
commit;
