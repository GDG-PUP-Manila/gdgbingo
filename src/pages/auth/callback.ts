import type { APIRoute } from 'astro';
import { callbackResponse } from '../../server/auth-adapter.mjs';

export const prerender = false;
export const GET: APIRoute = context => callbackResponse(context);
