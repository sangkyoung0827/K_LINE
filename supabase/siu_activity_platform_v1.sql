-- SIU Activity Platform V1. Run in Supabase SQL Editor as postgres.
-- Additive and re-runnable. No ECC/Hanhwal/history/preference table changes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.siu_roles (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND position('@' in email) > 1),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','official_member','admin','super_admin','developer')),
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.siu_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_key text NOT NULL,
  creator_display_name text NOT NULL DEFAULT '',
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  short_description text NOT NULL CHECK (char_length(short_description) BETWEEN 1 AND 300),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 10000),
  categories text[] NOT NULL DEFAULT '{}' CHECK (cardinality(categories) BETWEEN 1 AND 14 AND categories <@ ARRAY[
    'social_networking','party_nightlife','culture_tradition','travel','food','outdoor','sports',
    'wellness','volunteering','education','career','creative','language_exchange','local_exploration']::text[]),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 10),
  cover_image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at >= starts_at),
  location_name text NOT NULL CHECK (char_length(location_name) BETWEEN 1 AND 200),
  location_address text,
  capacity integer CHECK (capacity BETWEEN 1 AND 100000),
  application_deadline timestamptz CHECK (application_deadline <= starts_at),
  is_free boolean NOT NULL DEFAULT true,
  fee_krw bigint CHECK (fee_krw BETWEEN 0 AND 10000000),
  preparation_notes text,
  contact_note text,
  open_chat_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed','cancelled','hidden')),
  status_before_hidden text,
  hidden_by text,
  hidden_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (is_free OR fee_krw > 0)
);

CREATE TABLE IF NOT EXISTS public.siu_activity_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.siu_activities(id) ON DELETE RESTRICT,
  user_key text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','cancelled')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Immutable interest snapshots; reapplying never fabricates a second signal.
  categories_snapshot text[] NOT NULL,
  tags_snapshot text[] NOT NULL,
  title_snapshot text NOT NULL,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  rated_at timestamptz,
  preference_synced boolean NOT NULL DEFAULT false,
  UNIQUE (activity_id, user_key)
);

CREATE INDEX IF NOT EXISTS siu_activities_creator_idx ON public.siu_activities(creator_user_key, created_at DESC);
CREATE INDEX IF NOT EXISTS siu_activities_status_date_idx ON public.siu_activities(status, starts_at, id);
CREATE INDEX IF NOT EXISTS siu_applications_user_idx ON public.siu_activity_applications(user_key, applied_at DESC, id);
CREATE INDEX IF NOT EXISTS siu_applications_activity_status_idx ON public.siu_activity_applications(activity_id, status);
CREATE INDEX IF NOT EXISTS siu_applications_preference_pending_idx ON public.siu_activity_applications(id) WHERE NOT preference_synced;
CREATE INDEX IF NOT EXISTS siu_roles_role_idx ON public.siu_roles(role);

CREATE OR REPLACE FUNCTION public.siu_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS siu_activity_updated_at ON public.siu_activities;
CREATE TRIGGER siu_activity_updated_at BEFORE UPDATE ON public.siu_activities
  FOR EACH ROW EXECUTE FUNCTION public.siu_touch_updated_at();
DROP TRIGGER IF EXISTS siu_application_updated_at ON public.siu_activity_applications;
CREATE TRIGGER siu_application_updated_at BEFORE UPDATE ON public.siu_activity_applications
  FOR EACH ROW EXECUTE FUNCTION public.siu_touch_updated_at();
DROP TRIGGER IF EXISTS siu_role_updated_at ON public.siu_roles;
CREATE TRIGGER siu_role_updated_at BEFORE UPDATE ON public.siu_roles
  FOR EACH ROW EXECUTE FUNCTION public.siu_touch_updated_at();

CREATE OR REPLACE VIEW public.siu_activity_summaries WITH (security_invoker = true) AS
SELECT a.*, (SELECT count(*)::integer FROM public.siu_activity_applications p
  WHERE p.activity_id = a.id AND p.status = 'applied') AS application_count
FROM public.siu_activities a;

-- Read-only union. Existing records, their constraints and rating writes stay intact.
-- SIU dates are activity end dates, never evidence of physical attendance.
CREATE OR REPLACE VIEW public.kline_activity_history_v1 WITH (security_invoker = true) AS
SELECT id,user_id,source,activity_id,activity_instance_id,activity_title_snapshot,activity_date_snapshot,
  eligible_at,rating,rated_at,dismissed_at,created_at FROM public.user_activity_records
UNION ALL
SELECT p.id,p.user_key,'social_impact_union'::text,a.id::text,a.id,p.title_snapshot,a.ends_at,
  a.ends_at,p.rating,p.rated_at,NULL::timestamptz,p.applied_at
