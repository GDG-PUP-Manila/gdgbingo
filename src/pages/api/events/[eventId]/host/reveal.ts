import { endpoint, json, requireUser } from '../../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../../server/db/client.ts';
import { revealSkills } from '../../../../../server/reports/reveal.ts';
export const prerender = false;
export const GET = endpoint(async (context,eventId) => json(await revealSkills(getDatabase(),eventId,await requireUser(context))));
