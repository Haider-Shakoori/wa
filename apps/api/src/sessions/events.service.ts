import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, concatMap, from, interval, map, startWith } from 'rxjs';
import { DatabaseService } from '../database/database.service';

type EventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

@Injectable()
export class EventsService {
  constructor(private readonly db: DatabaseService) {}

  stream(organizationId: string, sessionId: string): Observable<MessageEvent> {
    let lastId = 0;

    return interval(1000).pipe(
      startWith(0),
      concatMap(() =>
        from(
          this.db.query<EventRow>(
            `SELECT id::text, event_type, payload, created_at::text
             FROM whatsapp_session_events
             WHERE organization_id = $1 AND session_id = $2 AND id > $3
             ORDER BY id ASC
             LIMIT 100`,
            [organizationId, sessionId, lastId],
          ),
        ),
      ),
      map((result) => {
        const events = result.rows.map((row) => {
          lastId = Math.max(lastId, Number(row.id));
          return {
            id: row.id,
            type: row.event_type,
            payload: row.payload,
            createdAt: row.created_at,
          };
        });

        return {
          type: events.length ? 'relaywa.events' : 'relaywa.heartbeat',
          data: events,
          retry: 2000,
        };
      }),
    );
  }
}
