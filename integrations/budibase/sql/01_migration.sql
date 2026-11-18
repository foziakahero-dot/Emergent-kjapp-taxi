-- Additive extension of the user's existing schema. Never creates/replaces base tables.
-- Apply only after 00_inspect.sql and an environment/backup check.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.users') IS NULL OR to_regclass('public.drivers') IS NULL
    OR to_regclass('public.vehicles') IS NULL OR to_regclass('public.pricing_zones') IS NULL
    OR to_regclass('public.rides') IS NULL THEN
    RAISE EXCEPTION 'SNAR base schema is missing';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS snar_admin;
REVOKE ALL ON SCHEMA snar_admin FROM PUBLIC;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS approved_by_admin_id integer REFERENCES public.users(id);
ALTER TABLE public.pricing_zones ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS snar_admin.identities (
  issuer text NOT NULL,
  subject text NOT NULL,
  user_id integer NOT NULL REFERENCES public.users(id),
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY(issuer,subject)
);
CREATE TABLE IF NOT EXISTS snar_admin.config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  price_unit text CHECK(price_unit IN ('NOK','NOK_ORE')),
  confirmed_at timestamptz
);
INSERT INTO snar_admin.config(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS snar_admin.audit_log (
  id bigserial PRIMARY KEY,
  actor_id integer NOT NULL REFERENCES public.users(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id integer NOT NULL,
  before_data jsonb,
  after_data jsonb,
  at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS snar_admin_audit_at ON snar_admin.audit_log(at DESC);
CREATE INDEX IF NOT EXISTS snar_admin_vehicle_driver ON public.vehicles(driver_id);
CREATE INDEX IF NOT EXISTS snar_admin_ride_driver ON public.rides(driver_id);

-- Invalidate stale forms even when another trusted application writes a row.
CREATE OR REPLACE FUNCTION snar_admin.bump_version() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN NEW.version:=OLD.version+1; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS snar_admin_version ON public.drivers;
CREATE TRIGGER snar_admin_version BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION snar_admin.bump_version();
DROP TRIGGER IF EXISTS snar_admin_version ON public.vehicles;
CREATE TRIGGER snar_admin_version BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION snar_admin.bump_version();
DROP TRIGGER IF EXISTS snar_admin_version ON public.pricing_zones;
CREATE TRIGGER snar_admin_version BEFORE UPDATE ON public.pricing_zones
  FOR EACH ROW EXECUTE FUNCTION snar_admin.bump_version();

-- These functions trust only transaction-local identity set by the JWT-verifying
-- gateway. Never give this gateway database role to a raw/shared Budibase SQL source.
CREATE OR REPLACE FUNCTION snar_admin.actor() RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result public.users;
BEGIN
  SELECT u.* INTO result FROM public.users u JOIN snar_admin.identities i ON i.user_id=u.id
    WHERE i.issuer=current_setting('snar.auth_issuer',true)
      AND i.subject=current_setting('snar.auth_subject',true) AND i.enabled
      AND NOT coalesce(u.is_blocked,false) FOR SHARE OF u;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Tilgang nektet'; END IF;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION snar_admin.require_admin() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u public.users;
BEGIN
  u:=snar_admin.actor();
  IF u.role::text<>'ADMIN' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administratortilgang kreves'; END IF;
  RETURN u.id;
END $$;

CREATE OR REPLACE FUNCTION snar_admin.me() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u public.users;
BEGIN
  u:=snar_admin.actor();
  RETURN jsonb_build_object('id',u.id,'name',u.name,'role',u.role);
END $$;
CREATE OR REPLACE FUNCTION snar_admin.dashboard() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM snar_admin.require_admin();
  RETURN jsonb_build_object('pending_drivers',(SELECT count(*) FROM public.drivers WHERE status='pending'),
    'pending_vehicles',(SELECT count(*) FROM public.vehicles WHERE status='pending'),
    'active_rides',(SELECT count(*) FROM public.rides WHERE status IN ('accepted','arrived','in_progress')),
    'requested_rides',(SELECT count(*) FROM public.rides WHERE status='requested'),'as_of',clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION snar_admin.drivers(p_status text DEFAULT 'pending',p_search text DEFAULT '',p_limit integer DEFAULT 25,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE items jsonb; total bigint;
BEGIN
  PERFORM snar_admin.require_admin();
  IF p_status IS NULL OR p_search IS NULL OR p_limit IS NULL OR p_offset IS NULL
    OR p_status NOT IN ('all','pending','approved','rejected','suspended') OR p_limit NOT BETWEEN 1 AND 100 OR p_offset<0
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ugyldig filter eller side'; END IF;
  SELECT count(*) INTO total FROM public.drivers d JOIN public.users u ON u.id=d.user_id
    WHERE (p_status='all' OR d.status::text=p_status) AND (strpos(lower(u.name),lower(p_search))>0 OR strpos(u.phone,p_search)>0);
  SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO items FROM (
    SELECT d.*,u.name,u.phone,u.email,coalesce(u.is_blocked,false) AS is_blocked
    FROM public.drivers d JOIN public.users u ON u.id=d.user_id
    WHERE (p_status='all' OR d.status::text=p_status) AND (strpos(lower(u.name),lower(p_search))>0 OR strpos(u.phone,p_search)>0)
    ORDER BY d.created_at DESC,d.id DESC LIMIT p_limit OFFSET p_offset) t;
  RETURN jsonb_build_object('rows',items,'total',total,'as_of',clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION snar_admin.vehicles(p_status text DEFAULT 'pending',p_limit integer DEFAULT 25,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE items jsonb; total bigint;
BEGIN
  PERFORM snar_admin.require_admin();
  IF p_status IS NULL OR p_limit IS NULL OR p_offset IS NULL
    OR p_status NOT IN ('all','pending','approved','rejected','suspended') OR p_limit NOT BETWEEN 1 AND 100 OR p_offset<0
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ugyldig filter eller side'; END IF;
  SELECT count(*) INTO total FROM public.vehicles WHERE p_status='all' OR status::text=p_status;
  SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO items FROM (
    SELECT v.*,u.name AS driver_name FROM public.vehicles v LEFT JOIN public.users u ON u.id=v.driver_id
    WHERE p_status='all' OR v.status::text=p_status ORDER BY v.created_at DESC,v.id DESC LIMIT p_limit OFFSET p_offset) t;
  RETURN jsonb_build_object('rows',items,'total',total,'as_of',clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION snar_admin.prices() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM snar_admin.require_admin();
  RETURN jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.pricing_zones p),
    'price_unit',(SELECT price_unit FROM snar_admin.config WHERE singleton),'as_of',clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION snar_admin.active_rides() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM snar_admin.require_admin();
  RETURN jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM (
    SELECT r.*,p.name AS passenger_name,d.name AS driver_name FROM public.rides r
    LEFT JOIN public.users p ON p.id=r.passenger_id LEFT JOIN public.users d ON d.id=r.driver_id
    WHERE r.status IN ('accepted','arrived','in_progress') ORDER BY r.created_at DESC,r.id DESC LIMIT 500) t),
    'as_of',clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION snar_admin.my_vehicles() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u public.users;
BEGIN
  u:=snar_admin.actor();
  IF u.role::text<>'DRIVER' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sjåførtilgang kreves'; END IF;
  RETURN jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.id),'[]'::jsonb) FROM public.vehicles v WHERE v.driver_id=u.id));
END $$;
CREATE OR REPLACE FUNCTION snar_admin.my_rides(p_limit integer DEFAULT 25,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u public.users;
BEGIN
  u:=snar_admin.actor();
  IF u.role::text<>'DRIVER' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sjåførtilgang kreves'; END IF;
  IF p_limit IS NULL OR p_offset IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset<0
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ugyldig side'; END IF;
  RETURN jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM (
    SELECT r.* FROM public.rides r WHERE r.driver_id=u.id ORDER BY r.created_at DESC,r.id DESC LIMIT p_limit OFFSET p_offset) t),
    'total',(SELECT count(*) FROM public.rides WHERE driver_id=u.id));
END $$;

CREATE OR REPLACE FUNCTION snar_admin.set_driver_status(p_id integer,p_version bigint,p_action text,p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor integer; before_row public.drivers; after_row public.drivers; u public.users;
BEGIN
  actor:=snar_admin.require_admin();
  IF p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_action IS NULL
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID, versjon og handling kreves'; END IF;
  SELECT * INTO before_row FROM public.drivers WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Søknad ikke funnet'; END IF;
  IF before_row.version<>p_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Søknaden er endret. Oppdater visningen.'; END IF;
  IF p_action NOT IN ('approved','rejected','suspended') OR before_row.status::text=p_action
    OR (p_action='suspended' AND before_row.status<>'approved') OR (p_action='rejected' AND before_row.status<>'pending')
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ugyldig statusovergang'; END IF;
  IF p_action IN ('rejected','suspended') AND length(btrim(coalesce(p_reason,'')))<3
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Begrunnelse kreves'; END IF;
  SELECT * INTO u FROM public.users WHERE id=before_row.user_id FOR SHARE;
  IF p_action='approved' AND (u.id IS NULL OR u.role::text<>'DRIVER' OR coalesce(u.is_blocked,false)
      OR before_row.license_expiry<CURRENT_DATE OR before_row.taxi_license_expiry<CURRENT_DATE)
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Bruker eller dokumentdatoer kan ikke godkjennes'; END IF;
  UPDATE public.drivers SET status=p_action::public.approval_status,
    reject_reason=CASE WHEN p_action='approved' THEN NULL ELSE btrim(p_reason) END,
    approved_at=CASE WHEN p_action='approved' THEN clock_timestamp() ELSE approved_at END,
    approved_by_admin_id=CASE WHEN p_action='approved' THEN actor ELSE approved_by_admin_id END
    WHERE id=p_id RETURNING * INTO after_row;
  INSERT INTO snar_admin.audit_log(actor_id,action,entity,entity_id,before_data,after_data)
    VALUES(actor,p_action,'driver',p_id,to_jsonb(before_row),to_jsonb(after_row));
  RETURN to_jsonb(after_row);
END $$;
CREATE OR REPLACE FUNCTION snar_admin.set_vehicle_status(p_id integer,p_version bigint,p_action text,p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor integer; before_row public.vehicles; after_row public.vehicles; d public.drivers; u public.users;
BEGIN
  actor:=snar_admin.require_admin();
  IF p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_action IS NULL
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID, versjon og handling kreves'; END IF;
  SELECT * INTO before_row FROM public.vehicles WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Kjøretøy ikke funnet'; END IF;
  IF before_row.version<>p_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Kjøretøyet er endret. Oppdater visningen.'; END IF;
  IF p_action NOT IN ('approved','rejected') OR before_row.status<>'pending'
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ugyldig statusovergang'; END IF;
  IF p_action='rejected' AND length(btrim(coalesce(p_reason,'')))<3
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Begrunnelse kreves'; END IF;
  SELECT * INTO u FROM public.users WHERE id=before_row.driver_id FOR SHARE;
  SELECT * INTO d FROM public.drivers WHERE user_id=before_row.driver_id FOR SHARE;
  IF p_action='approved' AND (u.id IS NULL OR u.role::text<>'DRIVER' OR coalesce(u.is_blocked,false)
      OR d.id IS NULL OR d.status<>'approved' OR d.license_expiry<CURRENT_DATE OR d.taxi_license_expiry<CURRENT_DATE
      OR before_row.insurance_expiry<CURRENT_DATE)
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Forsikring eller sjåførtilknytning kan ikke godkjennes'; END IF;
  UPDATE public.vehicles SET status=p_action::public.approval_status,
    reject_reason=CASE WHEN p_action='approved' THEN NULL ELSE btrim(p_reason) END,
    approved_at=CASE WHEN p_action='approved' THEN clock_timestamp() ELSE approved_at END,
    approved_by_admin_id=CASE WHEN p_action='approved' THEN actor ELSE approved_by_admin_id END
    WHERE id=p_id RETURNING * INTO after_row;
  INSERT INTO snar_admin.audit_log(actor_id,action,entity,entity_id,before_data,after_data)
    VALUES(actor,p_action,'vehicle',p_id,to_jsonb(before_row),to_jsonb(after_row));
  RETURN to_jsonb(after_row);
END $$;
CREATE OR REPLACE FUNCTION snar_admin.save_price(p_class text,p_version bigint,p_values jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor integer; before_row public.pricing_zones; after_row public.pricing_zones; k text; v jsonb;
BEGIN
  actor:=snar_admin.require_admin();
  IF p_class IS NULL OR p_version IS NULL OR p_version<0 OR p_values IS NULL
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prisklasse, versjon og verdier kreves'; END IF;
  IF (SELECT price_unit FROM snar_admin.config WHERE singleton) IS NULL
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prisens lagringsenhet må bekreftes først'; END IF;
  IF jsonb_typeof(p_values)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_values))<>7
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Alle sju prisfelter kreves'; END IF;
  FOR k,v IN SELECT * FROM jsonb_each(p_values) LOOP
    IF k NOT IN ('base_fare','per_km','per_minute','minimum_fare','night_surcharge','rush_hour_surcharge','is_active')
      THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ugyldig prisverdi'; END IF;
    IF k='is_active' THEN
      IF jsonb_typeof(v)<>'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ugyldig aktiv-verdi'; END IF;
    ELSE
      IF jsonb_typeof(v)<>'number' OR v::text !~ '^[0-9]+$'
        THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Pris må være et ikke-negativt heltall'; END IF;
      IF (v::text)::numeric>2147483647
        THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Pris er for stor'; END IF;
    END IF;
  END LOOP;
  IF (p_values->>'minimum_fare')::integer<(p_values->>'base_fare')::integer
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Minstepris kan ikke være lavere enn grunnpris'; END IF;
  SELECT * INTO before_row FROM public.pricing_zones WHERE vehicle_class::text=p_class FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Prisklasse ikke funnet'; END IF;
  IF before_row.version<>p_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Prisene er endret. Oppdater visningen.'; END IF;
  UPDATE public.pricing_zones SET base_fare=(p_values->>'base_fare')::integer,per_km=(p_values->>'per_km')::integer,
    per_minute=(p_values->>'per_minute')::integer,minimum_fare=(p_values->>'minimum_fare')::integer,
    night_surcharge=(p_values->>'night_surcharge')::integer,rush_hour_surcharge=(p_values->>'rush_hour_surcharge')::integer,
    is_active=(p_values->>'is_active')::boolean WHERE id=before_row.id RETURNING * INTO after_row;
  INSERT INTO snar_admin.audit_log(actor_id,action,entity,entity_id,before_data,after_data)
    VALUES(actor,'price.update','pricing_zone',before_row.id,to_jsonb(before_row),to_jsonb(after_row));
  RETURN to_jsonb(after_row);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA snar_admin FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA snar_admin FROM PUBLIC;
COMMIT;
