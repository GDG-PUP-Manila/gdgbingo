import type { APIRoute } from 'astro';
import { proxyResponse } from '../../../server/auth-adapter.mjs';

export const prerender = false;
export const ALL: APIRoute = context => proxyResponse(context);
