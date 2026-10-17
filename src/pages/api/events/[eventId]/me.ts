import { endpoint, json, requireUser } from '../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../server/db/client.ts';
import { tokenKeys } from '../../../../server/crypto/tokens.ts';
import { ownState } from '../../../../server/game/state.ts';
export const prerender = false;
export const GET = endpoint(async (context, eventId) => json(await ownState(getDatabase(), tokenKeys(), eventId, await requireUser(context))));
