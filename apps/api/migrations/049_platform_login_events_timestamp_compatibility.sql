-- PostgreSQL compatibility for timestamp values imported from Cloudflare D1.
-- D1 stored platform_login_events.created_at as text; PostgreSQL cannot compare
-- that column to now() until it is converted to timestamptz.
-- Run after verifying source values; UTC is the D1 snapshot's timestamp convention.
DO $$
DECLARE current_type text;
BEGIN
  SELECT data_type INTO current_type FROM information_schema.columns
  WHERE table_schema=current_schema() AND table_name='platform_login_events' AND column_name='created_at';
  IF current_type='text' OR current_type='character varying' THEN
    IF EXISTS (SELECT 1 FROM platform_login_events
      WHERE created_at IS NOT NULL AND created_at !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$') THEN
      RAISE EXCEPTION 'platform_login_events.created_at contains invalid D1 timestamps';
    END IF;
    ALTER TABLE platform_login_events ALTER COLUMN created_at TYPE timestamptz
      USING (created_at::timestamp AT TIME ZONE 'UTC');
  ELSIF current_type IS DISTINCT FROM 'timestamp with time zone' THEN
    RAISE EXCEPTION 'Unexpected platform_login_events.created_at type: %', current_type;
  END IF;
  ALTER TABLE platform_login_events ALTER COLUMN created_at SET DEFAULT now();
END $$;
