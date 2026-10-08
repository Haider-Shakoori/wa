-- Bot validation is separate from user agent classification, and tests stay auditable.
ALTER TABLE website_pageviews ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false;
ALTER TABLE website_pageviews ADD COLUMN IF NOT EXISTS bot_verification varchar(16) NOT NULL DEFAULT 'not_checked';
ALTER TABLE website_pageviews ADD CONSTRAINT website_pageviews_bot_verification_check
 CHECK (bot_verification IN ('verified','unverified','not_checked'));

CREATE TABLE IF NOT EXISTS website_bot_ranges (
  family varchar(50) NOT NULL,
  address_range cidr NOT NULL,
  PRIMARY KEY(family,address_range)
);
CREATE TABLE IF NOT EXISTS website_bot_range_sources (
  family varchar(50) PRIMARY KEY,
  refreshed_at timestamptz NOT NULL,
  prefix_count integer NOT NULL CHECK (prefix_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_website_pageviews_included_day
  ON website_pageviews(visit_day DESC) WHERE is_excluded = false;
