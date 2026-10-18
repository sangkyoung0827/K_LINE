begin;
-- Managed pg_net tables can retain PUBLIC ACLs owned by supabase_admin even after
-- a project-owner REVOKE. Never put a long-lived secret in that queue.
create or replace function public.kline_forms_live_dispatch_maintenance()
returns bigint language plpgsql security definer set search_path = '' as $$
declare token text; stamp text; signature text;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name = 'kline_forms_maintenance_token' limit 1;
  if token is null or length(token) < 32 then raise exception 'MAINTENANCE_TOKEN_NOT_CONFIGURED'; end if;
  stamp := floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature := encode(extensions.hmac(E'google-forms-maintenance\n' || stamp, token, 'sha256'), 'hex');
  return net.http_get(
    url := 'https://kline-nine-wheat.vercel.app/api/google-forms/maintenance',
    headers := jsonb_build_object('x-kline-forms-timestamp', stamp, 'x-kline-forms-signature', signature),
    timeout_milliseconds := 300000
  );
end;
$$;
revoke all on function public.kline_forms_live_dispatch_maintenance() from public, anon, authenticated;
commit;
