import { sql } from 'drizzle-orm';
import type { Database } from '../db/transaction.ts';
import { GameError } from './errors.ts';

export async function purgeExpiredEvent(db: Database, eventId: string, apply = false) {
  return db.transaction(async tx => {
    const event = (await tx.execute<{ eligible: boolean }>(sql`
      SELECT ((status='closed' OR closes_at<=clock_timestamp())
        AND coalesce(closed_at,closes_at)+interval '30 days'<=clock_timestamp()) AS eligible
      FROM event WHERE id=${eventId} FOR UPDATE`)).rows[0];
    if (!event) throw new GameError('event_not_found',404);
    if (!event.eligible) throw new GameError('retention_not_elapsed');
    if (!apply) return { eligible: true, deleted: false };
    await tx.execute(sql`DELETE FROM rate_limit_bucket WHERE participation_id IN (SELECT id FROM participation WHERE event_id=${eventId})`);
    await tx.execute(sql`DELETE FROM skill_selection WHERE participation_id IN (SELECT id FROM participation WHERE event_id=${eventId})`);
    await tx.execute(sql`DELETE FROM invitation WHERE event_id=${eventId}`);
    // Break the claim/code FK cycle only inside this event's deletion transaction.
    // No unspent code becomes visible: all matching codes are deleted before commit.
    await tx.execute(sql`UPDATE code SET redeemed_claim_id=NULL WHERE event_id=${eventId}`);
    await tx.execute(sql`DELETE FROM claim WHERE event_id=${eventId}`);
    await tx.execute(sql`DELETE FROM code WHERE event_id=${eventId}`);
    await tx.execute(sql`DELETE FROM card_cell WHERE participation_id IN (SELECT id FROM participation WHERE event_id=${eventId})`);
    await tx.execute(sql`DELETE FROM participation WHERE event_id=${eventId}`);
    await tx.execute(sql`DELETE FROM host_audit_event WHERE event_id=${eventId}`);
    await tx.execute(sql`DELETE FROM event_host WHERE event_id=${eventId}`);
    await tx.execute(sql`DELETE FROM event WHERE id=${eventId}`);
    // Square definitions are public and may be shared with another event.
    return { eligible: true, deleted: true };
  });
}
