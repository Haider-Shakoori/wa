import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { SessionStatus } from './session-status';
import { CreateSessionDto } from './sessions.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

type SessionRow = {
  id: string;
  organization_id: string;
  name: string;
  phone_hint: string | null;
  phone_number: string | null;
  display_name: string | null;
  whatsapp_jid: string | null;
  profile_picture_url: string | null;
  profile_synced_at: string | null;
  status: SessionStatus;
  worker_id: string | null;
  worker_lease_expires_at: string | null;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  connection_opened_at: string | null;
  reconnect_attempts: number;
  last_connection_error: string | null;
  created_at: string;
  updated_at: string;
};

const SESSION_SELECT = `
  id, organization_id, name, phone_hint, phone_number, display_name,
  whatsapp_jid, profile_picture_url, profile_synced_at, status, worker_id,
  worker_lease_expires_at, last_connected_at, last_disconnected_at,
  connection_opened_at, reconnect_attempts, last_connection_error,
  created_at, updated_at
`;

@Injectable()
export class SessionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async list(organizationId: string) {
    const result = await this.db.query<SessionRow>(
      `SELECT ${SESSION_SELECT}
       FROM whatsapp_sessions
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async create(organizationId: string, userId: string, input: CreateSessionDto) {
    const duplicate = await this.db.query<{ id: string }>(
      `SELECT id FROM whatsapp_sessions
       WHERE organization_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL
       LIMIT 1`,
      [organizationId, input.name.trim()],
    );
    if (duplicate.rowCount) throw new ConflictException('Session name already exists');

    await this.subscriptions.assertCanCreateSession(organizationId);

    const id = randomUUID();
    const result = await this.db.query<SessionRow>(
      `INSERT INTO whatsapp_sessions
        (id, organization_id, created_by_user_id, name, phone_hint, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING ${SESSION_SELECT}`,
      [id, organizationId, userId, input.name.trim(), input.phoneHint?.trim() || null],
    );

    return result.rows[0];
  }

  async get(organizationId: string, sessionId: string) {
    const result = await this.db.query<SessionRow>(
      `SELECT ${SESSION_SELECT}
       FROM whatsapp_sessions
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException('Session not found');
    return result.rows[0];
  }

  async requestLifecycle(
    organizationId: string,
    sessionId: string,
    action: 'connect' | 'restart' | 'logout',
  ) {
    await this.get(organizationId, sessionId);
    if (action !== 'logout') {
      await this.subscriptions.assertActive(organizationId);
    }
    const commandId = randomUUID();

    await this.db.query(
      `INSERT INTO whatsapp_session_commands
        (id, organization_id, session_id, command, status)
       VALUES ($1, $2, $3, $4, 'queued')`,
      [commandId, organizationId, sessionId, action],
    );

    return { commandId, sessionId, action, status: 'queued' as const };
  }
}
