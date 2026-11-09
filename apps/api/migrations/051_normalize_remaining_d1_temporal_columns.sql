-- Normalize remaining timestamp-like columns from the imported D1 snapshot.
-- Execute only after backing up the schema; transactionally abort on any
-- unparseable or blank non-null timestamp, preserving all original data.
DO $$
DECLARE item record; invalid_count bigint;
BEGIN
 FOR item IN SELECT table_name,column_name FROM information_schema.columns
   WHERE table_schema=current_schema() AND data_type IN ('text','character varying')
     AND (column_name LIKE '%_at' OR column_name LIKE '%_until' OR column_name LIKE '%_expires')
   ORDER BY table_name,column_name
 LOOP
   EXECUTE format('SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I !~ %L',
      item.table_name,item.column_name,item.column_name,
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)?$') INTO invalid_count;
   IF invalid_count > 0 THEN
     RAISE EXCEPTION 'Unparseable timestamp in %.% (% rows); no changes applied',
       item.table_name,item.column_name,invalid_count;
   END IF;
 END LOOP;
 FOR item IN SELECT table_name,column_name FROM information_schema.columns
   WHERE table_schema=current_schema() AND data_type IN ('text','character varying')
     AND (column_name LIKE '%_at' OR column_name LIKE '%_until' OR column_name LIKE '%_expires')
   ORDER BY table_name,column_name
 LOOP
   EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING (CASE WHEN %I ~ %L THEN %I::timestamptz ELSE (%I::timestamp AT TIME ZONE %L) END)',
      item.table_name,item.column_name,item.column_name,
      '[Zz]|[+-][0-9]{2}(:?[0-9]{2})?$',item.column_name,item.column_name,'UTC');
 END LOOP;
END $$;
