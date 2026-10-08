-- Privacy-conscious first-party website analytics.
-- No raw IP address, full user agent, cookies, query strings, or visitor identity are persisted.
CREATE TABLE IF NOT EXISTS website_pageviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  visit_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  visitor_key char(64) NOT NULL,
  path varchar(240) NOT NULL,
  country_code char(2) NOT NULL DEFAULT 'ZZ',
  traffic_type varchar(20) NOT NULL CHECK (traffic_type IN ('human', 'bot', 'suspected_bot')),
  bot_family varchar(50),
  device_type varchar(16) NOT NULL CHECK (device_type IN ('desktop','mobile','tablet','other')),
  referrer_host varchar(180)
);
CREATE INDEX IF NOT EXISTS idx_website_pageviews_day ON website_pageviews(visit_day DESC);
CREATE INDEX IF NOT EXISTS idx_website_pageviews_country_day ON website_pageviews(country_code,visit_day DESC);
CREATE INDEX IF NOT EXISTS idx_website_pageviews_traffic_day ON website_pageviews(traffic_type,visit_day DESC);
