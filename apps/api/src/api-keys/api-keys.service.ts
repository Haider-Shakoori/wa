import { encryptWebhookSecret, decryptWebhookSecret } from '../webhooks/webhook-crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { CreateApiKeyDto } from './api-keys.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async list(organizationId: string) {
    const result = await this.db.query(
      `SELECT id, organization_id, session_id, name, key_prefix, token_type,
              scopes, enabled, last_used_at, expires_at, revoked_at, created_at, (token_encrypted IS NOT NULL) AS viewable
       FROM api_keys
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async create(organizationId: string, userId: string, input: CreateApiKeyDto) {
    const tokenType = input.tokenType ?? (input.sessionId ? 'session' : 'organization');
    if (tokenType === 'session' && !input.sessionId) {
      throw new BadRequestException('sessionId is required for a session token');
    }
    if (tokenType === 'organization' && input.sessionId) {
      throw new BadRequestException('Organization API keys cannot be bound to a session');
    }
    if (!input.scopes?.length) throw new BadRequestException('At least one scope is required');

    if (input.sessionId) {
      const session = await this.db.query(
        `SELECT id FROM whatsapp_sessions
         WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [input.sessionId, organizationId],
      );
      if (!session.rows[0]) throw new NotFoundException('Session not found');
    }

    await this.subscriptions.assertCanCreateApiKey(organizationId);

    const prefix = tokenType === 'session' ? 'rw_session_' : 'rw_live_';
    const secret = randomBytes(32).toString('base64url');
    const token = `${prefix}${secret}`;
    const keyPrefix = token.slice(0, 20);
    const keyHash = createHash('sha256').update(token).digest('hex');

    const result = await this.db.query(
      `INSERT INTO api_keys
        (id, organization_id, created_by_user_id, session_id, name,
         key_prefix, key_hash, token_type, scopes, expires_at, token_encrypted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, organization_id, session_id, name, key_prefix,
                 token_type, scopes, enabled, expires_at, created_at`,
      [
        randomUUID(),
        organizationId,
        userId,
        input.sessionId ?? null,
        input.name.trim(),
        keyPrefix,
        keyHash,
        tokenType,
        [...new Set(input.scopes)],
        input.expiresAt ?? null,
        tokenType === 'session' ? encryptWebhookSecret(token) : null,
      ],
    );

    return { ...result.rows[0], token };
  }

  async reveal(organizationId: string, keyId: string) {
    const result = await this.db.query<{token_encrypted: string}>(
      `SELECT token_encrypted FROM api_keys WHERE id=$1 AND organization_id=$2
       AND session_id IS NOT NULL AND enabled AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())`, [keyId, organizationId]);
    if (!result.rows[0]?.token_encrypted) throw new NotFoundException('This key cannot be viewed. Create a new session key.');
    return {token: decryptWebhookSecret(result.rows[0].token_encrypted)};
  }

  async revoke(organizationId: string, keyId: string) {
    const result = await this.db.query(
      `UPDATE api_keys
       SET enabled = false, revoked_at = now(), updated_at = now()
       WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [keyId, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException('API key not found');
    return { id: keyId, revoked: true };
  }
}
