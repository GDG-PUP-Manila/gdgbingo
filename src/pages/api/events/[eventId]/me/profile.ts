import { endpoint, json, readBody, requireUser } from '../../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../../server/db/client.ts';
import { saveProfile } from '../../../../../server/game/profile.ts';
import { GameError } from '../../../../../server/game/errors.ts';
export const prerender = false;
export const PATCH = endpoint(async (context,eventId) => {
  const body = await readBody(context);
  const userId = await requireUser(context);
  if (typeof body.recruitmentConsent !== 'boolean' || !Array.isArray(body.skills) || body.skills.length>24
    || body.skills.some(skill => typeof skill !== 'string' || skill.length>64)) throw new GameError('invalid_input',422);
  return json(await saveProfile(getDatabase(),eventId,userId,body.recruitmentConsent,body.skills));
});
