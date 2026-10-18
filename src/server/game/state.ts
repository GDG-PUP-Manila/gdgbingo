import { sql } from 'drizzle-orm';
import type { Database } from '../db/transaction.ts';
import { decryptToken, type TokenKeys } from '../crypto/tokens.ts';
import { GameError } from './errors.ts';
import { scoreCard } from './card.ts';

export async function ownState(db: Database, keys: TokenKeys, eventId: string, userId: string) {
  eventId = eventId.toLowerCase();
  return db.transaction(async tx => {
    const participation = (await tx.execute<{ id: string; display_name: string; recruitment_consent: boolean }>(sql`
      SELECT id,display_name,recruitment_consent FROM participation WHERE event_id=${eventId} AND auth_user_id=${userId}`)).rows[0];
    if (!participation) throw new GameError('participation_required', 403);
    const card = (await tx.execute<{ position: number; squareKey: string | null; label: string | null; skillKey: string | null; claimed: boolean }>(sql`
      SELECT c.position,s.square_key AS "squareKey",s.label,s.skill_key AS "skillKey",
      EXISTS(SELECT 1 FROM claim q WHERE q.event_id=${eventId} AND q.claimant_participation_id=${participation.id} AND q.square_id=c.square_id) AS claimed
      FROM card_cell c LEFT JOIN square s ON s.id=c.square_id WHERE c.participation_id=${participation.id} ORDER BY c.position`)).rows;
    const privateCodes = (await tx.execute<{ id: string; ordinal: number; token_ciphertext: Buffer; spent: boolean }>(sql`
      SELECT id,ordinal,token_ciphertext,(redeemed_claim_id IS NOT NULL) AS spent FROM code
      WHERE event_id=${eventId} AND owner_participation_id=${participation.id} ORDER BY ordinal`)).rows;
    const skills = (await tx.execute<{ skill_key: string }>(sql`SELECT skill_key FROM skill_selection WHERE participation_id=${participation.id} ORDER BY skill_key`)).rows.map(row => row.skill_key);
    return {
      participationId: participation.id, displayName: participation.display_name,
      recruitmentConsent: participation.recruitment_consent, skills, card,
      codes: privateCodes.map(code => ({ ordinal: code.ordinal, spent: code.spent,
        token: decryptToken(keys, code.token_ciphertext, JSON.stringify([eventId, participation.id, code.id])) })),
      progress: scoreCard(card.filter(cell => cell.claimed).map(cell => cell.position)),
    };
  });
}
