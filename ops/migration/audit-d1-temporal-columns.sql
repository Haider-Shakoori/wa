-- Read-only audit for timestamp/date fields imported as text from D1.
-- Run against the active PostgreSQL schema after each D1 import and before cutover.
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema=current_schema()
  AND data_type IN ('text','character varying')
  AND (column_name LIKE '%_at' OR column_name LIKE '%_until'
       OR column_name LIKE '%_expires' OR column_name LIKE '%_date')
ORDER BY table_name,column_name;
