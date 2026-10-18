import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/transaction.ts';
import { encryptToken, newToken, normalizeToken, tokenDigest, type TokenKeys } from '../crypto/tokens.ts';
import { makeCard } from './card.ts';
import { GameError } from './errors.ts';

interface JoinInput { eventId: string; userId: string; displayName: string; invitation: string }
export async function joinEvent(db: Database, keys: TokenKeys, input: JoinInput) {
  input = { ...input, eventId: input.eventId.toLowerCase() };
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80 || /[\u0000-\u001f\u007f]/.test(displayName)) throw new GameError('display_name_invalid', 422);
  const lock = createHash('sha256').update(JSON.stringify(['gdgbingo:join:v1', input.eventId, input.userId])).digest().readBigInt64BE().toString();
  return db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL statement_timeout = '10s'`);
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lock}::bigint)`);
    const existing = await tx.execute<{ id: string }>(sql`SELECT id FROM participation WHERE event_id=${input.eventId} AND auth_user_id=${input.userId}`);
    if (existing.rows[0]) return { participationId: existing.rows[0].id, created: false };
    const event = (await tx.execute<{ status: string; card_version: string; code_allowance: number; expired: boolean }>(sql`
      SELECT status, card_version, code_allowance, (closes_at IS NOT NULL AND closes_at <= clock_timestamp()) AS expired
      FROM event WHERE id=${input.eventId} FOR SHARE`)).rows[0];
    if (!event) throw new GameError('event_not_found', 404);
    if (event.status === 'closed' || event.expired) throw new GameError('joining_closed');
    const digest = tokenDigest(keys, 'invitation', normalizeToken(input.invitation));
    // Shared invitations use compatible read locks so different players can join
    // concurrently. Single-use invitations retain their exclusive redemption lock.
    const shared = (await tx.execute<{ id: string; participation_id: string | null; expired: boolean; reusable: boolean }>(sql`
      SELECT id, participation_id, reusable, (expires_at IS NOT NULL AND expires_at <= clock_timestamp()) AS expired
      FROM invitation WHERE event_id=${input.eventId} AND token_digest=${digest} AND reusable FOR SHARE`)).rows[0];
    const invitation = shared ?? (await tx.execute<{ id: string; participation_id: string | null; expired: boolean; reusable: boolean }>(sql`
      SELECT id, participation_id, reusable, (expires_at IS NOT NULL AND expires_at <= clock_timestamp()) AS expired
      FROM invitation WHERE event_id=${input.eventId} AND token_digest=${digest} AND NOT reusable FOR UPDATE`)).rows[0];
    if (!invitation || invitation.expired || invitation.participation_id) throw new GameError('invitation_invalid', 422);
    const squares = await tx.execute<{ id: string }>(sql`SELECT id FROM square WHERE card_version=${event.card_version} ORDER BY square_key`);
    if (squares.rows.length !== 24) throw new GameError('event_not_ready', 503);
    const participationId = randomUUID();
    await tx.execute(sql`INSERT INTO participation (id,event_id,auth_user_id,display_name) VALUES (${participationId},${input.eventId},${input.userId},${displayName})`);
    const cells = makeCard(squares.rows.map(row => row.id));
    await tx.execute(sql`INSERT INTO card_cell (participation_id,position,square_id) VALUES ${sql.join(cells.map((squareId, position) => sql`(${participationId},${position},${squareId})`), sql`, `)}`);
    const issued = Array.from({ length: event.code_allowance }, (_, i) => {
      const id = randomUUID();
      const token = newToken();
      return sql`(${id},${input.eventId},${participationId},${tokenDigest(keys, 'code', token)},${encryptToken(keys, token, JSON.stringify([input.eventId, participationId, id]))},${i + 1})`;
    });
    await tx.execute(sql`INSERT INTO code (id,event_id,owner_participation_id,token_digest,token_ciphertext,ordinal) VALUES ${sql.join(issued, sql`, `)}`);
    if (!invitation.reusable) await tx.execute(sql`UPDATE invitation SET participation_id=${participationId} WHERE id=${invitation.id}`);
    return { participationId, created: true };
  });
}
