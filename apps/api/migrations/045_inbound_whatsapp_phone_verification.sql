-- Registration challenges are tenant-scoped; tokens are stored as hashes, never plaintext.
CREATE TABLE IF NOT EXISTS whatsapp_phone_verifications (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_e164 varchar(16) NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'pending',
  inbound_message_id varchar(255) UNIQUE,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_phone_verifications_status_check
    CHECK (status IN ('pending','verified','consumed'))
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_verifications_org_created
  ON whatsapp_phone_verifications (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_verifications_org_phone
  ON whatsapp_phone_verifications (organization_id, phone_e164, created_at DESC);
