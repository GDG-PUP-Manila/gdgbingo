import { endpoint, json, requireUser } from '../../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../../server/db/client.ts';
import { hostStandings } from '../../../../../server/reports/board.ts';
export const prerender = false;
export const GET = endpoint(async (context,eventId) => json(await hostStandings(getDatabase(),eventId,await requireUser(context))));