FROM public.siu_activity_applications p JOIN public.siu_activities a ON a.id=p.activity_id
WHERE p.status='applied' AND a.status IN ('published','closed') AND a.ends_at <= now();

-- Only the authenticated NextAuth server can invoke these RPCs (service_role).
-- Activity-row locks serialize capacity checks, edits, moderation and applications.
CREATE OR REPLACE FUNCTION public.siu_save_activity(
  p_actor text, p_name text, p_admin boolean, p_id uuid,
  p_action text, p_expected_updated_at timestamptz, p_data jsonb
) RETURNS public.siu_activities LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE a public.siu_activities; d public.siu_activities; n integer;
BEGIN
  IF p_actor IS NULL OR p_actor = '' THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  IF p_id IS NULL THEN
    IF p_action <> 'save' OR p_data->>'status' NOT IN ('draft','published') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('siu:create:' || p_actor, 0));
    IF (SELECT count(*) FROM public.siu_activities WHERE creator_user_key=p_actor AND created_at > now()-interval '1 day') >= 20
      THEN RAISE EXCEPTION 'CREATE_LIMIT'; END IF;
    d := jsonb_populate_record(NULL::public.siu_activities, p_data);
    INSERT INTO public.siu_activities (creator_user_key,creator_display_name,title,short_description,description,
      categories,tags,cover_image_url,starts_at,ends_at,location_name,location_address,capacity,application_deadline,
      is_free,fee_krw,preparation_notes,contact_note,open_chat_url,status)
    VALUES (p_actor,p_name,d.title,d.short_description,d.description,d.categories,d.tags,d.cover_image_url,
      d.starts_at,d.ends_at,d.location_name,d.location_address,d.capacity,d.application_deadline,
      d.is_free,d.fee_krw,d.preparation_notes,d.contact_note,d.open_chat_url,d.status)
    RETURNING * INTO a;
    RETURN a;
  END IF;
  SELECT * INTO a FROM public.siu_activities WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF a.creator_user_key <> p_actor AND NOT p_admin THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_expected_updated_at IS NULL OR a.updated_at <> p_expected_updated_at THEN RAISE EXCEPTION 'STALE_ACTIVITY'; END IF;
  IF p_action IN ('hide','unhide') THEN
    IF NOT p_admin THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF p_action='hide' AND a.status <> 'hidden' THEN
      UPDATE public.siu_activities SET status_before_hidden=status,status='hidden',hidden_by=p_actor,hidden_at=now()
      WHERE id=p_id RETURNING * INTO a;
    ELSIF p_action='unhide' AND a.status='hidden' THEN
      UPDATE public.siu_activities SET status=coalesce(status_before_hidden,'draft'),status_before_hidden=NULL,
        hidden_by=NULL,hidden_at=NULL WHERE id=p_id RETURNING * INTO a;
    ELSE RAISE EXCEPTION 'INVALID_ACTION'; END IF;
    RETURN a;
  END IF;
  IF a.status IN ('hidden','cancelled') THEN RAISE EXCEPTION 'ACTIVITY_LOCKED'; END IF;
  IF p_action='close' THEN
    IF a.status <> 'published' THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
    UPDATE public.siu_activities SET status='closed' WHERE id=p_id RETURNING * INTO a;
  ELSIF p_action='cancel' THEN
    UPDATE public.siu_activities SET status='cancelled',cancelled_at=now() WHERE id=p_id RETURNING * INTO a;
  ELSIF p_action='save' THEN
    IF a.creator_user_key <> p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    d := jsonb_populate_record(NULL::public.siu_activities, p_data);
    SELECT count(*) INTO n FROM public.siu_activity_applications WHERE activity_id=p_id AND status='applied';
    IF d.status NOT IN ('draft','published','closed') OR (d.status='draft' AND a.status <> 'draft' AND n>0)
      OR (d.capacity IS NOT NULL AND d.capacity < n) THEN RAISE EXCEPTION 'INVALID_ACTIVITY_STATE'; END IF;
    IF EXISTS (SELECT 1 FROM public.siu_activity_applications WHERE activity_id=p_id AND rating IS NOT NULL)
      AND (d.starts_at <> a.starts_at OR d.ends_at <> a.ends_at) THEN RAISE EXCEPTION 'RATED_DATE_LOCKED'; END IF;
    UPDATE public.siu_activities SET title=d.title,short_description=d.short_description,description=d.description,
      categories=d.categories,tags=d.tags,cover_image_url=d.cover_image_url,starts_at=d.starts_at,ends_at=d.ends_at,
      location_name=d.location_name,location_address=d.location_address,capacity=d.capacity,
      application_deadline=d.application_deadline,is_free=d.is_free,fee_krw=d.fee_krw,
      preparation_notes=d.preparation_notes,contact_note=d.contact_note,open_chat_url=d.open_chat_url,status=d.status
    WHERE id=p_id RETURNING * INTO a;
  ELSE RAISE EXCEPTION 'INVALID_ACTION';
  END IF;
  RETURN a;
