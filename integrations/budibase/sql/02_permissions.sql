-- Run as the schema owner after 01_migration.sql. Creates no login credentials.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='snar_bb_gateway') THEN
    CREATE ROLE snar_bb_gateway NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='snar_bb_gateway' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
    THEN RAISE EXCEPTION 'Existing gateway role has unsafe privileges'; END IF;
END $$;
GRANT USAGE ON SCHEMA snar_admin TO snar_bb_gateway;
GRANT EXECUTE ON FUNCTION snar_admin.me(),snar_admin.dashboard(),snar_admin.drivers(text,text,integer,integer),
  snar_admin.vehicles(text,integer,integer),snar_admin.prices(),snar_admin.active_rides(),snar_admin.my_vehicles(),
  snar_admin.my_rides(integer,integer),snar_admin.set_driver_status(integer,bigint,text,text),
  snar_admin.set_vehicle_status(integer,bigint,text,text),snar_admin.save_price(text,bigint,jsonb)
TO snar_bb_gateway;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND
      ((n.nspname='public' AND c.relname IN ('users','drivers','vehicles','pricing_zones','rides')) OR n.nspname='snar_admin')
      AND has_table_privilege('snar_bb_gateway',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
    THEN RAISE EXCEPTION 'Gateway inherited base-table access; review existing grants before proceeding'; END IF;
END $$;
COMMIT;
