import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { encryptWebhookSecret } from './webhook-crypto';
import { validateWebhookUrl } from './webhook-url';
import { CreateWebhookDto, UpdateWebhookDto } from './webhooks.dto';

type EndpointRow = {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  event_types: string[];
  enabled: boolean;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class WebhooksService {
  constructor(private readonly db: DatabaseService) {}

  async list(organizationId: string) {
    const result = await this.db.query<EndpointRow>(
      `SELECT id, organization_id, name, url, event_types, enabled,
              consecutive_failures, last_success_at, last_failure_at,
              created_at, updated_at
       FROM webhook_endpoints
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async create(organizationId: string, input: CreateWebhookDto) {
    const duplicate = await this.db.query(
      `SELECT id FROM webhook_endpoints
       WHERE organization_id = $1 AND lower(name) = lower($2)
       LIMIT 1`,
      [organizationId, input.name.trim()],
    );
    if (duplicate.rowCount) throw new ConflictException('Webhook name already exists');

    const secret = randomBytes(32).toString('base64url');
    const result = await this.db.query<EndpointRow>(
      `INSERT INTO webhook_endpoints
        (id, organization_id, name, url, secret_encrypted, event_types)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, organization_id, name, url, event_types, enabled,
                 consecutive_failures, last_success_at, last_failure_at,
                 created_at, updated_at`,
      [
        randomUUID(),
        organizationId,
        input.name.trim(),
        validateWebhookUrl(input.url),
        encryptWebhookSecret(secret),
        normalizeEventTypes(input.eventTypes),
      ],
    );
    return { ...result.rows[0], secret };
  }

  async update(organizationId: string, endpointId: string, input: UpdateWebhookDto) {
    const current = await this.get(organizationId, endpointId);
    const result = await this.db.query<EndpointRow>(
      `UPDATE webhook_endpoints
       SET name = $1, url = $2, event_types = $3, enabled = $4, updated_at = now()
       WHERE id = $5 AND organization_id = $6
       RETURNING id, organization_id, name, url, event_types, enabled,
                 consecutive_failures, last_success_at, last_failure_at,
                 created_at, updated_at`,
      [
        input.name?.trim() ?? current.name,
        input.url ? validateWebhookUrl(input.url) : current.url,
        input.eventTypes ? normalizeEventTypes(input.eventTypes) : current.event_types,
        input.enabled ?? current.enabled,
        endpointId,
        organizationId,
      ],
    );
    return result.rows[0];
  }

  async remove(organizationId: string, endpointId: string) {
    const result = await this.db.query(
      `DELETE FROM webhook_endpoints
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [endpointId, organizationId],
    );
    if (!result.rowCount) throw new NotFoundException('Webhook not found');
    return { id: endpointId, deleted: true };
  }

  async deliveries(organizationId: string, endpointId: string) {
    await this.get(organizationId, endpointId);
    const result = await this.db.query(
      `SELECT id, endpoint_id, session_event_id, status, attempts,
              next_attempt_at, response_status, response_body, last_error,
              queued_at, delivered_at, failed_at, updated_at
       FROM webhook_deliveries
       WHERE endpoint_id = $1 AND organization_id = $2
       ORDER BY queued_at DESC
       LIMIT 100`,
      [endpointId, organizationId],
    );
    return result.rows;
  }

  private async get(organizationId: string, endpointId: string) {
    const result = await this.db.query<EndpointRow>(
      `SELECT id, organization_id, name, url, event_types, enabled,
              consecutive_failures, last_success_at, last_failure_at,
              created_at, updated_at
       FROM webhook_endpoints
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [endpointId, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException('Webhook not found');
    return result.rows[0];
  }
}

function normalizeEventTypes(values?: string[]) {
  const normalized = [...new Set((values?.length ? values : ['*']).map((value) => value.trim()).filter(Boolean))];
  return normalized.length ? normalized : ['*'];
}
