import { sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/transaction.ts';
import { GameError } from './errors.ts';

export async function requireHost(tx: Transaction, eventId: string, userId: string) {
  const host = await tx.execute(sql`SELECT 1 FROM event_host WHERE event_id=${eventId} AND auth_user_id=${userId}`);
  if (!host.rows.length) throw new GameError('host_required', 403);
}
export async function setRoundState(db: Database, eventId: string, userId: string, action: 'open' | 'close') {
  return db.transaction(async tx => {
    await requireHost(tx, eventId, userId);
    const current = (await tx.execute<{ status: string }>(sql`SELECT status FROM event WHERE id=${eventId} FOR UPDATE`)).rows[0];
    if (!current) throw new GameError('event_not_found', 404);
    if (action === 'open' && current.status !== 'draft') throw new GameError('round_already_started');
    if (action === 'close' && current.status === 'draft') throw new GameError('round_not_open');
    if (action === 'close' && current.status === 'closed') return { status: 'closed' };
    const result = action === 'open'
      ? await tx.execute(sql`UPDATE event SET status='open',opens_at=clock_timestamp(),closes_at=clock_timestamp()+interval '12 minutes',closed_at=NULL WHERE id=${eventId} RETURNING status,opens_at,closes_at`)
      : await tx.execute(sql`UPDATE event SET status='closed',closed_at=clock_timestamp() WHERE id=${eventId} RETURNING status,closed_at`);
    await tx.execute(sql`INSERT INTO host_audit_event (event_id,actor_auth_user_id,action) VALUES (${eventId},${userId},${action})`);
    return result.rows[0];
  });
}
