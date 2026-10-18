import { sql } from 'drizzle-orm';
import type { Database } from '../db/transaction.ts';
import { GameError } from '../game/errors.ts';

export async function consumeClaimLimit(db: Database, participationId: string) {
  const allowed = await db.transaction(async tx => {
    const result = await tx.execute(sql`
      INSERT INTO rate_limit_bucket (participation_id,bucket_key,tokens,refilled_at,expires_at)
      VALUES (${participationId},'claim',9,clock_timestamp(),clock_timestamp()+interval '1 day')
      ON CONFLICT (participation_id,bucket_key) DO UPDATE
      SET tokens=least(10,rate_limit_bucket.tokens+floor(greatest(0,extract(epoch from (clock_timestamp()-rate_limit_bucket.refilled_at)))/6)::int)-1,
          refilled_at=rate_limit_bucket.refilled_at + floor(greatest(0,extract(epoch from (clock_timestamp()-rate_limit_bucket.refilled_at)))/6)*interval '6 seconds',
          expires_at=clock_timestamp()+interval '1 day'
      WHERE least(10,rate_limit_bucket.tokens+floor(greatest(0,extract(epoch from (clock_timestamp()-rate_limit_bucket.refilled_at)))/6)::int)>=1
      RETURNING participation_id`);
    return result.rows.length > 0;
  });
  if (!allowed) throw new GameError('rate_limited', 429);
}
