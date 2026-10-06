import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DirectoryService {
  constructor(private readonly db: DatabaseService) {}

  private async assertSession(organizationId: string, sessionId: string) {
    const result = await this.db.query(
      `SELECT id FROM whatsapp_sessions
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException('Session not found');
  }

  async contacts(organizationId: string, sessionId: string) {
    await this.assertSession(organizationId, sessionId);
    const result = await this.db.query(
      `SELECT jid, phone_number, display_name, notify_name, verified_name,
              is_business, updated_at
       FROM whatsapp_contacts
       WHERE organization_id = $1 AND session_id = $2
       ORDER BY COALESCE(display_name, notify_name, verified_name, jid) ASC
       LIMIT 500`,
      [organizationId, sessionId],
    );
    return result.rows;
  }

  async chats(organizationId: string, sessionId: string) {
    await this.assertSession(organizationId, sessionId);
    const result = await this.db.query(
      `SELECT jid, chat_type, name, unread_count, last_message_at, updated_at
       FROM whatsapp_chats
       WHERE organization_id = $1 AND session_id = $2
       ORDER BY last_message_at DESC NULLS LAST, updated_at DESC
       LIMIT 500`,
      [organizationId, sessionId],
    );
    return result.rows;
  }

  async groups(organizationId: string, sessionId: string) {
    await this.assertSession(organizationId, sessionId);
    const result = await this.db.query(
      `SELECT jid, subject, owner_jid, participant_count, announce,
              restrict_members, updated_at
       FROM whatsapp_groups
       WHERE organization_id = $1 AND session_id = $2
       ORDER BY COALESCE(subject, jid) ASC
       LIMIT 500`,
      [organizationId, sessionId],
    );
    return result.rows;
  }
}
