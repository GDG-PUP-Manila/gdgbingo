import type { APIRoute } from 'astro';

export const prerender = false;
export const GET: APIRoute = () => new Response(JSON.stringify({
  workspace: 'phase1-spike',
  liveGame: false,
}), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control': 'public, s-maxage=10',
  },
});
