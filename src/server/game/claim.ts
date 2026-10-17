import { createHash, randomInt, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/transaction.ts';
import { normalizeToken, tokenDigest, type TokenKeys } from '../crypto/tokens.ts';
import { GameError } from './errors.ts';
import { scoreCard } from './card.ts';
import { consumeClaimLimit } from '../ratelimit/consume.ts';

interface ClaimInput { eventId: string; userId: string; squareKey: string; code: string; requestId: string }
export async function progress(tx: Transaction, eventId: string, participationId: string) {
  const rows = (await tx.execute<{ position: number }>(sql`
    SELECT c.position FROM card_cell c JOIN claim q ON q.square_id=c.square_id
    AND q.claimant_participation_id=c.participation_id
    WHERE q.event_id=${eventId} AND c.participation_id=${participationId}`)).rows;
  return scoreCard(rows.map(row => row.position));
}
function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return;
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('cause' in error) return sqlState(error.cause);
}
function constraintName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return;
  if ('constraint' in error && typeof error.constraint === 'string') return error.constraint;
  if ('cause' in error) return constraintName(error.cause);
}
export async function redeemClaim(db: Database, keys: TokenKeys, input: ClaimInput) {
  input = { ...input, eventId: input.eventId.toLowerCase(), requestId: input.requestId.toLowerCase() };
  const participation = await db.transaction(async tx => (await tx.execute<{ id: string }>(sql`
    SELECT id FROM participation WHERE event_id=${input.eventId} AND auth_user_id=${input.userId}`)).rows[0]);
  if (!participation) throw new GameError('participation_required', 403);
  await consumeClaimLimit(db, participation.id);
  const code = normalizeToken(input.code);
  const hash = tokenDigest(keys, 'request', JSON.stringify([input.squareKey, code]));
  const lock = createHash('sha256').update(JSON.stringify(['gdgbingo:claim:v1', input.eventId, participation.id, input.requestId])).digest().readBigInt64BE().toString();
  async function replay(tx: Transaction) {
    const row = (await tx.execute<{ id: string; request_hash: Buffer }>(sql`
      SELECT id,request_hash FROM claim WHERE event_id=${input.eventId}
      AND claimant_participation_id=${participation!.id} AND request_id=${input.requestId}`)).rows[0];
    if (!row) return;
    if (!row.request_hash.equals(hash)) throw new GameError('request_id_reused');
    return { claimId: row.id, replayed: true, progress: await progress(tx, input.eventId, participation!.id) };
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.transaction(async tx => {
        await tx.execute(sql`SET LOCAL statement_timeout = '10s'`);
        await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${lock}::bigint)`);
        const original = await replay(tx);
        if (original) return original;
        await tx.execute(sql`SELECT id FROM event WHERE id=${input.eventId} FOR SHARE`);
        const timing = (await tx.execute<{ open: boolean }>(sql`
          SELECT (status='open' AND closed_at IS NULL AND opens_at<=clock_timestamp()
            AND closes_at>clock_timestamp()) AS open FROM event WHERE id=${input.eventId}`)).rows[0];
        if (!timing?.open) throw new GameError('round_not_open');
        const square = (await tx.execute<{ id: string }>(sql`
          SELECT s.id FROM card_cell c JOIN square s ON s.id=c.square_id
          WHERE c.participation_id=${participation.id} AND s.square_key=${input.squareKey}`)).rows[0];
        if (!square) throw new GameError('square_invalid', 422);
        const found = (await tx.execute<{ id: string; owner_participation_id: string; redeemed_claim_id: string | null }>(sql`
          SELECT id,owner_participation_id,redeemed_claim_id FROM code
          WHERE event_id=${input.eventId} AND token_digest=${tokenDigest(keys, 'code', code)} FOR UPDATE`)).rows[0];
        if (!found) throw new GameError('code_invalid', 404);
        if (found.owner_participation_id === participation.id) throw new GameError('self_claim', 422);
        if (found.redeemed_claim_id) throw new GameError('code_spent');
        const claimId = randomUUID();
        const accepted = await tx.execute(sql`WITH admission AS MATERIALIZED (SELECT clock_timestamp() AS at)
          INSERT INTO claim (id,event_id,claimant_participation_id,confirmer_participation_id,square_id,code_id,request_id,request_hash,created_at)
          SELECT ${claimId},${input.eventId},${participation.id},${found.owner_participation_id},${square.id},${found.id},${input.requestId},${hash},admission.at
          FROM admission JOIN event e ON e.id=${input.eventId}
          WHERE e.status='open' AND e.closed_at IS NULL AND e.opens_at<=admission.at AND e.closes_at>admission.at RETURNING id`);
        if (!accepted.rows.length) throw new GameError('round_not_open');
        await tx.execute(sql`UPDATE code SET redeemed_claim_id=${claimId} WHERE id=${found.id}`);
        return { claimId, replayed: false, progress: await progress(tx, input.eventId, participation.id) };
      });
    } catch (error) {
      if (error instanceof GameError) throw error;
      const state = sqlState(error);
      // A failed transaction has already rolled back before any recovery query.
      if (state === '23505') {
        return db.transaction(async tx => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${lock}::bigint)`);
          const original = await replay(tx);
          if (original) return original;
          const constraint = constraintName(error);
          if (constraint === 'claim_square_unique') throw new GameError('square_already_claimed');
          if (constraint === 'claim_code_unique') throw new GameError('code_spent');
          throw new GameError('claim_outcome_unconfirmed', 503);
        });
      }
      if (['40P01','40001'].includes(state ?? '') && attempt < 3) { await delay(20 + attempt * 30 + randomInt(20)); continue; }
      // Network/COMMIT acknowledgement loss is deliberately not auto-retried.
      // The browser must keep this request ID and resolve the outcome by replay.
      throw new GameError('claim_outcome_unconfirmed', 503);
    }
  }
  throw new GameError('claim_outcome_unconfirmed', 503);
}
