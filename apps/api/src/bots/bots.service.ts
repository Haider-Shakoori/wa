import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { CreateBotDto, CreateFaqDto } from './bots.dto';

@Injectable()
export class BotsService {
  constructor(private readonly db: DatabaseService) {}

  async list(org: string) {
    const result = await this.db.query(
      'SELECT id,name,session_id,mode,created_at,updated_at FROM relaywa_bots WHERE organization_id=$1 ORDER BY created_at DESC',
      [org],
    );
    return result.rows;
  }

  async create(org: string, user: string, body: CreateBotDto) {
    const session = await this.db.query(
      'SELECT id,worker_id FROM whatsapp_sessions WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',
      [body.sessionId, org],
    );
    if (!session.rowCount) throw new NotFoundException('WhatsApp session not found');
    // A bot is never automatically activated and never moves session ownership.
    const id = randomUUID();
    try {
      const result = await this.db.query(
        `INSERT INTO relaywa_bots(id,organization_id,session_id,created_by_user_id,name,mode)
         VALUES($1,$2,$3,$4,$5,'standby')
         RETURNING id,name,session_id,mode,created_at,updated_at`,
        [id, org, body.sessionId, user, body.name.trim()],
      );
      return result.rows[0];
    } catch (error) {
      if ((error as {code?:string}).code === '23505') throw new ConflictException('A bot already exists for this session');
      throw error;
    }
  }

  async get(org: string, id: string) {
    const result = await this.db.query(
      'SELECT id,name,session_id,mode,created_at,updated_at FROM relaywa_bots WHERE id=$1 AND organization_id=$2',
      [id,org],
    );
    if (!result.rowCount) throw new NotFoundException('Bot not found');
    return result.rows[0];
  }

  async faqs(org: string, id: string) {
    await this.get(org,id);
    const result = await this.db.query(
      `SELECT id,question,answer,aliases,created_at,updated_at FROM relaywa_bot_faqs
       WHERE bot_id=$1 AND organization_id=$2 ORDER BY created_at,id`,[id,org],
    );
    return result.rows;
  }

  async addFaq(org: string, id: string, body: CreateFaqDto) {
    await this.get(org,id);
    if ((body.aliases ?? []).length > 20 || (body.aliases ?? []).some(a => typeof a !== 'string' || a.length > 200 || !a.trim())) {
      throw new BadRequestException('Invalid FAQ aliases');
    }
    const result = await this.db.query(
      `INSERT INTO relaywa_bot_faqs(id,organization_id,bot_id,question,answer,aliases)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)
       RETURNING id,question,answer,aliases,created_at,updated_at`,
      [randomUUID(),org,id,body.question.trim(),body.answer.trim(),JSON.stringify(body.aliases ?? [])],
    );
    return result.rows[0];
  }

  async removeFaq(org: string, botId: string, faqId: string) {
    await this.get(org,botId);
    const result = await this.db.query(
      'DELETE FROM relaywa_bot_faqs WHERE id=$1 AND bot_id=$2 AND organization_id=$3 RETURNING id',
      [faqId,botId,org],
    );
    if (!result.rowCount) throw new NotFoundException('FAQ not found');
    return {deleted:true};
  }
}
