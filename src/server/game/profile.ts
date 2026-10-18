import { sql } from 'drizzle-orm';
import type { Database } from '../db/transaction.ts';
import { GameError } from './errors.ts';

export async function saveProfile(db: Database, eventId: string, userId: string, consent: boolean, skills: string[]) {
  return db.transaction(async tx => {
    const participation = (await tx.execute<{ id: string }>(sql`SELECT id FROM participation WHERE event_id=${eventId} AND auth_user_id=${userId} FOR UPDATE`)).rows[0];
    if (!participation) throw new GameError('participation_required',403);
    const valid = (await tx.execute<{ skill_key: string }>(sql`SELECT DISTINCT s.skill_key FROM square s JOIN event e ON e.card_version=s.card_version WHERE e.id=${eventId} AND s.skill_key IS NOT NULL`)).rows.map(row => row.skill_key);
    if (skills.some(skill => !valid.includes(skill))) throw new GameError('skills_invalid',422);
    await tx.execute(sql`UPDATE participation SET recruitment_consent=${consent},consent_at=CASE WHEN ${consent} THEN coalesce(consent_at,clock_timestamp()) ELSE NULL END WHERE id=${participation.id}`);
    await tx.execute(sql`DELETE FROM skill_selection WHERE participation_id=${participation.id}`);
    if (skills.length) await tx.execute(sql`INSERT INTO skill_selection (participation_id,skill_key) VALUES ${sql.join([...new Set(skills)].map(skill => sql`(${participation.id},${skill})`),sql`, `)}`);
    return { recruitmentConsent: consent, skills: [...new Set(skills)] };
  });
}
