BEGIN READ ONLY;
SELECT current_database(), current_user, version();
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('users','drivers','vehicles','pricing_zones','rides')
ORDER BY table_name, ordinal_position;
SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
WHERE t.typname IN ('user_role','approval_status','ride_status','vehicle_class')
ORDER BY t.typname,e.enumsortorder;
SELECT table_name, grantee, privilege_type FROM information_schema.table_privileges
WHERE table_schema='public' AND table_name IN ('users','drivers','vehicles','pricing_zones','rides');
COMMIT;
