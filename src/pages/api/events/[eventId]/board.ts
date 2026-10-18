import { endpoint } from '../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../server/db/client.ts';
import { publicBoard } from '../../../../server/reports/board.ts';
import { GameError } from '../../../../server/game/errors.ts';
export const prerender = false;
// Public DTO only: deliberately never resolves a session or reads cookies.
export const GET = endpoint(async (context,eventId) => {
  const page = Number(context.url.searchParams.get('page') ?? '1');
  if (!Number.isInteger(page) || page < 1 || page > 100) throw new GameError('page_invalid',422);
  return new Response(JSON.stringify(await publicBoard(getDatabase(),eventId,page)), { headers: {
    'Content-Type':'application/json', 'Cache-Control':'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control':'public, s-maxage=10', 'X-Content-Type-Options':'nosniff',
  } });
});
