import { endpoint, json, readBody, requireUser } from '../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../server/db/client.ts';
import { tokenKeys } from '../../../../server/crypto/tokens.ts';
import { joinEvent } from '../../../../server/game/join.ts';
import { GameError } from '../../../../server/game/errors.ts';
export const prerender = false;

export const POST = endpoint(async (context, eventId) => {
  const body = await readBody(context);
  const userId = await requireUser(context);
  if (typeof body.invitation !== 'string' || body.invitation.length > 80 || typeof body.displayName !== 'string') throw new GameError('invalid_input', 422);
  const result = await joinEvent(getDatabase(), tokenKeys(), { eventId, userId, invitation: body.invitation, displayName: body.displayName });
  return json(result, result.created ? 201 : 200);
});
