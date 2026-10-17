import { endpoint, requireUser } from '../../../../../server/http/endpoint.ts';
import { getDatabase } from '../../../../../server/db/client.ts';
import { exportResults } from '../../../../../server/reports/export.ts';
export const prerender = false;
export const GET = endpoint(async (context,eventId) => new Response(await exportResults(getDatabase(),eventId,await requireUser(context)), { headers: {
  'Content-Type':'text/csv; charset=utf-8', 'Cache-Control':'private, no-store',
  'Content-Disposition':'attachment; filename="gdg-bingo-results.csv"',
  'X-Content-Type-Options':'nosniff',
} }));
