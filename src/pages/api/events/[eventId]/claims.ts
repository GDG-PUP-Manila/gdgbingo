import { endpoint, isUuid, json, readBody, requireUser } from '../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../server/db/client.ts';
import { tokenKeys } from '../../../../server/crypto/tokens.ts';
import { redeemClaim } from '../../../../server/game/claim.ts';
import { GameError } from '../../../../server/game/errors.ts';
export const prerender = false;
export const POST = endpoint(async (context, eventId) => {
  const body = await readBody(context);
  const userId = await requireUser(context);
  if (typeof body.squareKey !== 'string' || !/^[a-z0-9-]{1,64}$/.test(body.squareKey)
    || typeof body.code !== 'string' || body.code.length > 80
    || typeof body.requestId !== 'string' || !isUuid(body.requestId)) throw new GameError('invalid_input', 422);
  const result = await redeemClaim(getDatabase(), tokenKeys(), { eventId, userId, squareKey: body.squareKey, code: body.code, requestId: body.requestId });
  return json(result, result.replayed ? 200 : 201);
});
