-- Ensure the diagnostic archive upsert has a PostgreSQL conflict arbiter.
-- Run after checking for duplicate (resource_type, resource_id) pairs.
-- The unique index is idempotent and preserves existing rows.
DO $$
BEGIN
  IF to_regclass('platform_diagnostic_archives') IS NULL THEN
    RAISE EXCEPTION 'platform_diagnostic_archives table is missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM platform_diagnostic_archives
    GROUP BY resource_type, resource_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate diagnostic archive resource pairs; resolve before adding unique index';
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS platform_diagnostic_archives_resource_pair_uidx
    ON platform_diagnostic_archives (resource_type, resource_id);
END $$;
