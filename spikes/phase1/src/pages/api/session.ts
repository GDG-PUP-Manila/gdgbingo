import type { APIRoute } from 'astro';
import { sessionResponse } from '../../server/auth-adapter.mjs';

export const prerender = false;
export const GET: APIRoute = context => sessionResponse(context);
