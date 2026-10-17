import { sql } from 'drizzle-orm';
import type { Database } from '../db/transaction.ts';
import { requireHost } from '../game/host.ts';
import { standings } from './board.ts';

export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
export async function exportResults(db: Database, eventId: string, userId: string) {
  return db.transaction(async tx => {
    await requireHost(tx,eventId,userId);
    const players = await standings(tx,eventId);
    const consenting = (await tx.execute<{ id: string; auth_user_id: string; skills: string | null; peer_skills: string | null }>(sql`
      SELECT p.id,p.auth_user_id,string_agg(DISTINCT ss.skill_key,'; ' ORDER BY ss.skill_key) AS skills,
        (SELECT string_agg(DISTINCT s.skill_key,'; ' ORDER BY s.skill_key) FROM claim q JOIN square s ON s.id=q.square_id
          WHERE q.event_id=p.event_id AND q.confirmer_participation_id=p.id AND s.skill_key IS NOT NULL) AS peer_skills
      FROM participation p LEFT JOIN skill_selection ss ON ss.participation_id=p.id
      WHERE p.event_id=${eventId} AND p.recruitment_consent GROUP BY p.id,p.auth_user_id`)).rows;
    const consent = new Map(consenting.map(row => [row.id,row]));
    const header = ['Display name','Claims','Lines','Blackout','Recruitment opt-in','Follow-up account ID','Self-selected skills','Peer-confirmed self-reported skills'];
    const rows = players.map(player => {
      const person = consent.get(player.participationId);
      return [player.displayName,player.claimedCount,player.lineCount,player.blackout,Boolean(person),person?.auth_user_id ?? '',person?.skills ?? '',person?.peer_skills ?? ''];
    });
    await tx.execute(sql`INSERT INTO host_audit_event (event_id,actor_auth_user_id,action) VALUES (${eventId},${userId},'export')`);
    return '\uFEFF'+[header,...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  });
}
