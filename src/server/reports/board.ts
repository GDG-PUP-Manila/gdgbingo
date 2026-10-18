import { sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/transaction.ts';
import { scoreCard } from '../game/card.ts';
import { requireHost } from '../game/host.ts';
import { GameError } from '../game/errors.ts';

export async function standings(tx: Transaction, eventId: string) {
  const players = (await tx.execute<{ id: string; display_name: string; codes_remaining: number }>(sql`
    SELECT p.id,p.display_name,(SELECT count(*)::int FROM code c WHERE c.owner_participation_id=p.id AND c.redeemed_claim_id IS NULL) AS codes_remaining
    FROM participation p WHERE p.event_id=${eventId}`)).rows;
  const claims = (await tx.execute<{ claimant_participation_id: string; position: number; created_at: string }>(sql`
    SELECT q.claimant_participation_id,c.position,q.created_at::text FROM claim q
    JOIN card_cell c ON c.participation_id=q.claimant_participation_id AND c.square_id=q.square_id
    WHERE q.event_id=${eventId} ORDER BY q.created_at,q.id`)).rows;
  const histories = new Map<string, { positions: number[]; firstLineAt: string | null }>();
  for (const claim of claims) {
    const history = histories.get(claim.claimant_participation_id) ?? { positions: [], firstLineAt: null };
    history.positions.push(claim.position);
    if (!history.firstLineAt && scoreCard(history.positions).lineCount > 0) history.firstLineAt = claim.created_at;
    histories.set(claim.claimant_participation_id, history);
  }
  return players.map(player => ({
    participationId: player.id, displayName: player.display_name, codesRemaining: player.codes_remaining,
    ...scoreCard(histories.get(player.id)?.positions ?? []), firstLineAt: histories.get(player.id)?.firstLineAt ?? null,
  })).sort((a,b) => b.lineCount-a.lineCount || b.claimedCount-a.claimedCount || a.displayName.localeCompare(b.displayName) || a.participationId.localeCompare(b.participationId));
}
async function eventState(tx: Transaction, eventId: string) {
    const event = (await tx.execute<{ title: string; status: string; opens_at: Date | null; closes_at: Date | null; expired: boolean }>(sql`
      SELECT title,status,opens_at,closes_at,(closes_at IS NOT NULL AND closes_at<=clock_timestamp()) AS expired FROM event WHERE id=${eventId}`)).rows[0];
    if (!event) throw new GameError('event_not_found', 404);
    return { id:eventId,title:event.title,status:event.expired?'closed':event.status,opensAt:event.opens_at,closesAt:event.closes_at };
}
export async function publicBoard(db: Database, eventId: string, page = 1) {
  return db.transaction(async tx => {
    const event = await eventState(tx,eventId);
    const all = await standings(tx, eventId);
    return {
      event,
      page, total: all.length,
      players: all.slice((page-1)*100,page*100).map(player => ({ displayName: player.displayName, claimedCount: player.claimedCount, lineCount: player.lineCount, blackout: player.blackout, codesRemaining: player.codesRemaining })),
    };
  });
}
export async function hostStandings(db: Database, eventId: string, userId: string) {
  return db.transaction(async tx => {
    await requireHost(tx,eventId,userId);
    const event = await eventState(tx,eventId);
    const players = await standings(tx,eventId);
    const earliest = players.map(player => player.firstLineAt).filter((time): time is string => Boolean(time)).sort()[0];
    return { event, players, firstLineWinners: earliest ? players.filter(player => player.firstLineAt === earliest).map(player => player.participationId) : [], tiePolicy: 'Equal first-line times share qualification.' };
  });
}
