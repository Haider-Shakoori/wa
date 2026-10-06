import { Injectable, NotFoundException } from '@nestjs/common';
import QRCode from 'qrcode';
import { DatabaseService } from '../database/database.service';

type QrRow = {
  id: string;
  status: string;
  qr_code: string | null;
  qr_expires_at: string | null;
};

@Injectable()
export class QrService {
  constructor(private readonly db: DatabaseService) {}

  async get(organizationId: string, sessionId: string) {
    const result = await this.db.query<QrRow>(
      `SELECT id, status, qr_code, qr_expires_at
       FROM whatsapp_sessions
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, organizationId],
    );
    const session = result.rows[0];
    if (!session) throw new NotFoundException('Session not found');

    const expired = session.qr_expires_at
      ? new Date(session.qr_expires_at).getTime() <= Date.now()
      : true;

    if (!session.qr_code || expired) {
      return {
        sessionId,
        status: session.status,
        available: false,
        expiresAt: session.qr_expires_at,
      };
    }

    return {
      sessionId,
      status: session.status,
      available: true,
      qr: session.qr_code,
      dataUrl: await QRCode.toDataURL(session.qr_code, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 360,
      }),
      expiresAt: session.qr_expires_at,
    };
  }
}
