import { endpoint, json, readBody, requireUser } from '../../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../../server/db/client.ts';
import { setRoundState } from '../../../../../server/game/host.ts';
export const prerender = false;
export const POST = endpoint(async (context,eventId) => {
  await readBody(context);
  return json(await setRoundState(getDatabase(),eventId,await requireUser(context),'open'));
});
