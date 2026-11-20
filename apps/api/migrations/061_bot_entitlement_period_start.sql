-- Explicit billing-period start for accurate monthly reply quota accounting.
-- Existing rows remain NULL and fail closed in the held-outbox quota gate
-- until a verified renewal establishes an authoritative period.
ALTER TABLE relaywa_bot_entitlements
 ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
