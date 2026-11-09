-- Normalize high-risk D1 text timestamps after validating all populated values.
-- Uses UTC for timezone-less D1 date strings; idempotent on PostgreSQL restores.
DO $$
DECLARE item record; actual_type text; invalid_count bigint;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('api_keys','created_at'),('api_keys','expires_at'),('api_keys','last_used_at'),('api_keys','revoked_at'),('api_keys','updated_at'),
    ('oauth_login_codes','created_at'),('oauth_login_codes','expires_at'),('oauth_login_codes','used_at'),
    ('admin_password_reset_links','expires_at'),('admin_password_reset_links','used_at'),
    ('platform_mfa_challenges','created_at'),('platform_mfa_challenges','expires_at'),('platform_mfa_challenges','used_at')
  ) AS targets(table_name,column_name) LOOP
    SELECT data_type INTO actual_type FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name=item.table_name AND column_name=item.column_name;
    IF actual_type IN ('text','character varying') THEN
      EXECUTE format('SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I !~ %L',
        item.table_name,item.column_name,item.column_name,
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)?$') INTO invalid_count;
      IF invalid_count>0 THEN RAISE EXCEPTION 'Invalid timestamps: %.% (% rows)',item.table_name,item.column_name,invalid_count; END IF;
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING (CASE WHEN %I ~ %L THEN %I::timestamptz ELSE (%I::timestamp AT TIME ZONE %L) END)',
        item.table_name,item.column_name,item.column_name, '[Zz]|[+-][0-9]{2}(:?[0-9]{2})?$', item.column_name,item.column_name,'UTC');
    ELSIF actual_type IS DISTINCT FROM 'timestamp with time zone' THEN
      RAISE EXCEPTION 'Unexpected type %.%: %',item.table_name,item.column_name,actual_type;
    END IF;
  END LOOP;
  ALTER TABLE api_keys ALTER COLUMN created_at SET DEFAULT now();
  ALTER TABLE api_keys ALTER COLUMN updated_at SET DEFAULT now();
  ALTER TABLE oauth_login_codes ALTER COLUMN created_at SET DEFAULT now();
  ALTER TABLE platform_mfa_challenges ALTER COLUMN created_at SET DEFAULT now();
END $$;
