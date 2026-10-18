import { sql } from 'drizzle-orm';
import type { Database } from '../db/transaction.ts';
import { requireHost } from '../game/host.ts';

export async function revealSkills(db: Database, eventId: string, userId: string) {
  return db.transaction(async tx => {
    await requireHost(tx,eventId,userId);
    const skills = (await tx.execute(sql`
      SELECT s.skill_key AS "skillKey",s.label,count(DISTINCT q.confirmer_participation_id)::int AS "peerConfirmedCount",
        (SELECT count(DISTINCT ss.participation_id)::int FROM skill_selection ss JOIN participation p ON p.id=ss.participation_id
          WHERE p.event_id=${eventId} AND ss.skill_key=s.skill_key) AS "selfSelectedCount"
      FROM square s JOIN event e ON e.card_version=s.card_version
      LEFT JOIN claim q ON q.square_id=s.id AND q.event_id=e.id
      WHERE e.id=${eventId} AND s.skill_key IS NOT NULL
      GROUP BY s.skill_key,s.label ORDER BY count(DISTINCT q.confirmer_participation_id) DESC,s.label`)).rows;
    await tx.execute(sql`INSERT INTO host_audit_event (event_id,actor_auth_user_id,action) VALUES (${eventId},${userId},'reveal')`);
    return { description: 'Peer-confirmed, self-reported skills; not verified qualifications.', skills };
  });
}
