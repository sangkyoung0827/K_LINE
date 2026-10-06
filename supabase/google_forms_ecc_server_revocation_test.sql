-- Additive, service-role-only test storage; no existing KLINE table changes.
CREATE TABLE IF NOT EXISTS public.kline_forms_test_ecc_form_entry_leases (
  google_form_id text NOT NULL,
  email text NOT NULL,
  permission_id text,
  expires_at timestamptz NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','active','promoted','revoked','attention')),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (google_form_id,email)
);
CREATE INDEX IF NOT EXISTS kline_forms_test_ecc_leases_due
  ON public.kline_forms_test_ecc_form_entry_leases(expires_at) WHERE state IN ('active','pending');
CREATE TABLE IF NOT EXISTS public.kline_forms_test_ecc_form_revoker_health (
  id text PRIMARY KEY CHECK (id='worker'),
  checked_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.kline_forms_test_ecc_form_locks (
  form_id text PRIMARY KEY,
  token uuid NOT NULL,
  locked_until timestamptz NOT NULL
);
ALTER TABLE public.kline_forms_test_ecc_form_entry_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kline_forms_test_ecc_form_revoker_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kline_forms_test_ecc_form_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kline_forms_test_ecc_form_entry_leases,public.kline_forms_test_ecc_form_revoker_health,public.kline_forms_test_ecc_form_locks FROM anon,authenticated;
GRANT ALL ON public.kline_forms_test_ecc_form_entry_leases,public.kline_forms_test_ecc_form_revoker_health,public.kline_forms_test_ecc_form_locks TO service_role;
CREATE OR REPLACE FUNCTION public.kline_forms_test_ecc_form_lock(p_form_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result uuid;
BEGIN
  INSERT INTO public.kline_forms_test_ecc_form_locks(form_id,token,locked_until)
  VALUES(p_form_id,gen_random_uuid(),now()+interval '30 minutes')
  ON CONFLICT(form_id) DO UPDATE SET token=EXCLUDED.token,locked_until=EXCLUDED.locked_until
  WHERE kline_forms_test_ecc_form_locks.locked_until<now()
  RETURNING token INTO result;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.kline_forms_test_ecc_form_unlock(p_form_id text,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.kline_forms_test_ecc_form_locks WHERE form_id=p_form_id AND token=p_token;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.kline_forms_test_ecc_form_lock(text),public.kline_forms_test_ecc_form_unlock(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kline_forms_test_ecc_form_lock(text),public.kline_forms_test_ecc_form_unlock(text,uuid) TO service_role;