END;
$$;

CREATE OR REPLACE FUNCTION public.siu_apply(
  p_activity_id uuid, p_user text, p_name text, p_action text, p_rating integer DEFAULT NULL
) RETURNS public.siu_activity_applications LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE a public.siu_activities; p public.siu_activity_applications;
BEGIN
  IF p_user IS NULL OR p_user = '' THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
  SELECT * INTO a FROM public.siu_activities WHERE id=p_activity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO p FROM public.siu_activity_applications WHERE activity_id=p_activity_id AND user_key=p_user FOR UPDATE;
  IF p_action='cancel' THEN
    IF p.id IS NULL THEN RAISE EXCEPTION 'NOT_APPLIED'; END IF;
    IF now() >= a.starts_at OR p.rating IS NOT NULL THEN RAISE EXCEPTION 'CANCELLATION_CLOSED'; END IF;
    UPDATE public.siu_activity_applications SET status='cancelled',cancelled_at=coalesce(cancelled_at,now())
    WHERE id=p.id RETURNING * INTO p;
  ELSIF p_action='rate' THEN
    IF p.id IS NULL OR p.status <> 'applied' OR a.status NOT IN ('published','closed')
      OR now() < a.ends_at THEN RAISE EXCEPTION 'RATING_NOT_ELIGIBLE'; END IF;
    IF p.rating IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_RATED'; END IF;
    IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
    UPDATE public.siu_activity_applications SET rating=p_rating,rated_at=now(),preference_synced=false
    WHERE id=p.id RETURNING * INTO p;
  ELSIF p_action='apply' THEN
    IF a.status <> 'published' OR now() >= least(a.starts_at,coalesce(a.application_deadline,a.starts_at))
      THEN RAISE EXCEPTION 'APPLICATION_CLOSED'; END IF;
    IF p.id IS NOT NULL AND p.status='applied' THEN RAISE EXCEPTION 'ALREADY_APPLIED'; END IF;
    IF a.capacity IS NOT NULL AND (SELECT count(*) FROM public.siu_activity_applications
      WHERE activity_id=a.id AND status='applied') >= a.capacity THEN RAISE EXCEPTION 'CAPACITY_REACHED'; END IF;
    IF p.id IS NULL THEN
      INSERT INTO public.siu_activity_applications(activity_id,user_key,display_name,categories_snapshot,tags_snapshot,title_snapshot)
      VALUES(a.id,p_user,p_name,a.categories,a.tags,a.title) RETURNING * INTO p;
    ELSE
      UPDATE public.siu_activity_applications SET status='applied',cancelled_at=NULL
      WHERE id=p.id RETURNING * INTO p;
    END IF;
  ELSE RAISE EXCEPTION 'INVALID_ACTION';
  END IF;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.siu_set_role(p_actor text,p_global_rank integer,p_email text,p_role text)
RETURNS public.siu_roles LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE actor_rank integer; target_rank integer; new_rank integer; result public.siu_roles;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('siu:roles',0));
  SELECT greatest(p_global_rank,coalesce(array_position(ARRAY['user','official_member','admin','super_admin','developer'],role),1))
    INTO actor_rank FROM (SELECT (SELECT role FROM public.siu_roles WHERE email=p_actor) AS role) t;
  SELECT coalesce(array_position(ARRAY['user','official_member','admin','super_admin','developer'],role),1)
    INTO target_rank FROM (SELECT (SELECT role FROM public.siu_roles WHERE email=p_email) AS role) t;
  new_rank := array_position(ARRAY['user','official_member','admin','super_admin'],p_role);
  IF actor_rank < 3 OR new_rank IS NULL OR new_rank >= actor_rank OR target_rank >= actor_rank OR p_actor=p_email
    THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  INSERT INTO public.siu_roles(email,role,updated_by) VALUES(p_email,p_role,p_actor)
  ON CONFLICT(email) DO UPDATE SET role=excluded.role,updated_by=excluded.updated_by RETURNING * INTO result;
  RETURN result;
END;
$$;

ALTER TABLE public.siu_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siu_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siu_activity_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.siu_roles,public.siu_activities,public.siu_activity_applications,public.siu_activity_summaries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.siu_roles,public.siu_activities,public.siu_activity_applications TO service_role;
GRANT SELECT ON public.siu_activity_summaries TO service_role;
REVOKE ALL ON public.kline_activity_history_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.kline_activity_history_v1 TO service_role;
REVOKE ALL ON FUNCTION public.siu_touch_updated_at() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.siu_save_activity(text,text,boolean,uuid,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.siu_apply(uuid,text,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.siu_set_role(text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.siu_save_activity(text,text,boolean,uuid,text,timestamptz,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.siu_apply(uuid,text,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.siu_set_role(text,integer,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
